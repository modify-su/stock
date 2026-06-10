import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  HelpCircle, 
  FileUp, 
  FileDown, 
  Plus, 
  ExternalLink, 
  Search, 
  Settings, 
  AlertTriangle,
  Flame,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Copy,
  Download,
  Info
} from 'lucide-react';
import { firebaseService, StockProduct } from '../services/firebaseService';

interface GoogleSheetsSyncProps {
  products: StockProduct[];
  userUsername: string;
  onRefreshProducts: () => Promise<void>;
  googleToken: string | null;
  setGoogleToken: (token: string | null) => void;
  googleEmail: string | null;
  setGoogleEmail: (email: string | null) => void;
}

interface ParsedSheetProduct {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
}

export default function GoogleSheetsSync({
  products,
  userUsername,
  onRefreshProducts,
  googleToken,
  setGoogleToken,
  googleEmail,
  setGoogleEmail
}: GoogleSheetsSyncProps) {
  // State definitions
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [syncStrategy, setSyncStrategy] = useState<'overwrite' | 'add_only'>('overwrite');
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [sheetProducts, setSheetProducts] = useState<ParsedSheetProduct[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [searchPreview, setSearchPreview] = useState('');
  
  // Modals / Confirmation Gate States
  const [showConfirmExport, setShowConfirmExport] = useState(false);
  const [showConfirmImport, setShowConfirmImport] = useState(false);

  // Template Copy & Download States
  const [copied, setCopied] = useState(false);

  // Download template CSV with UTF-8 BOM so Thai headings work beautifully in Excel and Sheets
  const handleDownloadCsvTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "\uFEFF" // UTF-8 BOM
      + [
          ['SKU', 'ชื่อสินค้า', 'หมวดหมู่สินค้า', 'คงเหลือสะสม', 'จำนวนแจ้งเตือนขั้นต่ำ'].join(','),
          ['PROD-001', 'นมสดพาสเจอร์ไรส์ Meiji 450ml', 'เครื่องดื่ม', '120', '15'].join(','),
          ['PROD-002', 'ข้าวหอมมะลิตราฉัตร 5kg', 'ข้าวสาร/อาหารแห้ง', '45', '10'].join(','),
          ['PROD-003', 'น้ำยาล้างจาน ไลปอนเอฟ 500ml', 'น้ำยาทำความสะอาด', '85', '20'].join(',')
        ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "stockmaster_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccessText('ดาวน์โหลดไฟล์เทมเพลต CSV สต็อกสินค้าแล้ว! คุณสามารถเปิดใน Excel/Sheets หรือนำเทมเพลตไปวางได้ทันที');
    setTimeout(() => setSuccessText(''), 4500);
  };

  // Copy standard tab-delimited headers directly to clipboard for instant pasting on Sheet
  const handleCopyHeaders = () => {
    const headers = 'SKU\tชื่อสินค้า\tหมวดหมู่สินค้า\tคงเหลือสะสม\tจำนวนแจ้งเตือนขั้นต่ำ';
    navigator.clipboard.writeText(headers);
    setCopied(true);
    setSuccessText('คัดลอกส่วนหัว 5 คอลัมน์ลงคลิปบอร์ดแล้ว! สามารถกดวาง (Ctrl+V) บนช่อง A1 บน Google Sheets ได้ทันที');
    setTimeout(() => {
      setCopied(false);
    }, 4500);
    const t = setTimeout(() => {
      setSuccessText('');
    }, 5500);
  };

  // Parse spreadsheet ID from potential full URL input
  const currentSpreadsheetId = useMemo(() => {
    if (!spreadsheetInput) return '';
    const trimmed = spreadsheetInput.trim();
    const urlPattern = /\/d\/([a-zA-Z0-9-_]+)/;
    const matches = trimmed.match(urlPattern);
    return matches ? matches[1] : trimmed;
  }, [spreadsheetInput]);

  const defaultRange = `${sheetName}!A1:E1000`;

  // Trigger Google Login
  const handleGoogleConnect = async () => {
    setLoading(true);
    setErrorText('');
    setSuccessText('');
    try {
      const res = await firebaseService.googleSignInForSheets();
      setGoogleToken(res.accessToken);
      setGoogleEmail(res.userEmail);
      setSuccessText('เชื่อมต่อบัญชี Google สำเร็จแล้ว!');
      setTimeout(() => setSuccessText(''), 4000);
    } catch (err: any) {
      setErrorText(err.message || 'เชื่อมต่อ Google Auth ล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  // Google Log-out
  const handleGoogleDisconnect = () => {
    setGoogleToken(null);
    setGoogleEmail(null);
    setSheetProducts([]);
    setPreviewLoaded(false);
    setSuccessText('ยกเลิกเชื่อมต่อเรียบร้อยแล้ว');
    setTimeout(() => setSuccessText(''), 3000);
  };

  // 1. Provision a brand new Spreadsheet setup
  const handleCreateNewSheet = async () => {
    if (!googleToken) {
      setErrorText('กรุณาเชื่อมต่อบัญชี Google ก่อนเริ่มดำเนินการ');
      return;
    }
    setLoading(true);
    setErrorText('');
    setSuccessText('');
    try {
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: `STOCKMASTER คลังสินค้าดิจิทัล - ${new Date().toLocaleDateString('th-TH')}`
          }
        })
      });

      if (!response.ok) {
        throw new Error('ไม่สามารถสร้าง Spreadsheet ใหม่บนไดรฟ์ได้');
      }

      const resData = await response.json();
      const newId = resData.spreadsheetId;
      const newUrl = resData.spreadsheetUrl;

      // Automatically fill the new sheet with initial template headings + existing products
      const range = `${sheetName}!A1:E`;
      const exportBody = {
        range: range,
        majorDimension: 'ROWS',
        values: [
          ['SKU', 'ชื่อสินค้า', 'หมวดหมู่สินค้า', 'คงเหลือสะสม', 'จำนวนแจ้งเตือนขั้นต่ำ'],
          ...products.map(p => [p.sku, p.name, p.category, p.quantity, p.lowStockThreshold])
        ]
      };

      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(exportBody)
        }
      );

      if (!writeRes.ok) {
        console.warn('สร้างประเภทสำเร็จ แต่ไม่สามารถบันทึกตารางข้อมูลตั้งต้นลงสเปรดชีตได้');
      }

      setSpreadsheetInput(newId);
      setSuccessText('สร้างเทมเพลตสต็อกใหม่สำเร็จ! คัดลอกและบันทึกอัปเดตลง Google Sheets ได้เลย');
      
      // Open in a new tab if supported
      if (newUrl) {
        window.open(newUrl, '_blank');
      }
    } catch (err: any) {
      setErrorText(err.message || 'การผลิตสเปรดชีตล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Spreadsheet data to PREVIEW before importing
  const handlePreviewFromSheet = async () => {
    if (!googleToken) {
      setErrorText('กรุณาเชื่อมต่อบัญชี Google ก่อนเริ่มดำเนินการ');
      return;
    }
    if (!currentSpreadsheetId) {
      setErrorText('กรุณาระบุ URL หรือรหัส Spreadsheet ID ให้ถูกต้อง');
      return;
    }

    setLoading(true);
    setErrorText('');
    setSuccessText('');
    setSheetProducts([]);
    setPreviewLoaded(false);

    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/${encodeURIComponent(defaultRange)}`,
        {
          headers: { Authorization: `Bearer ${googleToken}` }
        }
      );

      if (!response.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลสเปรดชีตได้ กรุณาตรวจสอบให้แน่ใจว่าสเปรดชีตของคุณมีแท็บชื่อ "' + sheetName + '"');
      }

      const data = await response.json();
      const rawValues: string[][] = data.values;

      if (!rawValues || rawValues.length === 0) {
        throw new Error('สเปรดชีตดังกล่าวไม่มีแถวข้อมูลใดๆ');
      }

      const headerRow = rawValues[0] || [];
      const dataRows = rawValues.slice(1);

      // Search smart column headings or default
      let skuIdx = 0, nameIdx = 1, catIdx = 2, qtyIdx = 3, threshIdx = 4;
      headerRow.forEach((col, idx) => {
        const txt = col.toString().toLowerCase().trim();
        if (txt.includes('sku') || txt.includes('รหัส')) skuIdx = idx;
        else if (txt.includes('name') || txt.includes('ชื่อ')) nameIdx = idx;
        else if (txt.includes('category') || txt.includes('หมวด')) catIdx = idx;
        else if (txt.includes('qty') || txt.includes('quantity') || txt.includes('จำนวน') || txt.includes('คงเหลือ')) qtyIdx = idx;
        else if (txt.includes('threshold') || txt.includes('alert') || txt.includes('เตือน') || txt.includes('ขั้นต่ำ')) threshIdx = idx;
      });

      const parsed: ParsedSheetProduct[] = dataRows
        .map(row => {
          const sku = row[skuIdx]?.toString().trim() || '';
          const name = row[nameIdx]?.toString().trim() || '';
          const category = row[catIdx]?.toString().trim() || 'สินค้าอื่นๆ (General)';
          const quantity = parseInt(row[qtyIdx]?.toString().replace(/,/g, '') || '0') || 0;
          const lowStockThreshold = parseInt(row[threshIdx]?.toString().replace(/,/g, '') || '10') || 10;

          return { sku, name, category, quantity, lowStockThreshold };
        })
        .filter(p => !!p.sku); // filter empty sku lines

      if (parsed.length === 0) {
        throw new Error('ไม่พบแถวข้อมูลใดๆ มี SKU สอดคล้องในตารางนี้');
      }

      setSheetProducts(parsed);
      setPreviewLoaded(true);
      setSuccessText(`โหลดรายการสินค้าใน Google Sheets จำนวน ${parsed.length} แถว สำเร็จแล้ว!`);
      setTimeout(() => setSuccessText(''), 4000);
    } catch (err: any) {
      setErrorText(err.message || 'การดึงข้อมูลเพื่อรีวิวขัดข้อง');
    } finally {
      setLoading(false);
    }
  };

  // 3. Apply changes and WRITE to final database (Merge/Overwrite list)
  const handleCommitImport = async () => {
    setShowConfirmImport(false);
    if (sheetProducts.length === 0) {
      setErrorText('ไม่มีข้อมูลสินค้าให้ทำการซิงค์เข้าคลัง');
      return;
    }

    setLoading(true);
    setErrorText('');
    setSuccessText('');
    try {
      const result = await firebaseService.bulkSyncProducts(sheetProducts, userUsername, syncStrategy);
      await onRefreshProducts();
      setSuccessText(`ซิงค์เข้าคลังสินค้าสำเร็จ! (เพิ่มสินค้าใหม่ ${result.added} รายการ, แก้ไข/อัปเดตข้อมูล ${result.updated} รายการ)`);
      setSheetProducts([]);
      setPreviewLoaded(false);
    } catch (err: any) {
      setErrorText(err.message || 'บันทึกประวัติซิงค์ล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  // 4. Overwrite Google Sheet with current local/cloud DB products
  const handleCommitExport = async () => {
    setShowConfirmExport(false);
    if (!googleToken) {
      setErrorText('กรุณาเชื่อมต่อ Google ก่อนส่งออก');
      return;
    }
    if (!currentSpreadsheetId) {
      setErrorText('กรุณาระบุ URL หรือรหัส Spreadsheet ให้ชัดเจน');
      return;
    }

    setLoading(true);
    setErrorText('');
    setSuccessText('');

    try {
      const exportBody = {
        range: defaultRange,
        majorDimension: 'ROWS',
        values: [
          ['SKU', 'ชื่อสินค้า', 'หมวดหมู่สินค้า', 'คงเหลือสะสม', 'จำนวนแจ้งเตือนขั้นต่ำ'],
          ...products.map(p => [p.sku, p.name, p.category, p.quantity, p.lowStockThreshold])
        ]
      };

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${currentSpreadsheetId}/values/${encodeURIComponent(defaultRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(exportBody)
        }
      );

      if (!response.ok) {
        throw new Error('ไม่สามารถเขียนทับข้อมูลลงในสเปรดชีตได้ กรุณาเปิดสิทธิ์ชีตเป็น "เข้าถึงได้ทุกคนที่มีลิงก์แล้วแก้ไขได้" หรือเชื่อมบัญชีเจ้าของไฟล์');
      }

      setSuccessText(`ส่งออกสินค้าคงคลังปัจจุบันจำนวนชิ้น ${products.length} รายการ ไปยัง Google Sheets สำเร็จแล้ว!`);
      setTimeout(() => setSuccessText(''), 5500);
    } catch (err: any) {
      setErrorText(err.message || 'เขียนทับข้อมูลชีตล้มเหลว ลิงก์ไฟล์อาจไม่ถูกต้องหรือขาดสิทธิ์การเข้าถึง');
    } finally {
      setLoading(false);
    }
  };

  // Preview List query filtering
  const filteredPreview = useMemo(() => {
    if (!searchPreview) return sheetProducts;
    const s = searchPreview.toLowerCase();
    return sheetProducts.filter(p => 
      p.sku.toLowerCase().includes(s) || 
      p.name.toLowerCase().includes(s) || 
      p.category.toLowerCase().includes(s)
    );
  }, [sheetProducts, searchPreview]);

  return (
    <div className="space-y-6" id="google-sheets-sync-panel">
      
      {/* Dynamic Headers Banner container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden" id="sheets-banner">
        <div className="absolute right-0 top-0 opacity-10 filter blur-xl animate-pulse">
          <div className="h-65 w-65 bg-emerald-500 rounded-full" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Live Google Sheets Sync
            </span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="h-7 w-7 text-emerald-400 shrink-0" />
              ระบบคลังสินค้าเชื่อมโยง Google Sheets
            </h1>
            <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
              จัดการรายการสินค้า อัปเดตยอดสินค้าคงคลัง และสต็อกสินค้าในคลังข้อมูลแบบ 2-Way Sync โดยตรงกับบัญชีสเปรดชีตของคุณแบบเรียลไทม์
            </p>
          </div>
          {/* Action trigger standard info */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreateNewSheet}
              disabled={loading || !googleToken}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 select-none cursor-pointer disabled:opacity-40"
              title={!googleToken ? 'กรุณาเชื่อมต่อบัญชี Google ก่อน' : 'สร้างชีตใหม่'}
              id="btn-create-sheet"
            >
              <Plus className="h-4 w-4" /> สร้างตารางใหม่บนคลาวด์
            </button>
          </div>
        </div>
      </div>

      {/* Grid view containing parameters configuration and authentication status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="sync-setup-grid">
        
        {/* Connection setup (Left col - span 7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5" id="settings-card">
          <h2 className="text-slate-900 text-xs font-bold uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2 select-none">
            <Settings className="h-4.5 w-4.5 text-slate-500" /> ตั้งค่าพารามิเตอร์ตาราง (Spreadsheet Config)
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-750 block mb-1.5" htmlFor="input-spread-id">
                ลิงก์หรือรหัส Google Sheet (Spreadsheet URL / ID)
              </label>
              <div className="relative">
                <FileSpreadsheet className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:bg-white rounded-xl pl-9.5 pr-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition shadow-inner font-mono"
                  placeholder="ตัวอย่างเช่น https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit"
                  value={spreadsheetInput}
                  onChange={e => setSpreadsheetInput(e.target.value)}
                  id="input-spread-id"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                *ระบบจะกรองและแปลงจากลิงก์สเปรดชีตอย่างยืดหยุ่นโดยอัตโนมัติ สำหรับไฟล์ที่ต้องการใช้ ควรตั้งสิทธิ์แชร์ให้อำนาจแก้ไขได้
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-755 block mb-1.5" htmlFor="input-sheet-name">
                  ชื่อแท็บชีตทำงาน (Sheet Name)
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  placeholder="เช่น Sheet1 หรือ สินค้าคงคลัง"
                  value={sheetName}
                  onChange={e => setSheetName(e.target.value)}
                  id="input-sheet-name"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-755 block mb-1.5">
                  ตรรกะการเขียนทับ/อิมพอร์ต
                </label>
                <div className="flex gap-2 h-11 bg-slate-50 border border-slate-250 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSyncStrategy('overwrite')}
                    className={`flex-1 text-[10px] font-black rounded-lg transition-all ${
                      syncStrategy === 'overwrite' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    อัปเดต / เขียนทับข้อมูล
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncStrategy('add_only')}
                    className={`flex-1 text-[10px] font-black rounded-lg transition-all ${
                      syncStrategy === 'add_only' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    เพิ่มรหัสใหม่เท่านั้น
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col md:flex-row gap-2">
            <button
              onClick={handlePreviewFromSheet}
              disabled={loading || !googleToken}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-505 hover:text-white text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 select-none shrink-0 cursor-pointer disabled:opacity-45"
              id="btn-preview-sheet"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              ดึงข้อมูลตารางและรีวิว (Import Preview)
            </button>

            <button
              onClick={() => {
                if (!spreadsheetInput) {
                  setErrorText('กรุณากรอกระบุลิงก์หรือรหัส Spreadsheet ของคุณก่อนส่งออก');
                  return;
                }
                setShowConfirmExport(true);
              }}
              disabled={loading || !googleToken}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 select-none shrink-0 cursor-pointer disabled:opacity-45 border border-slate-800"
              id="btn-trigger-export"
            >
              <FileDown className="h-4 w-4 text-emerald-400" />
              เขียนทับสต็อกคลังขึ้นชีต (Export to Sheets)
            </button>
          </div>
        </div>

        {/* Google sign-in status block (Right col - span 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between" id="auth-status-card">
          <div className="space-y-4">
            <h2 className="text-slate-900 text-xs font-bold uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center justify-between select-none">
              <span>สถานะบัญชีการเชื่อมโยง (Account Connection)</span>
              {googleToken ? (
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </h2>

            {googleToken ? (
              <div className="space-y-3 bg-emerald-50/50 border border-emerald-150 p-4 rounded-xl text-emerald-900" id="google-status-connected">
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold block text-emerald-950">เชื่อมต่อบริการเรียบร้อย!</span>
                    <span className="text-[11px] text-emerald-800 block font-semibold truncate select-all">{googleEmail}</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-700 leading-relaxed font-medium">
                  พร้อมทำการ Sync อ่าน-เขียนข้อมูลอย่างสมบูรณ์แบบ คุณสามารถดึงข้อมูลรายการสต็อกหรือจัดระเบียบตารางอัปเดตได้ตามความต้องการ
                </p>
              </div>
            ) : (
              <div className="space-y-2 bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-700" id="google-status-disconnected">
                <div className="flex items-start gap-2.5 text-slate-800">
                  <HelpCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold block">ต้องการเชื่อมต่อสิทธิ์ความปลอดภัย?</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-550 leading-relaxed font-semibold">
                  กรุณากดปุ่ม Sign In ด้านล่างเพื่อมอบความยินยอมให้แอปพลิเคชันเข้าถึง จัดประเภท และแลกเปลี่ยนข้อมูลสเปรดชีตผ่าน APIs ของคุณอย่างปลอดภัย
                </p>
              </div>
            )}
          </div>

          <div className="pt-5" id="auth-button-area">
            {googleToken ? (
              <button
                onClick={handleGoogleDisconnect}
                className="w-full py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer select-none"
                id="btn-disconnect-google"
              >
                <LogOut className="h-4 w-4" /> ยกเลิกเชื่อมต่อบัญชี Google
              </button>
            ) : (
              // Official G-style Google Auth button themed properly with Tailwind
              <button
                onClick={handleGoogleConnect}
                disabled={loading}
                className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer select-none shadow-sm disabled:opacity-50"
                id="btn-connect-google"
              >
                <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                <span>เชื่อมต่อสิทธิ์กับ Google Account</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Google Sheets Template & Setup Guide Block */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6" id="sheets-template-guide-block">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-105 pb-4">
          <div className="space-y-1">
            <h2 className="text-slate-900 text-sm font-black flex items-center gap-2 select-none">
              <Info className="h-5 w-5 text-indigo-500 shrink-0" />
              เทมเพลตและคู่มือการเชื่อมต่อคลังสินค้า (Google Sheets Template & Setup Guide)
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              วิธีจัดวางข้อมูลโครงสร้างคอลัมน์ และดาวน์โหลดหรือคัดลอกไฟล์ต้นแบบสำหรับการนำข้อมูลสินค้าคงคลังเข้า-ออก
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleCopyHeaders}
              className={`px-3.5 py-2.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                copied 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-705 hover:border-slate-300'
              }`}
              id="btn-copy-template-headers"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'คัดลอกส่วนหัวแล้ว!' : 'คัดลอกหัวคอลัมน์มาตรฐาน'}
            </button>
            
            <button
              onClick={handleDownloadCsvTemplate}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-550 border border-emerald-500 text-white font-bold text-[11px] rounded-xl transition flex items-center gap-1.5 cursor-pointer select-none shadow-sm"
              id="btn-download-csv-template"
            >
              <Download className="h-4 w-4" />
              ดาวน์โหลดเทมเพลต CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Flow of Setup Steps */}
          <div className="space-y-4">
            <h3 className="text-slate-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              ขั้นตอนการเริ่มต้นเชื่อมระบบ (Easy 4-Step Sync Guide)
            </h3>
            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-105">
              
              <div className="flex gap-4 relative">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-mono text-xs font-black shrink-0 relative z-10 shadow-sm">
                  1
                </div>
                <div>
                  <h4 className="text-slate-900 text-xs font-bold">เตรียมชีตเปล่าหรือดาวน์โหลดเทมเพลต</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mt-1">
                    ใช้เครื่องมือปุ่มกดขวามือเพื่อดาวน์โหลดไฟล์เทมเพลต CSV ต้นแบบ นำไปอัปโหลดขึ้น Google Drive หรือกด <span className="text-indigo-600 font-bold hover:underline cursor-pointer" onClick={handleCopyHeaders}>"คัดลอกหัวคอลัมน์"</span> แล้วนำไปวางบนแผ่นงานเปล่าแถวแรก (A1)
                  </p>
                </div>
              </div>

              <div className="flex gap-4 relative">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-mono text-xs font-black shrink-0 relative z-10 shadow-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="text-slate-900 text-xs font-bold">กรอกรายละเอียดสินค้าคงคลัง</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mt-1">
                    เขียน SKU รหัสสินค้า, ชื่อ, หมวดหมู่สินค้า, ยอดคงเหลือสะสม และจำนวนแจ้งเตือนขั้นต่ำลงทีละแถวให้เรียบร้อย (กรุณารักษาชื่อแท็บ เช่น <span className="font-mono bg-slate-100 rounded px-1.5 py-0.5 text-xs text-indigo-700 font-bold">{sheetName}</span> ให้ถูกต้อง)
                  </p>
                </div>
              </div>

              <div className="flex gap-4 relative">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-mono text-xs font-black shrink-0 relative z-10 shadow-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="text-slate-900 text-xs font-bold">ปรับสิทธิ์เชิญแชร์ให้เป็น "แก้ไขได้"</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mt-1">
                    ที่มุมขวาบนของ Google Sheets เลือกแชร์ไฟล์และเปลี่ยนเป็นแบบ <span className="font-bold text-slate-800">"ทุกคนที่มีลิงก์ (Anyone with the link) มีสิทธิ์เป็นผู้แก้ไข (Editor)"</span> เพื่อให้ระบบเรียกหาและซิงก์ยอดข้อมูลสินค้าได้ทันที
                  </p>
                </div>
              </div>

              <div className="flex gap-4 relative">
                <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-mono text-xs font-black shrink-0 relative z-10 shadow-sm font-semibold">
                  4
                </div>
                <div>
                  <h4 className="text-slate-900 text-xs font-bold">เชื่อมสิทธิ์บัญชี ดึงรันวิเคราะห์พรีวิว</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mt-1">
                    คัดลอก URL ลิงก์ที่จัดเก็บ วางในบล็อกด้านบน แล้วกดเชื่อมต่อสิทธิ์กูเกิล จากนั้นคลิกปุ่ม <span className="text-emerald-600 font-bold">"ดึงข้อมูลตารางและรีวิว"</span> เพื่อตรวจทานความถูกต้องก่อนกดยอมรับเข้าฐานข้อมูลจริง
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Mini Interactive Table Columns Visualizer */}
          <div className="space-y-4">
            <h3 className="text-slate-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2 select-none">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              โครงสร้างตารางข้อมูลมาตรฐาน (Sheets Data Schema Definition)
            </h3>
            
            <div className="border border-slate-150 rounded-xl overflow-hidden shadow-inner">
              <table className="w-full text-left text-[11px] border-collapse bg-slate-50/20">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 font-sans font-black text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">ชื่อคอลัมน์ (Header)</th>
                    <th className="py-2.5 px-3">ประเภทข้อมูล (Type)</th>
                    <th className="py-2.5 px-3">รายละเอียดความหมาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-650 font-sans font-medium">
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">A: SKU</td>
                    <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black rounded">TEXT (รหัสสินค้า)</span></td>
                    <td className="py-2.5 px-3">รหัสสินค้าแนะนำคลัง ต้องมีค่าห้ามเว้นว่าง (เช่น SKU-001)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">B: ชื่อสินค้า</td>
                    <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black rounded">TEXT (ข้อความ)</span></td>
                    <td className="py-2.5 px-3">ชื่อรายการสินค้าที่จะแสดงและใช้ในคลังจริง</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">C: หมวดหมู่สินค้า</td>
                    <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-black rounded">TEXT (ตัวหนังสือ)</span></td>
                    <td className="py-2.5 px-3">หมวดหมู่คลังสินค้า หากเว้นว่างไว้ระบบจะตั้งค่าทั่วไปให้</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">D: คงเหลือสะสม</td>
                    <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black rounded">NUMBER (ตัวเลข)</span></td>
                    <td className="py-2.5 px-3">ยอดรวมสินค้าที่มีอยู่ในสต็อก ณ ปัจจุบัน</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">E: จำนวนแจ้งเตือนขั้นต่ำ</td>
                    <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black rounded">NUMBER (ตัวเลข)</span></td>
                    <td className="py-2.5 px-3">เกณฑ์สำหรับส่งข้อความเตือนเมื่อของหมด ค่านิยมเริ่มต้นคือ 10</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
              💡 แนะนำ: โครงสร้างตารางจะเชื่อมต่อสำเร็จและดึงง่ายที่สุดเมื่อชื่อแถวคอลัมน์ตรงตามแบบสะสม แต่ระบบคลัง Master มี AI คาดเดาหัวข้อที่ใกล้เคียงให้อย่างชาญฉลาดหมดห่วง
            </p>
          </div>

        </div>
      </div>

      {/* Dynamic Notifications Feedback Box */}
      <AnimatePresence>
        {successText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl text-xs font-semibold flex items-start gap-2 shadow-sm"
            id="success-alert"
          >
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span>{successText}</span>
            </div>
          </motion.div>
        )}

        {errorText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-start gap-2 shadow-sm"
            id="error-alert"
          >
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="block font-bold mb-0.5">เกิดข้อผิดพลาดในการเชื่อมต่อ</span>
              <span>{errorText}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spreadsheet content preview block */}
      {previewLoaded && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4"
          id="sheet-content-preview"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-0.5">
              <h3 className="text-slate-900 text-sm font-bold flex items-center gap-1.5 leading-tight">
                <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-500" /> รีวิวแถวสินค้าที่พบในสเปรดชีต (Sheet Content Preview)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                พบสินค้าอ้างอิงตรงรวมทั้งหมด <span className="text-emerald-650 font-bold">({sheetProducts.length})</span> รายการ, ตรวจสอบที่พบด้านล่างก่อนยืนยันเขียนลงฐานคลังหลัก
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative shrink-0 w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, SKU หรือชนิดสินค้า..."
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-455 focus:outline-none focus:border-indigo-500"
                  value={searchPreview}
                  onChange={e => setSearchPreview(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowConfirmImport(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs rounded-lg transition shrink-0 select-none cursor-pointer flex items-center gap-1 shadow-sm"
                id="btn-confirm-import-trigger"
              >
                <Check className="h-4 w-4" /> ยืนยันบันทึกข้อมูลเข้าคลัง
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-150 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-150 select-none font-sans font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">รหัสสินค้า (SKU)</th>
                  <th className="py-3 px-4" style={{ minWidth: '180px' }}>ชื่อผลิตภัณฑ์ (Product Name)</th>
                  <th className="py-3 px-4">หมวดหมู่ (Category)</th>
                  <th className="py-3 px-4 text-right">ยอดคงเหลือชีต</th>
                  <th className="py-3 px-4 text-right header-min">เกณฑ์แจ้งเตือน</th>
                  <th className="py-3 px-4 text-center">สถานะเปรียบเทียบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-sans leading-relaxed">
                {filteredPreview.map((item, idx) => {
                  const dbMatch = products.find(p => p.sku === item.sku);
                  const isNew = !dbMatch;
                  const qtyDiff = dbMatch ? item.quantity - dbMatch.quantity : item.quantity;

                  return (
                    <tr key={item.sku} className="hover:bg-slate-50/30 transition">
                      <td className="py-2.5 px-4 text-[10px] text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-bold text-indigo-950 font-mono select-all text-xs">{item.sku}</td>
                      <td className="py-2.5 px-4 text-slate-900 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-4 text-[11px]">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-md">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">{item.quantity.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500">{item.lowStockThreshold}</td>
                      <td className="py-2.5 px-4 text-center">
                        {isNew ? (
                          <span className="inline-flex px-1.5 py-0.5 bg-sky-50 text-sky-600 border border-sky-100 text-[9px] font-black rounded">NEW SKU</span>
                        ) : qtyDiff !== 0 ? (
                          <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-black rounded ${qtyDiff > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                            {qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff} ชิ้น
                          </span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 bg-slate-50 text-slate-450 border border-slate-100 text-[9px] font-normal rounded">ตรงกัน</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredPreview.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">ไม่พบแถวผลิตภัณฑ์ตามเงื่อนไขที่กรองระบุ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Confirmation Modal: Overwrite export to Sheets */}
      <AnimatePresence>
        {showConfirmExport && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
              id="confirm-export-modal"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-white text-sm font-bold block mb-1">ต้องการเขียนข้อมูลลงใน Google Sheet?</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                    คุณกำลังส่งออกข้อมูลสินค้าคงคลังปัจจุบันจำนวน <span className="text-amber-400 font-bold">{products.length} รายการ</span> ไปบันทึกทับลงในสเปรดชีตของคุณ
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-[10px] text-rose-300 font-medium leading-relaxed">
                ⚠️ คำเตือน: ข้อมูลเดิมที่มีอยู่ในแท็บ "{sheetName}" ของคุณจะถูกลบและเขียนทับทั้งหมดด้วยรายละเอียดสต็อกคลังหลักสะสม โปรดยืนยันให้รับทราบความเสี่ยง
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={() => setShowConfirmExport(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs font-bold rounded-xl transition cursor-pointer"
                  id="btn-cancel-export"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  onClick={handleCommitExport}
                  className="px-4 py-2 bg-amber-550 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1 shadow-md cursor-pointer"
                  id="btn-confirm-export"
                >
                  <Flame className="h-4 w-4 shrink-0 fill-current" /> ยืนยันเขียนทับ (Export Overwrite)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal: Commit imported products list (Sheet -> DB) */}
      <AnimatePresence>
        {showConfirmImport && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
              id="confirm-import-modal"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-white text-sm font-bold block mb-1">ยืนยันนำเข้ารายการสินค้าลงฐานข้อมูล?</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                    คุณกำลังจะนำสินค้าจำนวน <span className="text-indigo-400 font-bold">{sheetProducts.length} รายการ</span> ที่มาในไฟล์ชีตเข้าสู่ฐานข้อมูลระบบของคุณ
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-[10px] text-slate-350 leading-relaxed font-medium">
                • นโยบายที่เลือกทำงาน: <span className="text-white font-bold">{syncStrategy === 'overwrite' ? 'แก้ไขอัปเดตทุกชื่อ/ยอดตรงตามตาราง' : 'กรองเพิ่มรหัสใหม่เท่านั้นข้ามข้อมูลเดิม'}</span><br/>
                • ข้อมูลหมวดหมู่ใดๆ ที่พบล่าสุดแต่ระบบยังไม่มี จะจดทะเบียนหมวดหมู่ให้โดยอัตโนมัติ<br/>
                • ถอดรหัสตรวจสอบความคงอยู่ของประวัติการซิงก์ได้อย่างเรียบร้อย
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={() => setShowConfirmImport(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs font-bold rounded-xl transition cursor-pointer"
                  id="btn-cancel-import"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleCommitImport}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-md cursor-pointer"
                  id="btn-confirm-import"
                >
                  <Check className="h-4 w-4" /> ตกลงนำเข้าเลย (Commit Import)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
