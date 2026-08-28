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
  FileUp,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Filter,
  Copy
} from 'lucide-react';
import { AppSettings, Product, Transaction, UserProfile, RolePermissions, Category, Shelf, CloudBackup, Unit } from '../types';
import ConfirmModal from './ConfirmModal';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export const EXPORT_HEADERS = [
  { key: 'sku', label: 'รหัส SKU', defaultChecked: true, getValue: (p: Product) => p.sku },
  { key: 'name', label: 'ชื่อรายการสินค้า', defaultChecked: true, getValue: (p: Product) => p.name },
  { key: 'category', label: 'หมวดหมู่', defaultChecked: true, getValue: (p: Product) => p.category },
  { key: 'quantity', label: 'กำลังจำหน่าย (พร้อมขาย)', defaultChecked: true, getValue: (p: Product) => p.quantity.toString() },
  { key: 'wholesaleStock', label: 'คลังหลัก (รอเบิก)', defaultChecked: true, getValue: (p: Product) => (p.wholesaleStock !== undefined ? p.wholesaleStock.toString() : '0') },
  { key: 'unit', label: 'หน่วยนับ', defaultChecked: true, getValue: (p: Product) => p.unit || 'ชิ้น' },
  { key: 'location', label: 'สถานที่จัดเก็บ', defaultChecked: true, getValue: (p: Product) => p.location || '-' },
  { key: 'minStock', label: 'เกณฑ์แจ้งเตือนสินค้าต่ำสุด', defaultChecked: false, getValue: (p: Product) => p.minStock.toString() },
  { key: 'price', label: 'ราคาสินค้า', defaultChecked: false, getValue: (p: Product) => (p.price !== undefined ? p.price.toString() : '-') },
  { key: 'weight', label: 'น้ำหนัก', defaultChecked: false, getValue: (p: Product) => (p.weight !== undefined && p.weight !== null ? p.weight.toString() : '-') },
  { key: 'weightUnit', label: 'หน่วยน้ำหนัก', defaultChecked: false, getValue: (p: Product) => p.weightUnit || '-' },
  { key: 'wholesaleUnit', label: 'หน่วยคลังหลัก', defaultChecked: false, getValue: (p: Product) => p.wholesaleUnit || '-' },
  { key: 'conversionFactor', label: 'อัตราแปลงหน่วย', defaultChecked: false, getValue: (p: Product) => (p.conversionFactor !== undefined ? p.conversionFactor.toString() : '1') }
];

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
  units?: Unit[];
  onRestoreFullBackup: (
    backupProducts: Product[],
    backupTransactions: Transaction[],
    backupCategories: Category[],
    backupShelves: Shelf[],
    backupUnits?: Unit[],
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
  units = [],
  onRestoreFullBackup
}: SyncAndBackupProps) {

  const [importStatus, setImportStatus] = useState<{ success?: boolean; count?: number; message?: string } | null>(null);
  const [isUrlCopied, setIsUrlCopied] = useState(false);

  // Customizable Export columns state
  const [selectedExportKeys, setSelectedExportKeys] = useState<string[]>(
    EXPORT_HEADERS.filter(h => h.defaultChecked).map(h => h.key)
  );

  // Transactions Export Date & Filter state
  const [txExportPeriod, setTxExportPeriod] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'MONTH' | 'DATE_RANGE' | 'TODAY'>('ALL');
  const [txExportMonth, setTxExportMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [txExportStartDate, setTxExportStartDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [txExportEndDate, setTxExportEndDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [txExportType, setTxExportType] = useState<'ALL' | 'IN_OUT' | 'IN' | 'OUT' | 'RETURN'>('ALL');

  const handleSelectMain7 = () => {
    setSelectedExportKeys(['sku', 'name', 'category', 'quantity', 'wholesaleStock', 'unit', 'location']);
  };

  const handleSelectAll = () => {
    setSelectedExportKeys(EXPORT_HEADERS.map(h => h.key));
  };

  const handleSelectNone = () => {
    setSelectedExportKeys([]);
  };

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
        unitsCount: units.length,
        products,
        transactions,
        categories,
        shelves,
        units,
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
        backup.units || [],
        backup.settings,
        backup.rolePermissions
      );
      
      setConfirmDialog({
        isOpen: true,
        title: '🎉 กู้คืนระบบสำเร็จสมบูรณ์',
        message: `แอปพลิเคชันได้รับการกู้คืนข้อมูลกลับไป ณ วันที่ ${new Date(backup.createdAt).toLocaleString('th-TH')} เรียบร้อยแล้ว!\n\nข้อมูลที่กู้กลับมา:\n📦 สินค้าคลัง: ${backup.productsCount} รายการ\n📝 ประวัติธุรกรรมเดินบัญชี: ${backup.transactionsCount} รายการ\n📁 หมวดหมู่: ${backup.categoriesCount} รายการ\n📍 ผังชั้นจัดวาง: ${backup.shelvesCount} รายการ\n⚖️ หน่วยนับสินค้า: ${backup.unitsCount || 0} รายการ`,
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
        unitsCount: units.length,
        products,
        transactions,
        categories,
        shelves,
        units,
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
                backup.units || [],
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
      if (selectedExportKeys.length === 0) {
        alert('⚠️ กรุณาเลือกหัวข้อคอลัมน์อย่างน้อย 1 รายการเพื่อส่งออกข้อมูล');
        return;
      }

      const activeHeaders = EXPORT_HEADERS.filter(h => selectedExportKeys.includes(h.key));
      const headers = activeHeaders.map(h => h.label);
      const rows = products.map(p => activeHeaders.map(h => h.getValue(p)));

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

  const getFilteredTransactions = () => {
    return transactions.filter(t => {
      // Type Filter
      if (txExportType === 'IN' && t.type !== 'IN') return false;
      if (txExportType === 'OUT' && t.type !== 'OUT') return false;
      if (txExportType === 'RETURN' && t.type !== 'RETURN') return false;
      if (txExportType === 'IN_OUT' && t.type !== 'IN' && t.type !== 'OUT') return false;

      if (!t.date) return true;
      const txDate = new Date(t.date);
      if (isNaN(txDate.getTime())) return true;

      if (txExportPeriod === 'ALL') return true;

      if (txExportPeriod === 'TODAY') {
        const today = new Date();
        return (
          txDate.getFullYear() === today.getFullYear() &&
          txDate.getMonth() === today.getMonth() &&
          txDate.getDate() === today.getDate()
        );
      }

      if (txExportPeriod === 'THIS_MONTH') {
        const now = new Date();
        return (
          txDate.getFullYear() === now.getFullYear() &&
          txDate.getMonth() === now.getMonth()
        );
      }

      if (txExportPeriod === 'LAST_MONTH') {
        const lastMonth = new Date();
        lastMonth.setDate(1);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return (
          txDate.getFullYear() === lastMonth.getFullYear() &&
          txDate.getMonth() === lastMonth.getMonth()
        );
      }

      if (txExportPeriod === 'MONTH' && txExportMonth) {
        const [y, m] = txExportMonth.split('-');
        const targetYear = parseInt(y, 10);
        const targetMonth = parseInt(m, 10) - 1;
        return (
          txDate.getFullYear() === targetYear &&
          txDate.getMonth() === targetMonth
        );
      }

      if (txExportPeriod === 'DATE_RANGE') {
        if (txExportStartDate) {
          const start = new Date(txExportStartDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (txExportEndDate) {
          const end = new Date(txExportEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
        return true;
      }

      return true;
    });
  };

  const getExportFileName = () => {
    const typeLabel = txExportType === 'IN' ? 'รับเข้า_IN' : txExportType === 'OUT' ? 'เบิกออก_OUT' : txExportType === 'IN_OUT' ? 'รับเข้าและส่งออก_IN_OUT' : txExportType === 'RETURN' ? 'สินค้าตีกลับ_RETURN' : 'ทุกประเภท';
    let periodLabel = 'ทั้งหมด';
    if (txExportPeriod === 'TODAY') {
      periodLabel = `วันนี้_${new Date().toISOString().slice(0, 10)}`;
    } else if (txExportPeriod === 'THIS_MONTH') {
      periodLabel = `เดือนนี้_${new Date().toISOString().slice(0, 7)}`;
    } else if (txExportPeriod === 'LAST_MONTH') {
      const lm = new Date();
      lm.setDate(1);
      lm.setMonth(lm.getMonth() - 1);
      periodLabel = `เดือนที่แล้ว_${lm.toISOString().slice(0, 7)}`;
    } else if (txExportPeriod === 'MONTH') {
      periodLabel = `ประจำเดือน_${txExportMonth || 'เลือก'}`;
    } else if (txExportPeriod === 'DATE_RANGE') {
      periodLabel = `ช่วงวันที่_${txExportStartDate || 'ต้น'}_ถึง_${txExportEndDate || 'ปลาย'}`;
    }
    return `Transaction_Movement_${settings.appName || 'Stock'}_${periodLabel}_${typeLabel}.csv`;
  };

  const handleExportTransactionsToCsv = () => {
    try {
      const targetList = getFilteredTransactions();
      if (targetList.length === 0) {
        alert('⚠️ ไม่พบข้อมูลรายการเคลื่อนไหวที่ตรงตามเงื่อนไข วัน/เดือน/ประเภท ที่ระบุ');
        return;
      }
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
      const rows = targetList.map(t => {
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
      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(col => `"${(col || '').replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", getExportFileName());
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyTransactionsToClipboard = () => {
    try {
      const targetList = getFilteredTransactions();
      if (targetList.length === 0) {
        alert('⚠️ ไม่พบข้อมูลรายการเคลื่อนไหวที่ตรงตามเงื่อนไข วัน/เดือน/ประเภท ที่ระบุ');
        return;
      }
      const headers = [
        "วันที่-เวลา",
        "รหัสสินค้า SKU",
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
      const rows = targetList.map(t => {
        let typeStr = t.type === 'IN' ? 'รับเข้า (IN)' : t.type === 'OUT' ? 'เบิกออก (OUT)' : 'สินค้าคืน/ตีกลับ (RETURN)';
        let returnStr = t.returnStatus === 'RE_STOCK' ? 'คืนสต๊อกหลัก' : t.returnStatus === 'DAMAGED_WRITE_OFF' ? 'สินค้าชำรุด/เขียนตัดบัญชี' : t.returnStatus === 'PENDING_INSPECT' ? 'รอตรวจสอบคุณภาพ' : '-';
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
      const tsvContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
      navigator.clipboard.writeText(tsvContent);
      alert(`📋 คัดลอกข้อมูลรายการเคลื่อนไหวจำนวน ${targetList.length} รายการ (Tab-Separated) ลงในคลิปบอร์ดแล้ว! สามารถกดวาง (Ctrl+V) ลงใน Excel หรือ Google Sheets ได้ทันที`);
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
        setImportStatus({ success: false, message: 'ไม่พบแถวข้อมูลผลิตภัณฑ์สินค้าที่มีโครงสร้างคีย์คู่คอลัมน์ถูกต้อง โปรดยึดตามตัวอย่าง' });
        return;
      }

      onImportProducts(importedList, overwrite);
      setImportStatus({ 
        success: true, 
        count: importedList.length, 
        message: `นำเข้าข้อมูลสินค้าจำนวน ${importedList.length} รายการ ซิงก์ขึ้น Firebase คลาวด์เรียบร้อยแล้ว!` 
      });
    } catch (err) {
      console.error(err);
      setImportStatus({ success: false, message: 'เกิดข้อผิดพลาดในการแปลสัญญาณถอดรหัส ตรวจสอบความถูกต้องของแนวสเปรดชีต' });
    }
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
                <p className="text-[11px] text-slate-400">คุณยังไม่มีการสร้างจุดสำรองข้อมูลย้อนกลับในขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {backups.map((b) => (
                  <div key={b.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 transition-all hover:border-indigo-200 hover:shadow-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span>📦 {b.note || 'Snapshot อัตโนมัติ'}</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {b.createdAt ? new Date(b.createdAt).toLocaleString('th-TH') : '-'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreBackupPoint(b)}
                        disabled={!hasSettingsPermission || isRestoring}
                        className="px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isRestoring ? 'กำลังกู้คืน...' : 'กู้คืนสถานะนี้'}
                      </button>
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

      {/* 2.5 Offline File Backup & Restore Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <FileJson className="w-5 h-5 text-indigo-600" />
            <span>💾 สำรองข้อมูลออฟไลน์ด้วยไฟล์ดิบ (.JSON Backup & Restore)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            บันทึกรวบยอดทั้งหมดเก็บเป็นไฟล์ข้อมูลความปลอดภัยภายนอก เพื่ออิมพอร์ตคืนสถานะภายหลัง
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-slate-600" />
                <span>ดาวน์โหลดชุดสำรองข้อมูล (.JSON Backup)</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                บันทึกเสถียรและดาวน์โหลดชุดสตรีมข้อมูลผลิตภัณฑ์และธุรกรรมของแอปพลิเคชันทั้งหมดไว้แบบสมบูรณ์
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
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>ดาวน์โหลดข้อมูลสินค้าคงเหลือในคลัง (Export Current Inventory)</span>
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ส่งออกตารางสินค้าปัจจุบันพร้อมข้อมูลชั้นวางและพารามิเตอร์อื่นๆ เป็นไฟล์ Excel / CSV (.csv) หรือคัดลอกลงบอร์ดโดยตรงตามหัวข้อที่คุณกำหนดด้านล่างนี้:
                </p>

                {/* Column Selection Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      🛠️ เลือกคอลัมน์ส่งออก (Select Columns)
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSelectMain7}
                        className="px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer transition-colors"
                        title="เลือกเฉพาะ 7 หัวข้อหลักที่ปรากฏในตารางคลังสินค้า"
                      >
                        เฉพาะ 7 หัวหลักในตาราง
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer transition-colors"
                      >
                        เลือกทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectNone}
                        className="px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer transition-colors"
                      >
                        ล้างทั้งหมด
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50/50 rounded-lg border border-slate-100 max-h-48 overflow-y-auto">
                    {EXPORT_HEADERS.map((h) => {
                      const isChecked = selectedExportKeys.includes(h.key);
                      return (
                        <label
                          key={h.key}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10.5px] cursor-pointer transition-all select-none ${
                            isChecked
                              ? 'bg-blue-50/50 border-blue-200 text-blue-800 font-semibold'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedExportKeys(prev =>
                                prev.includes(h.key)
                                  ? prev.filter(k => k !== h.key)
                                  : [...prev, h.key]
                              );
                            }}
                            className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>{h.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-400 italic">
                    💡 ระบบจะจัดเรียงข้อมูลตามคอลัมน์ที่เลือกตามลำดับด้านบนในไฟล์ผลลัพธ์
                  </div>
                </div>

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
                      if (selectedExportKeys.length === 0) {
                        alert('⚠️ กรุณาเลือกหัวข้อคอลัมน์อย่างน้อย 1 รายการเพื่อคัดลอกข้อมูล');
                        return;
                      }
                      const activeHeaders = EXPORT_HEADERS.filter(h => selectedExportKeys.includes(h.key));
                      const headers = activeHeaders.map(h => h.label);
                      const rows = products.map(p => activeHeaders.map(h => h.getValue(p)));
                      const tsvContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
                      navigator.clipboard.writeText(tsvContent);
                      alert("📋 คัดลอกข้อมูลสินค้าแบบแบ่งคอลัมน์ (Tab-Separated) ลงบอร์ดคลิปบอร์ดตามหัวข้อที่เลือกแล้ว! คุณสามารถกดปุ่มวาง (Ctrl+V) ลงในโปรแกรม Excel หรือ Google Sheets ได้ทันที");
                    }}
                    className="px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    คัดลอกด่วนไป Google Sheets (Tab)
                  </button>
                </div>
              </div>

              {/* Transactions log export */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>ส่งออกรายงานประวัติการรับเข้า - ส่งออก (Export Movements & Transactions)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    เลือกกำหนดช่วงเวลา เดือน วันที่ และประเภทรายการที่ต้องการส่งออก เพื่อนำไปจัดทำบัญชีสต๊อกหรือรายงานประจำงวด
                  </p>
                </div>

                {/* Filter and Period Selection Box */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 text-xs">
                  {/* 1. Transaction Type Selector */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-slate-400" />
                      ประเภทรายการที่ต้องการส่งออก:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'ALL', label: 'ทั้งหมด (ทุกประเภท)' },
                        { id: 'IN_OUT', label: 'รับเข้า & ส่งออก (IN+OUT)' },
                        { id: 'IN', label: '📥 เฉพาะรับเข้า (IN)' },
                        { id: 'OUT', label: '📤 เฉพาะส่งออก/เบิกจ่าย (OUT)' },
                        { id: 'RETURN', label: '↩️ เฉพาะสินค้าตีกลับ (RETURN)' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTxExportType(t.id as any)}
                          className={`px-2 py-1.5 rounded-lg border text-left text-[10.5px] font-medium transition-all cursor-pointer ${
                            txExportType === t.id
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Date & Month Period Selector */}
                  <div className="border-t border-slate-100 pt-2.5">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      กำหนดช่วงเวลา / เดือน / วันที่:
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2.5">
                      {[
                        { id: 'ALL', label: '🗂️ ทั้งหมด (All Time)' },
                        { id: 'MONTH', label: '🗓️ กำหนดตามเดือน (Month)' },
                        { id: 'DATE_RANGE', label: '📆 กำหนดช่วงวันที่ (Range)' },
                        { id: 'TODAY', label: '⏱️ เฉพาะวันนี้ (Today)' },
                        { id: 'THIS_MONTH', label: '📅 ประจำเดือนนี้' },
                        { id: 'LAST_MONTH', label: '📆 ประจำเดือนที่แล้ว' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setTxExportPeriod(p.id as any)}
                          className={`px-2 py-1.5 rounded-lg border text-left text-[10.5px] font-medium transition-all cursor-pointer ${
                            txExportPeriod === p.id
                              ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold shadow-xs'
                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Conditional Input for Month Selection */}
                    {txExportPeriod === 'MONTH' && (
                      <div className="p-2.5 bg-blue-50/40 border border-blue-100 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="text-[11px] font-bold text-blue-800 shrink-0">เลือกเดือน/ปี:</span>
                        <input
                          type="month"
                          value={txExportMonth}
                          onChange={(e) => setTxExportMonth(e.target.value)}
                          className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-md text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="text-[10px] text-blue-600">
                          {txExportMonth ? `(รายงานประจำเดือน ${new Date(txExportMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })})` : ''}
                        </span>
                      </div>
                    )}

                    {/* Conditional Input for Date Range Selection */}
                    {txExportPeriod === 'DATE_RANGE' && (
                      <div className="p-2.5 bg-blue-50/40 border border-blue-100 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-blue-800 shrink-0">ตั้งแต่วันที่:</span>
                          <input
                            type="date"
                            value={txExportStartDate}
                            onChange={(e) => setTxExportStartDate(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-md text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-blue-800 shrink-0">ถึงวันที่:</span>
                          <input
                            type="date"
                            value={txExportEndDate}
                            onChange={(e) => setTxExportEndDate(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-md text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Live Match Statistics Preview */}
                  {(() => {
                    const currentFiltered = getFilteredTransactions();
                    const inQty = currentFiltered.filter(t => t.type === 'IN').reduce((s, t) => s + (t.quantity || 0), 0);
                    const outQty = currentFiltered.filter(t => t.type === 'OUT').reduce((s, t) => s + (t.quantity || 0), 0);
                    const retQty = currentFiltered.filter(t => t.type === 'RETURN').reduce((s, t) => s + (t.quantity || 0), 0);

                    return (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-600">
                          📊 พบข้อมูลที่ตรงเงื่อนไข: <strong className="text-slate-800 font-bold">{currentFiltered.length}</strong> รายการ
                          {currentFiltered.length > 0 && (
                            <span className="text-[10px] text-slate-500 block sm:inline sm:ml-2">
                              (รับเข้า: <span className="text-emerald-600 font-semibold">+{inQty}</span> | เบิกออก: <span className="text-rose-600 font-semibold">-{outQty}</span> {retQty > 0 ? `| ตีกลับ: ${retQty}` : ''})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          UTF-8 BOM (.csv)
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleExportTransactionsToCsv}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>ดาวน์โหลดรายงานรายการ (.CSV / Excel)</span>
                  </button>

                  <button
                    onClick={handleCopyTransactionsToClipboard}
                    className="px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3 text-emerald-600" />
                    <span>คัดลอกด่วนไป Google Sheets (Tab)</span>
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

              {hasResetPermission && products.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: '⚠️ ล้างข้อมูลสินค้าในคลังทั้งหมด',
                      message: 'คุณต้องการลบหรือล้างข้อมูลสินค้าทั้งหมดในคลังระบบจริงหรือไม่?\n\n(การลบนี้จะทำให้ฐานข้อมูลสินค้าว่างเปล่าทันที เพื่อเปิดโอกาสให้ควบคุมนำเข้าข้อมูลใหม่ทั้งหมดได้)',
                      confirmText: 'ล้างข้อมูลสินค้าเด็ดขาด',
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
