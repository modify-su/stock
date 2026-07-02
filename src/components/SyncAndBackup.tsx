import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle2, 
  Download, 
  Upload, 
  AlertTriangle, 
  Clipboard, 
  Link2, 
  Check, 
  ShieldAlert, 
  Trash2,
  Cloud,
  History as HistoryIcon,
  Calendar,
  User,
  FileJson,
  RefreshCw,
  Plus,
  FileDown,
  FileUp
} from 'lucide-react';
import { AppSettings, Product, Transaction, UserProfile, RolePermissions, Category, Shelf, CloudBackup } from '../types';
import ConfirmModal from './ConfirmModal';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

interface SyncAndBackupProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => Promise<void>;
  products: Product[];
  transactions: Transaction[];
  onImportProducts: (parsedProducts: Omit<Product, 'id' | 'updatedAt'>[], overwrite: boolean) => Promise<void>;
  currentUser: UserProfile;
  rolePermissions: Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>;
  categories: Category[];
  shelves: Shelf[];
  onRestoreFullBackup: (
    backupProducts: Product[],
    backupTransactions: Transaction[],
    backupCategories: Category[],
    backupShelves: Shelf[],
    backupSettings?: AppSettings,
    backupRolePermissions?: Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>
  ) => Promise<void>;
}

