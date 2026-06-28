import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  Barcode, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Plus, 
  Minus, 
  Play, 
  Volume2, 
  HelpCircle,
  RefreshCw,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';
import { Product, Transaction, TransactionType, ReturnStatus, UserProfile } from '../types';

interface SmartScannerProps {
  products: Product[];
  onRecordMultipleTransactions: (txs: Omit<Transaction, 'id' | 'date'>[]) => Promise<void>;
  canRecordTransactions?: boolean;
  currentUser?: UserProfile;
}

interface ScannedItem {
  sku: string;
  productName: string;
  quantity: number;
  matched: boolean;
  matchedProduct: {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unit: string;
    location: string;
  } | null;
  selectedAction: TransactionType;
  selectedReturnStatus?: ReturnStatus;
  selectedReason: string;
  multiplier?: number;
  multiplierReason?: string;
}

// Helper to parse promotion/bundle multiplier from SKU or Name (e.g. "5 แถม 2" or "ซื้อ 5 แถม 2" -> 7, or "5+2" -> 7, or "แพ็ค 12" -> 12)
function parsePromoMultiplier(sku: string, name: string): { multiplier: number; reason: string } {
  const combined = `${sku || ''} ${name || ''}`.toLowerCase();
  
  // Pattern 1: X แถม Y or XแถมY (e.g. 5 แถม 2, 5แถม2, ซื้อ 5 แถม 2, ซื้อ5แถม2)
  const thaiPromoMatch = combined.match(/(\d+)\s*แถม\s*(\d+)/);
  if (thaiPromoMatch) {
    const x = parseInt(thaiPromoMatch[1], 10);
    const y = parseInt(thaiPromoMatch[2], 10);
    return { multiplier: x + y, reason: `โปรโมชัน ซื้อ ${x} แถม ${y} (รวม ${x + y} ชิ้น)` };
  }

  // Pattern 2: X+Y or X + Y (e.g. 5+2, 5 + 2, 10+2)
  const plusMatch = combined.match(/(\d+)\s*\+\s*(\d+)/);
  if (plusMatch) {
    const x = parseInt(plusMatch[1], 10);
    const y = parseInt(plusMatch[2], 10);
    if (x > 0 && y > 0 && x < 100 && y < 100) {
      return { multiplier: x + y, reason: `โปรโมชันแพ็ค ${x} + ${y} (รวม ${x + y} ชิ้น)` };
    }
  }

  // Pattern 3: แถม Y or แถมY (e.g. แถม 1, แถม1, แถม 2)
  const freeMatch = combined.match(/แถม\s*(\d+)/);
  if (freeMatch) {
    const y = parseInt(freeMatch[1], 10);
    return { multiplier: 1 + y, reason: `ซื้อ 1 แถม ${y} (รวม ${1 + y} ชิ้น)` };
  }

  // Pattern 4: แพ็ค X (e.g. แพ็ค 6, แพ็ค 12)
  const packMatch = combined.match(/แพ็ค\s*(\d+)|pack\s*(\d+)/i);
  if (packMatch) {
    const x = parseInt(packMatch[1] || packMatch[2], 10);
    if (x > 0 && x < 200) {
      return { multiplier: x, reason: `แพ็คเกจกล่อง/แพ็คละ ${x} ชิ้น` };
    }
  }

  // Pattern 5: Suffix quantities like 2 PC, 2 ชิ้น, 2 sets, 3 units etc. (if number > 1)
  try {
    const qtyMatches = Array.from(combined.matchAll(/(\d+)\s*(pcs|pc|ชิ้น|คู่|กล่อง|set|sets|pack|packs|pu|unit|units)/gi));
    for (const match of qtyMatches) {
      const x = parseInt(match[1], 10);
      if (x > 1 && x < 200) {
        return { multiplier: x, reason: `ระบุจำนวนทวีคูณ ${x} ${match[2]} ในรหัสหรือชื่อสินค้า` };
      }
    }
  } catch (e) {
    // Fallback if matchAll is not supported in environment
    const qtyMatch = combined.match(/(\d+)\s*(pcs|pc|ชิ้น|คู่|กล่อง|set|sets|pack|packs|pu|unit|units)/i);
    if (qtyMatch) {
      const x = parseInt(qtyMatch[1], 10);
      if (x > 1 && x < 200) {
        return { multiplier: x, reason: `ระบุจำนวนทวีคูณ ${x} ${qtyMatch[2]} ในรหัสหรือชื่อสินค้า` };
      }
    }
  }

  return { multiplier: 1, reason: "" };
}

