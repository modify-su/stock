import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Truck, Check, AlertTriangle, RefreshCw, Smartphone, PackageMinus, Layers } from 'lucide-react';

interface StockProduct {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
}

interface StockOutProps {
  products: StockProduct[];
  onStockOut: (payload: { sku: string; quantity: number; platform: string; courier: string }) => Promise<any>;
}

export default function StockOut({ products, onStockOut }: StockOutProps) {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [platform, setPlatform] = useState<'TikTok' | 'Shopee' | 'Lazada' | 'Facebook'>('TikTok');
  const [courier, setCourier] = useState<'Flash' | 'J&T' | 'LEX' | 'Best'>('Flash');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');

  const selectedProduct = products.find(p => p.sku === sku);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku) {
      setError('กรุณาเลือกสินค้า SKU ที่ต้องการส่งออก');
      return;
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('กรุณากรอกจำนวนจัดส่งให้ถูกต้อง (ต้องมากกว่า 0)');
      return;
    }

    if (selectedProduct && selectedProduct.quantity < qty) {
      setError(`ยอดสต็อกในคลังไม่พอ! สินค้านี้เหลือเพียง ${selectedProduct.quantity} ชิ้น แต่คุณต้องการสั่งตัดส่งออก ${qty} ชิ้น`);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setWarning('');

    try {
      const response = await onStockOut({
        sku,
        quantity: qty,
        platform,
        courier
      });

      setMessage(response.message);
      if (response.lowStockWarning) {
        setWarning(response.lowStockWarning);
      }
      
      // Reset
      setQuantity('');
    } catch (err: any) {
      setError(err.message || 'ส่งออกสต็อกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="stock-out-view">
      
      {/* Stock Out Form Card (Left) */}
      <div className="lg:col-span-7">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="form-stock-out-card">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            ตัดสินค้าออกจากคลังและบันทึกการจัดส่งสินค้า (Fulfillment Center)
          </h2>

          {/* Messages Feed */}
          {error && (
            <div className="p-3 bg-red-950/65 border border-red-800/80 text-red-200 text-xs rounded-xl mb-4" id="stock-out-error-alert">
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div className="p-3 bg-emerald-950/65 border border-emerald-800/80 text-emerald-200 text-xs rounded-xl mb-4" id="stock-out-success-alert">
              ✅ {message}
            </div>
          )}
          {warning && (
            <div className="p-3 bg-amber-950/65 border border-amber-800/80 text-amber-200 text-xs rounded-xl mb-4 flex items-center gap-2 select-all" id="stock-out-warning-alert">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="form-stock-out">
            
            {/* SKU selection */}
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1">เลือกรายการสินค้าคลังอัจฉริยะ (SKU)</label>
              <select 
                value={sku}
                onChange={e => { setSku(e.target.value); setError(''); setMessage(''); setWarning(''); }}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                id="select-stock-out-sku"
              >
                <option value="">-- กรุณาเลือกสินค้า SKU --</option>
                {products.map(p => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} - {p.name} (เหลือหลัก: {p.quantity} ชิ้น)
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Product info card snapshot */}
            <AnimatePresence>
              {selectedProduct && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5"
                  id="selected-sku-summary-card"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">ชื่อสินค้า:</span>
                    <span className="text-white font-semibold">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">หมวดหมู่:</span>
                    <span className="text-slate-200">{selectedProduct.category}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/50 pt-1.5">
                    <span className="text-slate-400">ยอดคงเหลือในคลังปัจจุบัน:</span>
                    <span className={`font-semibold  ${selectedProduct.quantity <= selectedProduct.lowStockThreshold ? 'text-amber-500' : 'text-teal-400'}`}>
                      {selectedProduct.quantity} ชิ้น / ต่ำสุดเตือน {selectedProduct.lowStockThreshold} ชิ้น
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quantity */}
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1">จำนวนส่งออกตัดยอดสต็อก (ชิ้น)</label>
              <input 
                type="number"
                min="1"
                step="1"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                placeholder="ป้อนจำนวนชิ้นที่ส่งออก"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                id="input-stock-out-qty"
              />
            </div>

            {/* Channels & Courier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 flex items-center gap-1">
                  <ShoppingBag className="h-3.5 w-3.5 text-blue-400" /> แพลตฟอร์มจำหน่าย (Platform)
                </label>
                <div className="grid grid-cols-2 gap-2" id="platform-btn-grid">
                  {(['TikTok', 'Shopee', 'Lazada', 'Facebook'] as const).map(plat => (
                    <button 
                      key={plat}
                      type="button"
                      onClick={() => setPlatform(plat)}
                      className={`py-2 text-[11px] rounded-xl font-semibold border transition ${platform === plat ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-900/10' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300'}`}
                      id={`btn-plat-${plat}`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-blue-400" /> บริการจัดส่งและรูปแบบขนส่ง
                </label>
                <div className="grid grid-cols-2 gap-2" id="courier-btn-grid">
                  {(['Flash', 'J&T', 'LEX', 'Best'] as const).map(cour => (
                    <button 
                      key={cour}
                      type="button"
                      onClick={() => setCourier(cour)}
                      className={`py-2 text-[11px] rounded-xl font-semibold border transition ${courier === cour ? 'bg-emerald-500 text-teal-950 border-emerald-400 shadow-md shadow-emerald-900/10' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300'}`}
                      id={`btn-cour-${cour}`}
                    >
                      {cour === 'Flash' ? 'Flash Express' : cour === 'J&T' ? 'J&T Express' : cour === 'LEX' ? 'LEX (Lazada)' : 'Best Express'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 select-none shadow-lg shadow-blue-950/20"
              id="btn-stock-out-submit"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'ยืนยันสั่งจำหน่ายและตัดสต็อก'}
            </button>
          </form>

        </div>
      </div>

      {/* Guide Visual Panels (Right) */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Help box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300">
          <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PackageMinus className="h-4 w-4 text-blue-400" /> คุณลักษะการคำนวณตัดช่องทางขาย
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            ระบบจัดสรรยอดสต็อกอัตโนมัติ จะทำหน้าที่ตัดแยกยอดตาม <b>Platform</b> ยอดจำหน่ายเพื่อส่งค่าไปยัง LINE Bot ตลอดเวลา และแจ้งเตือนอัตโนมัติหาเจ้าหน้าที่ทันทีหากสินค้าต่ำกว่าเกณฑ์
          </p>
          <div className="border-t border-slate-800/80 pt-3 mt-3 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">สถานะแชนเนล LINE Bot:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">🟢 พร้อมเชื่อมโยงข้อมูล</span>
          </div>
        </div>

        {/* Categories reference list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 mb-3">
            <Layers className="h-4 w-4 text-blue-400" /> ยอดคงเหลือสินค้าแยกตาม SKU สูงสุด
          </h3>
          <div className="space-y-2">
            {[...products].sort((a,b) => b.quantity - a.quantity).slice(0, 5).map((p, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-950/60 rounded-xl">
                <div className="min-w-0">
                  <span className="font-bold text-white block font-mono">{p.sku}</span>
                  <span className="text-[10px] text-slate-400 truncate block">{p.name}</span>
                </div>
                <span className={`text-xs font-bold leading-none py-1 px-2.5 rounded-lg ${p.quantity <= p.lowStockThreshold ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' : 'bg-slate-900 text-emerald-400'}`}>
                  {p.quantity} ชิ้น
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
