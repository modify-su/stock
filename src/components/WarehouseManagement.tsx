import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Filter, 
  Layers, 
  Boxes, 
  MoveRight, 
  HelpCircle, 
  Info, 
  Sparkles, 
  History, 
  Check, 
  X,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import { WarehouseItem, Category, Unit, Product } from '../types';

interface WarehouseManagementProps {
  warehouseItems: WarehouseItem[];
  categories: Category[];
  units: Unit[];
  products: Product[];
  onAddWarehouseItem: (item: Omit<WarehouseItem, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdateWarehouseItem: (item: WarehouseItem) => Promise<void>;
  onDeleteWarehouseItem: (id: string) => Promise<void>;
  onPortionWarehouseItem: (
    warehouseItemId: string, 
    deductQty: number, 
    targetProductId: string, 
    addQty: number,
    portionReason: string
  ) => Promise<void>;
  canManage: boolean;
}

export default function WarehouseManagement({
  warehouseItems,
  categories,
  units,
  products,
  onAddWarehouseItem,
  onUpdateWarehouseItem,
  onDeleteWarehouseItem,
  onPortionWarehouseItem,
  canManage
}: WarehouseManagementProps) {
  // --- States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [portioningItem, setPortioningItem] = useState<WarehouseItem | null>(null);

  // Form States for Add/Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSize, setFormSize] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formUnit, setFormUnit] = useState('');
  const [formStatus, setFormStatus] = useState<'NOT_DISTRIBUTED' | 'AWAITING_PORTION'>('NOT_DISTRIBUTED');

  // Form States for Portioning/Dividing
  const [targetProductId, setTargetProductId] = useState('');
  const [deductQty, setDeductQty] = useState<number>(0);
  const [conversionRate, setConversionRate] = useState<number>(1); // e.g. 1 wholesale bag = 10 retail packs
  const [portionReason, setPortionReason] = useState('');

  // --- Filtering Logic ---
  const filteredItems = warehouseItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.size.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === '' || item.category === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || item.status === selectedStatusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // --- Statistics Calculations ---
  const totalItemsCount = warehouseItems.length;
  const totalQuantity = warehouseItems.reduce((sum, item) => sum + item.quantity, 0);
  const awaitingPortionCount = warehouseItems.filter(item => item.status === 'AWAITING_PORTION').length;
  const notDistributedCount = warehouseItems.filter(item => item.status === 'NOT_DISTRIBUTED').length;

  // --- Handlers ---
  const handleOpenAdd = () => {
    setFormName('');
    setFormCategory(categories[0]?.name || 'ทั่วไป');
    setFormSize('');
    setFormQuantity(0);
    setFormUnit(units[0]?.name || 'กระสอบ');
    setFormStatus('NOT_DISTRIBUTED');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item: WarehouseItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormSize(item.size);
    setFormQuantity(item.quantity);
    setFormUnit(item.unit);
    setFormStatus(item.status);
  };

  const handleOpenPortion = (item: WarehouseItem) => {
    setPortioningItem(item);
    setDeductQty(Math.min(1, item.quantity)); // Default to 1 or max available
    setConversionRate(1);
    setTargetProductId('');
    setPortionReason(`แบ่งจำหน่ายสินค้าจากคลังสินค้าหลัก (${item.name})`);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('กรุณากรอกชื่อสินค้า');
      return;
    }
    try {
      await onAddWarehouseItem({
        name: formName.trim(),
        category: formCategory,
        size: formSize.trim() || '-',
        quantity: Math.max(0, formQuantity),
        unit: formUnit,
        status: formStatus
      });
      setIsAddOpen(false);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!formName.trim()) {
      alert('กรุณากรอกชื่อสินค้า');
      return;
    }
    try {
      await onUpdateWarehouseItem({
        ...editingItem,
        name: formName.trim(),
        category: formCategory,
        size: formSize.trim() || '-',
        quantity: Math.max(0, formQuantity),
        unit: formUnit,
        status: formStatus
      });
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    }
  };