export default function SyncAndBackup({
  settings,
  onUpdateSettings,
  products,
  transactions,
  onImportProducts,
  currentUser,
  rolePermissions,
  categories,
  shelves,
  onRestoreFullBackup
}: SyncAndBackupProps) {
  const [pastedText, setPastedText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; count?: number; message?: string } | null>(null);
  const [isUrlCopied, setIsUrlCopied] = useState(false);

  // Cloud Backup and Recovery State hooks
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Fetch saved cloud backups on demand and on mount
  const fetchBackups = async () => {
    try {
      setLoadingBackups(true);
      const snapshot = await getDocs(collection(db, 'backups'));
      const list: CloudBackup[] = [];
      snapshot.forEach((snapDoc) => {
        list.push({ id: snapDoc.id, ...snapDoc.data() } as CloudBackup);
      });
      // Sort in-memory by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBackups(list);
    } catch (err) {
      console.error("Failed to fetch cloud backups:", err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateCloudBackup = async () => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการข้อมูลหลักหรือสร้างจุดสำรองข้อมูล');
      return;
    }

    try {
      setCreatingBackup(true);
      const backupData: Omit<CloudBackup, 'id'> = {
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        note: backupNote.trim() || 'สำรองระบบรายงวด',
        productsCount: products.length,
        transactionsCount: transactions.length,
        categoriesCount: categories.length,
        shelvesCount: shelves.length,
        products,
        transactions,
        categories,
        shelves,
        settings
      };

      await addDoc(collection(db, 'backups'), backupData);
      setBackupNote('');
      alert('☁️ ทำการบันทึกภาพถ่ายฐานข้อมูล (Snapshot Backup) ขึ้นคลาวด์เรียบร้อยแล้ว!');
      fetchBackups();
    } catch (err: any) {
      console.error("Failed to create backup:", err);
      alert('❌ เกิดข้อผิดพลาดในการสร้างจุดสำรองข้อมูล: ' + err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteCloudBackup = async (id: string) => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์ลบข้อมูลสำรอง');
      return;
    }

    try {
      await deleteDoc(doc(db, 'backups', id));
      alert('🗑️ ลบจุดกู้คืนบนระบบคลาวด์เรียบร้อยแล้ว');
      fetchBackups();
    } catch (err: any) {
      console.error("Failed to delete backup:", err);
      alert('❌ เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleRestoreBackupPoint = async (backup: CloudBackup) => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการหรือควบคุมสิทธิ์ในการกู้คืนระบบ');
      return;
    }

    try {
      setIsRestoring(true);
      await onRestoreFullBackup(
        backup.products || [],
        backup.transactions || [],
        backup.categories || [],
        backup.shelves || [],
        backup.settings,
        backup.rolePermissions
      );
      
      setConfirmDialog({
        isOpen: true,
        title: '🎉 กู้คืนระบบสำเร็จสมบูรณ์',
        message: `แอปพลิเคชันได้รับการกู้คืนข้อมูลกลับไป ณ วันที่ ${new Date(backup.createdAt).toLocaleString('th-TH')} เรียบร้อยแล้ว!\n\nข้อมูลที่กู้กลับมา:\n📦 สินค้าคลัง: ${backup.productsCount} รายการ\n📝 ประวัติธุรกรรมเดินบัญชี: ${backup.transactionsCount} รายการ\n📁 หมวดหมู่: ${backup.categoriesCount} รายการ\n📍 ผังชั้นจัดวาง: ${backup.shelvesCount} รายการ`,
        confirmText: 'ตกลง (รีโหลดระบบ)',
        isAlertOnly: true,
        variant: 'info',
        onConfirm: () => {
          setConfirmDialog(p => ({ ...p, isOpen: false }));
          window.location.reload();
        }
      });
    } catch (err: any) {
      console.error("Failed to restore backup point:", err);
      alert('❌ เกิดข้อผิดพลาดในการคืนสภาพจุดสำรอง: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportToJson = () => {
    try {
      const fullBackup: Omit<CloudBackup, 'id'> = {
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        note: `ดาวน์โหลดไฟล์สำรองภายนอกแอปพลิเคชัน (${settings.appName || 'Stock Management'})`,
        productsCount: products.length,
        transactionsCount: transactions.length,
        categoriesCount: categories.length,
        shelvesCount: shelves.length,
        products,
        transactions,
        categories,
        shelves,
        settings
      };

      const jsonStr = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Inventory_Full_Backup_${settings.appName || 'Stock'}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("JSON backup generation failed", err);
      alert('❌ ไม่สามารถสร้างไฟล์สำรองดาวน์โหลดข้อมูลระบบได้');
    }
  };

  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasSettingsPermission) {
      alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการข้อมูลระบบเพื่อกู้คืน');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const backup = JSON.parse(text) as CloudBackup;
        if (!backup.products || !Array.isArray(backup.products)) {
          alert('❌ รูปแบบไฟล์สำรองออฟไลน์ .JSON ไม่ถูกต้องหรือไฟล์เกิดความเสียหาย');
          return;
        }

        setConfirmDialog({
          isOpen: true,
          title: '⚠️ ยืนยันการกู้คืนระบบจากชุดสำรองนอก',
          message: `คุณต้องการลบข้อมูลปัจจุบันทั้งหมดในคลังระบบจริง แล้วสวมทับคืนสภาพด้วยไฟล์สำรองภายนอก (.JSON) นี้ใช่หรือไม่?\n\n- วันที่สำรองไว้: ${backup.createdAt ? new Date(backup.createdAt).toLocaleString('th-TH') : 'ไม่ทราบข้อมูล'}\n- หมายเหตุแถม: ${backup.note || 'ไม่มี'}\n- จำนวนสินค้าคลัง: ${backup.products?.length || 0} รายการ\n- ประวัติเดินคลัง: ${backup.transactions?.length || 0} รายการ\n\n⚠️ คำเตือน: ระบบจะเขียนทับฐานข้อมูลเดิม และไม่สามารถกู้สถานะปัจจุบันคืนมาได้!`,
          confirmText: 'ตกลง กู้คืนแบบลบทับทั้งหมด',
          cancelText: 'ยกเลิก',
          variant: 'danger',
          onConfirm: async () => {
            try {
              setIsRestoring(true);
              setConfirmDialog(p => ({ ...p, isOpen: false }));
              
              await onRestoreFullBackup(
                backup.products || [],
                backup.transactions || [],
                backup.categories || [],
                backup.shelves || [],
                backup.settings,
                backup.rolePermissions
              );

              setConfirmDialog({
                isOpen: true,
                title: '🎉 คืนสภาพระบบจากไฟล์สำเร็จ',
                message: `ฐานข้อมูลระบบสต๊อกได้รับการฟื้นฟูกลับมาจากไฟล์ .JSON สำเร็จแล้ว!\n\n📦 สินค้า: ${backup.products?.length || 0} รายการ\n📝 ประวัติธุรกรรมคลัง: ${backup.transactions?.length || 0} รายการ`,
                confirmText: 'ตกลง (รีบูตระบบ)',
                isAlertOnly: true,
                variant: 'info',
                onConfirm: () => {
                  setConfirmDialog(p => ({ ...p, isOpen: false }));
                  window.location.reload();
                }
              });
            } catch (err: any) {
              console.error(err);
              alert('❌ เกิดข้อผิดพลาดขั้นวิกฤตระหว่างเขียนฐานข้อมูลคืนค่า: ' + err.message);
            } finally {
              setIsRestoring(false);
            }
          }
        });
      } catch (err) {
        console.error("JSON parse failure", err);
        alert('❌ โครงสร้างไฟล์ .JSON บกพร่องหรือชำรุด ไม่สามารถประยุกต์ถอดรหัสคืนยอดได้');
      }
    };
    reader.readAsText(file);
  };

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

const handleExportProductsToCsv = () => {
    try {
      const headers = ["ชื่อสินค้า", "รหัสสินค้า_SKU", "หมวดหมู่", "จำนวนคงเหลือ", "เกณฑ์แจ้งเตือนสินค้าต่ำสุด", "หน่วยนับ", "ตำแหน่งชั้นวาง", "น้ำหนัก", "หน่วยน้ำหนัก"];
      const rows = products.map(p => [
        p.name,
        p.sku,
        p.category,
        p.quantity.toString(),
        p.minStock.toString(),
        p.unit || 'ชิ้น',
        p.location || '-',
        p.weight !== undefined && p.weight !== null ? p.weight.toString() : '-',
        p.weightUnit || '-'
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

  const handleExportTransactionsToCsv = () => {
    try {
      const headers = [
        "วันที่-เวลา",
        "รหัสสินค้า_SKU",
        "ชื่อสินค้า",
        "ประเภทรายการ",
        "จำนวน",
        "น้ำหนักรวม",
        "หน่วยน้ำหนัก",
        "ผู้ปฏิบัติการ",
        "เลขที่อ้างอิง",
        "สถานะสินค้าตีกลับ",
        "หมายเหตุ/เหตุผล"
      ];
      const rows = transactions.map(t => {
        let typeStr = t.type === 'IN' ? 'รับเข้า (IN)' : t.type === 'OUT' ? 'เบิกออก (OUT)' : 'สินค้าคืน/ตีกลับ (RETURN)';
        let returnStr = t.returnStatus === 'RE_STOCK' ? 'คืนสต๊อกหลัก' : t.returnStatus === 'DAMAGED_WRITE_OFF' ? 'สินค้าชำรุด/เขียนตัดบัญชี (Write-off)' : t.returnStatus === 'PENDING_INSPECT' ? 'รอตรวจสอบคุณภาพ' : '-';
        return [
          t.date ? new Date(t.date).toLocaleString('th-TH') : '-',
          t.productSku,
          t.productName,
          typeStr,
          t.quantity.toString(),
          t.weight !== undefined && t.weight !== null ? t.weight.toString() : '-',
          t.weightUnit || '-',
          t.operator || '-',
          t.referenceNo || '-',
          returnStr,
          t.reason || '-'
        ];
      });
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(col => `"${col.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Transaction_Movement_Report_${settings.appName || 'Stock'}_${new Date().toISOString().slice(0, 10)}.csv`);
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
              บัญชีใช้งานระดับบทบาท <span className="font-bold underline">{currentUser.role === 'KEEPER' ? 'เจ้าหน้าที่ดูแลคลังสินค้า' : 'ผู้ตรวจสอบบัญชี (Auditor)'}</span> ของคุณไม่สามารถนำเข้าคลังสินค้าหรือทำยอดหลัก แต่ยังคงสามารถดาวน์โหลดสรุปประวัติและตารางสินค้าเป็นไฟล์ CSV เพื่อวัตถุประสงค์ในการตรวจสอบภายในส่วนบุคคลได้
            </p>
          </div>
        </div>
      )}

      {/* Cloud Backup & Recovery System */}
      <div className="bg-gradient-to-br from-indigo-50/40 to-slate-50 border border-indigo-100 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-indigo-600 animate-pulse" />
              <span>☁️ ระบบจัดเก็บข้อมูลสำรองบนคลาวด์ (Cloud Backup & System Recovery)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ป้องกันข้อมูลสูญหายด้วยการบันทึก Snapshot คลังของคุณ (สินค้า, ประวัติเดินบัญชี, หมวดหมู่, ผังชั้นวาง) ไว้บนระบบ Cloud แบบเรียลไทม์ และสามารถกู้คืนสู่สถานะเดิมได้ทันที
            </p>
          </div>
          <button 
            type="button" 
            onClick={fetchBackups}
            disabled={loadingBackups}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingBackups ? 'animate-spin' : ''}`} />
            <span>รีเฟรชประวัติ</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Backup Panel */}
          <div className="lg:col-span-5 p-5 bg-white border border-indigo-100/80 rounded-xl space-y-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>สร้างจุดกู้คืนปัจจุบัน (Create Snapshot)</span>
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              บันทึกสถานะของระบบสต๊อกปัจจุบันทั้งหมดไว้เป็นฐานข้อมูลย่อย คุณสามารถเลือกย้อนเวลาระบบเพื่อกู้คืนข้อมูลกลับมาได้ทุกเมื่อ
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  หมายเหตุ / บันทึกย่อจุดกู้คืน (Note)
                </label>
                <input
                  type="text"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  disabled={creatingBackup || !hasSettingsPermission}
                  placeholder="เช่น: สำรองไว้ก่อนเคลียร์สต๊อก, หลังปิดยอดประจำสัปดาห์"
                  className="w-full text-xs px-3 py-2 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-lg placeholder-slate-400 disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateCloudBackup}
                disabled={creatingBackup || !hasSettingsPermission}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                {creatingBackup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึกข้อมูลขึ้นระบบ Cloud...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>บันทึกจุดสำรองข้อมูลบนคลาวด์</span>
                  </>
                )}
              </button>
              
              {!hasSettingsPermission && (
                <p className="text-[10px] text-rose-500 text-center">
                  ⚠️ เฉพาะผู้จัดการคลังสินค้า (ADMIN) เท่านั้นที่สามารถสร้างจุดสำรองข้อมูลได้
                </p>
              )}
            </div>
          </div>

          {/* Backup History List */}
          <div className="lg:col-span-7 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <HistoryIcon className="w-4 h-4 text-indigo-600" />
              <span>จุดกู้คืนระบบบนคลาวด์ที่บันทึกไว้ ({backups.length})</span>
            </h4>

            {loadingBackups ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-xl space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-400">กำลังดึงรายการจุดสำรองข้อมูลจากระบบคลาวด์...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 bg-white/60 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                <Cloud className="w-10 h-10 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">ไม่พบจุดสำรองข้อมูลบนระบบคลาวด์</p>
                <p className="text-[11px] text-slate-400">คุณยังไม่เคยสำรองข้อมูลบนคลาวด์ หรือประวัติได้รับการล้างไปแล้ว</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {backups.map((b) => (
                  <div key={b.id} className="p-3.5 bg-white border border-slate-200 hover:border-indigo-200 rounded-xl transition-all shadow-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                            {b.note}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(b.createdAt).toLocaleString('th-TH')}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            ผู้บันทึก: {b.createdByName || 'ระบบ'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: '🔄 ยืนยันการคืนค่าระบบ (System Restore)',
                              message: `คุณยืนยันที่จะกู้คืนสถานะคลังสินค้ากลับไปยังจุดกู้คืน "${b.note}" ใช่หรือไม่?\n\nข้อมูลระบบ ณ ปัจจุบันของคุณจะถูกเขียนทับทั้งหมด!\n\n(สร้างเมื่อ: ${new Date(b.createdAt).toLocaleString('th-TH')})`,
                              confirmText: 'ตกลง กู้คืนฐานข้อมูล',
                              cancelText: 'ยกเลิก',
                              variant: 'warning',
                              onConfirm: () => {
                                setConfirmDialog(p => ({ ...p, isOpen: false }));
                                handleRestoreBackupPoint(b);
                              }
                            });
                          }}
                          disabled={isRestoring || !hasSettingsPermission}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>กู้คืน</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const jsonStr = JSON.stringify(b, null, 2);
                              const blob = new Blob([jsonStr], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.setAttribute("href", url);
                              link.setAttribute("download", `Backup_${b.note.replace(/\s+/g, '_')}_${new Date(b.createdAt).toISOString().slice(0, 10)}.json`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } catch (err) {
                              alert('เกิดข้อผิดพลาดในการแปลงไฟล์');
                            }
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer border border-slate-200"
                          title="ดาวน์โหลดชุดสำรองนี้เป็นไฟล์ .JSON"
                        >
                          <FileJson className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: '🗑️ ลบจุดกู้คืนข้อมูลบนคลาวด์',
                              message: `คุณแน่ใจที่จะลบจุดคืนค่าระบบ "${b.note}" นี้จากฐานคลาวด์อย่างถาวรหรือไม่?\n(การลบนี้เป็นลบถาวร ไม่ส่งผลต่อข้อมูลปัจจุบัน แต่จุดคืนค่านี้จะหายไป)`,
                              confirmText: 'ลบจุดสำรองถาวร',
                              cancelText: 'ยกเลิก',
                              variant: 'danger',
                              onConfirm: () => {
                                setConfirmDialog(p => ({ ...p, isOpen: false }));
                                handleDeleteCloudBackup(b.id);
                              }
                            });
                          }}
                          disabled={!hasSettingsPermission}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer border border-rose-100"
                          title="ลบข้อมูลสำรองจุดนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg text-[11px] text-slate-500 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono border border-slate-100">
                      <div>
                        <span className="block text-slate-400 text-[9px] uppercase">📦 สินค้าคลัง</span>
                        <span className="font-bold text-slate-700">{b.productsCount || 0} รายการ</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 text-[9px] uppercase">📝 ประวัติเดินคลัง</span>
                        <span className="font-bold text-slate-700">{b.transactionsCount || 0} รายการ</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 text-[9px] uppercase">📁 หมวดหมู่</span>
                        <span className="font-bold text-slate-700">{b.categoriesCount || 0} รายการ</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 text-[9px] uppercase">📍 ผังชั้นจัดวาง</span>
                        <span className="font-bold text-slate-700">{b.shelvesCount || 0} รายการ</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Offline JSON File Backup & Recovery Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileJson className="w-5 h-5 text-indigo-600" />
            <span>💾 สำรองข้อมูลในเครื่องแบบออฟไลน์ (.JSON Backup System)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            ดาวน์โหลดไฟล์สำรองฐานข้อมูลสต๊อกทั้งหมด (.JSON) เก็บไว้ในเครื่องคอมพิวเตอร์ของคุณแบบออฟไลน์ และสามารถกู้คืนระบบได้ตลอดเวลาแม้ไม่มีเน็ตหรือเปลี่ยนเครื่อง
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-indigo-600" />
                <span>ดาวน์โหลดไฟล์สำรองฐานระบบ (.JSON Export)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                สร้างและดาวน์โหลดชุดสตรีม JSON ตัวเต็มที่มีข้อมูลของสินค้า ประวัติเดินคลัง ผังชั้นวางและค่าตั้งค่าแอปพลิเคชันทั้งหมดไว้แบบสมบูรณ์
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportToJson}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer self-start transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลดไฟล์สำรอง .JSON</span>
            </button>
          </div>

          <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileUp className="w-4 h-4 text-emerald-600" />
                <span>อัปโหลดเพื่อคืนสภาพสต๊อก (.JSON Restore)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                กู้คืนโครงสร้างคลังทั้งหมดโดยป้อนอัพโหลดไฟล์ .JSON ที่บันทึกไว้ภายนอกกลับเข้ามาเขียนทับฐานข้อมูลระบบคลาวด์โดยตรง
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={jsonFileInputRef}
                accept=".json"
                onChange={handleImportFromJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  if (!hasSettingsPermission) {
                    alert('🔒 ขออภัย คุณไม่มีสิทธิ์จัดการข้อมูลหลักสินค้าเพื่อนำเข้า');
                    return;
                  }
                  jsonFileInputRef.current?.click();
                }}
                disabled={!hasSettingsPermission}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer self-start transition-all shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>เลือกไฟล์ออฟไลน์และกู้คืน</span>
              </button>
            </div>
          </div>
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
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Product inventory export */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>ดาวน์โหลดข้อมูลสินค้าคงเหลือในคลัง (Export Current Inventory)</span>
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ส่งออกตารางสินค้าปัจจุบันพร้อมน้ำหนักและตำแหน่งจัดวางเป็นไฟล์ Excel / CSV (.csv) รองรับการเปิดใช้งานและกรองข้อมูลด้วย Microsoft Excel
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleExportProductsToCsv}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>ดาวน์โหลดสรุปสต๊อกปัจจุบัน (.CSV / Excel)</span>
                  </button>

                  <button
                    onClick={() => {
                      const headers = ["ชื่อสินค้า", "รหัสสินค้า_SKU", "หมวดหมู่", "จำนวนคงเหลือ", "เกณฑ์แจ้งเตือนสินค้าต่ำสุด", "หน่วยนับ", "ตำแหน่งชั้นวาง", "น้ำหนัก", "หน่วยน้ำหนัก"];
                      const rows = products.map(p => [
                        p.name,
                        p.sku,
                        p.category,
                        p.quantity.toString(),
                        p.minStock.toString(),
                        p.unit || 'ชิ้น',
                        p.location || '-',
                        p.weight !== undefined && p.weight !== null ? p.weight.toString() : '-',
                        p.weightUnit || '-'
                      ]);
                      const tsvContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
                      navigator.clipboard.writeText(tsvContent);
                      alert("📋 คัดลอกข้อมูลสินค้าแบบแบ่งคอลัมน์ (Tab-Separated) ลงบอร์ดคลิปบอร์ดแล้ว! คุณสามารถเปิด Google Sheets แล้วกด Ctrl+V เพื่อวางข้อมูลได้เลยทันที");
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer border border-slate-300"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>คัดลอกด่วนไป Google Sheets (TSV)</span>
                  </button>
                </div>
              </div>

              {/* Separator line */}
              <div className="border-t border-slate-200/60 my-2"></div>

              {/* Transactions log export */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ดาวน์โหลดประวัติการเบิกออก-รับเข้าคลังรายเดือน (Export Monthly Movement Logs)</span>
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ดาวน์โหลดรายงานประวัติการเดินสะพัดคลังทั้งหมด เพื่อนำไปสรุปยอดรายเดือน คำนวณปริมาณการเบิกจ่ายสินค้า และวางแผนงวดสต๊อกถัดไป
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleExportTransactionsToCsv}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>ดาวน์โหลดประวัติเคลื่อนไหวคลัง (.CSV / Excel)</span>
                  </button>
                </div>
              </div>
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
              ไปที่เมนูฝั่งซ้าย เลือก **"ริชเมนู" (Rich Menus)** ภายใต้หัวข้อหน้าหลัก
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
              กด **บันทึก** เป็นอันเปิดใช้งาน โทรศัพท์มือถือของลูกค้าและพนักงานจะเห็นริชเมนูสวยงาม และสามารถกดเช็คสต๊อกหรือทำรายการได้จากห้องแชตทันที
            </li>
          </ul>
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
