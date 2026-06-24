import { useState, FormEvent } from 'react';
import { Search, Plus, Edit2, Trash2, SlidersHorizontal, AlertCircle, ShoppingBag, Folder, Tag, MapPin, DollarSign, ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { Product, Category } from '../types';
import ConfirmModal from './ConfirmModal';

interface InventoryTableProps {
  products: Product[];
  categories: Category[];
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onAddProduct: (product: Omit<Product, 'id' | 'updatedAt'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  isLowStockOnly: boolean;
  setIsLowStockOnly: (low: boolean) => void;
  onTriggerQuickAction: (productId: string, actionType: 'IN' | 'OUT' | 'RETURN') => void;
  canManageProducts?: boolean;
  canRecordTransactions?: boolean;
  canDeleteProducts?: boolean;
  canResetSystem?: boolean;
  onClearAllProducts?: () => Promise<void>;
}

export default function InventoryTable({
  products,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onClearAllProducts,
  selectedCategory,
  setSelectedCategory,
  isLowStockOnly,
  setIsLowStockOnly,
  onTriggerQuickAction,
  canManageProducts = true,
  canRecordTransactions = true,
  canDeleteProducts = true,
  canResetSystem = true,
}: InventoryTableProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort State
  const [sortBy, setSortBy] = useState<'sku' | 'name' | 'quantity' | 'unit'>('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal active states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states for adding brand-new item
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('');
  
  // Category management modal states
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [catError, setCatError] = useState('');
  const [newQty, setNewQty] = useState<number>(0);
  const [newMinStock, setNewMinStock] = useState<number>(10);
  const [newUnit, setNewUnit] = useState('ชิ้น');
  const [newLoc, setNewLoc] = useState('');

  // Sku uniqueness checks
  const [validationError, setValidationError] = useState('');

  // Custom modal dialog confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isAlertOnly?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleOpenAdd = () => {
    // Generate simple incremental SKU or leave empty for user
    const maxNumber = products
      .map(p => {
        const matches = p.sku.match(/\d+/);
        return matches ? parseInt(matches[0], 10) : 0;
      })
      .reduce((max, num) => num > max ? num : max, 0);
    
    setNewSku(`SKU-${(maxNumber + 1).toString().padStart(4, '0')}`);
    setNewName('');
    setNewCat(categories[0]?.name || 'ทั่วไป');
    setNewQty(0);
    setNewMinStock(10);
    setNewUnit('ชิ้น');
    setNewLoc('Zone A - ชั้น 1');
    setValidationError('');
    setIsAddOpen(true);
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!newSku.trim() || !newName.trim()) {
      setValidationError('กรุณากรอกรหัส SKU และชื่อสินค้าให้ครบถ้วน');
      return;
    }

    // Check SKU uniqueness
    const exists = products.some((p) => p.sku.toLowerCase() === newSku.trim().toLowerCase());
    if (exists) {
      setValidationError('รหัส SKU นี้มีอยู่ในระบบคลังสินค้าแล้ว กรุณาตั้งรหัสอื่น');
      return;
    }

    onAddProduct({
      sku: newSku.toUpperCase().trim(),
      name: newName.trim(),
      category: newCat || (categories[0]?.name || 'ทั่วไป'),
      quantity: Number(newQty),
      minStock: Number(newMinStock),
      unit: newUnit.trim() || 'ชิ้น',
      location: newLoc.trim() || 'คลังทั่วไป',
    });

    setIsAddOpen(false);
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.sku.trim() || !editingProduct.name.trim()) {
      return;
    }

    // Check SKU uniqueness excluding current product
    const exists = products.some(
      (p) => p.sku.toLowerCase() === editingProduct.sku.trim().toLowerCase() && p.id !== editingProduct.id
    );
    if (exists) {
      alert('รหัส SKU นี้ถูกใช้งานโดยสินค้าอื่นแล้ว');
      return;
    }

    onUpdateProduct({
      ...editingProduct,
      sku: editingProduct.sku.toUpperCase().trim(),
      name: editingProduct.name.trim(),
    });
    setEditingProduct(null);
  };

  // Sort function
  const toggleSort = (field: 'sku' | 'name' | 'quantity' | 'unit') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Filtering products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === '' || p.category === selectedCategory;
    const matchesLowStock = !isLowStockOnly || p.quantity <= p.minStock;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  // Sorting products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let propA = a[sortBy];
    let propB = b[sortBy];

    if (typeof propA === 'string' && typeof propB === 'string') {
      return sortOrder === 'asc' 
        ? propA.localeCompare(propB, 'th') 
        : propB.localeCompare(propA, 'th');
    } else if (typeof propA === 'number' && typeof propB === 'number') {
      return sortOrder === 'asc' ? propA - propB : propB - propA;
    }
    return 0;
  });

  // Safe Thai Baht format
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('th-TH').format(val) + ' ฿';
  };

  return (
    <div id="inventory-pane" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      {/* Header with Search and Commands */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            รายการสินค้าในคลังระบบ
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ค้นหา ตรวจสอบสต๊อกสินค้า ตั้งเกณฑ์เตือนขั้นต่ำ และแก้ไขข้อมูลสินค้า
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canResetSystem && onClearAllProducts && products.length > 0 && (
            <button
              id="btn-clear-all-products"
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: '⚠️ ล้างสต๊อกสินค้าทั้งหมด',
                  message: 'คุณต้องการลบหรือล้างข้อมูลสินค้าทั้งหมดในคลังระบบจริงหรือไม่?\n\n(การลบนี้จะทำให้ฐานข้อมูลสินค้าว่างเปล่าทันที หากไม่มีไฟล์สำรองข้อมูลจะไม่สามารถกู้กลับคืนมาได้เด็ดขาด)',
                  confirmText: 'ยืนยันล้างข้อมูล',
                  cancelText: 'ยกเลิก',
                  variant: 'danger',
                  onConfirm: () => {
                    setConfirmDialog({
                      isOpen: true,
                      title: '💥 คำเตือนขั้นสุดท้าย',
                      message: 'ยืนยันการลบล้างสต๊อกสินค้าเด็ดขาดจริงหรือไม่? การกระทำนี้ไม่สามารถกู้คืนได้ และคลังสินค้าจะว่างเปล่าทันที',
                      confirmText: 'ล้างข้อมูลเด็ดขาด',
                      cancelText: 'ยกเลิก',
                      variant: 'danger',
                      onConfirm: async () => {
                        try {
                          await onClearAllProducts();
                          setConfirmDialog({
                            isOpen: true,
                            title: '🧹 ล้างระบบสำเร็จ',
                            message: 'ล้างข้อมูลสินค้าในระบบคลัง Cloud เรียบร้อยแล้ว! คลังมีสถานะว่างพร้อมใช้งานสำหรับจัดตั้งใหม่',
                            confirmText: 'รับทราบ',
                            isAlertOnly: true,
                            variant: 'info',
                            onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
                          });
                        } catch (err: any) {
                          setConfirmDialog({
                            isOpen: true,
                            title: '❌ เกิดข้อผิดพลาด',
                            message: 'ไม่สามารถล้างคลังสินค้าได้: ' + err.message,
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
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              title="ล้างรายการสินค้าสต๊อกเดิมทั้งหมด เพื่อประจุหรือรับเข้าสร้างข้อมูลแบบตั้งต้นใหม่"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างสต๊อกทั้งหมด เพื่อสร้างใหม่</span>
            </button>
          )}

          <button
            id="btn-add-product"
            onClick={canManageProducts ? handleOpenAdd : undefined}
            disabled={!canManageProducts}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] shadow-sm cursor-pointer border ${
              canManageProducts 
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600' 
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title={!canManageProducts ? "บทบาทของคุณไม่มีสิทธิ์ในการเพิ่มรายการสินค้าใหม่" : "เพิ่มรายการสินค้าสะสมเข้าสารพัดรายการ"}
          >
            {canManageProducts ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
            เพิ่มรายการสินค้าใหม่
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Row */}
      <div id="filter-bar" className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
        {/* Search */}
        <div className="relative md:col-span-5">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัส SKU, ชื่อสินค้า, หรือชั้นผังเก็บ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-sans"
          />
        </div>

        {/* Category select */}
        <div className="md:col-span-3 flex items-center gap-1.5">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500 transition-all min-w-[120px]"
          >
            <option value="">ทุกหมวดหมู่ (All Categories)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
          {canManageProducts && (
            <button
              onClick={() => {
                setCatError('');
                setNewCatName('');
                setEditingCatId(null);
                setIsManageCatOpen(true);
              }}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 bg-white border border-slate-200 hover:border-blue-300 rounded-lg transition-all shrink-0 cursor-pointer"
              title="จัดการรายชื่อหมวดหมู่สินค้า"
            >
              <Folder className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Checkbox for Low Stock Filter */}
        <div className="md:col-span-4 flex items-center justify-start md:justify-end">
          <button
            onClick={() => setIsLowStockOnly(!isLowStockOnly)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
              isLowStockOnly
                ? 'bg-orange-50 text-orange-700 border-orange-200 font-semibold shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertCircle className={`w-4 h-4 ${isLowStockOnly ? 'text-orange-600 animate-bounce' : 'text-slate-400'}`} />
            เฉพาะสินค้าใกล้หมด (Low Stock)
          </button>
        </div>
      </div>

      {/* Actual Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/60 text-slate-600 text-xs uppercase tracking-wider font-semibold">
              <th className="py-3 px-4 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('sku')}>
                <div className="flex items-center gap-1.5">
                  รหัส SKU
                  {sortBy === 'sku' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-1.5">
                  ชื่อรายการสินค้า
                  {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                </div>
              </th>
              <th className="py-3 px-4">หมวดหมู่</th>
              <th className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('quantity')}>
                <div className="flex items-center justify-center gap-1.5">
                  จำนวนคงเหลือ
                  {sortBy === 'quantity' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                </div>
              </th>
              <th className="py-3 px-4 text-center cursor-pointer select-none hover:bg-slate-100" onClick={() => toggleSort('unit')}>
                <div className="flex items-center justify-center gap-1.5">
                  หน่วยนับ
                  {sortBy === 'unit' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                </div>
              </th>
              <th className="py-3 px-4 whitespace-nowrap text-center">สถานที่จัดเก็บ</th>
              <th className="py-3 px-4 text-right">ดำเนินการลัด (Quick actions)</th>
              <th className="py-3 px-4 text-center">จัดสต๊อก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-sm">
            {sortedProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                  <div className="flex flex-col items-center justify-center gap-2">
                     <SlidersHorizontal className="w-8 h-8 text-slate-300 stroke-1 block" />
                    <span>ไม่พบรายการสินค้าที่ตรงกับเงื่อนไขการกรองและการค้นหา</span>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('');
                        setIsLowStockOnly(false);
                      }}
                      className="mt-2 text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      ล้างค่าตัวกรองทั้งหมด
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedProducts.map((p) => {
                const isLow = p.quantity <= p.minStock;
                const isOutOfStock = p.quantity === 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3 px-4 font-mono font-medium text-xs text-blue-600 whitespace-nowrap">
                      {p.sku}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">อัปเดต: {new Date(p.updatedAt).toLocaleString('th-TH')}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/50">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="font-semibold text-slate-800 leading-none">{p.quantity}</div>
                      <div className="mt-1">
                        {isOutOfStock ? (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] text-rose-700 bg-rose-50 border border-rose-200 rounded font-semibold">สินค้าหมด!</span>
                        ) : isLow ? (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] text-orange-700 bg-orange-50 border border-orange-200 rounded font-semibold animate-pulse">ใกล้หมด (เกณฑ์ {p.minStock})</span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] text-emerald-700 bg-emerald-50 rounded font-normal">ปกติ (เกณฑ์ {p.minStock})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700 font-medium">
                      {p.unit || 'ชิ้น'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap text-slate-600 font-sans text-xs">
                      <div className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.location}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {/* Short action buttons matching "รับเข้า" "ส่งออก" "ตีกลับ" */}
                      {!canRecordTransactions ? (
                        <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 font-semibold py-1 bg-slate-100/50 rounded-lg justify-center border border-slate-200/50">
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>จำกัดสิทธิ์บันทึก</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onTriggerQuickAction(p.id, 'IN')}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200/40 transition-colors cursor-pointer"
                            title="ทำรายการ รับสินค้าเข้าคลัง"
                          >
                            รับเข้า +
                          </button>
                          <button
                            onClick={() => onTriggerQuickAction(p.id, 'OUT')}
                            disabled={isOutOfStock}
                            className={`px-2 py-1 text-[11px] font-semibold rounded border transition-colors ${
                              isOutOfStock
                                ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                                : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200/40 cursor-pointer'
                            }`}
                            title={isOutOfStock ? "ไม่มีสินค้าให้ส่งออก" : "ทำรายการ เบิกส่งออกสินค้า"}
                          >
                            ส่งออก -
                          </button>
                          <button
                            onClick={() => onTriggerQuickAction(p.id, 'RETURN')}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200/40 transition-colors cursor-pointer"
                            title="ทำรายการ บันทึกสินค้าตีกลับจากลูกค้า"
                          >
                            ตีกลับ ↩️
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => canManageProducts ? setEditingProduct(p) : undefined}
                          disabled={!canManageProducts}
                          className={`p-1 px-1.5 rounded transition-colors ${
                            canManageProducts 
                              ? 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer' 
                              : 'text-slate-300 bg-transparent cursor-not-allowed opacity-40'
                          }`}
                          title={canManageProducts ? "แก้ไขข้อมูลสินค้า" : "ไม่อนุญาตให้แก้ไขข้อมูลสินค้า"}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (!canDeleteProducts) return;
                            setConfirmDialog({
                              isOpen: true,
                              title: '🗑️ ยืนยันการลบสินค้า',
                              message: `คุณต้องการลบสินค้า "${p.name} [${p.sku}]" ออกจากคลังระบบจริงหรือไม่?\n\n(การลบนี้จะไม่มีผลกระทบต่อประวัติบันทึกการเคลื่อนย้ายก่อนหน้าที่เคยเสร็จสิ้นเรียบร้อยแล้ว)`,
                              confirmText: 'ลบสินค้านี้',
                              cancelText: 'ยกเลิก',
                              variant: 'danger',
                              onConfirm: () => {
                                try {
                                  onDeleteProduct(p.id);
                                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                } catch (err: any) {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: '❌ เกิดข้อผิดพลาด',
                                    message: 'ไม่สามารถลบสินค้าได้: ' + err.message,
                                    confirmText: 'ตกลง',
                                    isAlertOnly: true,
                                    variant: 'danger',
                                    onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                  });
                                }
                              }
                            });
                          }}
                          disabled={!canDeleteProducts}
                          className={`p-1 px-1.5 rounded transition-colors ${
                            canDeleteProducts 
                              ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer' 
                              : 'text-slate-300 bg-transparent cursor-not-allowed opacity-40'
                          }`}
                          title={canDeleteProducts ? "ลบออกจากระบบ" : "ไม่อนุญาตให้ลบสินค้า"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 1. Modal for ADDING Product */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg border border-slate-200 overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                เพิ่มรายการสินค้าใหม่ในคลัง
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {validationError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-1.5 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">รหัสสินค้า SKU *</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="เช่น TSH-001"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">หมวดหมู่สินค้า *</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  >
                    {categories.length === 0 && (
                      <option value="">-- กรุณาเพิ่มหมวดหมู่ก่อน --</option>
                    )}
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อรายการสินค้า *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="กรอกชื่อเรียกสินค้าให้ชัดเจน เช่น เสื้อยืดสีดำขนาด M"
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1">จํานวนตั้งต้น</label>
                  <input
                    type="number"
                    min={0}
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1">แจ้งเตือนขั้นต่ำ</label>
                  <input
                    type="number"
                    min={1}
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1">หน่วยนับ</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="เช่น ชิ้น, กล่อง, แพ็ค"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-505 mb-1">ตำแหน่งเก็บสินค้า (Shelf Location)</label>
                <input
                  type="text"
                  value={newLoc}
                  onChange={(e) => setNewLoc(e.target.value)}
                  placeholder="เช่น Zone A - แถวที่ 2 ชั้น 3"
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  บันทึกสินค้าใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal for EDITING Product */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg border border-slate-200 overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4.5 h-4.5 text-blue-600" />
                แก้ไขรายละเอียดข้อมูลสินค้า
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1">รหัสสินค้า SKU *</label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1">หมวดหมู่สินค้า *</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  >
                    {categories.length === 0 && (
                      <option value="">-- กรุณาเพิ่มหมวดหมู่ก่อน --</option>
                    )}
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-505 mb-1">ชื่อรายการสินค้า *</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-505 mb-1">จำนวนคงคลังปัจจุบัน *</label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.quantity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                    required
                  />
                  <span className="text-[9px] text-blue-600 font-semibold mt-0.5 block">แก้ไขได้ตรงโดยระบบจะซิงค์ประวัติให้</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">เกณฑ์แจ้งเตือนสต๊อกต่ำ</label>
                  <input
                    type="number"
                    min={1}
                    value={editingProduct.minStock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">หน่วยนับ</label>
                  <input
                    type="text"
                    value={editingProduct.unit || 'ชิ้น'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ชั้นที่เก็บสินค้า (Shelf Location)</label>
                <input
                  type="text"
                  value={editingProduct.location}
                  onChange={(e) => setEditingProduct({ ...editingProduct, location: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-150 focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 3. Modal for Managing Categories */}
      {isManageCatOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md border border-slate-205 overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-600" />
                จัดการหมวดหมู่สินค้าในคลัง
              </h3>
              <button
                onClick={() => setIsManageCatOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              {catError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-1.5 border border-rose-250">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{catError}</span>
                </div>
              )}

              {/* Add category form inline */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  เพิ่มหมวดหมู่สินค้าใหม่
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="เช่น รองเท้ากีฬา, เครื่องแต่งกาย"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-105"
                  />
                  <button
                    onClick={async () => {
                      setCatError('');
                      if (!newCatName.trim()) {
                        setCatError('กรุณากรอกชื่อหมวดหมู่');
                        return;
                      }
                      try {
                        await onAddCategory(newCatName);
                        setNewCatName('');
                      } catch (err: any) {
                        setCatError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบ');
                      }
                    }}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    เพิ่มหมวดหมู่
                  </button>
                </div>
              </div>

              {/* Category list */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  รายชื่อหมวดหมู่สะสมในคลัง ({categories.length} กลุ่ม)
                </label>
                
                {categories.length === 0 ? (
                  <div className="py-8 text-center text-slate-405 text-xs">
                    ยังไม่มีการเพิ่มรายชื่อกลุ่มหมวดหมู่สินค้าในคลังขณะนี้
                  </div>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 pr-1">
                    {categories.map((cat) => (
                      <div key={cat.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        {editingCatId === cat.id ? (
                          <div className="flex-1 flex gap-1.5">
                            <input
                              type="text"
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden"
                            />
                            <button
                              onClick={async () => {
                                setCatError('');
                                if (!editingCatName.trim()) {
                                  setCatError('กรุณากรอกชื่อหมวดหมู่');
                                  return;
                                }
                                try {
                                  await onUpdateCategory(cat.id, editingCatName);
                                  setEditingCatId(null);
                                } catch (err: any) {
                                  setCatError(err.message || 'เกิดข้อผิดพลาด');
                                }
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              บันทึก
                            </button>
                            <button
                              onClick={() => setEditingCatId(null)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-750">{cat.name}</span>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setEditingCatName(cat.name);
                                }}
                                className="p-1 px-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (!canDeleteProducts) return;
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: '⚠️ ยืนยันการลบหมวดหมู่',
                                    message: `คุณต้องการลบหมวดหมู่สินค้า "${cat.name}" ออกจากระบบจริงหรือไม่?`,
                                    confirmText: 'ลบหมวดหมู่',
                                    cancelText: 'ยกเลิก',
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        await onDeleteCategory(cat.id);
                                        setConfirmDialog(p => ({ ...p, isOpen: false }));
                                      } catch (err: any) {
                                        setCatError(err.message || 'เกิดข้อผิดพลาด');
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: '❌ เกิดข้อผิดพลาด',
                                          message: err.message || 'ไม่สามารถลบหมวดหมู่สินค้าได้',
                                          confirmText: 'ตกลง',
                                          isAlertOnly: true,
                                          variant: 'danger',
                                          onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
                                        });
                                      }
                                    }
                                  });
                                }}
                                disabled={!canDeleteProducts}
                                className={`p-1 px-1.5 rounded transition-colors ${
                                  canDeleteProducts 
                                    ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer' 
                                    : 'text-slate-300 bg-transparent cursor-not-allowed opacity-40'
                                }`}
                                title={canDeleteProducts ? "ลบหมวดหมู่สินค้า" : "ไม่อนุญาตให้ลบหมวดหมู่สินค้า"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
                <button
                  onClick={() => setIsManageCatOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ปิดหน้านี้
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Non-blocking Custom Modal Confirmation instead of native browser confirm/alert */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        isAlertOnly={confirmDialog.isAlertOnly}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel || (() => setConfirmDialog(p => ({ ...p, isOpen: false })))}
      />
    </div>
  );
}
