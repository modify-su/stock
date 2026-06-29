import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  FileText, 
  Sparkles, 
  Check, 
  X, 
  Loader2, 
  AlertTriangle, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ChevronRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  FlipHorizontal,
  Scan
} from 'lucide-react';
import { Product, Transaction, TransactionType, ReturnStatus, UserProfile } from '../types';

interface SmartScannerProps {
  products: Product[];
  transactions: Transaction[];
  onRecordMultipleTransactions: (txsData: Omit<Transaction, 'id' | 'date'>[]) => Promise<void>;
  canRecordTransactions: boolean;
  currentUser: UserProfile;
}

interface ExtractedItem {
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
    weight?: number;
    weightUnit?: string;
  } | null;
}

interface ScanResult {
  orderId: string;
  trackingNo: string;
  labelType: string;
  detectedAction: 'IN' | 'OUT' | 'RETURN';
  extractedItems: ExtractedItem[];
}

export default function SmartScanner({
  products,
  transactions,
  onRecordMultipleTransactions,
  canRecordTransactions,
  currentUser
}: SmartScannerProps) {
  const [activeMode, setActiveMode] = useState<'CAMERA' | 'UPLOAD' | 'PDF_TEXT'>('CAMERA');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  // Camera states
  const [hasCamera, setHasCamera] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isAutoScanActive, setIsAutoScanActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Upload states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // PDF Text states
  const [pdfText, setPdfText] = useState('');
  const [pdfPageNo, setPdfPageNo] = useState(1);

  // Scan analysis results
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [actionType, setActionType] = useState<'IN' | 'OUT' | 'RETURN'>('OUT');
  const [returnStatus, setReturnStatus] = useState<ReturnStatus>('RE_STOCK');
  const [referenceNo, setReferenceNo] = useState('');
  const [allowDuplicateForce, setAllowDuplicateForce] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check if inside IFrame, list cameras, and auto start camera on mount
  useEffect(() => {
    setIsIframe(typeof window !== 'undefined' && window.self !== window.top);
    
    const initScanner = async () => {
      const videoDevices = await checkCameras();
      if (videoDevices && videoDevices.length > 0) {
        // Automatically start camera with a slight delay to ensure browser readiness
        setTimeout(() => {
          startCamera('environment', videoDevices[0].deviceId);
        }, 500);
      } else {
        // Try direct fallback start
        setTimeout(() => {
          startCamera('environment', '');
        }, 500);
      }
    };
    initScanner();

    return () => {
      stopCamera();
    };
  }, []);

  // Simple Web Audio API Beep Sound Generator
  const playBeep = (type: 'success' | 'error' | 'scan') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'error') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(120, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      } else { // scan
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.08);
      }
    } catch (e) {
      console.warn('Audio context is not allowed or failed to play:', e);
    }
  };

  const checkCameras = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setHasCamera(false);
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedCameraId(videoDevices[0].deviceId);
        setHasCamera(true);
        return videoDevices;
      } else {
        setHasCamera(false);
        return [];
      }
    } catch (err) {
      console.warn('Error enumerating cameras:', err);
      setHasCamera(false);
      return [];
    }
  };

  const startCamera = async (currentFacingMode = facingMode, useDeviceId = selectedCameraId) => {
    setErrorMessage(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: useDeviceId 
          ? { deviceId: { exact: useDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Error starting camera:', err);
      // Fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (fallbackErr: any) {
        setErrorMessage(
          "❌ ไม่สามารถเปิดกล้องได้: " + (fallbackErr.message || "ไม่มีสิทธิ์เข้าถึงหรือไม่มีกล้องเว็บแคม") +
          " แนะนำให้อัปโหลดไฟล์รูปใบปะหน้าสินค้า หรือกรอกสต๊อกแบบคีย์มือแทนครับ"
        );
        setIsCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedCameraId(''); // clear ID to use facingMode constraint
    if (isCameraActive) {
      setTimeout(() => startCamera(nextMode, ''), 100);
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCameraId(newId);
    if (isCameraActive) {
      setTimeout(() => startCamera(facingMode, newId), 100);
    }
  };

  // Helper to check if a tracking number or order ID already exists in transactions
  const checkDuplicateNo = (refNo: string, trackNo: string) => {
    if (!refNo && !trackNo) return null;
    
    const duplicate = transactions.find(t => 
      (refNo && t.referenceNo === refNo) || 
      (trackNo && t.referenceNo === trackNo) ||
      (trackNo && t.id.includes(trackNo))
    );

    return duplicate || null;
  };

  const handleScanAPI = async (base64Image: string, keepCameraActive: boolean = false) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    playBeep('scan');

    try {
      const res = await fetch('/api/scan-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'การส่งวิเคราะห์ล้มเหลว');
      }

      const data: ScanResult = await res.json();
      
      setScanResult(data);
      setActionType(data.detectedAction || 'OUT');
      setReferenceNo(data.trackingNo || data.orderId || '');

      // Check for duplicate transaction
      const duplicateTx = checkDuplicateNo(data.orderId, data.trackingNo);
      
      if (keepCameraActive) {
        // AUTO SCAN FLOW
        const allMatched = data.extractedItems && data.extractedItems.length > 0 && data.extractedItems.every(item => item.matched && item.matchedProduct);
        
        if (allMatched && !duplicateTx) {
          if (!canRecordTransactions) {
            playBeep('error');
            setErrorMessage("❌ คุณไม่มีสิทธิ์ของพนักงานในการบันทึกรายการสินค้า (ระบบหยุดออโต้สแกน)");
            setIsAutoScanActive(false);
            return;
          }

          // Build transaction records
          const txsToRecord: Omit<Transaction, 'id' | 'date'>[] = data.extractedItems.map(item => ({
            productId: item.matchedProduct!.id,
            productSku: item.matchedProduct!.sku,
            productName: item.matchedProduct!.name,
            type: data.detectedAction || 'OUT',
            quantity: item.quantity,
            referenceNo: data.trackingNo || data.orderId || 'AUTO_SCAN_AI',
            reason: `ตัดสต๊อกอัตโนมัติ (ระบบสแกนต่อเนื่อง) ประเภท: ${
              data.detectedAction === 'IN' ? 'รับสินค้า' : data.detectedAction === 'OUT' ? 'ส่งสินค้า' : 'คืนสินค้า'
            }`,
            operator: currentUser.name,
            ...(data.detectedAction === 'RETURN' && { returnStatus: returnStatus })
          }));

          await onRecordMultipleTransactions(txsToRecord);
          playBeep('success');
          setSuccessMessage(`✅ [ออโต้สแกนสำเร็จ] บันทึกและตัดสต๊อกสินค้า ${txsToRecord.map(t => `${t.productSku} x${t.quantity}`).join(', ')} เรียบร้อย! (เลขแทรค/ออเดอร์: ${data.trackingNo || data.orderId || '-'})`);
          
          // Clear result for the next frame
          setScanResult(null);
        } else {
          playBeep('error');
          setIsAutoScanActive(false); // Stop auto scan to let user resolve manually

          if (duplicateTx) {
            setErrorMessage(`⚠️ [ออโต้สแกนหยุดทำงาน] ตรวจพบข้อมูลซ้ำ: เลขอ้างอิง (${data.trackingNo || data.orderId}) เคยถูกบันทึกไปแล้วเมื่อ ${new Date(duplicateTx.date).toLocaleString()} หากต้องการทำซ้ำกรุณาเปิดอนุญาตบันทึกซ้ำและกดบันทึกด้วยตนเองครับ`);
          } else if (!data.extractedItems || data.extractedItems.length === 0) {
            setErrorMessage(`❌ [ออโต้สแกนหยุดทำงาน] ไม่พบข้อมูลสินค้าจากใบปะหน้า กรุณาเพิ่มสินค้าหรือกรอก SKU และกดบันทึกด้วยตนเอง`);
          } else {
            const unmatchedItems = data.extractedItems.filter(item => !item.matched);
            setErrorMessage(`❌ [ออโต้สแกนหยุดทำงาน] พบ SKU ที่จับคู่สินค้าในระบบไม่เจอ (${unmatchedItems.map(i => i.sku || 'ไม่ทราบ SKU').join(', ')}) กรุณาเลือกจับคู่สินค้าหรือแก้ไข SKU ด้วยตนเอง จากนั้นกดบันทึกและตัดสต๊อกด้านล่างครับ`);
          }
        }
      } else {
        // MANUAL/UPLOAD SCAN FLOW
        if (duplicateTx) {
          playBeep('error');
          setErrorMessage(`⚠️ ตรวจพบเลขออเดอร์/แทรคกิ้งนี้ (${data.trackingNo || data.orderId}) ได้ถูกทำรายการไปแล้วเมื่อ ${new Date(duplicateTx.date).toLocaleString()} โดยผู้ใช้ ${duplicateTx.operator} หากคุณต้องการทำซ้ำกรุณากดอนุญาตให้ทำรายการซ้ำด้านล่างครับ`);
        } else {
          playBeep('success');
          setSuccessMessage('🎉 สแกนวิเคราะห์ใบปะหน้าพัสดุสำเร็จ! AI ค้นหา SKU และรายการสินค้าเสร็จเรียบร้อย');
        }
      }

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setErrorMessage(`❌ ผิดพลาดในการวิเคราะห์ใบปะหน้า: ${err.message || 'ระบบหลังบ้านไม่ตอบสนอง'}`);
      if (keepCameraActive) {
        setIsAutoScanActive(false); // Stop auto scan if API throws error
      }
    } finally {
      setIsLoading(false);
    }
  };

  const compressImage = (base64Str: string, maxDim: number = 960, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      // If not an image (e.g. PDF), bypass compression
      if (!base64Str.startsWith('data:image/')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
      img.src = base64Str;
    });
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      
      // Check if video is loaded and playing
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        setErrorMessage("❌ ไม่สามารถถ่ายภาพได้: กล้องเว็บแคมยังโหลดภาพไม่เสร็จ หรือถูกจำกัดสิทธิ์โดยเบราว์เซอร์ แนะนำให้เปิดในแท็บใหม่ หรืออัปโหลดรูปภาพใบปะหน้าแทนครับ");
        playBeep('error');
        return;
      }

      const canvas = canvasRef.current;
      
      // Optimize frame size (max 960px) for much faster upload & AI processing
      const MAX_DIM = 960;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }
      
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Reduce jpeg quality to 0.75 for extremely lightweight data transfer (around 50-90KB)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setUploadedImage(dataUrl);
        stopCamera();
        setActiveMode('UPLOAD');
        handleScanAPI(dataUrl, false);
      }
    }
  };

  const captureFrameForAutoScan = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return; // skip if video is not fully active
      }

      const canvas = canvasRef.current;
      
      // Optimize frame size (max 800px) for superfast auto-scanning
      const MAX_DIM = 800;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setUploadedImage(dataUrl);
        // Do not stop camera, do not change mode, just send to API
        handleScanAPI(dataUrl, true);
      }
    }
  };

  // Auto scan interval effect (Optimized to scan every 3 seconds for high responsiveness)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isAutoScanActive && isCameraActive && activeMode === 'CAMERA') {
      intervalId = setInterval(() => {
        if (!isLoading) {
          captureFrameForAutoScan();
        }
      }, 3000); // scan every 3 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoScanActive, isCameraActive, activeMode, isLoading]);

  const handleFile = (file: File) => {
    if (!file) return;

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async () => {
        const resultBase64 = reader.result as string;
        
        if (file.type.startsWith('image/')) {
          // Compress large photos to max 1024px to ensure rapid transmission & API response
          const compressed = await compressImage(resultBase64, 1024, 0.8);
          setUploadedImage(compressed);
          handleScanAPI(compressed);
        } else {
          setUploadedImage(resultBase64);
          handleScanAPI(resultBase64);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage("❌ ระบบสแกนใบปะหน้ารองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP) หรือไฟล์เอกสาร PDF เท่านั้นครับ");
      playBeep('error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // PDF Text analysis
  const handlePdfTextScan = async () => {
    if (!pdfText.trim()) {
      setErrorMessage('❌ กรุณากรอกหรือคัดลอกข้อความจากเอกสาร PDF/ใบคำสั่งซื้อก่อนดำเนินการครับ');
      playBeep('error');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    playBeep('scan');

    try {
      const res = await fetch('/api/scan-pdf-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: [
            {
              pageNumber: pdfPageNo,
              text: pdfText
            }
          ]
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'การส่งวิเคราะห์ล้มเหลว');
      }

      const data = await res.json();
      const results = data.results || [];
      if (results.length > 0) {
        const firstPageResult = results[0];
        setScanResult({
          orderId: firstPageResult.orderId || '',
          trackingNo: firstPageResult.trackingNo || '',
          labelType: firstPageResult.labelType || 'UNKNOWN',
          detectedAction: firstPageResult.detectedAction || 'OUT',
          extractedItems: firstPageResult.extractedItems || []
        });

        setActionType(firstPageResult.detectedAction === 'IN' ? 'IN' : 'OUT');
        setReferenceNo(firstPageResult.trackingNo || firstPageResult.orderId || '');

        const duplicateTx = checkDuplicateNo(firstPageResult.orderId, firstPageResult.trackingNo);
        if (duplicateTx) {
          playBeep('error');
          setErrorMessage(`⚠️ ตรวจพบเลขออเดอร์/แทรคกิ้งนี้ (${firstPageResult.trackingNo || firstPageResult.orderId}) ได้ถูกทำรายการตัดคลังไปแล้วเมื่อ ${new Date(duplicateTx.date).toLocaleString()} หากต้องการลงรายการซ้ำกรุณากดยอมรับซ้ำครับ`);
        } else {
          playBeep('success');
          setSuccessMessage('🎉 ถอดข้อความ PDF และจำลองการตัดสต๊อกเสร็จสิ้น!');
        }
      } else {
        throw new Error('ไม่พบข้อมูลผลลัพธ์การสแกนในเนื้อความที่ส่งไป');
      }

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setErrorMessage(`❌ ผิดพลาดในการวิเคราะห์ข้อความ PDF: ${err.message || 'ระบบวิเคราะห์ล้มเหลว'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Modify quantities & item values in local result list
  const updateItemQuantity = (index: number, change: number) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    items[index].quantity = Math.max(1, items[index].quantity + change);
    setScanResult({ ...scanResult, extractedItems: items });
  };

  const removeItem = (index: number) => {
    if (!scanResult) return;
    const items = scanResult.extractedItems.filter((_, i) => i !== index);
    setScanResult({ ...scanResult, extractedItems: items });
  };

  const addNewItemRow = () => {
    if (!scanResult) return;
    const newItem: ExtractedItem = {
      sku: '',
      productName: 'เพิ่มสินค้าแบบกำหนดเอง',
      quantity: 1,
      matched: false,
      matchedProduct: null
    };
    setScanResult({
      ...scanResult,
      extractedItems: [...scanResult.extractedItems, newItem]
    });
  };

  const handleItemSkuChange = (index: number, val: string) => {
    if (!scanResult) return;
    const items = [...scanResult.extractedItems];
    const cleanSku = val.trim();
    items[index].sku = cleanSku;

    // Try to match on-the-fly
    const matched = products.find(p => p.sku.toLowerCase() === cleanSku.toLowerCase());
    if (matched) {
      items[index].matched = true;
      items[index].matchedProduct = {
        id: matched.id,
        sku: matched.sku,
        name: matched.name,
        quantity: matched.quantity,
        unit: matched.unit || 'ชิ้น',
        location: matched.location || 'ไม่ได้ระบุ',
        weight: matched.weight,
        weightUnit: matched.weightUnit,
      };
    } else {
      items[index].matched = false;
      items[index].matchedProduct = null;
    }

    setScanResult({ ...scanResult, extractedItems: items });
  };

  // Handle confirming and submitting the transactions
  const handleConfirmTransactions = async () => {
    if (!scanResult || scanResult.extractedItems.length === 0) return;

    if (!canRecordTransactions) {
      setErrorMessage("❌ คุณไม่มีสิทธิ์ของพนักงานในการบันทึกรายการสินค้า (สิทธิ์ของคุณถูกจำกัด)");
      playBeep('error');
      return;
    }

    // Check duplicate once again
    if (!allowDuplicateForce) {
      const duplicateTx = checkDuplicateNo(scanResult.orderId, scanResult.trackingNo);
      if (duplicateTx) {
        setErrorMessage("⚠️ ไม่สามารถลงรายการซ้ำได้ กรุณาติ๊กเลือก 'อนุญาตให้ลงรายการซ้ำ' หากมั่นใจว่าพัสดุนี้ต้องการทำรายการมากกว่า 1 ครั้ง");
        playBeep('error');
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const txsToRecord: Omit<Transaction, 'id' | 'date'>[] = [];

      for (const item of scanResult.extractedItems) {
        if (!item.matched || !item.matchedProduct) {
          // Skip or handle unmatched items - for robust safety, we only record transactions for matched items in the database!
          continue;
        }

        const txData: Omit<Transaction, 'id' | 'date'> = {
          productId: item.matchedProduct.id,
          productSku: item.matchedProduct.sku,
          productName: item.matchedProduct.name,
          type: actionType,
          quantity: item.quantity,
          referenceNo: referenceNo || scanResult.trackingNo || scanResult.orderId || 'SCAN_AI',
          reason: `ตัดสต๊อกอัตโนมัติด้วยระบบสแกนใบปะหน้า AI (ประเภท: ${actionType === 'IN' ? 'รับสินค้า' : actionType === 'OUT' ? 'ส่งสินค้า' : 'คืนสินค้า'})`,
          operator: currentUser.name,
          ...(actionType === 'RETURN' && { returnStatus: returnStatus })
        };

        txsToRecord.push(txData);
      }

      if (txsToRecord.length === 0) {
        throw new Error("ไม่มีสินค้าใดในใบปะหน้านี้ที่ตรงกับรหัส SKU ในฐานข้อมูลคลังปัจจุบัน กรุณาตรวจสอบรหัส SKU หรือจับคู่สินค้าให้ถูกต้องก่อนกดบันทึกครับ");
      }

      await onRecordMultipleTransactions(txsToRecord);
      
      playBeep('success');
      setSuccessMessage(`🎉 บันทึกรายการสแกนจำนวน ${txsToRecord.length} รายการลงสต๊อกเรียบร้อย!`);
      // Clear result list
      setScanResult(null);
      setUploadedImage(null);
      setPdfText('');

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setErrorMessage(`❌ ผิดพลาดในการบันทึกสต๊อก: ${err.message || 'บันทึกสต๊อกล้มเหลว'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setUploadedImage(null);
    setPdfText('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setAllowDuplicateForce(false);
    if (isCameraActive) {
      startCamera();
    }
  };

  return (
    <div id="smart-scanner-root" className="space-y-6">
      {/* Hidden canvas used for capturing video frames */}
      <canvas ref={canvasRef} className="hidden" style={{ display: 'none' }} />

      {/* Tab Navigation for modes */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveMode('UPLOAD');
            stopCamera();
            setErrorMessage(null);
          }}
          className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeMode === 'UPLOAD'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            <span>อัปโหลดรูปภาพใบปะหน้า</span>
          </div>
        </button>
        <button
          onClick={() => {
            setActiveMode('CAMERA');
            setIsAutoScanActive(true);
            startCamera();
            setErrorMessage(null);
          }}
          className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeMode === 'CAMERA'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Camera className="w-4 h-4" />
            <span>สแกนกล้องสด (Webcam)</span>
          </div>
        </button>
        <button
          onClick={() => {
            setActiveMode('PDF_TEXT');
            stopCamera();
            setErrorMessage(null);
          }}
          className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeMode === 'PDF_TEXT'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            <span>สแกนข้อความจาก PDF / แพลตฟอร์ม</span>
          </div>
        </button>
      </div>

      {/* IFrame camera permission block advice */}
      {isIframe && activeMode === 'CAMERA' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <p className="font-bold">💡 คำแนะนำความปลอดภัยและการใช้สิทธิ์กล้อง:</p>
              <p className="text-slate-600 mt-1">
                เนื่องจากเบราว์เซอร์มักจำกัดการเข้าถึงกล้องเว็บแคมผ่านกรอบ iFrame พัฒนา เพื่อให้คุณสามารถเปิดสแกนหน้ากล้องได้อย่างลื่นไหล 100% กรุณาคลิกเพื่อเปิดระบบคลังสินค้าในหน้าจอแบบเต็มจอ (New Tab)
              </p>
            </div>
          </div>
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0 text-center"
          >
            <ExternalLink className="w-4 h-4" />
            <span>เปิดระบบเต็มจอในแท็บใหม่ ↗️</span>
          </a>
        </div>
      )}

      {/* Mode Renderers */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Source */}
        <div className="md:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>ต้นทางข้อมูลใบปะหน้าพัสดุ</span>
          </h4>

          {/* UPLOAD MODE */}
          {activeMode === 'UPLOAD' && (
            <div className="space-y-4">
              <div 
                onClick={triggerFileSelect}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center group ${
                  isDragging 
                    ? 'border-indigo-600 bg-indigo-50/50 scale-[1.02]' 
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20'
                }`}
              >
                <Upload className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-indigo-600 animate-bounce' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <p className="text-sm font-bold text-slate-700">คลิกที่นี่เพื่อเลือกไฟล์ หรือลากรูปภาพ/PDF มาวาง</p>
                <p className="text-xs text-slate-400 mt-1">รองรับไฟล์ JPG, PNG, WebP และเอกสาร PDF ใบปะหน้าพัสดุ</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden" 
                />
              </div>

              {uploadedImage && (
                <div className="rounded-lg overflow-hidden border border-slate-300 bg-white p-2">
                  <div className="text-xs font-bold text-slate-500 mb-1.5">เอกสาร/ภาพที่ใช้วิเคราะห์ล่าสุด:</div>
                  {uploadedImage.startsWith("data:application/pdf") ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-100 rounded-lg">
                      <FileText className="w-12 h-12 text-red-500 mb-1.5 animate-pulse" />
                      <span className="text-xs font-bold text-slate-700">เอกสาร PDF ใบปะหน้าพัสดุ</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">ส่งเข้าระบบวิเคราะห์ด้วย AI แล้ว</span>
                    </div>
                  ) : (
                    <img src={uploadedImage} alt="Uploaded" className="w-full h-auto max-h-60 object-contain rounded" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* CAMERA MODE */}
          {activeMode === 'CAMERA' && (
            <div className="space-y-4">
              {hasCamera ? (
                <div className="space-y-3">
                  {/* Camera Selector */}
                  {cameras.length > 1 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">เลือกกล้องที่ต้องการ:</label>
                      <select
                        value={selectedCameraId}
                        onChange={handleCameraChange}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {cameras.map((cam, i) => (
                          <option key={cam.deviceId} value={cam.deviceId}>
                            {cam.label || `กล้องถ่ายรูปตัวที่ ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Camera Utility Controls */}
                  <div className="flex flex-wrap gap-2 items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setIsMirrored(!isMirrored)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isMirrored
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title="กลับด้านภาพกล้องสำหรับการอ่านฉลากหรือบาร์โค้ดปกติ"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                        <span>{isMirrored ? 'สลับกลับปกติ 🔄' : 'สลับเป็นกระจก 🪞'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        className="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                        title="สลับกล้องหน้า (เซลฟี่) หรือกล้องหลัง (กล้องหลักถ่ายพัสดุ)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>สลับเลนส์ ({facingMode === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'})</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextAuto = !isAutoScanActive;
                        setIsAutoScanActive(nextAuto);
                        if (nextAuto && !isCameraActive) {
                          startCamera();
                        }
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isAutoScanActive
                          ? 'bg-emerald-600 text-white animate-pulse shadow-md'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title="วิเคราะห์ตัดยอดโดยอัตโนมัติเมื่อวางพัสดุหน้ากล้องทุกๆ 5 วินาที"
                    >
                      <Scan className={`w-3.5 h-3.5 ${isAutoScanActive ? 'animate-spin' : ''}`} />
                      <span>{isAutoScanActive ? 'ออโต้สแกน: เปิดอยู่ 🟢' : 'เปิดออโต้สแกน 🔍'}</span>
                    </button>
                  </div>

                  {/* Video Viewport */}
                  <div className="relative w-full aspect-square xs:aspect-[4/3] sm:aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-300 flex items-center justify-center shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`absolute inset-0 w-full h-full object-cover ${
                        isMirrored ? 'scale-x-[-1]' : 'scale-x-100'
                      }`}
                    />
                    
                    {/* Floating Target Frame Guide */}
                    <div className="absolute inset-3 sm:inset-6 border border-indigo-400/40 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                      <div className="flex justify-between">
                        <div className="w-6 h-6 border-t-4 border-l-4 border-indigo-500"></div>
                        <div className="w-6 h-6 border-t-4 border-r-4 border-indigo-500"></div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-white bg-indigo-600/90 px-3 py-1 rounded-md self-center font-bold font-sans text-center shadow-md max-w-[90%]">
                        วางใบลาเบลพัสดุ/บาร์โค้ดสากลให้อยู่ในกรอบนี้
                      </span>
                      <div className="flex justify-between">
                        <div className="w-6 h-6 border-b-4 border-l-4 border-indigo-500"></div>
                        <div className="w-6 h-6 border-b-4 border-r-4 border-indigo-500"></div>
                      </div>
                    </div>

                    {/* Auto Scan Indicator Overlay */}
                    {isAutoScanActive && isCameraActive && (
                      <div className="absolute top-3 left-3 bg-slate-950/85 border border-emerald-500/40 text-emerald-400 px-2.5 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-lg select-none">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>ระบบสแกนอัตโนมัติทำงานอยู่ (ส่งตรวจทุก 5 วิ)</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {isCameraActive ? (
                      <>
                        <button
                          onClick={captureFrame}
                          disabled={isLoading}
                          className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-md"
                        >
                          <Camera className="w-4 h-4 animate-pulse" />
                          <span>กดถ่ายภาพสแกนแมนนวล 📸</span>
                        </button>
                        <button
                          onClick={stopCamera}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-2 rounded-lg text-xs cursor-pointer"
                        >
                          ปิดกล้อง
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startCamera(facingMode, selectedCameraId)}
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>เปิดใช้งานกล้องอีกครั้ง</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border border-slate-200 rounded-xl bg-white space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">ไม่สามารถเชื่อมต่อกล้องเว็บแคมได้</p>
                  <p className="text-[11px] text-slate-400">ระบบไม่พบกล้องเว็บแคมหรือคุณปิดกั้นการเข้าถึง แนะนำให้ใช้สแกนไฟล์รูปแทนครับ</p>
                </div>
              )}
            </div>
          )}

          {/* PDF TEXT MODE */}
          {activeMode === 'PDF_TEXT' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  คัดลอกและวางเนื้อหาข้อความจากเอกสาร PDF หรือบิลแพลตฟอร์ม:
                </label>
                <textarea
                  value={pdfText}
                  onChange={(e) => setPdfText(e.target.value)}
                  placeholder="คัดลอกข้อความในหน้าบิลพัสดุ (เช่น Ctrl+A ใน PDF แล้วนำมาวางตรงนี้) เพื่อให้ AI ถอด SKU สินค้าออกมาอัจฉริยะ"
                  className="w-full h-40 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-500 mb-0.5">ระบุหน้า PDF (กรณีสแกนทีละหน้า):</label>
                  <input
                    type="number"
                    min="1"
                    value={pdfPageNo}
                    onChange={(e) => setPdfPageNo(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-center font-bold"
                  />
                </div>
                <button
                  onClick={handlePdfTextScan}
                  disabled={isLoading}
                  className="flex-[2] h-[34px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 hover:shadow-md transition-all cursor-pointer mt-4"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>ประมวลผลข้อความ PDF ✨</span>
                </button>
              </div>
            </div>
          )}

          {/* Informational advice about scanned platforms */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 space-y-2">
            <h5 className="text-xs font-bold text-blue-950 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>แพลตฟอร์มที่แนะนำและรองรับ:</span>
            </h5>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              สแกนได้โดยตรง <strong>ไม่ต้องต่อ API พอร์ตใดๆ</strong> ทั้งใบปะหน้า Shopee, TikTok Shop, Lazada, ไปรษณีย์ไทย, J&T Express, Flash Express, Kerry และใบจัดบิลสั่งซื้อทั่วไป เพียงแค่สแกนและ AI จะตัดยอดคลังให้ทันที!
            </p>
          </div>
        </div>

        {/* Right Column: Scan Results and confirmation */}
        <div className="md:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>ผลการวิเคราะห์และถอดรหัสของ AI</span>
            </h4>
            {scanResult && (
              <button
                onClick={resetScanner}
                className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                <span>ล้างข้อมูลสแกน</span>
              </button>
            )}
          </div>

          {/* Loading Overlay State */}
          {isLoading && (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-indigo-50/20 rounded-xl border border-indigo-100/50">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Gemini AI กำลังวิเคราะห์ฉลากใบปะหน้าสินค้าอัจฉริยะ...</p>
              <p className="text-[10px] text-slate-400">กรุณารอสักครู่ ระบบกำลังจับคู่ SKU รหัสสินค้า กับยอดสต๊อกในระบบปัจจุบัน</p>
            </div>
          )}

          {/* Status Message Notification inside Column */}
          {errorMessage && !isLoading && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-bold">ตรวจสอบข้อมูล / คำเตือน:</span>
              </div>
              <p className="text-slate-700 leading-relaxed">{errorMessage}</p>
              
              {errorMessage.includes('⚠️ ตรวจพบเลขออเดอร์/แทรคกิ้งนี้') && (
                <div className="pt-1.5">
                  <label className="flex items-center gap-2 bg-white/70 px-3 py-1.5 border border-rose-300 rounded-md cursor-pointer text-slate-800 text-[11px] font-bold">
                    <input
                      type="checkbox"
                      checked={allowDuplicateForce}
                      onChange={(e) => setAllowDuplicateForce(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>อนุญาตให้ทำรายการซ้ำสำหรับพัสดุนี้ (บันทึกสต๊อกซ้ำ)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {successMessage && !isLoading && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3.5 rounded-lg text-xs flex items-start gap-2 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="font-medium">{successMessage}</p>
            </div>
          )}

          {/* No results prompt */}
          {!scanResult && !isLoading && (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
              <Sparkles className="w-8 h-8 text-indigo-300 mx-auto animate-pulse" />
              <p className="text-xs font-bold text-slate-500">ยังไม่มีข้อมูลการสแกน</p>
              <p className="text-[11px] text-slate-400">กรุณาอัปโหลดรูปภาพใบปะหน้า, กดถ่ายภาพด้วยกล้องสด หรือวางเนื้อหาบิลจาก PDF เพื่อถอด SKU และตัดยอดสต๊อกเรียลไทม์</p>
            </div>
          )}

          {/* Extracted items checklist panel */}
          {scanResult && !isLoading && (
            <div className="space-y-4 animate-fade-in">
              {/* Reference Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">เลขอ้างอิงขนส่ง (Tracking No.) / บิล:</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white font-bold font-sans text-slate-800"
                    placeholder="ไม่ได้ระบุเลขแทรคกิ้ง"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">เลขออเดอร์สั่งซื้อ (Order ID):</label>
                  <p className="mt-1 px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 rounded text-slate-700 min-h-[26px] flex items-center">
                    {scanResult.orderId || 'ไม่พบในใบลาเบล'}
                  </p>
                </div>
              </div>

              {/* Action type setup */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">เลือกประเภทความเคลื่อนไหวคลังพัสดุนี้:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType('OUT')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      actionType === 'OUT'
                        ? 'bg-red-50 text-red-700 border-red-300 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                    <span>ตัดออก (OUT - ส่งพัสดุ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('IN')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      actionType === 'IN'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                    <span>เพิ่มเข้า (IN - รับของเข้า)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('RETURN')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      actionType === 'RETURN'
                        ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                    <span>รับคืน (RETURN - คืนสินค้า)</span>
                  </button>
                </div>
              </div>

              {/* If RETURN is selected, show Return Status Selector */}
              {actionType === 'RETURN' && (
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 text-xs space-y-1.5">
                  <span className="font-bold text-amber-950 block">สถานะพัสดุรับคืน (Return Disposition):</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnStatus('RE_STOCK')}
                      className={`px-3 py-1.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer border ${
                        returnStatus === 'RE_STOCK'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      คืนเข้าคลังขายต่อ (Re-stock)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnStatus('DAMAGED_WRITE_OFF')}
                      className={`px-3 py-1.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer border ${
                        returnStatus === 'DAMAGED_WRITE_OFF'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      สินค้าชำรุดคัดทิ้ง (Write-off)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnStatus('PENDING_INSPECT')}
                      className={`px-3 py-1.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer border ${
                        returnStatus === 'PENDING_INSPECT'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      รอตรวจสอบสภาพ (Pending Inspect)
                    </button>
                  </div>
                </div>
              )}

              {/* Items Table List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">รายการสินค้าที่แกะข้อมูลได้:</label>
                  <button
                    onClick={addNewItemRow}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มสินค้าแถวใหม่</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {scanResult.extractedItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      {/* Left Side: SKU Matching */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={item.sku}
                            onChange={(e) => handleItemSkuChange(idx, e.target.value)}
                            className="px-2 py-0.5 border border-slate-200 rounded font-mono font-bold text-xs uppercase w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="รหัส SKU สินค้า"
                          />
                          
                          {item.matched ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5 shrink-0">
                              <Check className="w-2.5 h-2.5" />
                              <span>ตรงในคลัง</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5 shrink-0">
                              <X className="w-2.5 h-2.5" />
                              <span>ไม่พบ SKU นี้</span>
                            </span>
                          )}
                        </div>

                        {item.matched && item.matchedProduct ? (
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 text-[11px] line-clamp-1">{item.matchedProduct.name}</p>
                            <p className="text-[10px] text-slate-400">
                              คงเหลือปัจจุบัน: <strong className="text-slate-600">{item.matchedProduct.quantity} {item.matchedProduct.unit}</strong> | พิกัดเก็บ: <strong className="text-slate-600">{item.matchedProduct.location}</strong>
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic line-clamp-1">ชื่อที่ตรวจจับ: {item.productName || 'ไม่ระบุรหัส SKU สินค้า'}</p>
                        )}
                      </div>

                      {/* Right Side: Quantity Adjustments */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(idx, -1)}
                            className="p-1 px-2 text-slate-500 hover:bg-slate-200 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-slate-800 min-w-8 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(idx, 1)}
                            className="p-1 px-2 text-slate-500 hover:bg-slate-200 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary of Action and Confirmation */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">รายการพัสดุวิเคราะห์เสร็จ:</span>
                  <span className="font-bold text-indigo-950">
                    {scanResult.extractedItems.filter(i => i.matched).length} / {scanResult.extractedItems.length} สินค้าตรงระบบ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmTransactions}
                  disabled={isLoading || scanResult.extractedItems.filter(i => i.matched).length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>บันทึกรายการสต๊อกอัจฉริยะ (สั่งทำงานตามใบปะ) 📦</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
