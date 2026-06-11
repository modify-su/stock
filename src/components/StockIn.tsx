import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowDownToLine, Plus, Search, Tag, AlertTriangle, Layers, Calendar, ClipboardList } from 'lucide-react';

interface StockProduct {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
}

interface StockInProps {
  products: StockProduct[];
  onStockIn: (payload: { sku: string; quantity: number; notes: string }) => Promise<any>;
  onAddNewProduct: (payload: { sku: string; name: string; category: string; initialQty: number; lowStockThreshold: number }) => Promise<any>;
  categories?: string[];
}

export default function StockIn({ products, onStockIn, onAddNewProduct, categories = [] }: StockInProps) {
  // Toggle between adding stock to existing SKU or creating a new SKU
  const [formMode, setFormMode] = useState<'replenish' | 'create_sku'>('replenish');

  // Active Category Sets
  const categoriesList = categories.length > 0 ? categories : [
    'เสื้อผ้า (Apparel)',
    'ไอทีและอิเล็กทรอนิกส์ (Electronics)',
    'เครื่องครัวและบ้าน (Home & Kitchen)',
    'เครื่องสำอางและบิวตี้ (Beauty & Cosmetics)',
    'อาหารและเครื่องดื่ม (Food & Beverages)',
    'สินค้าอื่นๆ (General)'
  ];

  // Replenish States
  const [replenishSku, setReplenishSku] = useState('');
  const [replenishQty, setReplenishQty] = useState('');
  const [replenishNotes, setReplenishNotes] = useState('');

  // New SKU States
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('ทั่วไป');
  const [newInitialQty, setNewInitialQty] = useState('');
  const [newThreshold, setNewThreshold] = useState('10');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishSku) {
      setError('กรุณาเลือกรายการสินค้า SKU ที่ต้องการเติม');
      return;
    }
    const qty = Number(replenishQty);
    if (isNaN(qty) || qty <= 0) {
      setError('กรุณาระบุจำนวนสินค้าที่ต้องการนำเข้าให้ถูกต้อง (ต้องมากกว่า 0)');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await onStockIn({
        sku: replenishSku,
        quantity: qty,
        notes: replenishNotes
      });
      setMessage(response.message);
      // Reset
      setReplenishQty('');
      setReplenishNotes('');
    } catch (err: any) {
      setError(err.message || 'นำเข้าสต็อกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = newCategory.trim() || 'ทั่วไป';
    if (!newSku || !newName) {
      setError('กรุณากรอกข้อมูล SKU, ชื่อสินค้า และ หมวดหมู่สินค้า');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await onAddNewProduct({
        sku: newSku.toUpperCase().trim(),
        name: newName.trim(),
        category: finalCategory,
        initialQty: Number(newInitialQty) || 0,
        lowStockThreshold: Number(newThreshold) || 10
      });
      setMessage(response.message);
      // Reset
      setNewSku('');
      setNewName('');
      setNewInitialQty('');
      setNewThreshold('10');
      setNewCategory(finalCategory);
    } catch (err: any) {
      setError(err.message || 'จดทะเบียน SKU ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="stock-in-view">
      
      {/* Forms Segment (Left) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Navigation Selector */}
        <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex">
          <button 
            type="button"
            onClick={() => { setFormMode('replenish'); setError(''); setMessage(''); }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${formMode === 'replenish' ? 'bg-emerald-500 text-teal-950 shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
            id="tab-mode-replenish"
          >
            <ArrowDownToLine className="h-4 w-4" /> นำเข้าสินค้าเดิม (Replenish Stock)
          </button>
          <button 
            type="button"
            onClick={() => { setFormMode('create_sku'); setError(''); setMessage(''); }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${formMode === 'create_sku' ? 'bg-emerald-500 text-teal-950 shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
            id="tab-mode-newsku"
          >
            <Plus className="h-4 w-4" /> จดทะเบียนสินค้า SKU ใหม่
          </button>
        </div>

        {/* Dynamic Card form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="form-stock-in-card">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            {formMode === 'replenish' ? 'บันทึกเติมรับเข้าสินค้าสต็อกเดิม' : 'จดทะเบียนขึ้นบันทึกรหัส SKU สินค้าชิ้นใหม่'}
          </h2>

          {/* Response Alerts */}
          {error && (
            <div className="p-3 bg-red-950/65 border border-red-800/80 text-red-200 text-xs rounded-xl mb-4" id="stock-in-error bg">
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div className="p-3 bg-emerald-950/65 border border-emerald-800/80 text-emerald-200 text-xs rounded-xl mb-4" id="stock-in-success-bg">
              ✅ {message}
            </div>
          )}

          {formMode === 'replenish' ? (
            // Form Replica 1
            <form onSubmit={handleReplenishSubmit} className="space-y-4" id="form-stock-replenish">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1">เลือกสินค้าที่ต้องการนำเข้า (SKU)</label>
                <select 
                  value={replenishSku}
                  onChange={e => setReplenishSku(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  id="select-replenish-sku"
                >
                  <option value="">-- กรุณาเลือกสินค้า SKU --</option>
                  {products.map(p => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} - {p.name} (คงเหลือ: {p.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1">จำนวนที่นำเข้าเพิ่ม (ชิ้น)</label>
                <input 
                  type="number"
                  min="1"
                  step="1"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="เช่น 10, 50, 100"
                  value={replenishQty}
                  onChange={e => setReplenishQty(e.target.value)}
                  id="input-replenish-qty"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1">หมายเหตุการนำเข้า / เลขที่เอกสารอ้างอิง</label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="เช่น ล๊อตโปรโมชั่นมิถุนายน, ซัพพลายเออร์ส่งสินค้าทดแทน ฯลฯ"
                  value={replenishNotes}
                  onChange={e => setReplenishNotes(e.target.value)}
                  id="input-replenish-notes"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-teal-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 select-none"
                id="btn-replenish-submit"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกเติมสต็อกสินค้า'}
              </button>
            </form>
          ) : (
            // Form Replica 2
            <form onSubmit={handleCreateSkuSubmit} className="space-y-4" id="form-stock-create-sku">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 text-xs font-medium block mb-1">รหัสสินค้า (SKU ID)</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
                    placeholder="เช่น SKU-SHIRT-M-RED"
                    value={newSku}
                    onChange={e => setNewSku(e.target.value)}
                    id="input-newsku-id"
                  />
                </div>

                <div>
                  <label className="text-slate-300 text-xs font-medium block mb-1">หมวดหมู่สินค้า (Category)</label>
                  <div className="relative">
                    <input 
                      type="text"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="พิมพ์หมวดหมู่เองได้อิสระ (เช่น ทั่วไป, ความงาม, ไอที)"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      id="input-newsku-cat-manual"
                      list="categories-datalist-manual"
                    />
                    <datalist id="categories-datalist-manual">
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1">ชื่อเรียกอย่างเป็นทางการ (Product Name)</label>
                <input 
                  type="text"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="เช่น เสื้อยืดสีแดง คอกลม ไซส์ M"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  id="input-newsku-name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 text-xs font-medium block mb-1">จำนวนเริ่มต้นเข้าคลัง (ชิ้น)</label>
                  <input 
                    type="number"
                    min="0"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="ใส่ 0 หากไม่มี"
                    value={newInitialQty}
                    onChange={e => setNewInitialQty(e.target.value)}
                    id="input-newsku-initqty"
                  />
                </div>

                <div>
                  <label className="text-slate-300 text-xs font-medium block mb-1">เกณฑ์แจ้งเตือนสต็อกต่ำ (ชิ้น)</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="ต่ำกว่านี้ระบบจะฟ้องเตือน"
                    value={newThreshold}
                    onChange={e => setNewThreshold(e.target.value)}
                    id="input-newsku-threshold"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-teal-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 select-none"
                id="btn-newsku-submit"
              >
                {loading ? 'กำลังบันทึก...' : 'จดทะเบียน SKUและนำเข้าคลัง'}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* Helper Visual Panel (Right) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300">
          <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-emerald-400" /> คำแนะนำขั้นตอบการระบุล๊อตคลังสินค้า
          </h3>
          <ul className="space-y-3 text-xs leading-relaxed text-slate-400">
            <li className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-slate-950 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">1</span>
              <span>ตรวจสอบสิทธิ์บัญชีผู้ใช้ บัญชีสิทธิ์ปกติสามารถจดทะเบียน SKU และนำเข้าสต็อกได้ทันทีตลอด 24 ชม.</span>
            </li>
            <li className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-slate-950 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">2</span>
              <span>การจดทะเบียน <b>SKU ใหม่</b> จะลงระบบบันทึกประวัติต้นตระกูลสต็อกไว้ และสะท้อนภาพเข้าสู่ระบบวิเคราะห์ในแท็บหน้าหลักทันที</span>
            </li>
            <li className="flex gap-2">
              <span className="h-5 w-5 rounded-full bg-slate-950 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">3</span>
              <span>พนักงาน LINE Bot จะติดตามและดึงข้อมูลอัปเดตแบบเรียลไทม์ทันทีหลังจากที่คุณกดอัปเดตจำนวนสต็อก</span>
            </li>
          </ul>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 mb-3">
            <Layers className="h-4 w-4 text-emerald-400" /> รายการความถี่แยกตามหมวดหมู่
          </h3>
          <div className="space-y-2.5">
            {categoriesList.map((cat, idx) => {
              const matchedCount = products.filter(p => p.category === cat).length;
              const totalItems = products.filter(p => p.category === cat).reduce((s, x) => s + x.quantity, 0);
              return (
                <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-950/60 rounded-xl" id={`info-cat-row-${idx}`}>
                  <span className="text-slate-300 font-medium">{cat}</span>
                  <span className="text-slate-400 text-[11px]">
                    <span className="text-white font-bold">{matchedCount}</span> SKU / <span className="text-emerald-400 font-bold">{totalItems}</span> ชิ้น
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
