import { useState } from 'react';
import { 
  X, 
  MapPin, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle, 
  Sparkles,
  History,
  RotateCcw,
  Info
} from 'lucide-react';
import { Product, Shelf, UserProfile, TransactionType } from '../types';

interface ShelfAuditModalProps {
  shelf: Shelf;
  products: Product[];
  currentUser: UserProfile;
  canRecordTransactions: boolean;
  onRecordTransaction: (txData: any) => Promise<void>;
  onClose: () => void;
}

export default function ShelfAuditModal({
  shelf,
  products,
  currentUser,
  canRecordTransactions,
  onRecordTransaction,
  onClose
}: ShelfAuditModalProps) {
  // Filter products for this shelf
  const shelfProducts = products.filter(
    p => (p.location || '').trim().toLowerCase() === shelf.name.trim().toLowerCase()
  );

  // Local state for tracking physical counts being audited
  // key: productId, value: physicalCount
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    shelfProducts.forEach(p => {
      initial[p.id] = p.quantity;
    });
    return initial;
  });

  // Track loading state for each product adjustment
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const handleCountChange = (productId: string, newValue: number) => {
    setAuditCounts(prev => ({
      ...prev,
      [productId]: Math.max(0, newValue)
    }));
  };

  const handleAdjustStock = async (product: Product) => {
    const physical = auditCounts[product.id] ?? product.quantity;
    const delta = physical - product.quantity;

    if (delta === 0) return; // No change

    setUpdatingProductId(product.id);
    setSuccessMsg('');

    try {
      const type: TransactionType = delta > 0 ? 'IN' : 'OUT';
      const quantity = Math.abs(delta);

      await onRecordTransaction({
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        type,
        quantity,
        reason: 'ปรับปรุงยอดจากการตรวจนับชั้นวางสินค้า (Shelf Audit)',
        operator: currentUser.name,
        referenceNo: `AUDIT-${shelf.name}`
      });

      setSuccessMsg(`อัปเดตสต๊อกสินค้า "${product.name}" สำเร็จ!`);
      // Auto clear message
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to adjust stock:', err);
      alert('เกิดข้อผิดพลาดในการปรับปรุงสต๊อกสินค้า');
    } finally {
      setUpdatingProductId(null);
    }
  };

  const handleResetRow = (product: Product) => {
    setAuditCounts(prev => ({
      ...prev,
      [product.id]: product.quantity
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 text-blue-300 p-2 rounded-lg border border-blue-500/30">
              <MapPin className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-500 text-white font-extrabold px-2 py-0.5 rounded font-mono">
                  {shelf.zone || 'คลังหลัก'}
                </span>
                <span className="text-[10px] bg-indigo-500 text-white font-extrabold px-2 py-0.5 rounded font-mono">
                  สแกนตรวจเช็ค
                </span>
              </div>
              <h4 className="font-black text-base mt-1">
                ตรวจเช็คชั้นวางพิกัด "{shelf.name}"
              </h4>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors cursor-pointer bg-white/10 hover:bg-white/20 p-1.5 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info panel */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 shrink-0 flex items-center gap-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            {shelf.description || 'ระบุยอดจำนวนสินค้าที่นับเจอจริงในทางกายภาพเพื่อปรับยอดในระบบคงคลังให้ตรงกันครับ'}
          </span>
        </div>

        {/* Main Products List for Audit */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-pulse">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {shelfProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <span className="text-xs font-bold block text-slate-700">ไม่มีสินค้าคงคลังในชั้นวางนี้</span>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                ไม่พบสินค้าที่ระบุตำแหน่ง (Location) เป็น "{shelf.name}" ในระบบ หากท่านเพิ่มสินค้าหรือย้ายพิกัดสินค้ามาที่นี่ รายการสินค้าจะปรากฏขึ้นอัตโนมัติครับ
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {shelfProducts.map((product) => {
                const sysCount = product.quantity;
                const physicalCount = auditCounts[product.id] ?? sysCount;
                const delta = physicalCount - sysCount;
                const isDiff = delta !== 0;

                return (
                  <div 
                    key={product.id}
                    className={`border rounded-xl p-4 transition-all ${
                      isDiff 
                        ? 'border-amber-300 bg-amber-50/20' 
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {product.sku}
                        </span>
                        <h5 className="font-bold text-slate-800 text-xs mt-1">{product.name}</h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">หมวดหมู่: {product.category} | หน่วยนับ: {product.unit}</p>
                      </div>

                      {/* Stock Audit Adjuster */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 block font-bold">ยอดในระบบ</span>
                          <span className="text-xs font-mono font-extrabold text-slate-700">{sysCount}</span>
                        </div>

                        {/* Adjust counts */}
                        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1">
                          <button
                            onClick={() => handleCountChange(product.id, physicalCount - 1)}
                            className="p-1 bg-white hover:bg-slate-50 text-slate-600 rounded-md cursor-pointer border border-slate-200/50 shadow-3xs"
                            disabled={!canRecordTransactions}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          
                          <input
                            type="number"
                            value={physicalCount}
                            onChange={(e) => handleCountChange(product.id, parseInt(e.target.value) || 0)}
                            className="w-12 text-center font-bold text-xs bg-transparent border-none focus:outline-hidden focus:ring-0"
                            disabled={!canRecordTransactions}
                          />

                          <button
                            onClick={() => handleCountChange(product.id, physicalCount + 1)}
                            className="p-1 bg-white hover:bg-slate-50 text-slate-600 rounded-md cursor-pointer border border-slate-200/50 shadow-3xs"
                            disabled={!canRecordTransactions}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action indicators */}
                    {isDiff && (
                      <div className="mt-3 pt-3 border-t border-slate-100/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-slate-600">พบลักลั่นในชั้นวาง:</span>
                          <span className={`font-black font-mono ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                          <span className="text-slate-500">
                            ({delta > 0 ? `รับเข้าสต๊อก` : `ตัดสต๊อกเบิกออก`})
                          </span>
                        </div>

                        <div className="flex gap-1.5 ml-auto">
                          <button
                            onClick={() => handleResetRow(product)}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="ย้อนกลับยอดในระบบ"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAdjustStock(product)}
                            disabled={updatingProductId === product.id || !canRecordTransactions}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-3xs transition-all ${
                              delta > 0 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                            }`}
                          >
                            {updatingProductId === product.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>บันทึกปรับปรุงยอด</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>ตรวจนับสต๊อกด่วน (Fast Shelf Audit Panel)</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            เสร็จสิ้นการตรวจเช็ค
          </button>
        </div>
      </div>
    </div>
  );
}
