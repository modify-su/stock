import React, { useState, useRef, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  Plus, 
  Download, 
  Upload, 
  AlertTriangle, 
  Clipboard, 
  RefreshCcw, 
  Database,
  Link2,
  Unlink,
  Check,
  ShieldAlert,
  HelpCircle,
  Trash2
} from 'lucide-react';
import { AppSettings, Product, Transaction, UserProfile, RolePermissions } from '../types';
import ConfirmModal from './ConfirmModal';
import { 
  signInWithGoogleSheets, 
  signOutGoogle, 
  getCachedToken, 
  createInventorySpreadsheet, 
  syncProductsToSpreadsheet, 
  fetchSpreadsheetProducts 
} from '../googleSheetsService';
import { User } from 'firebase/auth';

interface SyncAndBackupProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => Promise<void>;
  products: Product[];
  transactions: Transaction[];
  onImportProducts: (parsedProducts: Omit<Product, 'id' | 'updatedAt'>[], overwrite: boolean) => Promise<void>;
  currentUser: UserProfile;
  rolePermissions: Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>;
}

export default function SyncAndBackup({
  settings,
  onUpdateSettings,
  products,
  transactions,
  onImportProducts,
  currentUser,
  rolePermissions
}: SyncAndBackupProps) {
  // Live Google Sheets Connection Local States
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(getCachedToken());
  const [inputSpreadsheetId, setInputSpreadsheetId] = useState(settings.googleSheetsId || '');
  const [googleSheetsStatus, setGoogleSheetsStatus] = useState<string>('');
  const [isSheetsBusy, setIsSheetsBusy] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; count?: number; message?: string } | null>(null);
  const [isUrlCopied, setIsUrlCopied] = useState(false);

  const handleCopyAppUrl = () => {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(appUrl);
    setIsUrlCopied(true);
    setTimeout(() => setIsUrlCopied(false), 2000);
  };

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isAlertOnly?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checks permissions
  const hasSettingsPermission = rolePermissions[currentUser.role]?.manageSettings ?? false;
  const hasResetPermission = rolePermissions[currentUser.role]?.resetSystem ?? false;

  // Sync token cache on mount
  useEffect(() => {
    const cachedToken = getCachedToken();
    if (cachedToken) {
      setGoogleToken(cachedToken);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSheetsBusy(true);
    setGoogleSheetsStatus('กำลังเปิดหน้าต่างลงชื่อเข้าใช้กับ Google...');
    try {
      const result = await signInWithGoogleSheets();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setGoogleSheetsStatus('เชื่อมต่อกับบัญชี Google สำเร็จแล้ว!');
      } else {
        setGoogleSheetsStatus('การเชื่อมต่อถูกปฏิเสธ');
      }
    } catch (err: any) {
      console.error(err);
      setGoogleSheetsStatus(`การเชื่อมโยงระบบล้มเหลว: ${err.message || err}`);
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setIsSheetsBusy(true);
    try {
      await signOutGoogle();
      setGoogleUser(null);
      setGoogleToken(null);
      setGoogleSheetsStatus('ลงชื่อออกสำเร็จแล้ว');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleCreateAndLinkSheet = async () => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการหรือผูกการตั้งค่าภายนอก');
      return;
    }

    const token = googleToken || getCachedToken();
    if (!token) {
      alert('⚠️ กรุณาเข้าสู่ระบบด้วย Google ก่อนเพื่อเริ่มสร้างและผูกชีต');
      return;
    }

    const conf = window.confirm(
      '🌟 ยืนยันการสร้างเทมเพลต Google Spreadsheet ใหม่หรือไม่?\n' +
      'ระบบจะทำการสร้างไฟล์สเปรดชีตชื่อสอดคล้องกันบนหน้าไดรฟ์ของท่าน พร้อมตกแต่งหัวตารางและล็อกโครงสร้างคิวบิกทันที'
    );
    if (!conf) return;

    setIsSheetsBusy(true);
    setGoogleSheetsStatus('กำลังส่งคำขอเข้า Google เพื่อสร้างสเปรดชีตใหม่...');
    try {
      const result = await createInventorySpreadsheet(token, settings.appName);
      
      // Update settings in Firestore
      const updatedSettings = {
        ...settings,
        googleSheetsId: result.spreadsheetId,
        googleSheetsUrl: result.spreadsheetUrl,
        googleSheetsLastSyncedAt: new Date().toISOString()
      };
      await onUpdateSettings(updatedSettings);

      // Immediately sync current products to initialize template
      setGoogleSheetsStatus('สร้างไฟล์สำเร็จแล้ว! กำลังเตรียมประจุข้อมูลสินค้าลงสเปรดชีตครั้งแรก...');
      await syncProductsToSpreadsheet(token, result.spreadsheetId, products);
      
      setInputSpreadsheetId(result.spreadsheetId);
      setGoogleSheetsStatus('🎉 สร้างสเปรดชีตเทมแพลตสต๊อกสินค้าหลัก และซิงก์ข้อมูลนำร่องสมบูรณ์แบบเรียบร้อยแล้ว!');
      alert('🎉 สำเร็จ! สร้างไฟล์ Google Sheets และผูกเชื่อมระบบจัดการสต๊อกเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      setGoogleSheetsStatus(`เกิดข้อผิดพลาดในการสร้างไฟล์: ${err.message || err}`);
      alert(`❌ สร้างชีตล้มเหลว: ${err.message || err}`);
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handlePushSync = async () => {
    const token = googleToken || getCachedToken();
    if (!token) {
      alert('⚠️ กรุณาลงชื่อเข้าใช้ Google ก่อนเพื่อกดซิงค์ข้อมูล');
      return;
    }
    const currentSheetId = settings.googleSheetsId;
    if (!currentSheetId) {
      alert('⚠️ ขออภัย ไม่พบสเปรดชีตที่ผูกเชื่อมไว้ กรุณากดปุ่มสร้างใหม่หรือป้อนและบันทึก ID สำหรับใช้งานก่อน');
      return;
    }

    const conf = window.confirm(
      '⚠️ ยืนยันการบันทึกทับสต๊อกสินค้าไปยัง Google Sheets หรือไม่?\n' +
      'ข้อมูลปัจจุบันในแถวข้อมูลสเปรดชีตจะถูกเขียนทับด้วยสถานะคลังเรียลไทม์ชุดปัจจุบันทันที'
    );
    if (!conf) return;

    setIsSheetsBusy(true);
    setGoogleSheetsStatus('กำลังถ่ายโอนข้อมูลสินค้าทั้งหมดไปยัง Google Sheets...');
    try {
      await syncProductsToSpreadsheet(token, currentSheetId, products);
      
      const updatedSettings = {
        ...settings,
        googleSheetsLastSyncedAt: new Date().toISOString()
      };
      await onUpdateSettings(updatedSettings);
      
      setGoogleSheetsStatus('✅ ซิงค์ข้อมูลขาส่งออกสินค้าทั้งหมดไปยัง Google Sheets สำเร็จเรียบร้อยแล้ว!');
      alert('✅ ซิงค์ข้อมูลขาส่งออกสินค้าไปยัง Google Sheets เรียบร้อยแล้ว!');
    } catch (err: any) {
      console.error(err);
      setGoogleSheetsStatus(`การซิงก์ข้อมูลขาส่งล้มเหลว: ${err.message || err}`);
      alert(`❌ ซิงก์ล้มเหลว: ${err.message || err}`);
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handlePullSync = async () => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์ซิงค์นำเข้า/แก้ไขข้อมูลหลักระดับระบบ');
      return;
    }

    const token = googleToken || getCachedToken();
    if (!token) {
      alert('⚠️ กรุณาลงชื่อเข้าใช้ Google ก่อนเพื่อจะดึงข้อมูล');
      return;
    }
    const currentSheetId = settings.googleSheetsId;
    if (!currentSheetId) {
      alert('⚠️ ไม่พบรหัสสเปรดชีตที่เชื่อมโยงในระบบฐานข้อมูลคลาวด์');
      return;
    }

    const conf = window.confirm(
      '⚠️ ยืนยันดึงฐานข้อมูลกลับมาจาก Google Sheets หรือไม่?\n' +
      'ระบบจะนำสินค้าทั้งหมดที่พบในแถวของแถบ Sheet1 มาอัปเดต / นำเข้า เข้าสู่ระบบคลังแอปชุดหลักทันที โดยอิงรหัส SKU เป็นหลัก'
    );
    if (!conf) return;

    setIsSheetsBusy(true);
    setGoogleSheetsStatus('กำลังเชื่อมสายดึงข้อมูลสเปรดชีตลงคลังสินค้า...');
    try {
      const importedList = await fetchSpreadsheetProducts(token, currentSheetId);
      if (importedList.length === 0) {
        throw new Error('ไม่พบแถวข้อมูลสินค้าใดๆ (ยกเว้นหัวตาราง) ใน Google Sheet ของคุณ โปรดตรวจสอบความสมบูรณ์ระบุชีต');
      }

      const overwriteChoice = window.confirm(
        '💡 คุณต้องการ ล้างข้อมูลสต๊อกเดิมของระบบจัดส่งหลักออกทั้งหมด (Clear & Replace)\n' +
        'หรือ ซิงค์สมทบเฉพาะรายการที่ไม่มีอยู่ / ปรับยอดปริมาณ (Merge & Update)?\n\n' +
        '-> กด [ตกลง / OK] เพื่อ "ลบรายการสินค้าเดิมทั้งหมดแล้วเขียนทับใหม่"\n' +
        '-> กด [ยกเลิก / Cancel] เพื่อ "ซิงค์เพิ่มเติมสมทบทับคีย์สากลสต๊อกสินค้า"'
      );

      await onImportProducts(importedList, overwriteChoice);

      const updatedSettings = {
        ...settings,
        googleSheetsLastSyncedAt: new Date().toISOString()
      };
      await onUpdateSettings(updatedSettings);

      setGoogleSheetsStatus(`✅ ดึงสินค้ารวมสำเร็จซิงค์ข้อมูลลงสต๊อกเรียบร้อยแล้วจำนวน ${importedList.length} รายการ!`);
      alert(`🎉 ซิงค์กลับจาก Google Sheets สำเร็จ! นำเข้าข้อมูลสินค้าจำนวน ${importedList.length} รายการแล้ว`);
    } catch (err: any) {
      console.error(err);
      setGoogleSheetsStatus(`ดึงข้อมูลสต๊อกล้มเหลว: ${err.message || err}`);
      alert(`❌ ดึงข้อมูลล้มเหลว: ${err.message || err}`);
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleLinkExistingSheetId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์ซิงค์หรือผูกการตั้งค่าภายนอก');
      return;
    }

    if (!inputSpreadsheetId.trim()) return;

    setIsSheetsBusy(true);
    try {
      let targetId = inputSpreadsheetId.trim();
      if (targetId.includes('/d/')) {
        const parts = targetId.split('/d/');
        if (parts[1]) {
          targetId = parts[1].split('/')[0];
        }
      }

      const generatedUrl = `https://docs.google.com/spreadsheets/d/${targetId}/edit`;

      const updatedSettings = {
        ...settings,
        googleSheetsId: targetId,
        googleSheetsUrl: generatedUrl,
      };
      await onUpdateSettings(updatedSettings);

      setGoogleSheetsStatus('🔗 ผูกและเชื่อมโยงรหัสสเปรดชีตรองรับเรียบร้อยแล้ว!');
      alert('🔗 เชื่อมโยง Google Sheets เรียบร้อยแล้ว!');
    } catch (err: any) {
      console.error(err);
      alert('❌ เชื่อมโยงล้มเหลว');
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleUnlinkSheet = async () => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์ผูก/ตัดการตั้งค่าระบบ');
      return;
    }

    const conf = window.confirm('⚠️ ยืนยันที่จะตัดสัมพันธ์ ปลดการเชื่อมโยงสเปรดชีตอันนี้ออกหรือไม่? (ไฟล์ใน Google Drive จะยังอยู่ปกติ)');
    if (!conf) return;

    setIsSheetsBusy(true);
    try {
      const updatedSettings = {
        ...settings,
        googleSheetsId: '',
        googleSheetsUrl: '',
      };
      await onUpdateSettings(updatedSettings);
      setInputSpreadsheetId('');
      setGoogleSheetsStatus('ปลดการเชื่อมโยงสเปรดชีตออกเสร็จสิ้น');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleExportProductsToCsv = () => {
    try {
      const headers = ["ชื่อสินค้า", "รหัสสินค้า_SKU", "หมวดหมู่", "จำนวนคงเหลือ", "เกณฑ์แจ้งเตือนสินค้าต่ำสุด", "หน่วยนับ", "ตำแหน่งชั้นวาง"];
      const rows = products.map(p => [
        p.name,
        p.sku,
        p.category,
        p.quantity.toString(),
        p.minStock.toString(),
        p.unit || 'ชิ้น',
        p.location || '-'
      ]);
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(col => `"${col.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Backup_Inventory_${settings.appName || 'Stock'}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>, overwrite: boolean) => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการหรืออัปโหลดสินค้า');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseAndImportText(text, overwrite);
      }
    };
    reader.readAsText(file);
  };

  const parseAndImportText = (text: string, overwrite: boolean) => {
    try {
      const lines = text.trim().split("\n");
      if (lines.length === 0) {
        setImportStatus({ success: false, message: 'ไฟล์หรือข้อความว่างเปล่า' });
        return;
      }

      let startIndex = 0;
      const headerLine = lines[0].toLowerCase();
      if (headerLine.includes("sku") || headerLine.includes("รหัส") || headerLine.includes("ชื่อ") || headerLine.includes("category")) {
        startIndex = 1;
      }

      const importedList: Omit<Product, 'id' | 'updatedAt'>[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const separation = line.includes("\t") ? "\t" : ",";
        const cols = line.split(separation);
        if (cols.length < 2) continue;

        let name = cols[0]?.replace(/^["']|["']$/g, '').trim() || '';
        let sku = cols[1]?.replace(/^["']|["']$/g, '').trim() || '';
        let category = cols[2]?.replace(/^["']|["']$/g, '').trim() || 'ทั่วไป';
        let quantity = parseInt(cols[3]?.replace(/^["']|["']$/g, '').trim()) || 0;
        let minStock = parseInt(cols[4]?.replace(/^["']|["']$/g, '').trim()) || 5;
        let unit = cols[5]?.replace(/^["']|["']$/g, '').trim() || 'ชิ้น';
        let location = cols[6]?.replace(/^["']|["']$/g, '').trim() || 'Zone-A';

        if (!name || !sku) continue;

        importedList.push({
          name,
          sku,
          category,
          quantity,
          minStock,
          unit,
          location
        });
      }

      if (importedList.length === 0) {
        setImportStatus({ success: false, message: 'ไม่พบแถวข้อมูลผลิตภัณฑ์สินค้าที่มีโครงสร้างคีย์คู่คอลัมน์ถูกต้อง โปรดยึกตามตัวอย่าง' });
        return;
      }

      onImportProducts(importedList, overwrite);
      setImportStatus({ 
        success: true, 
        count: importedList.length, 
        message: `นำเข้าข้อมูลสินค้าจำนวน ${importedList.length} รายการ ซิงก์ขึ้น Firebase คลาวด์เรียบร้อยแล้ว!` 
      });
      setPastedText('');
    } catch (err) {
      console.error(err);
      setImportStatus({ success: false, message: 'เกิดข้อผิดพลาดในการแปลสัญญาณถอดรหัส ตรวจสอบความถูกต้องของแนวสเปรดชีต' });
    }
  };

  const handleImportPasted = (overwrite: boolean) => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์ซิงค์นำเข้าสินค้า');
      return;
    }

    if (!pastedText.trim()) return;
    parseAndImportText(pastedText, overwrite);
  };

  return (
    <div id="sync-backup-view" className="space-y-6">
      
      {/* 1. View Security Header Banner */}
      {!hasSettingsPermission && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 text-amber-800">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">🔒 สิทธิ์การทำหน้าที่ถูกจำกัด</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              บัญชีใช้งานระดับบทบาท <span className="font-bold underline">{currentUser.role === 'KEEPER' ? 'เจ้าหน้าที่ดูแลคลังสินค้า' : 'ผู้ตรวจสอบบัญชี (Auditor)'}</span> ของคุณไม่สามารถเชื่อมต่อ แก้ไขรหัสกระดาน หรือสั่งซิงค์ขากลับ (Pull Data) ตลอดจนสั่งบันทึกทำทับได้ อย่างไรก็ตาม คุณยังคงสามารถลงชื่อใช้งาน Google และกด "ส่งออกขาส่งสินค้าปัจจุบัน (Sync to Sheet)" หรือดาวน์โหลดไฟล์สำรองข้อมูล CSV ไปเช็คสต๊อกส่วนตัวได้เสมอ
            </p>
          </div>
        </div>
      )}

      {/* 2. Primary Google Sheets Realtime Sync Integration Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <FileSpreadsheet className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                🔌 ซิงค์ข้อมูลอัตโนมัติแบบเรียลไทม์กับ Google Sheets
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                ทำหน้าที่บันทึกกระดานฐานข้อมูลส่วนกลางของคุณและผูกเข้าหาตารางแสดงผลสดใน Google Sheets อย่างเป็นระเบียบเมื่อใดก็ชามที่มีสินค้าใดๆ มีการเคลื่อนไหวเกิดขึ้น หรือดึงยอดจากหน้าชีตกลับแอปเพื่อซิงค์ข้อมูลอย่างแม่นยำ
              </p>
            </div>
          </div>
        </div>

        {/* Central Auth Area & Main controls */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Google Sheets Connector Authenticator
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                อนุญาตเพื่อลงสิทธิ์แก้ไขไฟล์สเปรดชีตใน Google ไดรฟ์ของคุณโดยตรงด้วยระบบ Google API
              </p>
            </div>
            
            <div className="shrink-0">
              {googleToken ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>เชื่อมต่อ Google แล้ว</span>
                  </span>
                  <button
                    onClick={handleGoogleSignOut}
                    disabled={isSheetsBusy}
                    className="px-2.5 py-1 text-xs border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 rounded-md transition-colors cursor-pointer"
                  >
                    ลงชื่อออก
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSheetsBusy}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>เชื่อมต่อสิทธิ์กับ Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Connected Spreadsheet State Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            {/* Left side: Spreadsheet Linkage Display */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                สเปรดชีตใช้งานหลัก (Target Sheet Linkage)
              </span>
              {settings.googleSheetsId ? (
                <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>เชื่องผูกเรียบร้อย (Linked)</span>
                    </span>
                    {hasSettingsPermission && (
                      <button
                        onClick={handleUnlinkSheet}
                        disabled={isSheetsBusy}
                        className="text-[10px] text-rose-650 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        ถอนการเชื่อมโยง
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate" title={settings.googleSheetsId}>
                    ID: {settings.googleSheetsId}
                  </p>
                  
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    <a
                      href={settings.googleSheetsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-bold"
                    >
                      เปิดดูตารางสเปรดชีตบน Google Drive ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-slate-400 font-medium">ยังไม่พบการผูกไฟล์สเปรดชีต</span>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">
                    คุณสามารถลงชื่อ Google แล้วตั้งสเปรดชีตเทมแพลตหลักใหม่ หรือนำรหัสสเปรดชีตเดิมของคุณมาเชื่อมต่อได้ทันที
                  </p>
                </div>
              )}
            </div>

            {/* Right side: Sync control state & Settings */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                นโยบายการประจุข้อมูลสต๊อก (Auto-Sync Policy)
              </span>
              
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sheets-auto-sync"
                    checked={settings.googleSheetsAutoSync || false}
                    onChange={(e) => {
                      if (!hasSettingsPermission) {
                        alert('🔒 สิทธิ์ของคุณไม่สามารถปรับแต่งการซิงค์หลักได้');
                        return;
                      }
                      onUpdateSettings({
                        ...settings,
                        googleSheetsAutoSync: e.target.checked
                      });
                    }}
                    disabled={!hasSettingsPermission}
                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-blue-500 rounded cursor-pointer disabled:opacity-50"
                  />
                  <label htmlFor="sheets-auto-sync" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    🔄 อัปโหลดไปยังคลาวด์ Sheets ทันที เมื่อแอปเปลี่ยนแปลง
                  </label>
                </div>
                
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>สถานะอัปเดตระบบล่าสุด:</span>
                  <span className="font-mono text-slate-700 font-bold">
                    {settings.googleSheetsLastSyncedAt 
                      ? new Date(settings.googleSheetsLastSyncedAt).toLocaleString('th-TH') 
                      : 'ยังไม่มีประวัติการเชื่อม'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sync action buttons (Export / Import / Create) */}
          {googleToken && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
              {hasSettingsPermission && (
                <button
                  onClick={handleCreateAndLinkSheet}
                  disabled={isSheetsBusy}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>📂 สร้าง Google Sheets ใหม่ขึ้นเพื่อเป็นคลังหลัก</span>
                </button>
              )}

              {settings.googleSheetsId && (
                <>
                  <button
                    onClick={handlePushSync}
                    disabled={isSheetsBusy}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>📥 ส่งออกยอดคลังปัจจุบัน (Push to Sheet)</span>
                  </button>

                  {hasSettingsPermission && (
                    <button
                      onClick={handlePullSync}
                      disabled={isSheetsBusy}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>📤 ดึงรายการสต๊อกจากกระดาน (Pull from Sheet)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Form to bind existing spreadsheet manual ID */}
          <form onSubmit={handleLinkExistingSheetId} className="pt-3 border-t border-slate-205 flex items-center gap-2">
            <div className="grow">
              <input
                type="text"
                placeholder="ป้อนรหัส ID หรือ ที่อยู่แอดเดรส URL ของสเปรดชีตที่มีอยู่เพื่อนำมารวมศูนย์..."
                value={inputSpreadsheetId}
                onChange={(e) => setInputSpreadsheetId(e.target.value)}
                disabled={isSheetsBusy || !hasSettingsPermission}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={isSheetsBusy || !inputSpreadsheetId.trim() || !hasSettingsPermission}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              ผูกสเปรดชีต
            </button>
          </form>

          {/* Logs and Activity feedback */}
          {googleSheetsStatus && (
            <div className="bg-slate-100 p-2.5 rounded-lg text-[11px] font-mono text-slate-600 border border-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span>{googleSheetsStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. CSV File Backup & Excel Import Area */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <Clipboard className="w-5 h-5 text-blue-600" />
            <span>สำรองข้อมูล และนำเข้าด้วยไฟล์สเปรดชีต (CSV / Copy-Paste Template)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            บันทึกรวบยอดเก็บเป็นไฟล์พาสภายนอกลงคอมพิวเตอร์ของคุณ หรือดึงยอดสะสมจากสมาร์ทโฟนเข้าสู่แอปหลัก
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Block: Export actions */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>ดาวน์โหลดข้อมูลสต๊อก (Export Backup)</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ดาวน์โหลดตารางผลิตภัณฑ์สินค้าทั้งหมดเป็นไฟล์นามสกุลมาตรฐาน CSV เพื่อเซฟเป็นบันทึกสรุปรอบบัญชี หรือสั่งเขียนลงโปรแกรม Microsoft Excel
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleExportProductsToCsv}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดข้อมูล (.CSV)</span>
              </button>

              <button
                onClick={() => {
                  const headers = ["ชื่อสินค้า", "รหัสสินค้า_SKU", "หมวดหมู่", "จำนวนคงเหลือ", "เกณฑ์แจ้งเตือนสินค้าต่ำสุด", "หน่วยนับ", "ตำแหน่งชั้นวาง"];
                  const rows = products.map(p => [
                    p.name,
                    p.sku,
                    p.category,
                    p.quantity.toString(),
                    p.minStock.toString(),
                    p.unit || 'ชิ้น',
                    p.location || '-'
                  ]);
                  const tsvContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
                  navigator.clipboard.writeText(tsvContent);
                  alert("📋 คัดลอกข้อมูลสินค้าแบบแบ่งคอลัมน์ (Tab-Separated) ลงบอร์ดคลิปบอร์ดแล้ว! คุณสามารถเปิด Google Sheets แล้วกด Ctrl+V เพื่อวางข้อมูลได้เลยทันที");
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>คัดลอกด่วนไป Google Sheets (TSV)</span>
              </button>
            </div>
          </div>

          {/* Right Block: Import actions */}
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>นำเข้าผลิตภัณฑ์ (Upload Spreadsheet)</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                คุณสามารถกู้ฐานข้อมูลรวมสินค้าหรืออัปโหลดสารบบเดิมของคุณผ่านตารางไฟล์ CSV เพื่อประจุยอดลงคลัง Firebase โดยตรงระบบจะตรวจสอบความสอดคล้องกันรหัสสินค้า SKU คีย์กลาง
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={(e) => handleCsvUpload(e, false)}
                className="hidden"
                id="sheets-csv-uploader-sync-backup"
              />
              <button
                onClick={() => {
                  if (!hasSettingsPermission) {
                    alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการข้อมูลหลักสินค้าเพื่อนำเข้า');
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                disabled={!hasSettingsPermission}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>อัปโหลดจากไฟล์ CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const demoFormat = "ชื่อน้ำดื่มสิงห์ 500ml\tSKU-SING-A1\tเครื่องดื่ม\t150\t20\tขวด\tShelf A2\nสบู่นกแก้ว สมุนไพร\tSKU-PARR-B2\tของใช้ในบ้าน\t80\t15\tก้อน\tShelf B3";
                  setPastedText(demoFormat);
                  alert("💡 ได้จำลองรูปแบบข้อความตัวอย่างนำเข้าลงในกล่องกรอกข้อมูลด้านล่างเรียบร้อยแล้ว ลองทดสอบเล่นได้ทันที!");
                }}
                className="px-3.5 py-1.5 text-slate-500 border border-slate-300 hover:bg-slate-100 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                โหลดตัวอย่างตาราง (Demo)
              </button>

              {hasResetPermission && products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: '⚠️ ล้างข้อมูลสินค้าในคลังทั้งหมด',
                      message: 'คุณต้องการลบหรือล้างข้อมูลสินค้าทั้งหมดในคลังระบบจริงหรือไม่?\n\n(การลบนี้จะทำให้ฐานข้อมูลสินค้าว่างเปล่าทันที เพื่อเปิดโอกาสให้ควบคุมนำเข้าข้อมูลใหม่ทั้งหมดได้)',
                      confirmText: 'ล้างข้อมูลสินค้า',
                      cancelText: 'ยกเลิก',
                      variant: 'danger',
                      onConfirm: () => {
                        setConfirmDialog({
                          isOpen: true,
                          title: '💥 คำเตือนขั้นเด็ดขาด',
                          message: 'ยืนยันการลบล้างเด็ดขาดจริงหรือไม่? (ข้อมูลสินค้าทั้งหมดจะถูกลบและจะไม่สามารถกู้กลับคืนมาได้หากไม่มีการสำรองไฟล์ไว้)',
                          confirmText: 'ล้างข้อมูลเด็ดขาด',
                          cancelText: 'ยกเลิก',
                          variant: 'danger',
                          onConfirm: async () => {
                            try {
                              await onImportProducts([], true);
                              setConfirmDialog({
                                isOpen: true,
                                title: '🧹 ล้างระบบสำเร็จ',
                                message: 'ล้างข้อมูลสินค้าในระบบคลัง Cloud เรียบร้อยแล้ว! คลังมีสถานะว่างพร้อมใช้งานสร้างใหม่',
                                confirmText: 'ตกลง',
                                isAlertOnly: true,
                                variant: 'info',
                                onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
                              });
                            } catch (err: any) {
                              setConfirmDialog({
                                isOpen: true,
                                title: '❌ เกิดข้อผิดพลาด',
                                message: 'ไม่สามารถล้างข้อมูลสินค้าได้: ' + err.message,
                                confirmText: 'ตกลง',
                                isAlertOnly: true,
                                variant: 'danger',
                                onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
                              });
                            }
                          }
                        });
                      }
                    });
                  }}
                  className="px-3.5 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  title="ล้างรายการสินค้าสต๊อกเดิมทั้งหมด เพื่อประจุหรือรับเข้าสร้างข้อมูลแบบตั้งต้นใหม่"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างสินค้าทั้งหมดในคลัง</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Text clipboard fast import area */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider block">
            กู้คืนสินค้าด้วยกล่องข้อมูลตารางวางตรง (Google Sheets / Excel Copy-Paste Container)
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={!hasSettingsPermission}
            rows={5}
            placeholder={`วางสินค้าที่คุณ Copy จาก Google Sheets มาที่นี่ (เรียงตามแนวคอลัมน์: ชื่อสินค้า, SKU, หมวดหมู่, จำนวนคงเหลือ, เกณฑ์ต่ำสุด, หน่วยนับ, ตำแหน่ง)\n\nตัวอย่าง:\nน้ำมันองุ่นพลาสติก\tSKU-M-OIL\tครัวแปรรูป\t175\t20\tขวด\tZone B-3`}
            className="w-full text-xs font-mono p-3 bg-slate-900 text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => handleImportPasted(false)}
              disabled={!pastedText.trim() || !hasSettingsPermission}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              🚀 ซิงก์ควบสมทบ (Merge & Update ยึด SKU)
            </button>
            <button
              onClick={() => {
                if (!hasSettingsPermission) {
                  setConfirmDialog({
                    isOpen: true,
                    title: '🔒 ข้อจำกัดการใช้งาน',
                    message: 'ขออภัย คุณไม่มีบทบาทเป็นผู้ดูแลระบบระดับสูง (ซิงก์ข้อมูลนำเข้า)',
                    confirmText: 'ตกลง',
                    isAlertOnly: true,
                    variant: 'warning',
                    onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
                  });
                  return;
                }
                setConfirmDialog({
                  isOpen: true,
                  title: '⚠️ ยืนยันการลบทับสินค้าเดิมทั้งหมด',
                  message: 'คุณยืนยันการลบทับสินค้าสะสมและข้อมูลสต๊อกทั้งหมดใน Cloud หรือไม่?\n\nการกระทำนี้จะเคลียร์ล้างข้อมูลที่ชั้นวางที่มีอยู่เดิมทั้งหมด และอัปเดตระบบด้วยชุดตารางใหม่นี้ทันที!',
                  confirmText: 'ลบทับข้อมูลเดิมและเข้าแทรกแซงกู้คืน',
                  cancelText: 'ยกเลิก',
                  variant: 'danger',
                  onConfirm: () => {
                    handleImportPasted(true);
                    setConfirmDialog(p => ({ ...p, isOpen: false }));
                  }
                });
              }}
              disabled={!pastedText.trim() || !hasSettingsPermission}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              💥 ลบทับพยับหมอกและกู้คืน (Clear & Replace Storage)
            </button>
          </div>
        </div>

        {/* Display response / parsed count */}
        {importStatus && (
          <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
            importStatus.success 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {importStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{importStatus.success ? 'นำเข้าและกู้คืนสมบูรณ์แล้ว!' : 'ตรวจพบข้อผิดพลาดระหว่างประกอบขากรรม'}</p>
              <p className="mt-0.5 text-slate-600">{importStatus.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. LINE Official Account & External Integration Guide Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-lg space-y-6">
        <div>
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-400" />
            <span>📱 คู่มือใช้งานภายนอก & ติดตั้งเมนูบน LINE Official Account (LINE OA)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            คุณสามารถย้ายแอปพลิเคชันออกไปเปิดนอก iFrame หรือนำไปผูกเข้ากับปุ่มบนแชต LINE OA ของคุณเพื่อให้ทุกคนในทีมเช็คสต๊อกได้อย่างลื่นไหล
          </p>
        </div>

        {/* Live App Link Copier */}
        <div className="p-4 border border-slate-800 bg-slate-950 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-300">🔗 ลิงก์ตรงสำหรับเปิดแอปพอร์ตจริง (Direct App URL)</h4>
              <p className="text-[11px] text-slate-500">ใช้ลิงก์นี้ในการเปิดแอปแยกแท็บภายนอกเพื่อหลีกเลี่ยงการติดบล็อกสิทธิ์ของ iFrame หรือนำไปใส่ในเมนู LINE OA</p>
            </div>
            <button
              onClick={handleCopyAppUrl}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all self-start cursor-pointer shrink-0"
            >
              {isUrlCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>คัดลอกสำเร็จ!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>คัดลอกลิงก์แอป</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 select-all overflow-x-auto whitespace-nowrap">
            {window.location.origin}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Connecting LINE OA */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>ขั้นตอนสร้างริชเมนูบน LINE OA (Rich Menu)</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-400 list-decimal pl-4 leading-relaxed">
              <li>
                ล็อกอินเข้าใช้งานระบบหลังบ้าน <a href="https://manager.line.me" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">LINE Official Account Manager</a>
              </li>
              <li>
                ไปที่ที่ทำรายชื่อฝั่งซ้าย เลือกเมนู **"ริชเมนู" (Rich Menus)** ใต้หัวข้อหน้าหลัก
              </li>
              <li>
                คลิกปุ่ม **"สร้างใหม่"** เพื่อกำหนดหน้าตาปุ่มคีย์ลัดบนแชตไลน์ของคุณ
              </li>
              <li>
                ในขั้นตอนการตั้งค่าเทมเพลตปุ่มกด และการระบุแอ็กชัน (Action) ให้เลือกประเภทแอ็กชันเป็น <span className="font-bold text-slate-200">"ลิงก์" (Link)</span>
              </li>
              <li>
                คัดลอกลิงก์ตัวเต็มด้านบน (ลิงก์แอปพอร์ตจริงที่คัดลอกได้) ไปวางลงในช่อง **URL ลิงก์** พร้อมใส่คำอธิบายปุ่มแชร์
              </li>
              <li>
                กด **บันทึก** เป็นอันเปิดใช้งาน สองมือถือของลูกค้าและพนักงานก็จะเห็นริชเมนูสุดแสนสวยงาม กดใช้งานสต๊อกได้จากห้องแชตทันที
              </li>
            </ul>
          </div>

          {/* Step 2: Bypassing Unverified Warning */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>วิธีแก้ปัญหา "ขอสิทธิ์เข้าถึง" / คำเตือนจาก Google</span>
            </h4>
            <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <p>
                เนื่องจากแอปพลิเคชันตัวนี้เป็น **Custom / Private App** สำหรับคลังสินค้าของตนเอง ไม่ได้รับอนุญาตระดับพับบลิกสาธารณะจาก Google ทำให้เมื่อเราสั่งเชื่อม Google Sheets ระบบความปลอดภัยจะหยุดตรวจสอบสิทธิ์ชั่วคราวและแจ้งขึ้นเตือนว่า <span className="font-bold text-amber-400">"Google ยังไม่ได้ตรวจสอบแอปพลิเคชันนี้"</span>
              </p>
              <p className="bg-slate-900/50 p-2.5 rounded-lg border border-amber-950/30 text-amber-200 text-[11px] leading-relaxed">
                📢 **วิธีแก้ปัญหา:** <br/>
                คลิกคำว่า **"ขั้นสูง" (Advanced)** บริเวณแถบตัวเลือกมุมล่างซ้าย จากนั้นคลิกลิงก์คำว่า <span className="underline font-bold text-amber-300">"ไปยัง ... (ไม่ปลอดภัย)" (Go to ... (unsafe))</span> เพื่อทำงานลงสิทธิ์สเปรดชีตต่อไป จากนั้นกดยืนยันให้สิทธิ์เข้าถึง คุณก็จะเชื่อมชีตและอัปเดตข้อมูลรวมศูนย์กับฟังก์ชั่นในแอปได้ตามปกติอย่างร้อยเปอร์เซ็นต์!
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        isAlertOnly={confirmDialog.isAlertOnly}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
      />
    </div>
  );
}
