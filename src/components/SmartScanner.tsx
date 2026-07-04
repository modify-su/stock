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
  Scan,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Product, Transaction, ReturnStatus, UserProfile } from '../types';

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
  processed?: boolean;
  errorMessage?: string;
}

export default function SmartScanner({
  products,
  transactions,
  onRecordMultipleTransactions,
  canRecordTransactions,
  currentUser
}: SmartScannerProps) {
  const [activeMode, setActiveMode] = useState<'CAMERA' | 'UPLOAD' | 'PDF_TEXT'>('UPLOAD');
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
  const [uploadedImages, setUploadedImages] = useState<Array<{ name: string; type: string; data: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  
  // PDF Text states
  const [pdfText, setPdfText] = useState('');
  const [pdfPageNo, setPdfPageNo] = useState(1);

  // Scan analysis results (Batch processing support)
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [actionType, setActionType] = useState<'IN' | 'OUT' | 'RETURN'>('OUT');
  const [returnStatus, setReturnStatus] = useState<ReturnStatus>('RE_STOCK');
  const [allowDuplicateForce, setAllowDuplicateForce] = useState(false);
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({ 0: true });

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check if inside IFrame and enumerate cameras on mount
  useEffect(() => {
    setIsIframe(typeof window !== 'undefined' && window.self !== window.top);
    
    const initScanner = async () => {
      await checkCameras();
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

  // Maps raw API label responses to properly structured ScanResults with database matching (names, SKU, current stock)
  const mapRawLabelsToScanResults = (rawLabels: any[]): ScanResult[] => {
    return rawLabels.map(label => {
      const extractedItems = (label.extractedItems || []).map((item: any) => {
        const cleanSku = (item.sku || '').trim();
        const matched = products.find(p => p.sku.toLowerCase() === cleanSku.toLowerCase());
        const matchedProduct = matched ? {
          id: matched.id,
          sku: matched.sku,
          name: matched.name,
          quantity: matched.quantity,
          unit: matched.unit || 'ชิ้น',
          location: matched.location || 'ไม่ได้ระบุ',
          weight: matched.weight,
          weightUnit: matched.weightUnit,
        } : null;

        return {
          sku: cleanSku,
          productName: item.productName || item.name || 'สินค้าวิเคราะห์ทั่วไป',
          quantity: parseInt(item.quantity) || 1,
          matched: !!matched,
          matchedProduct
        };
      });

      return {
        orderId: label.orderId || '',
        trackingNo: label.trackingNo || '',
        labelType: label.labelType || 'UNKNOWN',
        detectedAction: label.detectedAction || 'OUT',
        extractedItems,
        processed: !!label.processed
      };
    });
  };

  // Dynamic Batch Analysis of Multiple Files (Images or PDFs)
  const handleMultipleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress({ current: 0, total: files.length });

    const rawResultsToMap: any[] = [];
    const previewsToAppend: Array<{ name: string; type: string; data: string }> = [];
    let hasError = false;
    let errText = "";

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        // Read file to base64
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
          reader.readAsDataURL(file);
        });

        let targetData = fileBase64;
        if (file.type.startsWith('image/')) {
          targetData = await compressImage(fileBase64, 1024, 0.8);
        }

        // Store file preview metadata
        previewsToAppend.push({
          name: file.name,
          type: file.type,
          data: file.type.startsWith('image/') ? targetData : fileBase64
        });

        // Call scan-label API for this file (supporting multi-page PDFs inside the endpoint!)
        try {
          const res = await fetch('/api/scan-label', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: targetData })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `ไฟล์ที่ ${i + 1} วิเคราะห์ล้มเหลว`);
          }

          const data = await res.json();
          if (data.labels && Array.isArray(data.labels) && data.labels.length > 0) {
            rawResultsToMap.push(...data.labels);
          } else {
            rawResultsToMap.push({
              orderId: data.orderId || '',
              trackingNo: data.trackingNo || '',
              labelType: data.labelType || 'UNKNOWN',
              detectedAction: data.detectedAction || 'OUT',
              extractedItems: data.extractedItems || []
            });
          }
        } catch (fileErr: any) {
          console.error(`Error processing file ${file.name}:`, fileErr);
          hasError = true;
          errText += `• ไฟล์ "${file.name}": ${fileErr.message || "ล้มเหลว"}\n`;
        }
      }

      setUploadedImages(prev => [...prev, ...previewsToAppend]);

      const resultsToAppend = mapRawLabelsToScanResults(rawResultsToMap);

      if (resultsToAppend.length > 0) {
        setScanResults(prev => {
          const next = [...prev, ...resultsToAppend];
          
          // Auto-expand newly added scan results
          setExpandedIndices(ex => {
            const nextEx = { ...ex };
            const startIndex = prev.length;
            resultsToAppend.forEach((_, idx) => {
              nextEx[startIndex + idx] = true;
            });
            return nextEx;
          });
          
          return next;
        });

        playBeep('success');
        let successStr = `🎉 สแกนสำเร็จทั้งหมด ${resultsToAppend.length} ใบปะหน้าพัสดุ!`;
        if (hasError) {
          successStr += ` (มีข้อผิดพลาดบางไฟล์:\n${errText})`;
        }
        setSuccessMessage(successStr);

        // Check duplicates for newly scanned labels
        let hasDuplicate = false;
        let duplicateNames = "";
        resultsToAppend.forEach((label) => {
          const duplicateTx = checkDuplicateNo(label.orderId, label.trackingNo);
          if (duplicateTx) {
            hasDuplicate = true;
            duplicateNames += `${label.trackingNo || label.orderId || 'ไม่ทราบเลข'}, `;
          }
        });

        if (hasDuplicate) {
          playBeep('error');
          setErrorMessage(`⚠️ ตรวจพบเลขอ้างอิงใบปะหน้าบางชิ้น (${duplicateNames.slice(0, -2)}) เคยทำรายการลงคลังไปแล้ว หากต้องการบันทึกสต๊อกซ้ำ กรุณาติ๊กเลือก 'อนุญาตให้ลงรายการซ้ำ' ด้านล่างครับ`);
        }

      } else {
        throw new Error(`เกิดข้อผิดพลาดในการสแกนไฟล์ทั้งหมด:\n${errText}`);
      }

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setErrorMessage(`❌ ไม่สามารถวิเคราะห์ไฟล์ชุดนี้ได้: ${err.message}`);
    } finally {
      setIsLoading(false);
      setUploadProgress(null);
    }
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

      const data = await res.json();
      const rawLabels: any[] = [];

      if (data.labels && Array.isArray(data.labels) && data.labels.length > 0) {
        rawLabels.push(...data.labels);
      } else {
        rawLabels.push({
          orderId: data.orderId || '',
          trackingNo: data.trackingNo || '',
          labelType: data.labelType || 'UNKNOWN',
          detectedAction: data.detectedAction || 'OUT',
          extractedItems: data.extractedItems || []
        });
      }

      const newLabels = mapRawLabelsToScanResults(rawLabels);

      if (keepCameraActive) {
        // AUTO SCAN FLOW - Process 1st label directly to make it instantaneous
        const firstLabel = newLabels[0];
        if (!firstLabel) return;

        const duplicateTx = checkDuplicateNo(firstLabel.orderId, firstLabel.trackingNo);
        const allMatched = firstLabel.extractedItems && firstLabel.extractedItems.length > 0 && firstLabel.extractedItems.every(item => item.matched && item.matchedProduct);
        
        if (allMatched && !duplicateTx) {
          if (!canRecordTransactions) {
            playBeep('error');
            setErrorMessage("❌ คุณไม่มีสิทธิ์ของพนักงานในการบันทึกรายการสินค้า (ระบบหยุดออโต้สแกน)");
            setIsAutoScanActive(false);
            return;
          }

          // Build transaction records
          const txsToRecord: Omit<Transaction, 'id' | 'date'>[] = firstLabel.extractedItems.map(item => ({
            productId: item.matchedProduct!.id,
            productSku: item.matchedProduct!.sku,
            productName: item.matchedProduct!.name,
            type: firstLabel.detectedAction || 'OUT',
            quantity: item.quantity,
            referenceNo: firstLabel.trackingNo || firstLabel.orderId || 'AUTO_SCAN_AI',
            reason: `ตัดสต๊อกอัตโนมัติ (ระบบสแกนต่อเนื่อง) ประเภท: ${
              firstLabel.detectedAction === 'IN' ? 'รับสินค้า' : firstLabel.detectedAction === 'OUT' ? 'ส่งสินค้า' : 'คืนสินค้า'
            }`,
            operator: currentUser.name,
            ...(firstLabel.detectedAction === 'RETURN' && { returnStatus: returnStatus })
          }));

          await onRecordMultipleTransactions(txsToRecord);
          playBeep('success');
          setSuccessMessage(`✅ [ออโต้สแกนสำเร็จ] บันทึกและตัดสต๊อกสินค้า ${txsToRecord.map(t => `${t.productSku} x${t.quantity}`).join(', ')} เรียบร้อย! (เลขแทรค/ออเดอร์: ${firstLabel.trackingNo || firstLabel.orderId || '-'})`);
          
          // Clear current scan state for next frames
          setScanResults([]);
        } else {
          playBeep('error');
          if (duplicateTx) {
            setErrorMessage(`⚠️ [ตรวจพบข้อมูลซ้ำแต่ออโต้สแกนทำงานต่อ 🔍] เลขอ้างอิง (${firstLabel.trackingNo || firstLabel.orderId}) เคยถูกบันทึกไปแล้วเมื่อ ${new Date(duplicateTx.date).toLocaleString()} ระบบจะทำการสแกนกล่องถัดไปโดยอัตโนมัติ`);
          } else if (!firstLabel.extractedItems || firstLabel.extractedItems.length === 0) {
            setErrorMessage(`❌ [ตรวจพบข้อผิดพลาดแต่ออโต้สแกนทำงานต่อ 🔍] ไม่พบข้อมูลสินค้าจากใบปะหน้า ระบบจะทำการสแกนกล่องถัดไปโดยอัตโนมัติ`);
          } else {
            const unmatchedItems = firstLabel.extractedItems.filter(item => !item.matched);
            setErrorMessage(`❌ [ตรวจพบข้อผิดพลาดแต่ออโต้สแกนทำงานต่อ 🔍] พบ SKU ที่ไม่ตรงในระบบ (${unmatchedItems.map(i => i.sku || 'ไม่ทราบ SKU').join(', ')}) ระบบจะทำการสแกนกล่องถัดไปโดยอัตโนมัติ`);
          }
        }
      } else {
        // MANUAL/UPLOAD SCAN FLOW - Append to list
        setScanResults(prev => {
          const next = [...prev, ...newLabels];
          setExpandedIndices(ex => {
            const nextEx = { ...ex };
            const startIndex = prev.length;
            newLabels.forEach((_, idx) => {
              nextEx[startIndex + idx] = true;
            });
            return nextEx;
          });
          return next;
        });

        // Check for duplicates in manual scan
        let hasDuplicate = false;
        let duplicateNames = "";
        newLabels.forEach((label) => {
          const duplicateTx = checkDuplicateNo(label.orderId, label.trackingNo);
          if (duplicateTx) {
            hasDuplicate = true;
            duplicateNames += `${label.trackingNo || label.orderId || 'ไม่ทราบเลข'}, `;
          }
        });

        if (hasDuplicate) {
          playBeep('error');
          setErrorMessage(`⚠️ ตรวจพบเลขอ้างอิงใบปะหน้าพัสดุบางชิ้น (${duplicateNames.slice(0, -2)}) เคยทำรายการลงสต๊อกไปแล้ว หากต้องการบันทึกสต๊อกซ้ำ กรุณาติ๊กเลือก 'อนุญาตให้ลงรายการซ้ำ' ด้านล่างครับ`);
        } else {
          playBeep('success');
          setSuccessMessage(`🎉 สแกนวิเคราะห์ใบปะหน้าพัสดุสำเร็จ! ถอดข้อมูลได้เพิ่มอีก ${newLabels.length} ใบปะหน้า`);
        }
      }

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setErrorMessage(`❌ ผิดพลาดในการวิเคราะห์ใบปะหน้า: ${err.message || 'ระบบหลังบ้านไม่ตอบสนอง'}`);
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
        setErrorMessage("❌ ไม่สามารถถ่ายภาพได้: กล้องเว็บแคมยังโหลดภาพไม่เสร็จ แนะนำให้เปิดในแท็บใหม่ หรืออัปโหลดไฟล์แทนครับ");
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setUploadedImages([{ name: "captured_frame.jpg", type: "image/jpeg", data: dataUrl }]);
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
        setUploadedImages([{ name: "autoscan_frame.jpg", type: "image/jpeg", data: dataUrl }]);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleMultipleFiles(Array.from(files));
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
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleMultipleFiles(Array.from(files));
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
        
        const rawResult = {
          orderId: firstPageResult.orderId || '',
          trackingNo: firstPageResult.trackingNo || '',
          labelType: firstPageResult.labelType || 'UNKNOWN',
          detectedAction: firstPageResult.detectedAction || 'OUT',
          extractedItems: firstPageResult.extractedItems || []
        };

        const mappedResults = mapRawLabelsToScanResults([rawResult]);
        const newResult = mappedResults[0];

        setScanResults(prev => {
          const next = [...prev, newResult];
          setExpandedIndices(ex => ({ ...ex, [next.length - 1]: true }));
          return next;
        });

        const duplicateTx = checkDuplicateNo(firstPageResult.orderId, firstPageResult.trackingNo);
        if (duplicateTx) {
          playBeep('error');
          setErrorMessage(`⚠️ ตรวจพบเลขออเดอร์/แทรคกิ้งนี้ (${firstPageResult.trackingNo || firstPageResult.orderId}) ได้เคยทำรายการตัดคลังไปแล้วเมื่อ ${new Date(duplicateTx.date).toLocaleString()} กรุณาเลือก 'อนุญาตให้ลงรายการซ้ำ' ด้านล่างหากต้องการบันทึกสต๊อกซ้ำครับ`);
        } else {
          playBeep('success');
          setSuccessMessage('🎉 ถอดข้อความ PDF และเพิ่มเข้าสู่รายการตรวจสอบสต๊อกเรียบร้อย!');
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
  const updateItemQuantity = (labelIdx: number, itemIdx: number, change: number) => {
    setScanResults(prev => {
      const copy = [...prev];
      if (!copy[labelIdx]) return prev;
      const items = [...copy[labelIdx].extractedItems];
      items[itemIdx] = {
        ...items[itemIdx],
        quantity: Math.max(1, items[itemIdx].quantity + change)
      };
      copy[labelIdx] = { ...copy[labelIdx], extractedItems: items };
      return copy;
    });
  };

  const removeItem = (labelIdx: number, itemIdx: number) => {
    setScanResults(prev => {
      const copy = [...prev];
      if (!copy[labelIdx]) return prev;
      const items = copy[labelIdx].extractedItems.filter((_, i) => i !== itemIdx);
      copy[labelIdx] = { ...copy[labelIdx], extractedItems: items };
      return copy;
    });
  };

  const removeLabel = (labelIdx: number) => {
    setScanResults(prev => prev.filter((_, i) => i !== labelIdx));
  };

  const addNewItemRow = (labelIdx: number) => {
    const newItem: ExtractedItem = {
      sku: '',
      productName: 'เพิ่มสินค้าแบบกำหนดเอง',
      quantity: 1,
      matched: false,
      matchedProduct: null
    };
    setScanResults(prev => {
      const copy = [...prev];
      if (!copy[labelIdx]) return prev;
      copy[labelIdx] = {
        ...copy[labelIdx],
        extractedItems: [...copy[labelIdx].extractedItems, newItem]
      };
      return copy;
    });
  };

  const handleItemSkuChange = (labelIdx: number, itemIdx: number, val: string) => {
    const cleanSku = val.trim();
    // Try to match on-the-fly
    const matched = products.find(p => p.sku.toLowerCase() === cleanSku.toLowerCase());
    const matchedProduct = matched ? {
      id: matched.id,
      sku: matched.sku,
      name: matched.name,
      quantity: matched.quantity,
      unit: matched.unit || 'ชิ้น',
      location: matched.location || 'ไม่ได้ระบุ',
      weight: matched.weight,
      weightUnit: matched.weightUnit,
    } : null;

    setScanResults(prev => {
      const copy = [...prev];
      if (!copy[labelIdx]) return prev;
      const items = [...copy[labelIdx].extractedItems];
      items[itemIdx] = {
        ...items[itemIdx],
        sku: cleanSku,
        matched: !!matched,
        matchedProduct: matchedProduct
      };
      copy[labelIdx] = { ...copy[labelIdx], extractedItems: items };
      return copy;
    });
  };

  const handleTrackingNoChange = (labelIdx: number, val: string) => {
    setScanResults(prev => {
      const copy = [...prev];
      if (!copy[labelIdx]) return prev;
      copy[labelIdx] = {
        ...copy[labelIdx],
        trackingNo: val
      };
      return copy;
    });
  };

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Confirm and submit a SINGLE Transaction (Deduct a single shipping label immediately)
  const handleConfirmSingleTransaction = async (labelIdx: number) => {
    const result = scanResults[labelIdx];
    if (!result) return;

    if (!canRecordTransactions) {
      setErrorMessage("❌ คุณไม่มีสิทธิ์ของพนักงานในการบันทึกรายการสินค้า (สิทธิ์ของคุณถูกจำกัด)");
      playBeep('error');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const txsToRecord: Omit<Transaction, 'id' | 'date'>[] = [];
      
      // Validate duplicates
      if (!allowDuplicateForce) {
        const duplicateTx = checkDuplicateNo(result.orderId, result.trackingNo);
        if (duplicateTx) {
          throw new Error(`ใบปะหน้านี้ (เลขอ้างอิง: ${result.trackingNo || result.orderId || 'ไม่ระบุ'}) เคยลงคลังไปแล้ว หากยืนยันจะทำซ้ำ กรุณาติ๊กเลือก 'อนุญาตให้บันทึกซ้ำ' ด้านล่างก่อนกดยืนยันครับ`);
        }
      }

      for (const item of result.extractedItems) {
        if (!item.matched || !item.matchedProduct) {
          continue;
        }

        const txData: Omit<Transaction, 'id' | 'date'> = {
          productId: item.matchedProduct.id,
          productSku: item.matchedProduct.sku,
          productName: item.matchedProduct.name,
          type: actionType,
          quantity: item.quantity,
          referenceNo: result.trackingNo || result.orderId || `SCAN_SINGLE_${labelIdx + 1}`,
          reason: `ตัดสต๊อกอัตโนมัติด้วยระบบสแกนใบปะหน้า AI (เดี่ยว - ประเภท: ${actionType === 'IN' ? 'รับสินค้า' : actionType === 'OUT' ? 'ส่งสินค้า' : 'คืนสินค้า'})`,
          operator: currentUser.name,
          ...(actionType === 'RETURN' && { returnStatus: returnStatus })
        };

        txsToRecord.push(txData);
      }

      if (txsToRecord.length === 0) {
        throw new Error("ไม่มีสินค้าใดในใบปะหน้านี้ที่รหัส SKU ตรงกับระบบคลังปัจจุบัน กรุณาแก้ไขรหัส SKU ให้ถูกต้องก่อนกดยืนยันบันทึกครับ");
      }

      await onRecordMultipleTransactions(txsToRecord);
      
      playBeep('success');
      setSuccessMessage(`🎉 บันทึกรายการสต๊อกสำเร็จจากใบปะหน้า ${result.trackingNo || result.orderId || `ที่ ${labelIdx + 1}`} จำนวน ${txsToRecord.length} ชิ้นสินค้าเรียบร้อยแล้ว!`);
      
      setScanResults(prev => {
        const copy = [...prev];
        if (copy[labelIdx]) {
          copy[labelIdx] = {
            ...copy[labelIdx],
            processed: true
          };
        }
        return copy;
      });

    } catch (err: any) {
      console.error(err);
      playBeep('error');
      setErrorMessage(`❌ ผิดพลาดในการบันทึกสต๊อกใบนี้: ${err.message || 'บันทึกสต๊อกล้มเหลว'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm and submit BATCH Transactions at once
  const handleConfirmTransactions = async () => {
    // Only process labels that have NOT been processed yet
    const pendingResults = scanResults.filter(r => !r.processed);
    if (pendingResults.length === 0) {
      setSuccessMessage("✨ ทุกรายการสแกนในคิวได้รับการตัดคลัง/บันทึกเรียบร้อยหมดแล้วครับ!");
      return;
    }

    if (!canRecordTransactions) {
      setErrorMessage("❌ คุณไม่มีสิทธิ์ของพนักงานในการบันทึกรายการสินค้า (สิทธิ์ของคุณถูกจำกัด)");
      playBeep('error');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const txsToRecord: Omit<Transaction, 'id' | 'date'>[] = [];
      let duplicateDetails = "";

      for (let i = 0; i < scanResults.length; i++) {
        const result = scanResults[i];
        if (result.processed) continue; // Skip already processed ones
        
        // Validate duplicates before recording
        if (!allowDuplicateForce) {
          const duplicateTx = checkDuplicateNo(result.orderId, result.trackingNo);
          if (duplicateTx) {
            duplicateDetails += `• ใบปะหน้าที่ ${i + 1} (เลขอ้างอิง: ${result.trackingNo || result.orderId || 'ไม่ระบุ'}) เคยลงคลังไปแล้ว\n`;
          }
        }

        for (const item of result.extractedItems) {
          if (!item.matched || !item.matchedProduct) {
            continue;
          }

          const txData: Omit<Transaction, 'id' | 'date'> = {
            productId: item.matchedProduct.id,
            productSku: item.matchedProduct.sku,
            productName: item.matchedProduct.name,
            type: actionType,
            quantity: item.quantity,
            referenceNo: result.trackingNo || result.orderId || `SCAN_BATCH_${i+1}`,
            reason: `ตัดสต๊อกอัตโนมัติด้วยระบบสแกนใบปะหน้า AI (ประเภท: ${actionType === 'IN' ? 'รับสินค้า' : actionType === 'OUT' ? 'ส่งสินค้า' : 'คืนสินค้า'})`,
            operator: currentUser.name,
            ...(actionType === 'RETURN' && { returnStatus: returnStatus })
          };

          txsToRecord.push(txData);
        }
      }

      if (duplicateDetails && !allowDuplicateForce) {
        throw new Error(`พบเลขออเดอร์/แทรคกิ้งที่ซ้ำในระบบดังนี้:\n${duplicateDetails}\nกรุณาเลือกติ๊ก 'อนุญาตให้ลงรายการซ้ำ' ด้านล่างหากต้องการบันทึกสต๊อกทับลงคลังครับ`);
      }

      if (txsToRecord.length === 0) {
        throw new Error("ไม่มีรายการสินค้าใดที่จับคู่รหัส SKU ตรงกับระบบคลังปัจจุบัน กรุณาแก้ไข SKU ให้ตรงกับในระบบก่อนกดยืนยันบันทึกครับ");
      }

      await onRecordMultipleTransactions(txsToRecord);
      
      playBeep('success');
      setSuccessMessage(`🎉 บันทึกรายการตัดคลังสต๊อกสำเร็จจำนวน ${txsToRecord.length} ชิ้นสินค้า จากใบปะหน้าที่เลือกทั้งหมด ${pendingResults.length} ใบเสร็จเรียบร้อยแล้ว!`);
      
      // Mark all pending ones as processed
      setScanResults(prev => prev.map(r => r.processed ? r : { ...r, processed: true }));
      setUploadedImages([]);
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
    setScanResults([]);
    setUploadedImages([]);
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
            <span>อัปโหลดหลายไฟล์รูปภาพ/PDF</span>
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
                <p className="text-sm font-bold text-slate-700">คลิกที่นี่เพื่อเลือกหลายไฟล์ หรือลากรูปภาพ/PDF มาวาง</p>
                <p className="text-xs text-slate-400 mt-1">สแกนพร้อมกันได้หลายไฟล์ | ไฟล์ PDF 1 ไฟล์ก็สแกนได้ทุกหน้า!</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden" 
                  multiple={true}
                />
              </div>

              {uploadedImages.length > 0 && (
                <div className="rounded-lg border border-slate-300 bg-white p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-500 flex justify-between">
                    <span>เอกสารที่เลือกสแกน ({uploadedImages.length} ไฟล์):</span>
                    <button onClick={() => setUploadedImages([])} className="text-[10px] text-red-500 hover:underline">ล้างทั้งหมด</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="flex items-center gap-2 pt-1.5 first:pt-0">
                        {img.type === 'application/pdf' ? (
                          <FileText className="w-6 h-6 text-red-500 shrink-0" />
                        ) : (
                          <img src={img.data} alt={img.name} className="w-6 h-6 object-cover rounded shrink-0 border border-slate-200" />
                        )}
                        <span className="text-[11px] text-slate-600 truncate flex-1 font-mono">{img.name}</span>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded shrink-0">โหลดแล้ว</span>
                      </div>
                    ))}
                  </div>
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

                    <div
                      className="px-3 py-1.5 rounded-md text-xs font-bold transition-all bg-emerald-600 text-white animate-pulse shadow-md flex items-center gap-1.5 select-none"
                      title="ระบบกำลังวิเคราะห์ตัดยอดโดยอัตโนมัติเมื่อตรวจพบพัสดุหน้ากล้องอย่างต่อเนื่อง"
                    >
                      <Scan className="w-3.5 h-3.5 animate-spin [animation-duration:4s]" />
                      <span>ระบบออโต้สแกนกำลังทำงานอัตโนมัติ 🟢</span>
                    </div>
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
                        <span>ระบบสแกนอัตโนมัติทำงานอยู่ (ส่งตรวจทุก 3 วิ)</span>
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

        {/* Right Column: Scan Results and confirmation (Batch layout) */}
        <div className="md:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>ผลการวิเคราะห์และถอดรหัสของ AI {scanResults.length > 0 && `(${scanResults.length} ชิ้นพัสดุ)`}</span>
            </h4>
            {scanResults.length > 0 && (
              <button
                onClick={resetScanner}
                className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ล้างคิวสแกนทั้งหมด</span>
              </button>
            )}
          </div>

          {/* Loading Overlay State (Supporting Batch Upload Progress) */}
          {isLoading && (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-indigo-50/20 rounded-xl border border-indigo-100/50">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-700">Gemini AI กำลังวิเคราะห์ถอดข้อมูลด้วยระบบอัจฉริยะ...</p>
              {uploadProgress ? (
                <div className="w-full max-w-xs space-y-1">
                  <div className="flex justify-between text-[10px] text-indigo-700 font-bold">
                    <span>กำลังประมวลผลไฟล์...</span>
                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}></div>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400">กรุณารอสักครู่ ระบบกำลังเปรียบเทียบ SKU และจัดเตรียมความถูกต้องให้คุณ</p>
              )}
            </div>
          )}

          {/* Error Message Notifications inside Column */}
          {errorMessage && !isLoading && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-bold">ข้อมูลการลงคลัง / คำแจ้งเตือนความถูกต้อง:</span>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{errorMessage}</p>
              
              <div className="pt-1.5">
                <label className="flex items-center gap-2 bg-white/70 px-3 py-1.5 border border-rose-300 rounded-md cursor-pointer text-slate-800 text-[11px] font-bold">
                  <input
                    type="checkbox"
                    checked={allowDuplicateForce}
                    onChange={(e) => setAllowDuplicateForce(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>อนุญาตให้บันทึกซ้ำ (ในกรณีที่หน้าพัสดุนี้ตั้งใจบันทึกสต๊อกซ้ำ)</span>
                </label>
              </div>
            </div>
          )}

          {successMessage && !isLoading && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3.5 rounded-lg text-xs flex items-start gap-2 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="font-medium whitespace-pre-line">{successMessage}</div>
            </div>
          )}

          {/* No results prompt */}
          {scanResults.length === 0 && !isLoading && (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
              <Sparkles className="w-8 h-8 text-indigo-300 mx-auto animate-pulse" />
              <p className="text-xs font-bold text-slate-500">ยังไม่มีข้อมูลในคิวสแกนของคุณ</p>
              <p className="text-[11px] text-slate-400">กรุณาอัปโหลดรูปภาพใบปะหน้า, ลากไฟล์ PDF หลายหน้ามาวาง, หรือวางบิลข้อความเพื่อตรวจเช็คสต๊อกแบบกลุ่มได้ทันที</p>
            </div>
          )}

          {/* Batch Scan Results Display Panel */}
          {scanResults.length > 0 && !isLoading && (
            <div className="space-y-4 animate-fade-in">
              {/* Batch Action type setup */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">ประเภทความเคลื่อนไหวสต๊อกของกลุ่มนี้:</label>
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

                {actionType === 'RETURN' && (
                  <div className="pt-2 border-t border-slate-200/50 text-xs space-y-1.5">
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
              </div>

              {/* LIST OF DETECTED LABELS */}
              <div className="space-y-3">
                {scanResults.map((label, labelIdx) => {
                  const isExpanded = !!expandedIndices[labelIdx];
                  const matchedCount = label.extractedItems.filter(i => i.matched).length;
                  const totalCount = label.extractedItems.length;
                  const allItemsMatched = label.extractedItems.length > 0 && label.extractedItems.every(i => i.matched);
                  const isLabelDuplicate = checkDuplicateNo(label.orderId, label.trackingNo);
                  const isProcessed = !!label.processed;

                  return (
                    <div 
                      key={labelIdx} 
                      className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                        isProcessed
                          ? 'border-emerald-200 bg-emerald-50/5 opacity-85'
                          : isLabelDuplicate 
                            ? 'border-rose-250 bg-rose-50/10' 
                            : allItemsMatched
                              ? 'border-emerald-200 bg-white hover:border-emerald-300 shadow-sm'
                              : 'border-amber-300 bg-amber-50/5'
                      }`}
                    >
                      {/* Accordion Card Header */}
                      <div 
                        onClick={() => toggleExpand(labelIdx)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none ${
                          isProcessed
                            ? 'bg-emerald-50/20'
                            : allItemsMatched
                              ? 'bg-emerald-50/10 hover:bg-emerald-50/20'
                              : 'bg-amber-50/20 hover:bg-amber-50/40'
                        }`}
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`w-5 h-5 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 ${
                            isProcessed
                              ? 'bg-emerald-600 text-white'
                              : allItemsMatched
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500 text-white animate-pulse'
                          }`}>
                            {labelIdx + 1}
                          </span>
                          <div className="truncate text-xs">
                            <span className="font-bold text-slate-700">
                              {label.trackingNo ? `แทรค: ${label.trackingNo}` : (label.orderId ? `ออเดอร์: ${label.orderId}` : 'พัสดุใหม่ไม่ระบุชื่อ')}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {label.labelType !== 'UNKNOWN' ? label.labelType : 'บิลพิมพ์จากระบบ'} 
                              {isProcessed ? (
                                <strong className="text-emerald-600 ml-1.5 font-bold">| ✅ บันทึกสต๊อกสำเร็จแล้ว</strong>
                              ) : (
                                <>
                                  {' '} | ตรงในระบบ:{' '}
                                  <strong className={allItemsMatched ? "text-emerald-600 font-bold" : "text-amber-600 font-bold animate-pulse"}>
                                    {matchedCount}/{totalCount} รายการ
                                  </strong>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isProcessed ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> บันทึกแล้ว
                            </span>
                          ) : allItemsMatched ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-md border border-emerald-300">
                              แจ้งตัดสต๊อกได้ ✅
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-md border border-rose-300 animate-pulse">
                              แจ้งเตือนเพื่อปรับแก้ไข ⚠️
                            </span>
                          )}

                          {isLabelDuplicate && !isProcessed && (
                            <span className="bg-rose-100 text-rose-800 text-[8px] font-bold px-1.5 py-0.5 rounded-md animate-pulse">
                              ซ้ำ
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLabel(labelIdx);
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-200/50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-3 border-t border-slate-200/50 space-y-3 bg-white">
                          {/* Warnings and Status Banners */}
                          {isProcessed ? (
                            <div className="p-2 bg-emerald-50 text-emerald-800 text-[11px] rounded-lg border border-emerald-100 flex items-center gap-1.5">
                              <Check className="w-4 h-4 shrink-0" />
                              <span><strong>บันทึกสำเร็จ:</strong> รายการใบปะหน้านี้ได้รับการหักลบและบันทึกลงคลังสต๊อกสำเร็จแล้ว</span>
                            </div>
                          ) : !allItemsMatched ? (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-950 text-[11px] rounded-lg flex flex-col gap-1 shadow-xs">
                              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-bounce" />
                                <span>แจ้งเตือนสินค้าไม่ตรงในระบบ! กรุณาปรับปรุงแก้ไขข้อมูล</span>
                              </div>
                              <p className="text-slate-600 pl-5">
                                ตรวจพบสินค้าในหน้า PDF มี <strong className="text-rose-700 font-bold">รหัส SKU ไม่ตรงในคลังปัจจุบัน (แสดงแถบไม่พบ SKU สีแดง)</strong> กรุณาคลิกเลือกคำแนะนำด้านล่าง พิมพ์ปรับแก้ไขรหัส หรือลบแถวสินค้าที่ไม่ต้องการออก จากนั้นกดปุ่ม <strong>"บันทึกยืนยัน"</strong> ด้านล่างเพื่อบันทึกรายการ
                              </p>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] rounded-lg flex flex-col gap-1 shadow-xs">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                                <span>รายการสินค้าตรงตามคลัง 100%! แจ้งตัดสต๊อกได้ทันที</span>
                              </div>
                              <p className="text-slate-600 pl-5">
                                รหัส SKU สินค้าทั้งหมดตรงกับฐานข้อมูลคลังเรียบร้อยแล้ว คุณสามารถทำรายการและคลิก <strong>"บันทึกยืนยันตัดสต๊อกเลย"</strong> เพื่อตัดยอดสต๊อกในระบบได้อย่างสมบูรณ์แบบ
                              </p>
                            </div>
                          )}

                          {/* Reference Metadata Fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 text-xs">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">เลขอ้างอิงขนส่ง (Tracking No.):</label>
                              <input
                                type="text"
                                disabled={isProcessed}
                                value={label.trackingNo}
                                onChange={(e) => handleTrackingNoChange(labelIdx, e.target.value)}
                                className="w-full mt-1 px-2 py-0.5 border border-slate-200 rounded bg-white font-bold font-sans text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                                placeholder="ไม่มีเลขแทรคกิ้ง"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">เลขออเดอร์สั่งซื้อ (Order ID):</label>
                              <p className="mt-1 px-2 py-0.5 bg-slate-100/70 border border-slate-200/30 rounded text-slate-700 min-h-[22px] flex items-center font-bold">
                                {label.orderId || 'ไม่พบในใบปะหน้า'}
                              </p>
                            </div>
                          </div>

                          {/* Item lines */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold text-slate-600">รายการสินค้าในพัสดุชิ้นนี้:</span>
                              {!isProcessed && (
                                <button
                                  type="button"
                                  onClick={() => addNewItemRow(labelIdx)}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>เพิ่มสินค้าแถวใหม่</span>
                                </button>
                              )}
                            </div>

                            {/* Beautiful Table Layout for Matches */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                              {/* Header for Desktop/Tablets */}
                              <div className="hidden sm:grid grid-cols-12 gap-2 bg-slate-100 p-2.5 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                <div className="col-span-3">รหัส SKU</div>
                                <div className="col-span-4">ชื่อสินค้าในระบบ / บนใบปะหน้า</div>
                                <div className="col-span-3 text-center">จำนวนที่จะตัด (Qty)</div>
                                <div className="col-span-2 text-right">คงเหลือจริง (Qty Total)</div>
                              </div>

                              <div className="divide-y divide-slate-100">
                                {label.extractedItems.length === 0 ? (
                                  <p className="p-4 text-center text-slate-400 italic text-[11px]">ไม่มีสินค้าวิเคราะห์ได้ในใบปะหน้านี้</p>
                                ) : (
                                  label.extractedItems.map((item, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs transition-all ${
                                        isProcessed 
                                          ? 'bg-slate-50/50 opacity-80'
                                          : item.matched 
                                            ? 'bg-white hover:bg-slate-50/30' 
                                            : 'bg-rose-50/30 border-l-4 border-rose-500'
                                      }`}
                                    >
                                      {/* Column 1: SKU with Match indicator */}
                                      <div className="col-span-1 sm:col-span-3 space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="text"
                                            disabled={isProcessed}
                                            value={item.sku}
                                            onChange={(e) => handleItemSkuChange(labelIdx, idx, e.target.value)}
                                            className="px-2 py-1 border border-slate-200 rounded font-mono font-bold text-[11px] uppercase w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 bg-white text-slate-800 shadow-2xs"
                                            placeholder="รหัส SKU สินค้า"
                                          />
                                        </div>

                                        {/* Matches Badges */}
                                        <div className="flex flex-wrap gap-1">
                                          {item.matched ? (
                                            <span className="bg-emerald-100 text-emerald-800 text-[8px] px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5 border border-emerald-200 shrink-0">
                                              <Check className="w-2 h-2" />
                                              <span>ตรงคลังแล้ว ✅</span>
                                            </span>
                                          ) : (
                                            <span className="bg-rose-150 text-rose-850 text-[8px] px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5 border border-rose-250 shrink-0 animate-pulse">
                                              <X className="w-2 h-2" />
                                              <span>ไม่พบ SKU ⚠️</span>
                                            </span>
                                          )}
                                        </div>

                                        {/* Suggestions for unmatched SKUs */}
                                        {!item.matched && !isProcessed && (
                                          (() => {
                                            const searchStr = item.sku.trim().toLowerCase();
                                            const suggestions = products
                                              .filter(p => 
                                                p.sku.toLowerCase().includes(searchStr) || 
                                                p.name.toLowerCase().includes(searchStr)
                                              )
                                              .slice(0, 3);

                                            if (suggestions.length > 0) {
                                              return (
                                                <div className="mt-1 flex flex-col gap-1 bg-indigo-50/40 p-1.5 rounded border border-indigo-100 text-[10px]">
                                                  <span className="text-[9px] text-slate-500 font-bold">🔍 แนะนำรหัส SKU ในคลัง:</span>
                                                  {suggestions.map((p) => (
                                                    <button
                                                      key={p.id}
                                                      type="button"
                                                      onClick={() => handleItemSkuChange(labelIdx, idx, p.sku)}
                                                      className="text-[9px] bg-white hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded border border-indigo-200 transition-all cursor-pointer text-left truncate block w-full"
                                                      title={p.name}
                                                    >
                                                      {p.sku} ({p.name.slice(0, 15)}...)
                                                    </button>
                                                  ))}
                                                </div>
                                              );
                                            }
                                            return null;
                                          })()
                                        )}
                                      </div>

                                      {/* Column 2: Product Name & Metadata */}
                                      <div className="col-span-1 sm:col-span-4 space-y-1">
                                        {item.matched && item.matchedProduct ? (
                                          <div>
                                            <p className="font-bold text-slate-800 text-[11px] leading-tight line-clamp-2">{item.matchedProduct.name}</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5 flex flex-wrap gap-1">
                                              <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono font-bold">พิกัด: {item.matchedProduct.location}</span>
                                              {item.matchedProduct.weight && (
                                                <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono font-bold">น.น. {item.matchedProduct.weight} {item.matchedProduct.weightUnit || 'kg'}</span>
                                              )}
                                            </p>
                                          </div>
                                        ) : (
                                          <div>
                                            <p className="text-[10px] text-rose-600 font-bold leading-tight">ชื่อตามใบปะ: {item.productName || 'ไม่ระบุรหัส SKU สินค้า'}</p>
                                            <p className="text-[9px] text-slate-400 italic">ไม่สามารถจับคู่สินค้าในระบบคลังปัจจุบันได้</p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Column 3: Quantity with controls */}
                                      <div className="col-span-1 sm:col-span-3 flex justify-center sm:justify-center">
                                        <div className="flex items-center gap-1.5">
                                          <span className="sm:hidden text-[10px] font-semibold text-slate-400 mr-1.5">จำนวนที่จะตัด:</span>
                                          <div className="flex items-center border border-slate-200 rounded bg-slate-50 shadow-2xs overflow-hidden">
                                            <button
                                              type="button"
                                              disabled={isProcessed}
                                              onClick={() => updateItemQuantity(labelIdx, idx, -1)}
                                              className="p-1 px-2.5 text-slate-500 hover:bg-slate-200 cursor-pointer disabled:opacity-30 font-extrabold text-xs transition-colors"
                                            >
                                              -
                                            </button>
                                            <span className="px-3 text-xs font-black text-slate-800 min-w-8 text-center bg-white border-x border-slate-100">{item.quantity}</span>
                                            <button
                                              type="button"
                                              disabled={isProcessed}
                                              onClick={() => updateItemQuantity(labelIdx, idx, 1)}
                                              className="p-1 px-2.5 text-slate-500 hover:bg-slate-200 cursor-pointer disabled:opacity-30 font-extrabold text-xs transition-colors"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Column 4: Stock Total / Actions */}
                                      <div className="col-span-1 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2.5">
                                        <span className="sm:hidden text-[10px] font-semibold text-slate-400">สต๊อกระบบ (Qty Total):</span>
                                        {item.matched && item.matchedProduct ? (
                                          <div className="text-right shrink-0">
                                            <span className={`text-xs font-black px-2 py-1 rounded-md border ${
                                              item.matchedProduct.quantity >= item.quantity 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                            }`}>
                                              {item.matchedProduct.quantity} {item.matchedProduct.unit}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[11px] text-slate-400 font-bold">-</span>
                                        )}

                                        {!isProcessed && (
                                          <button
                                            type="button"
                                            onClick={() => removeItem(labelIdx, idx)}
                                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-colors cursor-pointer ml-1.5 shrink-0"
                                            title="ลบแถวสินค้านี้"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Individual Sheet Save Action */}
                          {!isProcessed && (
                            <div className="pt-2 flex justify-end">
                              {allItemsMatched ? (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmSingleTransaction(labelIdx)}
                                  disabled={isLoading}
                                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-1.5 px-3 rounded text-[11px] flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>⚡ กดบันทึกยืนยันและตัดสต๊อกใบนี้เลย (ตรงคลัง)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmSingleTransaction(labelIdx)}
                                  disabled={isLoading}
                                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white font-bold py-1.5 px-3 rounded text-[11px] flex items-center gap-1 cursor-pointer shadow-sm transition-all animate-pulse"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>📝 กดบันทึกยืนยัน (ปรับแก้ไขแล้ว)</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary of Action and Confirmation */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">สรุปภาพรวมเตรียมบันทึกสต๊อก:</span>
                  <span className="font-bold text-indigo-950">
                    ทั้งหมด {scanResults.length} ใบปะหน้า
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmTransactions}
                  disabled={isLoading || scanResults.length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>กดบันทึกยืนยันและตัดสต๊อกกลุ่มนี้ทั้งหมด ({scanResults.length} ใบปะหน้า) 📦</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