export default function SmartScanner({
  products,
  onRecordMultipleTransactions,
  canRecordTransactions = true,
  currentUser,
}: SmartScannerProps) {
  // Tabs: 'AI_LABEL' (Scan Shipping Label) or 'BARCODE_SCAN' (Scan Barcodes/SKUs)
  const [activeMode, setActiveMode] = useState<'AI_LABEL' | 'BARCODE_SCAN'>('AI_LABEL');

  // Sort products alphabetically by SKU for easy lookup
  const sortedProducts = [...products].sort((a, b) => {
    const skuA = a.sku || '';
    const skuB = b.sku || '';
    return skuA.localeCompare(skuB);
  });

  // Common operators
  const [operator, setOperator] = useState('');
  useEffect(() => {
    if (currentUser) {
      setOperator(currentUser.name);
    }
  }, [currentUser]);

  // --- AI Shipping Label Scanning State ---
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    orderId: string;
    trackingNo: string;
    labelType: string;
    detectedAction: string;
    extractedItems: ScannedItem[];
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Barcode / Manual Input Scanning State ---
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeAction, setBarcodeAction] = useState<TransactionType>('OUT');
  const [barcodeReturnStatus, setBarcodeReturnStatus] = useState<ReturnStatus>('RE_STOCK');
  const [barcodeReason, setBarcodeReason] = useState('สแกนจ่ายสินค้า (Barcode checkout)');
  const [barcodeList, setBarcodeList] = useState<ScannedItem[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // --- PDF Batch Scanning State ---
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfCurrentParsingPage, setPdfCurrentParsingPage] = useState(0);
  const [pdfCurrentAnalyzingBatch, setPdfCurrentAnalyzingBatch] = useState<{ start: number, end: number, total: number } | null>(null);
  const [pdfPagesText, setPdfPagesText] = useState<{ pageNumber: number, text: string }[]>([]);
  const [pdfBatchResults, setPdfBatchResults] = useState<{
    pageNumber: number;
    orderId: string;
    trackingNo: string;
    labelType: string;
    detectedAction: TransactionType;
    extractedItems: ScannedItem[];
  }[]>([]);

  // Play audio beep
  const playBeep = (type: 'success' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('AudioContext not supported or blocked by browser permissions', e);
    }
  };

  // Turn on/off camera
  const startCamera = async (currentFacingMode = facingMode) => {
    setErrorMessage('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Attempt 1: Try with current facingMode (as ideal) and resolution
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn("First camera attempt failed, trying basic video constraints:", firstErr);
        // Attempt 2: Fallback to basic video stream (any available camera)
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(playErr => {
          console.error("Video play failed:", playErr);
        });
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setErrorMessage("ไม่สามารถเข้าถึงกล้องถ่ายภาพได้: " + (err.message || err.name || "สิทธิ์ถูกปฏิเสธ") + " แนะนำให้เปลี่ยนมาใช้วิธีอัปโหลดรูปภาพใบปะหน้าพัสดุ หรือสแกนผ่านลิงก์แท็บใหม่แทนได้ครับ");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Capture frame
  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setSelectedImage(dataUrl);
        stopCamera();
        
        // Auto-trigger scanning!
        setTimeout(() => {
          handleScanWithAI(dataUrl);
        }, 100);
      }
    }
  };

  // Generate a mock Thai shipping label image dynamically so users can test immediately
  const generateDemoLabel = () => {
    setErrorMessage('');
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Header Logo & Label Info
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(15, 15, canvas.width - 30, 80);
    
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('⚡ FLASH EXPRESS (DEMO)', 30, 62);

    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('LABEL TYPE: SHIPMENT CARD', 420, 60);

    // Divider
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 95);
    ctx.lineTo(585, 95);
    ctx.stroke();

    // From / To Information
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('ผู้ส่ง (SENDER):', 30, 120);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('โกดังคลังสินค้าหลัก AI Smart Warehouse โทร. 02-123-4567', 30, 140);

    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText('ผู้รับ (RECEIVER):', 30, 180);
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('คุณ สมชาย รักเรียนดี', 30, 205);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('123/45 ถนนราชดำเนิน แขวงพระบรมมหาราชวัง เขตพระนคร', 30, 230);
    ctx.fillText('กรุงเทพมหานคร 10200 (โทร. 089-999-8888)', 30, 250);

    // Order Details Block
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(20, 275, canvas.width - 40, 60);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText('เลขที่สั่งซื้อ (Order ID): ORD-2026-95843', 40, 300);
    ctx.fillText('ช่องทาง (Channel): LINE Shop', 40, 320);

    // Barcode Simulation
    ctx.fillStyle = '#000000';
    // Draw some simple lines for barcode
    for (let i = 0; i < 180; i += 4) {
      const barWidth = (i % 3 === 0) ? 3 : (i % 5 === 0) ? 1 : 2;
      ctx.fillRect(80 + i * 2.3, 360, barWidth, 65);
    }
    ctx.font = 'bold 15px Courier, monospace';
    ctx.fillText('TH9845348923FLASH', 180, 445);

    // Items Section Table
    ctx.fillStyle = '#334155';
    ctx.fillRect(20, 475, canvas.width - 40, 35);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('รหัสสินค้า (SKU / Code)', 40, 497);
    ctx.fillText('ชื่อสินค้า (Product Detail)', 180, 497);
    ctx.fillText('จำนวน (Qty)', 500, 497);

    // Row 1
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px Arial, sans-serif';
    // We will list existing SKU codes or standard ones that we can map in the app
    const prod1Sku = products[0]?.sku || 'SKU-SHIRT-M';
    const prod1Name = products[0]?.name || 'เสื้อยืด Streetwear';
    ctx.fillText(prod1Sku, 40, 540);
    ctx.fillText(prod1Name.substring(0, 30), 180, 540);
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText('x 2', 510, 540);

    // Line Row 1
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(20, 555);
    ctx.lineTo(580, 555);
    ctx.stroke();

    // Row 2
    ctx.font = '13px Arial, sans-serif';
    const prod2Sku = products[1]?.sku || 'SKU-BOTTLE';
    const prod2Name = products[1]?.name || 'กระบอกน้ำเก็บความเย็น';
    ctx.fillText(prod2Sku, 40, 585);
    ctx.fillText(prod2Name.substring(0, 30), 180, 585);
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText('x 1', 510, 585);

    // Line Row 2
    ctx.beginPath();
    ctx.moveTo(20, 600);
    ctx.lineTo(580, 600);
    ctx.stroke();

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px Arial, sans-serif';
    ctx.fillText('ใบปะหน้าจำลองเพื่อการตรวจสอบสต๊อกอัตโนมัติด้วย AI Warehouse Scanner', 130, 710);

    // Convert to Image URL
    const demoUrl = canvas.toDataURL('image/jpeg', 0.95);
    setSelectedImage(demoUrl);
    setScanResult(null);
    setSuccessMessage("สร้างใบลาเบลพัสดุจำลองสำเร็จ! คุณสามารถกดปุ่ม 'วิเคราะห์และสแกนด้วย AI อัจฉริยะ' เพื่อจำลองการตัดสต๊อกจริงได้เลยครับ");
  };

  // Send captured image to Gemini AI backend API
  const handleScanWithAI = async (imageToScan?: any) => {
    const targetImage = (typeof imageToScan === 'string' ? imageToScan : null) || selectedImage;
    if (!targetImage) return;

    setIsScanning(true);
    setErrorMessage('');
    setSuccessMessage('');
    setScanResult(null);

    try {
      const response = await fetch('/api/scan-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: targetImage })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      
      // Map extracted action mapping
      const actionType: TransactionType = data.detectedAction === 'IN' ? 'IN' : data.detectedAction === 'RETURN' ? 'RETURN' : 'OUT'; // Default to OUT

      // Enrich extracted items with required transaction mapping fields
      const formattedItems = (data.extractedItems || []).map((item: any) => {
        const promo = parsePromoMultiplier(item.sku, item.productName || (item.matchedProduct?.name));
        return {
          ...item,
          selectedAction: actionType,
          selectedReturnStatus: actionType === 'RETURN' ? 'RE_STOCK' : undefined,
          selectedReason: actionType === 'OUT' ? `เบิกจ่ายอัตโนมัติผ่านแทรคกิ้ง ${data.trackingNo || data.orderId || ''}`.trim() : 'รับเข้าคลังผ่านการสแกนใบลาเบล',
          multiplier: promo.multiplier,
          multiplierReason: promo.reason
        };
      });

      setScanResult({
        orderId: data.orderId || '-',
        trackingNo: data.trackingNo || '-',
        labelType: data.labelType || 'UNKNOWN',
        detectedAction: data.detectedAction || 'UNKNOWN',
        extractedItems: formattedItems
      });

      if (formattedItems.length > 0) {
        playBeep('success');
        const matchedCount = formattedItems.filter((i: any) => i.matched).length;
        setSuccessMessage(`สแกนสำเร็จ! ถอดข้อมูลพัสดุเรียบร้อย พบสินค้าทั้งหมด ${formattedItems.length} รายการ (จับคู่ตรงระบบคลัง ${matchedCount} รายการ)`);
      } else {
        playBeep('error');
        setErrorMessage("AI สแกนเอกสารสำเร็จ แต่ไม่พบรหัสสินค้า (SKU) ระบุอยู่ในใบลาเบลนี้อย่างชัดเจน");
      }

    } catch (err: any) {
      console.error("AI Scan Error:", err);
      playBeep('error');
      setErrorMessage(err.message || "ระบบตรวจจับเอกสารขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsScanning(false);
    }
  };

  // Load PDFJS from CDN dynamically
  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error('ไม่สามารถดาวน์โหลดไลบรารีวิเคราะห์ PDF จาก CDN ได้ชั่วคราว'));
      document.head.appendChild(script);
    });
  };

  // Client-side text extraction from PDF pages
  const extractTextFromPdf = async (file: File) => {
    setIsParsingPdf(true);
    setErrorMessage('');
    setSuccessMessage('');
    setPdfPagesText([]);
    setPdfBatchResults([]);
    setScanResult(null);
    setSelectedImage(null);

    try {
      const pdfjs = await loadPdfJS();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      setPdfTotalPages(numPages);

      const pagesTextList: { pageNumber: number, text: string }[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setPdfCurrentParsingPage(pageNum);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        pagesTextList.push({ pageNumber: pageNum, text: pageText });
      }

      setPdfPagesText(pagesTextList);
      playBeep('success');
      
      // Auto-trigger batch AI analysis
      await analyzePdfPagesInBatches(pagesTextList);

    } catch (err: any) {
      console.error("PDF text extraction error:", err);
      setErrorMessage("เกิดข้อผิดพลาดขณะดึงข้อความจาก PDF: " + (err.message || String(err)));
      playBeep('error');
    } finally {
      setIsParsingPdf(false);
    }
  };

  // Analyze extracted PDF text pages in batches
  const analyzePdfPagesInBatches = async (pagesList: { pageNumber: number, text: string }[]) => {
    setIsAnalyzingPdf(true);
    setErrorMessage('');
    const BATCH_SIZE = 10;
    const allResults: any[] = [];

    try {
      for (let i = 0; i < pagesList.length; i += BATCH_SIZE) {
        const batch = pagesList.slice(i, i + BATCH_SIZE);
        setPdfCurrentAnalyzingBatch({
          start: i + 1,
          end: Math.min(i + BATCH_SIZE, pagesList.length),
          total: pagesList.length
        });

        const response = await fetch('/api/scan-pdf-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pages: batch })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        if (data.results) {
          // Enrich extracted actions with default states for React inputs
          const enrichedResults = data.results.map((pageRes: any) => ({
            ...pageRes,
            extractedItems: pageRes.extractedItems.map((item: any) => {
              const promo = parsePromoMultiplier(item.sku, item.productName || (item.matchedProduct?.name));
              return {
                ...item,
                selectedAction: pageRes.detectedAction,
                selectedReturnStatus: pageRes.detectedAction === 'RETURN' ? 'RE_STOCK' : undefined,
                selectedReason: pageRes.detectedAction === 'OUT' 
                  ? `เบิกสต๊อกผ่าน PDF ออเดอร์ (แผ่นที่ ${pageRes.pageNumber} แทรคกิ้ง: ${pageRes.trackingNo || pageRes.orderId || '-'})`
                  : `รับเข้าคลังสินค้าผ่าน PDF แผ่นที่ ${pageRes.pageNumber}`,
                multiplier: promo.multiplier,
                multiplierReason: promo.reason
              };
            })
          }));
          allResults.push(...enrichedResults);
        }
      }

      setPdfBatchResults(allResults);
      
      // Count total extracted items
      let totalExtractedItems = 0;
      let matchedCount = 0;
      allResults.forEach(r => {
        totalExtractedItems += r.extractedItems.length;
        matchedCount += r.extractedItems.filter((item: any) => item.matched).length;
      });

      setSuccessMessage(`🎉 AI สแกนวิเคราะห์ PDF ทั้งหมด ${pagesList.length} แผ่นเสร็จสิ้นสมบูรณ์! ค้นพบสินค้า ${totalExtractedItems} รายการ (ตรงกับระบบคลัง ${matchedCount} รายการ)`);
      playBeep('success');

    } catch (err: any) {
      console.error("PDF batch analysis error:", err);
      setErrorMessage("เกิดข้อผิดพลาดในการส่งข้อความ PDF วิเคราะห์ด้วย AI: " + (err.message || String(err)));
      playBeep('error');
    } finally {
      setIsAnalyzingPdf(false);
      setPdfCurrentAnalyzingBatch(null);
    }
  };

  // Handle file uploads (Images or multi-page PDFs)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage('');
      setSuccessMessage('');
      setScanResult(null);
      setPdfPagesText([]);
      setPdfBatchResults([]);

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedImage(null);
        extractTextFromPdf(file);
      } else {
        // Image processing
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setSelectedImage(dataUrl);
          
          // Auto-trigger scanning!
          setTimeout(() => {
            handleScanWithAI(dataUrl);
          }, 100);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Change individual scanned item's quantity or action
  const updateScannedItemField = (index: number, field: keyof ScannedItem, value: any) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    items[index] = { ...items[index], [field]: value };
    setScanResult({ ...scanResult, extractedItems: items });
  };

  // Manual product matching for single scanned item
  const handleManualMatch = (index: number, product: Product | null) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    if (product) {
      items[index] = {
        ...items[index],
        matched: true,
        matchedProduct: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          quantity: product.quantity,
          unit: product.unit || "ชิ้น",
          location: product.location || "ไม่ได้ระบุ"
        }
      };
    } else {
      items[index] = {
        ...items[index],
        matched: false,
        matchedProduct: null
      };
    }
    setScanResult({ ...scanResult, extractedItems: items });
  };

  // Inline edit SKU for single scanned item, which triggers auto-matching
  const handleUpdateScannedSku = (index: number, newSku: string) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    const item = items[index];
    
    const cleanSku = newSku.trim().toUpperCase();
    const matchedProduct = products.find(p => p.sku.trim().toUpperCase() === cleanSku);
    
    items[index] = {
      ...item,
      sku: newSku,
      matched: !!matchedProduct,
      matchedProduct: matchedProduct ? {
        id: matchedProduct.id,
        sku: matchedProduct.sku,
        name: matchedProduct.name,
        quantity: matchedProduct.quantity,
        unit: matchedProduct.unit || "ชิ้น",
        location: matchedProduct.location || "ไม่ได้ระบุ"
      } : null
    };
    setScanResult({ ...scanResult, extractedItems: items });
  };

  // Inline edit product name for single scanned item
  const handleUpdateScannedName = (index: number, newName: string) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    items[index] = {
      ...items[index],
      productName: newName
    };
    setScanResult({ ...scanResult, extractedItems: items });
  };

  // Manual product matching for PDF batch items
  const handleManualMatchPdf = (pageIndex: number, itemIndex: number, product: Product | null) => {
    setPdfBatchResults(prev => {
      const updated = [...prev];
      const page = { ...updated[pageIndex] };
      const items = [...page.extractedItems];
      if (product) {
        items[itemIndex] = {
          ...items[itemIndex],
          matched: true,
          matchedProduct: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            quantity: product.quantity,
            unit: product.unit || "ชิ้น",
            location: product.location || "ไม่ได้ระบุ"
          }
        };
      } else {
        items[itemIndex] = {
          ...items[itemIndex],
          matched: false,
          matchedProduct: null
        };
      }
      page.extractedItems = items;
      updated[pageIndex] = page;
      return updated;
    });
  };

  // Inline edit SKU for PDF batch item
  const handleUpdatePdfBatchSku = (pageIndex: number, itemIndex: number, newSku: string) => {
    setPdfBatchResults(prev => {
      const updated = [...prev];
      const page = { ...updated[pageIndex] };
      const items = [...page.extractedItems];
      const item = items[itemIndex];
      
      const cleanSku = newSku.trim().toUpperCase();
      const matchedProduct = products.find(p => p.sku.trim().toUpperCase() === cleanSku);
      
      items[itemIndex] = {
        ...item,
        sku: newSku,
        matched: !!matchedProduct,
        matchedProduct: matchedProduct ? {
          id: matchedProduct.id,
          sku: matchedProduct.sku,
          name: matchedProduct.name,
          quantity: matchedProduct.quantity,
          unit: matchedProduct.unit || "ชิ้น",
          location: matchedProduct.location || "ไม่ได้ระบุ"
        } : null
      };
      page.extractedItems = items;
      updated[pageIndex] = page;
      return updated;
    });
  };

  // Inline edit name for PDF batch item
  const handleUpdatePdfBatchName = (pageIndex: number, itemIndex: number, newName: string) => {
    setPdfBatchResults(prev => {
      const updated = [...prev];
      const page = { ...updated[pageIndex] };
      const items = [...page.extractedItems];
      items[itemIndex] = {
        ...items[itemIndex],
        productName: newName
      };
      page.extractedItems = items;
      updated[pageIndex] = page;
      return updated;
    });
  };

  // Remove a scanned item from the list
  const removeScannedItem = (index: number) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    items.splice(index, 1);
    setScanResult({ ...scanResult, extractedItems: items });
  };

  // Reset uploader
  const resetAIUploader = () => {
    setSelectedImage(null);
    setScanResult(null);
    setErrorMessage('');
    setSuccessMessage('');
    stopCamera();
  };

  // Update PDF batch item field
  const updatePdfBatchItemField = (pageIndex: number, itemIndex: number, field: string, value: any) => {
    setPdfBatchResults(prev => {
      const updated = [...prev];
      const page = { ...updated[pageIndex] };
      const items = [...page.extractedItems];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      
      // If action is changed, auto-update the default reason too
      if (field === 'selectedAction') {
        items[itemIndex].selectedReason = value === 'OUT' 
          ? `เบิกสต๊อกผ่าน PDF ออเดอร์ (แผ่นที่ ${page.pageNumber} แทรคกิ้ง: ${page.trackingNo || page.orderId || '-'})`
          : `รับเข้าคลังสินค้าผ่าน PDF แผ่นที่ ${page.pageNumber}`;
        if (value !== 'RETURN') {
          items[itemIndex].selectedReturnStatus = undefined;
        } else {
          items[itemIndex].selectedReturnStatus = 'RE_STOCK';
        }
      }
      
      page.extractedItems = items;
      updated[pageIndex] = page;
      return updated;
    });
  };

  // Remove PDF batch item
  const removePdfBatchItem = (pageIndex: number, itemIndex: number) => {
    setPdfBatchResults(prev => {
      const updated = [...prev];
      const page = { ...updated[pageIndex] };
      const items = [...page.extractedItems];
      items.splice(itemIndex, 1);
      page.extractedItems = items;
      updated[pageIndex] = page;
      // Filter out pages that have no items left
      return updated.filter(p => p.extractedItems.length > 0);
    });
  };

  // Reset PDF uploader
  const resetPdfUploader = () => {
    setPdfPagesText([]);
    setPdfBatchResults([]);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Confirm and submit PDF batch transactions
  const handleConfirmPdfBatchTransactions = async () => {
    if (!operator.trim()) {
      setErrorMessage("กรุณากรอกชื่อพนักงานดําเนินงานก่อนบันทึกทำรายการ");
      return;
    }

    // Flatten all items across all pages that are matched
    const validTxs: any[] = [];
    pdfBatchResults.forEach(pageRes => {
      pageRes.extractedItems.forEach(item => {
        if (item.matched && item.matchedProduct) {
          const prod = item.matchedProduct;
          const finalQty = item.quantity * (item.multiplier || 1);
          const promoReasonSuffix = item.multiplier && item.multiplier > 1 
            ? ` [รวมตัวคูณโปรโมชัน/ของแถม: x${item.multiplier} ชิ้น (${item.multiplierReason || ''})]` 
            : '';
          validTxs.push({
            productId: prod.id,
            productSku: prod.sku,
            productName: prod.name,
            type: item.selectedAction,
            quantity: finalQty,
            reason: (item.selectedReason || (item.selectedAction === 'IN' ? 'รับเข้าคลังผ่านการสแกน PDF' : `เบิกออเดอร์อัตโนมัติผ่าน PDF ปะหน้าพัสดุ (หน้า ${pageRes.pageNumber})`)) + promoReasonSuffix,
            operator: operator.trim(),
            returnStatus: item.selectedAction === 'RETURN' ? item.selectedReturnStatus : undefined,
            referenceNo: pageRes.trackingNo && pageRes.trackingNo !== '-' ? pageRes.trackingNo : pageRes.orderId
          });
        }
      });
    });

    if (validTxs.length === 0) {
      setErrorMessage("ไม่พบสินค้าที่จับคู่สำเร็จในระบบคลังจากหน้าเอกสาร PDF ทั้งหมด");
      return;
    }

    setIsAnalyzingPdf(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await onRecordMultipleTransactions(validTxs);
      playBeep('success');
      setSuccessMessage(`🎉 บันทึกปรับปรุงสต๊อกแบบชุดทั้งหมด ${validTxs.length} รายการ จากหน้า PDF ทั้งหมดเรียบร้อยแล้วครับ!`);
      setPdfBatchResults([]);
      setPdfPagesText([]);
    } catch (err: any) {
      console.error("PDF Batch Transaction Save Error:", err);
      playBeep('error');
      setErrorMessage("ไม่สามารถบันทึกรายการจาก PDF ได้: " + (err.message || String(err)));
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  // --- Barcode Quick Scanning Operations ---
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const query = barcodeInput.trim();
    if (!query) return;

    // Search product in database (Exact match SKU first, then partial match SKU, then exact match ID)
    const lowerQuery = query.toLowerCase();
    let foundProd = products.find(p => p.sku.toLowerCase() === lowerQuery);
    if (!foundProd) {
      foundProd = products.find(p => p.id.toLowerCase() === lowerQuery);
    }
    if (!foundProd) {
      foundProd = products.find(p => p.sku.toLowerCase().includes(lowerQuery) || p.name.toLowerCase().includes(lowerQuery));
    }

    if (foundProd) {
      // Check if product is already in the barcode list
      const existingIdx = barcodeList.findIndex(item => item.sku === foundProd!.sku);
      if (existingIdx > -1) {
        const updatedList = [...barcodeList];
        updatedList[existingIdx].quantity += 1;
        setBarcodeList(updatedList);
      } else {
        const promo = parsePromoMultiplier(foundProd.sku, foundProd.name);
        const newScanned: ScannedItem = {
          sku: foundProd.sku,
          productName: foundProd.name,
          quantity: 1,
          matched: true,
          matchedProduct: {
            id: foundProd.id,
            sku: foundProd.sku,
            name: foundProd.name,
            quantity: foundProd.quantity,
            unit: foundProd.unit || 'ชิ้น',
            location: foundProd.location || 'ไม่ได้ระบุ',
          },
          selectedAction: barcodeAction,
          selectedReturnStatus: barcodeAction === 'RETURN' ? barcodeReturnStatus : undefined,
          selectedReason: barcodeReason,
          multiplier: promo.multiplier,
          multiplierReason: promo.reason,
        };
        setBarcodeList([newScanned, ...barcodeList]);
      }
      playBeep('success');
      setSuccessMessage(`สแกนพบสินค้า: "${foundProd.name}" เพิ่มลงรายการเรียบร้อย`);
    } else {
      playBeep('error');
      // Even if not found in db, allow adding as custom unmapped item
      const promo = parsePromoMultiplier(query, `รหัสที่ไม่พบคลังคิวสินค้า (${query})`);
      const unmappedScanned: ScannedItem = {
        sku: query.toUpperCase(),
        productName: `รหัสที่ไม่พบคลังคิวสินค้า (${query})`,
        quantity: 1,
        matched: false,
        matchedProduct: null,
        selectedAction: barcodeAction,
        selectedReturnStatus: barcodeAction === 'RETURN' ? barcodeReturnStatus : undefined,
        selectedReason: barcodeReason,
        multiplier: promo.multiplier,
        multiplierReason: promo.reason,
      };
      setBarcodeList([unmappedScanned, ...barcodeList]);
      setErrorMessage(`⚠️ ไม่พบสินค้าที่มีรหัส SKU: "${query}" ในระบบคลังสินค้าหลัก แต่ได้สร้างรายการสแกนสำรองไว้ให้แล้วครับ`);
    }

    setBarcodeInput('');
    // Auto re-focus input
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Adjust scanned list quantity
  const adjustBarcodeQty = (index: number, amount: number) => {
    const updated = [...barcodeList];
    updated[index].quantity = Math.max(1, updated[index].quantity + amount);
    setBarcodeList(updated);
  };

  // Update barcode list item field (e.g., multiplier)
  const updateBarcodeItemField = (index: number, field: keyof ScannedItem, value: any) => {
    const updated = [...barcodeList];
    updated[index] = { ...updated[index], [field]: value };
    setBarcodeList(updated);
  };

  // Remove barcode scanned item
  const removeBarcodeItem = (index: number) => {
    const updated = [...barcodeList];
    updated.splice(index, 1);
    setBarcodeList(updated);
  };

  // Final confirmation to submit multiple transactions
  const handleConfirmBatchTransactions = async (listToSubmit: ScannedItem[]) => {
    if (!operator.trim()) {
      setErrorMessage("กรุณากรอกชื่อพนักงานดําเนินงานก่อนบันทึกทำรายการ");
      return;
    }

    const validTxs = listToSubmit.filter(item => item.matched && item.matchedProduct);
    if (validTxs.length === 0) {
      setErrorMessage("ไม่พบสินค้าที่จับคู่สำเร็จในระบบคลังเพื่อทำรายการอัปเดตสต๊อก");
      return;
    }

    setIsScanning(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const transactionsPayload = validTxs.map(item => {
        const prod = item.matchedProduct!;
        const finalQty = item.quantity * (item.multiplier || 1);
        const promoReasonSuffix = item.multiplier && item.multiplier > 1 
          ? ` [รวมตัวคูณโปรโมชัน/ของแถม: x${item.multiplier} ชิ้น (${item.multiplierReason || ''})]` 
          : '';
        return {
          productId: prod.id,
          productSku: prod.sku,
          productName: prod.name,
          type: item.selectedAction,
          quantity: finalQty,
          reason: (item.selectedReason || (item.selectedAction === 'IN' ? 'รับเข้าคลังผ่านการสแกนลาเบล' : 'เบิกจ่ายด่วนผ่านเครื่องสแกนบาร์โค้ด')) + promoReasonSuffix,
          operator: operator.trim(),
          returnStatus: item.selectedAction === 'RETURN' ? item.selectedReturnStatus : undefined,
          referenceNo: activeMode === 'AI_LABEL' ? (scanResult?.trackingNo !== '-' ? scanResult?.trackingNo : scanResult?.orderId) : undefined
        };
      });

      // Execute batch write in Firestore!
      await onRecordMultipleTransactions(transactionsPayload);

      playBeep('success');
      setSuccessMessage(`🎉 อัปเดตสต๊อกสินค้าเรียบร้อย! ทำการบันทึกรายการเคลื่อนไหวแบบกลุ่ม ${transactionsPayload.length} รายการสำเร็จในระบบเรียลไทม์`);
      
      // Clear current lists
      if (activeMode === 'AI_LABEL') {
        setScanResult(null);
        setSelectedImage(null);
      } else {
        setBarcodeList([]);
      }

    } catch (err: any) {
      console.error("Batch Transaction Error:", err);
      playBeep('error');
      setErrorMessage("ไม่สามารถบันทึกรายการชุดสต๊อกได้: " + (err.message || String(err)));
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div id="ai-smart-scanner" className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Sparkles className="w-5 h-5 text-yellow-200 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-1.5">
              <span>สแกนเนอร์อัจฉริยะประมวลผลด้วย AI (AI Label & Quick Scanner)</span>
            </h3>
            <p className="text-xs text-slate-300">
              อัปโหลดใบปะหน้าขนส่ง (Flash/Kerry/Lazada) เพื่อให้ AI ถอดรหัสและตัดสต๊อกทันที หรือสแกนบาร์โค้ดสินค้าเพื่ออัปเดตสต๊อกด่วน
            </p>
          </div>
        </div>

        {/* Global Operator Input */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <span className="text-xs text-slate-300 font-medium whitespace-nowrap">พนักงาน:</span>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="ชื่อผู้ทำรายการ"
            className="bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded text-xs font-semibold focus:outline-hidden focus:border-blue-500 w-full md:w-44"
          />
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => {
            setActiveMode('AI_LABEL');
            setErrorMessage('');
            setSuccessMessage('');
          }}
          className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeMode === 'AI_LABEL'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>สแกนใบลาเบลด้วย AI (AI Label OCR Scanner)</span>
        </button>
        <button
          onClick={() => {
            setActiveMode('BARCODE_SCAN');
            setErrorMessage('');
            setSuccessMessage('');
            // Focus barcode input
            setTimeout(() => barcodeInputRef.current?.focus(), 100);
          }}
          className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeMode === 'BARCODE_SCAN'
              ? 'border-blue-600 text-blue-600 bg-blue-50/20'
              : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Barcode className="w-4 h-4" />
          <span>สแกนบาร์โค้ด / พิมพ์รหัสไว (Barcode Gun & Fast SKU)</span>
        </button>
      </div>

      {/* Status Notifications */}
      {errorMessage && (
        <div className="mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg flex items-start gap-2.5 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}
      {successMessage && (
        <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-start gap-2.5 text-xs animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* --- MODE 1: AI SHIPPING LABEL SCANNER --- */}
      {activeMode === 'AI_LABEL' && (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Camera Stream or Image Preview */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              ช่องนำเข้ารูปภาพ (Image Input Channel)
            </h4>

            {/* Video Live Stream Viewport */}
            {cameraActive ? (
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-300 bg-black flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Aiming Reticle */}
                <div className="absolute inset-4 border-2 border-dashed border-blue-500/60 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-2/3 h-1/3 border border-red-500/40 rounded flex items-center justify-center">
                    <span className="text-[9px] text-red-500/80 font-bold bg-slate-900/80 px-2 py-0.5 rounded uppercase font-mono tracking-widest">
                      Align Barcode & Items Here
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 flex-wrap px-2">
                  <button
                    onClick={captureFrame}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>ถ่ายภาพใบลาเบล (Capture)</span>
                  </button>
                  <button
                    onClick={() => {
                      const nextMode = facingMode === 'environment' ? 'user' : 'environment';
                      setFacingMode(nextMode);
                      startCamera(nextMode);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                    title="สลับกล้องหน้า/หลัง"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>สลับกล้อง ({facingMode === 'environment' ? 'หลัง' : 'หน้า'})</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : selectedImage ? (
              /* Image Preview Panel */
              <div className="relative border border-slate-300 bg-white rounded-lg overflow-hidden shadow-xs">
                <img
                  src={selectedImage}
                  alt="Captured Label"
                  className="w-full h-auto object-contain max-h-96"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={resetAIUploader}
                    className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-md"
                    title="ลบรูปภาพ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* File Drag-and-Drop and Placeholder options */
              <div className="flex flex-col gap-3">
                {/* 1. Native Mobile Camera Button (Highly recommended for mobile browsers inside iframe) */}
                <input
                  id="ai-camera-capture-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => document.getElementById('ai-camera-capture-input')?.click()}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer transform active:scale-98 border-b-4 border-emerald-800"
                >
                  <Camera className="w-5 h-5 text-white animate-pulse" />
                  <span>ถ่ายภาพใบปะหน้าทันที (กล้องมือถือ 100% คมชัดสุด)</span>
                </button>

                {/* 2. Drag & Drop or File Picker */}
                <div 
                  className="border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative"
                  onClick={() => document.getElementById('ai-file-input')?.click()}
                >
                  <input
                    id="ai-file-input"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="bg-blue-50 text-blue-600 p-2.5 rounded-full mb-2">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <h5 className="font-bold text-slate-800 text-xs">
                    เลือกรูปภาพที่มีอยู่ หรือไฟล์ PDF สติ๊กเกอร์รวมหลายแผ่น
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                    รองรับภาพจากคลัง หรือไฟล์ PDF ขนาดใหญ่ (50-100 หน้า) จาก Shopee, Lazada, TikTok Shop
                  </p>
                </div>

                {/* 3. Extra tools */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => startCamera()}
                    className="py-2 px-3 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-slate-600" />
                    <span>ใช้กล้องเว็บแคม (Webcam Live)</span>
                  </button>
                  <button
                    onClick={generateDemoLabel}
                    className="py-2 px-3 border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>ใช้ใบลาเบลจำลอง (Demo)</span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Call Action Button */}
            {selectedImage && !isScanning && !scanResult && (
              <button
                onClick={handleScanWithAI}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>วิเคราะห์และสแกนด้วย AI อัจฉริยะ (Analyze Label with AI)</span>
              </button>
            )}

            {isScanning && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <h5 className="font-bold text-xs text-slate-800">กำลังส่งรูปภาพวิเคราะห์ด้วย Gemini AI...</h5>
                <p className="text-[10px] text-slate-500 mt-1">
                  กรุณารอประมาณ 2-4 วินาที ระบบจะดึงรหัสสินค้า คีย์จับคู่คงคลัง และแนะนำการเบิกสต๊อกให้คุณโดยอัตโนมัติ
                </p>
              </div>
            )}

            {isParsingPdf && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col items-center justify-center text-center shadow-xs">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <h5 className="font-bold text-xs text-slate-800">กำลังสกัดข้อความจากเอกสาร PDF...</h5>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  กำลังประมวลผลอ่านแผ่นที่ <strong>{pdfCurrentParsingPage}</strong> จากทั้งหมด {pdfTotalPages} แผ่น (ขั้นตอนนี้ทำงานบนเบราว์เซอร์และเสร็จไวมากครับ)
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${(pdfCurrentParsingPage / pdfTotalPages) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {isAnalyzingPdf && pdfCurrentAnalyzingBatch && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col items-center justify-center text-center shadow-xs">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                <h5 className="font-bold text-xs text-slate-800">AI กำลังวิเคราะห์ฉลากคัดสต๊อก...</h5>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  กำลังวิเคราะห์หน้าพัสดุแผ่นที่ <strong>{pdfCurrentAnalyzingBatch.start} ถึง {pdfCurrentAnalyzingBatch.end}</strong> จากทั้งหมด {pdfCurrentAnalyzingBatch.total} แผ่น
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${(pdfCurrentAnalyzingBatch.end / pdfCurrentAnalyzingBatch.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {pdfPagesText.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เอกสารที่อัปโหลด</span>
                  <button 
                    onClick={resetPdfUploader}
                    className="text-[10px] text-rose-600 hover:text-rose-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> ลบไฟล์ PDF ออก
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">เอกสาร PDF รวมทั้งหมด {pdfTotalPages} แผ่น</span>
                    <span className="text-[9px] text-slate-500 block">วิเคราะห์แผ่นคำสั่งซื้อด้วยระบบประมวลผลข้อความความเร็วสูง</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Analyzed & Matched Result Table */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              ผลการวิเคราะห์ฉลาก & ปรับปรุงคลัง (Extracted & Mapped Items)
            </h4>

            {pdfBatchResults.length > 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col overflow-hidden animate-fade-in">
                {/* PDF Batch Summary Header */}
                <div className="bg-slate-950 text-white px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                      <span>รายงานผลการวิเคราะห์กลุ่ม PDF ({pdfBatchResults.length} แผ่นพัสดุ)</span>
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      ตรวจสอบรหัสสินค้า คีย์จับคู่ และยืนยันการบันทึกสต๊อกในคลิกเดียว
                    </p>
                  </div>
                  <div className="text-right text-[11px] font-mono bg-slate-800 px-2.5 py-1 rounded">
                    คลังตรง:{' '}
                    <strong className="text-emerald-400">
                      {pdfBatchResults.reduce((acc, page) => acc + page.extractedItems.filter(item => item.matched).length, 0)}
                    </strong>{' '}
                    / {pdfBatchResults.reduce((acc, page) => acc + page.extractedItems.length, 0)} รายการ
                  </div>
                </div>

                {/* List of Pages Accordion */}
                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                  {pdfBatchResults.map((pageRes, pageIdx) => (
                    <div key={pageIdx} className="pt-4 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-md border border-slate-200 text-xs mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                            แผ่นที่ {pageRes.pageNumber}
                          </span>
                          <span className="font-semibold text-slate-700">
                            ออเดอร์: {pageRes.orderId || '-'}
                          </span>
                          {pageRes.trackingNo && pageRes.trackingNo !== '-' && (
                            <span className="text-[10px] bg-slate-200 text-slate-600 font-mono px-1 rounded-xs">
                              TRACKING: {pageRes.trackingNo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500">ประเภท: {pageRes.labelType === 'SHIP_LABEL' ? '📦 ใบปะขนส่ง' : '📑 เอกสาร'}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${pageRes.detectedAction === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {pageRes.detectedAction === 'IN' ? '📥 รับเข้า' : '📤 ส่งออก'}
                          </span>
                        </div>
                      </div>

                      {/* Items table for this page */}
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-semibold">
                            <th className="py-1 px-2">ข้อมูลสแกน</th>
                            <th className="py-1 px-2">สินค้าคงคลังระบบ</th>
                            <th className="py-1 px-2 w-28 text-center">ประเภทรายการ</th>
                            <th className="py-1 px-2 w-20 text-center">จำนวน</th>
                            <th className="py-1 px-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pageRes.extractedItems.map((item, itemIdx) => (
                            <tr key={itemIdx} className={`hover:bg-slate-50/40 ${!item.matched ? 'bg-amber-50/20' : ''}`}>
                              <td className="py-2 px-2 w-64">
                                <div className="space-y-1 max-w-[240px]">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-slate-400 font-bold shrink-0 w-6 font-sans">SKU:</span>
                                    <input
                                      type="text"
                                      value={item.sku}
                                      onChange={(e) => handleUpdatePdfBatchSku(pageIdx, itemIdx, e.target.value)}
                                      placeholder="SKU"
                                      className="font-mono bg-slate-50 text-slate-700 px-1 py-0.5 rounded text-[10px] border border-slate-200 focus:border-blue-500 focus:bg-white w-full outline-hidden"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-slate-400 font-bold shrink-0 w-6 font-sans">ชื่อ:</span>
                                    <input
                                      type="text"
                                      value={item.productName}
                                      onChange={(e) => handleUpdatePdfBatchName(pageIdx, itemIdx, e.target.value)}
                                      placeholder="ชื่อสินค้า"
                                      className="text-slate-600 text-[10px] px-1 py-0.5 rounded border border-slate-200 focus:border-blue-500 focus:bg-white w-full outline-hidden"
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                {item.matched && item.matchedProduct ? (
                                  <div className="space-y-1">
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-slate-800 block text-[11px] leading-tight">{item.matchedProduct.name}</span>
                                      <span className="text-[9px] text-slate-500">
                                        สต๊อก: <strong>{item.matchedProduct.quantity} {item.matchedProduct.unit}</strong> | พิกัด: {item.matchedProduct.location}
                                      </span>
                                    </div>
                                    <div className="pt-0.5 max-w-[220px]">
                                      <select
                                        className="w-full border border-slate-200 hover:border-blue-400 rounded px-1.5 py-0.5 text-[10px] focus:outline-hidden focus:border-blue-500 bg-white"
                                        value={item.matchedProduct.id}
                                        onChange={(e) => {
                                          const selectedId = e.target.value;
                                          const prod = products.find(p => p.id === selectedId);
                                          if (prod) {
                                            handleManualMatchPdf(pageIdx, itemIdx, prod);
                                          } else {
                                            handleManualMatchPdf(pageIdx, itemIdx, null);
                                          }
                                        }}
                                      >
                                        <option value="">-- เปลี่ยนตัวจับคู่ --</option>
                                        {sortedProducts.map(p => (
                                          <option key={p.id} value={p.id}>
                                            [{p.sku}] {p.name} ({p.quantity} {p.unit})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-amber-600 font-semibold text-[9px]">
                                      <AlertCircle className="w-3 h-3 shrink-0" />
                                      <span>ไม่พบ SKU ในระบบ</span>
                                    </div>
                                    <div className="max-w-[220px]">
                                      <select
                                        className="w-full border border-amber-300 hover:border-blue-500 rounded px-1.5 py-0.5 text-[10px] focus:outline-hidden focus:border-blue-500 bg-amber-50/50"
                                        value=""
                                        onChange={(e) => {
                                          const selectedId = e.target.value;
                                          const prod = products.find(p => p.id === selectedId);
                                          if (prod) {
                                            handleManualMatchPdf(pageIdx, itemIdx, prod);
                                          }
                                        }}
                                      >
                                        <option value="">👉 เลือกคู่สินค้าด้วยมือ...</option>
                                        {sortedProducts.map(p => (
                                          <option key={p.id} value={p.id}>
                                            [{p.sku}] {p.name} ({p.quantity} {p.unit})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  value={item.selectedAction}
                                  onChange={(e) => updatePdfBatchItemField(pageIdx, itemIdx, 'selectedAction', e.target.value as TransactionType)}
                                  className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[11px] bg-white focus:outline-hidden focus:border-blue-500"
                                >
                                  <option value="OUT">📤 เบิกออก [OUT]</option>
                                  <option value="IN">📥 รับเข้า [IN]</option>
                                  <option value="RETURN">🔄 คืนสินค้า [RETURN]</option>
                                </select>
                                {item.selectedAction === 'RETURN' && (
                                  <select
                                    value={item.selectedReturnStatus || 'RE_STOCK'}
                                    onChange={(e) => updatePdfBatchItemField(pageIdx, itemIdx, 'selectedReturnStatus', e.target.value as ReturnStatus)}
                                    className="w-full border border-slate-200 rounded px-1 py-0.5 text-[9px] mt-1 bg-white"
                                  >
                                    <option value="RE_STOCK">คืนสต๊อกหลัก</option>
                                    <option value="DAMAGED_WRITE_OFF">ชำรุดตัดทิ้ง</option>
                                    <option value="PENDING_INSPECT">รอตรวจคุณภาพ</option>
                                  </select>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex flex-col items-center gap-1.5">
                                  {/* Primary Qty Controller */}
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => updatePdfBatchItemField(pageIdx, itemIdx, 'quantity', Math.max(1, item.quantity - 1))}
                                      className="p-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="font-bold text-[11px] w-5 text-center">{item.quantity}</span>
                                    <button
                                      onClick={() => updatePdfBatchItemField(pageIdx, itemIdx, 'quantity', item.quantity + 1)}
                                      className="p-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>

                                  {/* Multiplier Setup */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center gap-0.5 text-[9px] text-slate-500">
                                      <span className="whitespace-nowrap">คูณโปรฯ:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.multiplier || 1}
                                        onChange={(e) => {
                                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                          updatePdfBatchItemField(pageIdx, itemIdx, 'multiplier', val);
                                          if (val === 1) {
                                            updatePdfBatchItemField(pageIdx, itemIdx, 'multiplierReason', '');
                                          } else {
                                            updatePdfBatchItemField(pageIdx, itemIdx, 'multiplierReason', `ปรับแต่งตัวคูณสต๊อก x${val}`);
                                          }
                                        }}
                                        className="w-9 text-center font-bold bg-slate-50 border border-slate-200 rounded text-[9px] py-0 outline-hidden focus:border-blue-500 focus:bg-white"
                                      />
                                    </div>
                                    {item.multiplier && item.multiplier > 1 && (
                                      <div className="text-[8px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded text-center max-w-[120px] leading-tight shrink-0">
                                        {item.multiplierReason || 'โปรของแถม'}
                                      </div>
                                    )}
                                    <div className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 mt-0.5">
                                      หักสุทธิ: {item.quantity * (item.multiplier || 1)} ชิ้น
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => removePdfBatchItem(pageIdx, itemIdx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* PDF Batch Save Action Panel */}
                <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    * ปรับปรุงยอดสินค้าเฉพาะรายการที่จับคู่ได้สำเร็จในคลังเท่านั้น
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={resetPdfUploader}
                      className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      ยกเลิกทั้งหมด
                    </button>
                    <button
                      onClick={handleConfirmPdfBatchTransactions}
                      disabled={isAnalyzingPdf || !canRecordTransactions}
                      className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>ยืนยันบันทึกสต๊อกทุกแผ่น ({pdfBatchResults.reduce((acc, page) => acc + page.extractedItems.filter(item => item.matched).length, 0)} รายการ)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : scanResult ? (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                {/* Meta block */}
                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium block">เลขที่สั่งซื้อ:</span>
                    <span className="font-bold text-slate-800">{scanResult.orderId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">เลขพัสดุ Tracking:</span>
                    <span className="font-bold text-blue-600 underline font-mono">{scanResult.trackingNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">ประเภทเอกสาร:</span>
                    <span className="font-semibold text-slate-700">
                      {scanResult.labelType === 'SHIP_LABEL' ? '📦 ใบปะขนส่ง' : '📄 บิลเอกสาร'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">การทำงานแนะนำ:</span>
                    <span className="font-bold text-rose-600">
                      {scanResult.detectedAction === 'IN' ? '📥 นำเข้าคลัง' : '📤 ส่งมอบสินค้า'}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                        <th className="p-3">ข้อมูลสแกน (SKU/ชื่อจากใบ)</th>
                        <th className="p-3">สินค้าที่พบคลังระบบ (Matched)</th>
                        <th className="p-3 w-28 text-center">ประเภทรายการ</th>
                        <th className="p-3 w-24 text-center">จำนวนสแกน</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {scanResult.extractedItems.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${!item.matched ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-3 w-72">
                            <div className="space-y-1.5 max-w-[280px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-bold shrink-0 w-8">SKU:</span>
                                <input
                                  type="text"
                                  value={item.sku}
                                  onChange={(e) => handleUpdateScannedSku(idx, e.target.value)}
                                  placeholder="รหัส SKU บนใบ"
                                  className="font-mono bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded text-[11px] border border-slate-200 focus:border-blue-500 focus:bg-white w-full outline-hidden"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-bold shrink-0 w-8">ชื่อใบ:</span>
                                <input
                                  type="text"
                                  value={item.productName}
                                  onChange={(e) => handleUpdateScannedName(idx, e.target.value)}
                                  placeholder="ชื่อสินค้าบนใบ"
                                  className="text-slate-600 text-[11px] px-1.5 py-0.5 rounded border border-slate-200 focus:border-blue-500 focus:bg-white w-full outline-hidden"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {item.matched && item.matchedProduct ? (
                              <div className="space-y-1.5">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-800 block leading-tight text-[11px]">{item.matchedProduct.name}</span>
                                  <span className="text-[10px] text-slate-500 block">
                                    คงคลัง: <strong className="text-slate-700">{item.matchedProduct.quantity} {item.matchedProduct.unit}</strong> | พิกัด: <span className="bg-slate-100 text-slate-600 px-1 rounded text-[9px]">{item.matchedProduct.location}</span>
                                  </span>
                                </div>
                                <div className="pt-1 max-w-[260px]">
                                  <select
                                    className="w-full border border-slate-200 hover:border-blue-400 rounded px-1.5 py-1 text-[11px] focus:outline-hidden focus:border-blue-500 bg-white"
                                    value={item.matchedProduct.id}
                                    onChange={(e) => {
                                      const selectedId = e.target.value;
                                      const prod = products.find(p => p.id === selectedId);
                                      if (prod) {
                                        handleManualMatch(idx, prod);
                                      } else {
                                        handleManualMatch(idx, null);
                                      }
                                    }}
                                  >
                                    <option value="">-- ค้นหา/เปลี่ยนตัวจับคู่สินค้าระบบ --</option>
                                    {sortedProducts.map(p => (
                                      <option key={p.id} value={p.id}>
                                        [{p.sku}] {p.name} ({p.quantity} {p.unit})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1 text-amber-600 font-semibold text-[10px]">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>ไม่พบ SKU ในสต๊อกระบบ (ปรับแต่งคลังเองได้ด้านล่าง)</span>
                                </div>
                                <div className="max-w-[260px]">
                                  <select
                                    className="w-full border border-amber-300 hover:border-blue-500 rounded px-1.5 py-1 text-[11px] focus:outline-hidden focus:border-blue-500 bg-amber-50/50"
                                    value=""
                                    onChange={(e) => {
                                      const selectedId = e.target.value;
                                      const prod = products.find(p => p.id === selectedId);
                                      if (prod) {
                                        handleManualMatch(idx, prod);
                                      }
                                    }}
                                  >
                                    <option value="">👉 เลือกคู่สินค้าในระบบด้วยตนเอง...</option>
                                    {sortedProducts.map(p => (
                                      <option key={p.id} value={p.id}>
                                        [{p.sku}] {p.name} ({p.quantity} {p.unit})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <select
                              value={item.selectedAction}
                              onChange={(e) => updateScannedItemField(idx, 'selectedAction', e.target.value)}
                              className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-hidden focus:border-blue-500 bg-white"
                            >
                              <option value="OUT">📤 เบิกออก [OUT]</option>
                              <option value="IN">📥 รับเข้า [IN]</option>
                              <option value="RETURN">🔄 สินค้าคืน [RETURN]</option>
                            </select>
                            {item.selectedAction === 'RETURN' && (
                              <select
                                value={item.selectedReturnStatus || 'RE_STOCK'}
                                onChange={(e) => updateScannedItemField(idx, 'selectedReturnStatus', e.target.value)}
                                className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px] mt-1 bg-white"
                              >
                                <option value="RE_STOCK">คืนสต๊อกหลัก</option>
                                <option value="DAMAGED_WRITE_OFF">ชำรุดตัดทิ้ง</option>
                                <option value="PENDING_INSPECT">รอตรวจคุณภาพ</option>
                              </select>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-2">
                              {/* Primary Qty Controller */}
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => updateScannedItemField(idx, 'quantity', Math.max(1, item.quantity - 1))}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                  title="ลดจำนวนสแกน"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs w-6 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateScannedItemField(idx, 'quantity', item.quantity + 1)}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                  title="เพิ่มจำนวนสแกน"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Multiplier controller */}
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <span>ตัวคูณโปรฯ:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.multiplier || 1}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      updateScannedItemField(idx, 'multiplier', val);
                                      if (val === 1) {
                                        updateScannedItemField(idx, 'multiplierReason', '');
                                      } else {
                                        updateScannedItemField(idx, 'multiplierReason', `ปรับแต่งตัวคูณสต๊อก x${val}`);
                                      }
                                    }}
                                    className="w-10 text-center font-bold bg-slate-50 border border-slate-200 rounded text-[10px] py-0.5 outline-hidden focus:border-blue-500 focus:bg-white"
                                  />
                                </div>
                                {item.multiplier && item.multiplier > 1 && (
                                  <div className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-center max-w-[140px] leading-tight shrink-0">
                                    {item.multiplierReason || 'พบเงื่อนไขของแถม'}
                                  </div>
                                )}
                                <div className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 mt-0.5">
                                  ยอดสัญจรสุทธิ: {item.quantity * (item.multiplier || 1)} {item.matchedProduct?.unit || 'ชิ้น'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => removeScannedItem(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Confirm Panel */}
                <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    * ระบบจะปรับลดหรือเพิ่มสต๊อกตามสินค้าที่จับคู่ได้จริงสำเร็จในคลังเท่านั้น
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={resetAIUploader}
                      className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      สแกนใบอื่นใหม่
                    </button>
                    <button
                      onClick={() => handleConfirmBatchTransactions(scanResult.extractedItems)}
                      disabled={!canRecordTransactions}
                      className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>ยืนยันตัดสต๊อกระบบเรียลไทม์</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 bg-white rounded-lg p-10 flex flex-col items-center justify-center text-center h-full text-slate-400 min-h-60">
                <FileText className="w-10 h-10 text-slate-300 mb-3" />
                <h5 className="font-bold text-xs text-slate-700">ไม่มีข้อมูลการสแกนใบลาเบล</h5>
                <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-relaxed">
                  เมื่อคุณถ่ายรูปใบปะหน้า หรืออัปโหลดรูปบิลส่งสินค้า AI อัจฉริยะของระบบจะช่วยแปลงตัวอักษรบนกระดาษ และเสนอรายการหักสต๊อกสินค้าที่นี่โดยตรงแบบไม่ต้องพิมพ์ป้อนมือทีละชิ้น!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODE 2: BARCODE / QUICK MANUAL SKU SCANNER --- */}
      {activeMode === 'BARCODE_SCAN' && (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          {/* Left Panel: Scanned Input Control */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              แผงรับรหัสเครื่องสแกนบาร์โค้ด (Scanner Port)
            </h4>

            {/* Quick action config for scanner gun */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-2xs">
              
              {/* Type selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ประเภทรายการสำหรับการยิงสแกน (Operation Type):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setBarcodeAction('OUT');
                      setBarcodeReason('สแกนจ่ายสินค้า (Barcode checkout)');
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      barcodeAction === 'OUT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>เบิกจ่าย [OUT]</span>
                  </button>
                  <button
                    onClick={() => {
                      setBarcodeAction('IN');
                      setBarcodeReason('สแกนรับของนำเข้าคลังสินค้า');
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      barcodeAction === 'IN'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>รับเข้า [IN]</span>
                  </button>
                  <button
                    onClick={() => {
                      setBarcodeAction('RETURN');
                      setBarcodeReason('สแกนรับสินค้าคืน/ตีกลับของลูกค้า');
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      barcodeAction === 'RETURN'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ตีกลับ [RETURN]</span>
                  </button>
                </div>
              </div>

              {/* In case of Return, show extra status */}
              {barcodeAction === 'RETURN' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สภาพของสินค้าที่ตีคืนกลับเข้าสต๊อก:
                  </label>
                  <select
                    value={barcodeReturnStatus}
                    onChange={(e) => setBarcodeReturnStatus(e.target.value as ReturnStatus)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:outline-hidden focus:border-blue-500 font-semibold"
                  >
                    <option value="RE_STOCK">คืนเข้าสต๊อกใช้งานหลัก (Re-stock)</option>
                    <option value="DAMAGED_WRITE_OFF">ชำรุดตัดทิ้งเป็นค่าเสื่อม (Write-off)</option>
                    <option value="PENDING_INSPECT">รอคัดแยกตรวจสอบคุณภาพ (Inspect)</option>
                  </select>
                </div>
              )}

              {/* Reason input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุ / เหตุผลทำรายการ (Transaction Memo):
                </label>
                <input
                  type="text"
                  value={barcodeReason}
                  onChange={(e) => setBarcodeReason(e.target.value)}
                  placeholder="เช่น เบิกส่งออเดอร์สาขา"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-hidden focus:border-blue-500 bg-slate-50"
                />
              </div>

              {/* Barcode Gun Port Trigger Area */}
              <div className="pt-2 border-t border-slate-100">
                <form onSubmit={handleBarcodeSubmit}>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>🔫 ช่องรับข้อมูลการสแกน (คีย์บอร์ด / ปืนสแกน):</span>
                    <span className="text-[10px] text-blue-600 animate-pulse font-normal">กำลังรอสัญญาณ...</span>
                  </label>
                  
                  <div className="relative">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="ยิงบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter..."
                      className="w-full bg-slate-900 text-white border-2 border-blue-500 rounded-lg px-4 py-3 pl-10 text-xs font-bold font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-blue-500/50"
                    />
                    <Barcode className="w-5 h-5 text-blue-400 absolute left-3 top-3" />
                  </div>
                </form>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                  💡 <strong>Tip สำหรับความเร็วสูงสุด:</strong> ต่อปืนยิงสแกนเนอร์บาร์โค้ดเข้าพอร์ต USB / Bluetooth เมื่อสแกน บาร์โค้ดปืนจะสั่งพิมพ์ Enter อัตโนมัติ เพื่อเพิ่มรายการสินค้านั้นเข้าไปในตารางทันที พร้อมเสียงบี๊บยืนยัน!
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: Scanned items cart */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>รายการยิงสแกนคิวปัจจุบัน (Scanned Batch Cart)</span>
              <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                {barcodeList.length} ชิ้น
              </span>
            </h4>

            {barcodeList.length > 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] text-slate-500 font-semibold">
                        <th className="p-3">สินค้าที่สแกน (SKU & ชื่อสินค้า)</th>
                        <th className="p-3 w-32 text-center">ประเภทการอัปเดต</th>
                        <th className="p-3 w-28 text-center">จำนวนชิ้น</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {barcodeList.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50/40 transition-colors ${!item.matched ? 'bg-amber-50/30' : ''}`}>
                          <td className="p-3">
                            <div className="font-bold text-slate-800 leading-tight">{item.productName}</div>
                            <span className="font-mono text-[10px] text-slate-500 block mt-0.5">
                              SKU: <strong className="text-slate-700">{item.sku}</strong>
                              {item.matchedProduct && ` | คงเหลือสต๊อกล่าสุด: ${item.matchedProduct.quantity} ${item.matchedProduct.unit}`}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${
                              item.selectedAction === 'IN' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : item.selectedAction === 'OUT' 
                                ? 'bg-rose-100 text-rose-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {item.selectedAction === 'IN' ? '📥 รับของเข้า [IN]' : item.selectedAction === 'OUT' ? '📤 ส่งของออก [OUT]' : '🔄 ลูกค้าคืน [RETURN]'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-1.5">
                              {/* Primary Qty Controller */}
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => adjustBarcodeQty(idx, -1)}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs w-6 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => adjustBarcodeQty(idx, 1)}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Multiplier Setup */}
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <span>ตัวคูณโปรฯ:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.multiplier || 1}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      updateBarcodeItemField(idx, 'multiplier', val);
                                      if (val === 1) {
                                        updateBarcodeItemField(idx, 'multiplierReason', '');
                                      } else {
                                        updateBarcodeItemField(idx, 'multiplierReason', `ปรับแต่งตัวคูณสต๊อก x${val}`);
                                      }
                                    }}
                                    className="w-10 text-center font-bold bg-slate-50 border border-slate-200 rounded text-[10px] py-0.5 outline-hidden focus:border-blue-500 focus:bg-white"
                                  />
                                </div>
                                {item.multiplier && item.multiplier > 1 && (
                                  <div className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-center max-w-[140px] leading-tight shrink-0">
                                    {item.multiplierReason || 'พบเงื่อนไขของแถม'}
                                  </div>
                                )}
                                <div className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 mt-0.5">
                                  ยอดสัญจรสุทธิ: {item.quantity * (item.multiplier || 1)} ชิ้น
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => removeBarcodeItem(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer and Submit block */}
                <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                    <Volume2 className="w-4 h-4 text-slate-400" />
                    <span>ลำโพงช่วยส่งสัญญาณยืนยันการสแกนสำเร็จถูกเปิดใช้งานแล้ว</span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setBarcodeList([])}
                      className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      ล้างตะกร้าสแกน
                    </button>
                    <button
                      onClick={() => handleConfirmBatchTransactions(barcodeList)}
                      disabled={!canRecordTransactions || barcodeList.filter(item => item.matched).length === 0}
                      className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>บันทึกกลุ่มความเคลื่อนไหวสต๊อก ({barcodeList.filter(item => item.matched).length} ชิ้น)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 bg-white rounded-lg p-10 flex flex-col items-center justify-center text-center h-full text-slate-400 min-h-60">
                <Barcode className="w-10 h-10 text-slate-300 mb-3 animate-pulse" />
                <h5 className="font-bold text-xs text-slate-700">ไม่มีข้อมูลการยิงสแกนสินค้า</h5>
                <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-relaxed">
                  คลิกที่ช่องรับรหัสบาร์โค้ดสีดำด้านซ้ายมือ จากนั้นใช้สแกนเนอร์บาร์โค้ดสแกนป้ายของสินค้า หรือลองพิมพ์รหัส SKU แล้วกด Enter รายการสินค้าจะมาปรากฏพร้อมอัปเดตยอดตรงนี้เป็นชุดๆ เพื่อลดเวลาการทำเอกสารครับ
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