  const handleDelete = async (item: WarehouseItem) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการ "${item.name}" ออกจากคลังสินค้าหลัก?`)) {
      return;
    }
    try {
      await onDeleteWarehouseItem(item.id);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  const handleSavePortion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portioningItem) return;
    if (!targetProductId) {
      alert('กรุณาเลือกสินค้าหน้าร้านปลายทาง');
      return;
    }
    if (deductQty <= 0) {
      alert('กรุณากรอกจำนวนที่ต้องการตัดออกจากคลังสินค้าหลัก');
      return;
    }
    if (deductQty > portioningItem.quantity) {
      alert(`จำนวนสต๊อกในคลังไม่เพียงพอ (มีอยู่ ${portioningItem.quantity} ${portioningItem.unit})`);
      return;
    }
    if (conversionRate <= 0) {
      alert('กรุณากรอกอัตราส่วนการแบ่งย่อยที่ถูกต้อง (ต้องมากกว่า 0)');
      return;
    }

    const calculatedAddQty = deductQty * conversionRate;

    try {
      await onPortionWarehouseItem(
        portioningItem.id,
        deductQty,
        targetProductId,
        calculatedAddQty,
        portionReason.trim()
      );
      setPortioningItem(null);
      alert('แบ่งจำหน่ายและเพิ่มสต๊อกพร้อมขายปลายทางเรียบร้อยแล้วครับ! 🎉');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในระบบแบ่งจำหน่ายสต๊อก');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Information & Description banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>คลังสินค้าหลักระบบปิด (Back-of-House Storage)</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">คลังสินค้าหลัก • สินค้ารอแบ่งจำหน่าย 🏢</h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            พื้นที่แยกส่วนจัดเก็บสินค้าขนาดใหญ่ (Bulk Items) สินค้าที่ <strong>ยังไม่ได้นำมาจำหน่าย</strong> หรือ <strong>รอการแบ่งจำหน่าย/บรรจุย่อย</strong> ไปยังคลังย่อยพร้อมขายหน้าร้าน ช่วยตรวจสอบและสลับสถานะสินค้าได้อย่างเป็นระบบ
          </p>
        </div>
        
        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-103 active:scale-97"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>เพิ่มรายการใหม่ในคลังสินค้า</span>
          </button>
        )}
      </div>

      {/* 2. Statistical Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Items Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-xs">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">รายการสินค้าทั้งหมด</span>
            <span className="text-2xl font-black text-slate-800 font-mono leading-none">{totalItemsCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">ในคลังสินค้าหลัก</span>
          </div>
        </div>

        {/* Not Distributed Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-xs">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">ยังไม่ได้จำหน่าย</span>
            <span className="text-2xl font-black text-slate-800 font-mono leading-none">{notDistributedCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">สินค้าเพื่อรอการตรวจสอบ</span>
          </div>
        </div>

        {/* Awaiting Portion Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-xs">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">รอการแบ่งจำหน่าย</span>
            <span className="text-2xl font-black text-slate-800 font-mono leading-none">{awaitingPortionCount}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">สินค้ารอแบ่งแพ็ค/แบ่งกระสอบ</span>
          </div>
        </div>

        {/* Total Quantities Widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-xs">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">ปริมาณรวมทุกรายการ</span>
            <span className="text-2xl font-black text-slate-800 font-mono leading-none">
              {totalQuantity.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">หน่วยนับรวมสะสม</span>
          </div>
        </div>
      </div>

      {/* 3. Realtime Filtering & Search Engine Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Field */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้าคลัง หรือ ขนาดสินค้า... (เช่น กระสอบใหญ่, 50kg)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
          />
        </div>

        {/* Dropdowns Filters */}
        <div className="w-full md:w-auto flex flex-wrap gap-2 items-center">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs bg-transparent focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">ทุกสถานะสินค้า</option>
              <option value="NOT_DISTRIBUTED">ยังไม่ได้จำหน่าย</option>
              <option value="AWAITING_PORTION">รอการแบ่งจำหน่าย</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="text-xs bg-transparent focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedCategoryFilter || selectedStatusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('');
                setSelectedStatusFilter('ALL');
              }}
              className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/60 rounded-lg px-3 py-1.5 hover:bg-rose-100/80 transition-colors cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Products Inventory Table list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-mono font-bold text-[10px] uppercase tracking-wider">
                <th className="px-5 py-4">หมวดหมู่</th>
                <th className="px-5 py-4">ชื่อสินค้าคลังสินค้าหลัก</th>
                <th className="px-5 py-4">ขนาดสินค้า (Size)</th>
                <th className="px-5 py-4 text-right">จำนวนคงเหลือคลัง</th>
                <th className="px-5 py-4">หน่วยนับ</th>
                <th className="px-5 py-4 text-center">สถานะการเก็บ</th>
                <th className="px-5 py-4 text-right">จัดการระบบคลัง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs text-slate-700 font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 px-4">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="p-4 bg-slate-50 text-slate-400 rounded-full inline-block">
                        <Boxes className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-700">ไม่พบข้อมูลในคลังสินค้าหลัก</p>
                        <p className="text-xs text-slate-400">ยังไม่มีรายการ หรือข้อมูลไม่ตรงกับการค้นหาปัจจุบัน ลองตรวจสอบหมวดหมู่หรือเพิ่มรายการสินค้าใหม่</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4.5">
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold text-[10px] tracking-wide border border-slate-200/50">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-5 py-4.5">
                      <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">ID: {item.id}</span>
                    </td>
                    <td className="px-5 py-4.5 font-mono text-slate-600 font-bold">{item.size}</td>
                    <td className="px-5 py-4.5 text-right font-mono text-slate-900 font-extrabold text-sm">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-5 py-4.5 text-slate-500 font-bold">{item.unit}</td>
                    <td className="px-5 py-4.5 text-center">
                      {item.status === 'NOT_DISTRIBUTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          ยังไม่ได้จำหน่าย
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          รอการแบ่งจำหน่าย
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4.5 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {/* Portion Stock Trigger */}
                        {canManage && item.quantity > 0 && (
                          <button
                            onClick={() => handleOpenPortion(item)}
                            className="px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:text-white hover:bg-blue-600 bg-blue-50 border border-blue-200 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            title="แบ่งจำหน่ายสินค้า: โอนสับเปลี่ยนสต๊อกขนาดใหญ่ไปเพิ่มในสินค้าพร้อมขายหน้าร้าน"
                          >
                            <MoveRight className="w-3.5 h-3.5" />
                            <span>แบ่งจำหน่าย ➡️</span>
                          </button>
                        )}
                        
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="แก้ไขข้อมูลสินค้าในคลัง"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between text-slate-400 text-[10px]">
          <span>กำลังแสดง {filteredItems.length} จากทั้งหมด {warehouseItems.length} รายการ</span>
          <span className="font-mono">Real-time DB Connection Active</span>
        </div>
      </div>

      {/* 5. ADD PRODUCT MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl border border-slate-200 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between shrink-0">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>เพิ่มรายการใหม่ในคลังสินค้าหลัก</span>
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 overflow-y-auto flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">ชื่อรายการสินค้าคลัง *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ระบุชื่อเรียกสินค้าคลังหลักให้ชัดเจน (เช่น กระสอบอาหารวัวสูตร 1, ลังปุ๋ยชีวภาพสูตรเข้มข้น)"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">หมวดหมู่สินค้า *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    {categories.length === 0 && <option value="ทั่วไป">ทั่วไป</option>}
                  </select>
                </div>

                {/* Size / Dimension */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">ขนาดสินค้า (e.g. 50kg, XL, 1000ml)</label>
                  <input
                    type="text"
                    value={formSize}
                    onChange={(e) => setFormSize(e.target.value)}
                    placeholder="ระบุขนาดของรายการสินค้าคลัง"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Initial Stock Quantity */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">ปริมาณคงเหลือเริ่มต้น *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Unit of measure */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">หน่วยนับ *</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                    {units.length === 0 && <option value="กระสอบ">กระสอบ</option>}
                  </select>
                </div>

                {/* Status Selection */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">สถานะของสินค้าในคลังหลัก *</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormStatus('NOT_DISTRIBUTED')}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${
                        formStatus === 'NOT_DISTRIBUTED'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-bold text-xs">🟢 ยังไม่ได้จำหน่าย</span>
                      <span className="text-[10px] text-slate-500">เก็บรักษาเพื่อรอนโยบายการตลาด หรืออยู่ระหว่างตรวจคัดแยก (Not Distributed)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormStatus('AWAITING_PORTION')}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${
                        formStatus === 'AWAITING_PORTION'
                          ? 'border-amber-500 bg-amber-50/50 text-amber-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-bold text-xs">🟡 รอการแบ่งจำหน่าย</span>
                      <span className="text-[10px] text-slate-500">พร้อมเบิกไปเทแบ่งกระสอบ แบ่งแพ็คย่อย เพื่อนำไปขายในสต๊อกพร้อมขายหน้าร้าน (Awaiting Portioning)</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5 shrink-0 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  บันทึกรายการสินค้าใหม่ ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT PRODUCT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl border border-slate-200 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between shrink-0">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4.5 h-4.5 text-blue-600" />
                <span>แก้ไขรายการสินค้าในคลังสินค้าหลัก</span>
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Name */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">ชื่อรายการสินค้าคลัง *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ระบุชื่อเรียกสินค้าคลังหลัก"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">หมวดหมู่สินค้า *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                    {categories.length === 0 && <option value="ทั่วไป">ทั่วไป</option>}
                  </select>
                </div>

                {/* Size / Dimension */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">ขนาดสินค้า (e.g. 50kg, XL, 1000ml)</label>
                  <input
                    type="text"
                    value={formSize}
                    onChange={(e) => setFormSize(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Initial Stock Quantity */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">ปริมาณคงเหลือในคลัง *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Unit of measure */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">หน่วยนับ *</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                    {units.length === 0 && <option value="กระสอบ">กระสอบ</option>}
                  </select>
                </div>

                {/* Status Selection */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">สถานะของสินค้าในคลังหลัก *</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormStatus('NOT_DISTRIBUTED')}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${
                        formStatus === 'NOT_DISTRIBUTED'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-bold text-xs">🟢 ยังไม่ได้จำหน่าย</span>
                      <span className="text-[10px] text-slate-500">เก็บรักษาเพื่อรอนโยบายการตลาด หรืออยู่ระหว่างตรวจคัดแยก (Not Distributed)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormStatus('AWAITING_PORTION')}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${
                        formStatus === 'AWAITING_PORTION'
                          ? 'border-amber-500 bg-amber-50/50 text-amber-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-bold text-xs">🟡 รอการแบ่งจำหน่าย</span>
                      <span className="text-[10px] text-slate-500">พร้อมเบิกไปเทแบ่งกระสอบ แบ่งแพ็คย่อย เพื่อนำไปขายในสต๊อกพร้อมขายหน้าร้าน (Awaiting Portioning)</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5 shrink-0 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  บันทึกการแก้ไขข้อมูล ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. PORTION STOCK / DEDUCT-TRANSFER MODAL */}
      {portioningItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl border border-slate-200 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-250 flex items-center justify-between shrink-0">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <MoveRight className="w-5 h-5 text-indigo-600" />
                <span>แบ่งจำหน่ายสินค้าออกจากคลังหลัก ➡️ สู่คลังพร้อมขาย</span>
              </h3>
              <button onClick={() => setPortioningItem(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSavePortion} className="p-6 space-y-4 overflow-y-auto flex-grow">
              
              {/* Product Information Source banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold font-mono">รายการต้นทาง</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">{portioningItem.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold font-mono">หมวดหมู่</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{portioningItem.category}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold font-mono">ขนาดคลังต้นทาง</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{portioningItem.size}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold font-mono">คงเหลือในคลังหลัก</span>
                  <span className="font-extrabold text-indigo-700 mt-0.5 block text-sm">
                    {portioningItem.quantity} {portioningItem.unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Deduct Quantity input */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    1. จำนวนที่จะเบิก/ตัดออกจากคลังหลัก *
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="1"
                      max={portioningItem.quantity}
                      required
                      value={deductQty}
                      onChange={(e) => setDeductQty(Math.min(portioningItem.quantity, Math.max(1, parseInt(e.target.value) || 0)))}
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-l-lg focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                    <span className="px-4 py-2.5 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-xs font-bold text-slate-600 shrink-0 font-mono">
                      {portioningItem.unit}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    ระบุจำนวนที่เบิกออกจากคลังสินค้าหลัก เช่น เบิกข้าวสาร 5 กระสอบ
                  </span>
                </div>

                {/* Conversion Rate / Multiplier */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    2. อัตราส่วนการแบ่งย่อย (Conversion Ratio) *
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2.5 bg-slate-100 border border-slate-300 border-r-0 rounded-l-lg text-xs font-bold text-slate-500 shrink-0">
                      1 {portioningItem.unit} =
                    </span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={conversionRate}
                      onChange={(e) => setConversionRate(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-300 focus:ring-1 focus:ring-indigo-500 font-bold text-center"
                    />
                    <span className="px-3 py-2.5 bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg text-xs font-bold text-slate-600 shrink-0">
                      หน่วยย่อยพร้อมขาย
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    เช่น ถ้าเบิกข้าวสาร 1 กระสอบใหญ่มาแบ่งบรรจุถุงย่อยได้ 10 ถุง ให้ใส่อัตรา = 10
                  </span>
                </div>

                {/* Target retail product selection */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    3. เลือกสินค้าหน้าร้าน / คลังพร้อมขายปลายทางที่ต้องการเติมสต๊อก *
                  </label>
                  <select
                    required
                    value={targetProductId}
                    onChange={(e) => setTargetProductId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- เลือกรายการสินค้าหน้าร้านปลายทาง --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        📦 [{p.sku}] {p.name} {p.location ? `(พิกัด: ${p.location})` : ''} — สต๊อกปัจจุบัน: {p.quantity} {p.unit}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block">
                    สินค้าปลายทางจะได้รับสต๊อกเพิ่มขึ้นตามจำนวนคำนวณ: <strong>{deductQty} {portioningItem.unit} × {conversionRate} = {(deductQty * conversionRate).toLocaleString()} หน่วยพร้อมขาย</strong>
                  </span>
                </div>

                {/* Portioning Reason */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">เหตุผลในการเบิกแบ่งคลังหลัก</label>
                  <input
                    type="text"
                    value={portionReason}
                    onChange={(e) => setPortionReason(e.target.value)}
                    placeholder="ระบุหมายเหตุการแบ่งโอนสต๊อกคลังหลัก"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Real-time Math helper feedback */}
              {targetProductId && deductQty > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs font-medium text-blue-900 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-800">📊 ผลกระทบทางสต๊อกระบบ (Simulation):</span>
                    <p className="text-slate-600 font-semibold text-[11px] leading-relaxed">
                      - คลังหลักจะถูกหักออก: <strong>{deductQty} {portioningItem.unit}</strong> (เหลือ {(portioningItem.quantity - deductQty).toLocaleString()} {portioningItem.unit})
                      <br />
                      - คลังหน้าร้าน [{products.find(p => p.id === targetProductId)?.sku}] จะได้รับบวกสต๊อกเพิ่ม: <strong>+{(deductQty * conversionRate).toLocaleString()} {products.find(p => p.id === targetProductId)?.unit || 'หน่วย'}</strong>
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-blue-500 block">สูตรคำนวณโอนย้าย</span>
                    <span className="font-bold text-lg text-blue-700 font-mono">
                      {deductQty} × {conversionRate} = {deductQty * conversionRate}
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-5 shrink-0 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPortioningItem(null)}
                  className="px-4.5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ยืนยันเบิกแบ่งสต๊อกคลังหลัก ✓</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
