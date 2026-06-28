import { useState, useEffect, FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, AlertCircle, CheckCircle, HelpCircle, ClipboardList, PenTool, Lock, Search, X } from 'lucide-react';
import { Product, Transaction, TransactionType, ReturnStatus, UserProfile } from '../types';

interface ActionFormsProps {
  products: Product[];
  onRecordTransaction: (tx: Omit<Transaction, 'id' | 'date'>) => void;
  onRecordMultipleTransactions: (txs: Omit<Transaction, 'id' | 'date'>[]) => Promise<void>;
  preSelectedProductId: string | null;
  preSelectedType: TransactionType | null;
  onClearPreSelection: () => void;
  canRecordTransactions?: boolean;
  currentUser?: UserProfile;
}

export default function ActionForms({
  products,
  onRecordTransaction,
  onRecordMultipleTransactions,
  preSelectedProductId,
  preSelectedType,
  onClearPreSelection,
  canRecordTransactions = true,
  currentUser,
}: ActionFormsProps) {
  // Navigation for workflows
  const [activeTab, setActiveTab] = useState<TransactionType>('IN');

  // Form Fields
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [operator, setOperator] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [returnStatus, setReturnStatus] = useState<ReturnStatus>('RE_STOCK');
  const [weight, setWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<string>('g');

  // Autocomplete state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Ui helpers
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto pre-populate user name
  useEffect(() => {
    if (currentUser) {
      setOperator(currentUser.name);
    }
  }, [currentUser]);

  // Auto pre-select when quick action matches
  useEffect(() => {
    if (preSelectedProductId) {
      setProductId(preSelectedProductId);
      const found = products.find(p => p.id === preSelectedProductId);
      if (found) {
        setProductSearchQuery(`[${found.sku}] - ${found.name}`);
      }
    } else {
      setProductId('');
      setProductSearchQuery('');
    }
    if (preSelectedType) {
      setActiveTab(preSelectedType);
    }
  }, [preSelectedProductId, preSelectedType, products]);

  // Selected product details
  const selectedProduct = products.find((p) => p.id === productId);

  // Suggested reasons based on action type
  const getSuggestedReason = (type: TransactionType) => {
    switch (type) {
      case 'IN':
        return ['สั่งผลิต/รับสินค้าเข้าล็อคใหม่', 'ปรับสต๊อกระบบ/ของขาดเกินคลัง', 'ย้ายพื้นที่เก็บ', 'สต๊อกคงเหลือจากการนับมือ'];
      case 'OUT':
        return ['ส่งมอบลูกค้าออเดอร์', 'เบิกใช้ภายในสาขา', 'เบิกเพื่อการตลาดและรีวิว', 'เคลียร์สินค้าหมดอายุ/ชำรุดตัดจำหน่าย'];
      case 'RETURN':
        return ['ลูกค้าปฎิเสธการรับสินค้า/ของตีกลับ', 'สินค้าชำรุดจากการขนส่ง ตีกลับเคลม', 'สั่งซื้อสี/ไซส์ผิด ตีมาเปลี่ยน', 'ตรวจสอบรายละเอียดตกหล่น'];
      default:
        return [];
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!productId) {
      setErrorMessage('กรุณาเลือกสินค้าสำหรับการทำรายการ');
      return;
    }

    if (quantity <= 0) {
      setErrorMessage('จำนวนสินค้าต้องมากกว่า 0 เสมอ');
      return;
    }

    if (!operator.trim()) {
      setErrorMessage('กรุณากรอกชื่อผู้ทำรายการหรือพนักงานดําเนินงาน');
      return;
    }

    // Safety checks for checkout
    if (activeTab === 'OUT') {
      if (!selectedProduct) return;
      if (selectedProduct.quantity < quantity) {
        setErrorMessage(
          `ไม่สามารถเบิกจ่ายได้เนื่องจาก สต๊อกคงเหลือในคลังมีเพียง ${selectedProduct.quantity} ชิ้น (คุณพยายามเบิก ${quantity} ชิ้น)`
        );
        return;
      }
    }

    // Record transaction
    onRecordTransaction({
      productId,
      productSku: selectedProduct?.sku || 'UNKNOWN',
      productName: selectedProduct?.name || 'สินค้าทั่วไป',
      type: activeTab,
      quantity,
      reason: reason.trim() || 'ทำรายการทั่วไป',
      operator: operator.trim(),
      referenceNo: referenceNo.trim() || undefined,
      returnStatus: activeTab === 'RETURN' ? returnStatus : undefined,
      weight: weight ? Number(weight) : undefined,
      weightUnit: weight ? weightUnit : undefined,
    });

    // Success response and clear state
    setSuccessMessage(`บันทึกรายการ "${activeTab === 'IN' ? 'รับเข้า' : activeTab === 'OUT' ? 'ส่งออก' : 'ตีกลับสินค้า'}" สำเร็จเรียบร้อย!`);
    
    // Reset forms (hold operator name for convenience)
    setQuantity(1);
    setReason('');
    setReferenceNo('');
    setWeight('');
    onClearPreSelection();

    // Auto clear success message
    const timer = setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
    return () => clearTimeout(timer);
  };

  return (
    <div id="action-workspace" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="border-b border-slate-200 pb-4 mb-5 flex md:items-center justify-between gap-3 flex-col md:flex-row">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-blue-600" />
            บันทึกทำรายการเคลื่อนไหวสต๊อก (Inventory Operations)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            บันทึกการส่งออกสินค้า, การตรวจรับสินค้าใหม่นำเข้าคลัง หรือตั้งแท่นระบบจัดการตีกลับเพื่อคัดแยกคลัง
          </p>
        </div>
        {!canRecordTransactions && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-55 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-700 font-mono animate-pulse w-fit">
            <Lock className="w-3.5 h-3.5" />
            <span>จำกัดสิทธิ์ / VIEW ONLY</span>
          </div>
        )}
      </div>

      {/* Alert if current user is locked out */}
      {!canRecordTransactions && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3 text-amber-800 animate-fade-in">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold">🔒 สิทธิ์ระดับบทบาท คิวงานของคุณ ถูกจำกัดให้แสดงผลสัมพัทธ์เท่านั้น</h4>
            <p className="text-[11px] text-amber-700 leading-relaxed font-normal">
              ผู้ใช้บัญชี <span className="font-semibold underline">@{currentUser?.username} ({currentUser?.role})</span> ไม่มีสิทธิ์บันทึกประวัติการเบิกหรือการไหลของรอบของคลัง ท่านสามารถสลับบัญชีผู้ใช้ด้านบนเพื่อเปิดฟังก์ชั่นเขียนข้อมูล
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div id="oper-tabs" className="grid grid-cols-3 gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg mb-6">
        {/* Tab 1: IN (รับสินค้า) */}
        <button
          onClick={() => {
            setActiveTab('IN');
            setErrorMessage('');
            setSuccessMessage('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'IN'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/70'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>รับเข้าสินค้า [IN]</span>
        </button>

        {/* Tab 2: OUT (เบิกสินค้า) */}
        <button
          onClick={() => {
            setActiveTab('OUT');
            setErrorMessage('');
            setSuccessMessage('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'OUT'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/70'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>ส่งออกสินค้า [OUT]</span>
        </button>

        {/* Tab 3: RETURN (ตีกลับ) */}
        <button
          onClick={() => {
            setActiveTab('RETURN');
            setErrorMessage('');
            setSuccessMessage('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === 'RETURN'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/70'
          }`}
        >
          <RotateCcw className="w-4.5 h-4.5" />
          <span>ระบบสินค้าตีกลับ [RETURN]</span>
        </button>
      </div>

      {/* Forms Area */}
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <fieldset disabled={!canRecordTransactions} className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Product selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-550 mb-1">
              เลือกสินค้าในระบบคลัง *
            </label>
            <div className="relative">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 font-medium"
                  placeholder="ค้นหาตามชื่อสินค้า หรือ SKU..."
                  value={productSearchQuery}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setProductId('');
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  required={!productId}
                />
                {productSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductId('');
                      setProductSearchQuery('');
                      setIsDropdownOpen(true);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown Options */}
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {products.filter(p => 
                      p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                      p.sku.toLowerCase().includes(productSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">ไม่พบรายการสินค้าที่ต้องการ</div>
                    ) : (
                      products
                        .filter(p => 
                          p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(productSearchQuery.toLowerCase())
                        )
                        .map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setProductId(p.id);
                              setProductSearchQuery(`[${p.sku}] - ${p.name}`);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 text-xs border-b border-slate-50 flex justify-between items-center transition-colors cursor-pointer"
                          >
                            <div>
                              <div className="font-extrabold text-slate-800">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                SKU: {p.sku} | พิกัด: {p.location || 'ไม่ได้ระบุ'}
                              </div>
                            </div>
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-black text-[9px] shrink-0">
                              {p.quantity} {p.unit || 'ชิ้น'}
                            </span>
                          </button>
                        ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Selected product quick metadata card */}
            {selectedProduct && (
              <div className="mt-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs animate-fade-in">
                <div>
                  <span className="text-slate-400 uppercase tracking-widest font-semibold block text-[9px]">สถานที่เก็บ</span>
                  <span className="font-medium text-slate-700">{selectedProduct.location || '-'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase tracking-widest font-semibold block text-[9px]">หน่วยนับ</span>
                  <span className="font-semibold text-slate-900">{selectedProduct.unit || 'ชิ้น'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quantity selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-550 mb-1">
              จำนวนสินค้า ({activeTab === 'IN' ? 'รับเข้า' : activeTab === 'OUT' ? 'เบิกขาย' : 'ส่งตีกลับ'}) *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                required
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">{selectedProduct ? (selectedProduct.unit || 'ชิ้น') : 'ชิ้น'}</span>
            </div>
            {activeTab === 'OUT' && selectedProduct && (
              <p className="text-[10px] text-slate-500 mt-1">
                สูงสุดที่เบิกได้คือ {selectedProduct.quantity} {selectedProduct.unit || 'ชิ้น'}
              </p>
            )}
          </div>

          {/* Weight selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-550 mb-1">
              น้ำหนักของรายการ (เลือกใส่ได้)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="เช่น 500, 1.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              />
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
                className="px-2 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shrink-0"
              >
                <option value="g">กรัม (g)</option>
                <option value="kg">กิโลกรัม (kg)</option>
              </select>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              ระบุน้ำหนักรวมตามจริงเพื่อจดจำลงประวัติ
            </p>
          </div>
        </div>

        {/* Dynamic Return Actions - "จัดการสินค้าตีกลับ" */}
        {activeTab === 'RETURN' && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              การจัดการปลายทางเคสคืนสินค้า (Returned Decision Routing)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* RE-STOCK Option */}
              <label className={`block p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                returnStatus === 'RE_STOCK'
                  ? 'bg-emerald-50 border-emerald-400 font-semibold text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="returnStatus"
                  value="RE_STOCK"
                  checked={returnStatus === 'RE_STOCK'}
                  onChange={() => setReturnStatus('RE_STOCK')}
                  className="hidden"
                />
                <span className="block text-xs font-bold text-emerald-700">1. คืนเข้าคลังส่วนกลาง</span>
                <span className="block text-[10px] mt-1 text-emerald-600 font-normal mt-0.5">สินค้าสมบูรณ์ 100% เพิ่มสต๊อกพร้อมขายปกติ</span>
              </label>

              {/* DAMAGED WRITE OFF Option */}
              <label className={`block p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                returnStatus === 'DAMAGED_WRITE_OFF'
                  ? 'bg-rose-50 border-rose-400 font-semibold text-rose-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="returnStatus"
                  value="DAMAGED_WRITE_OFF"
                  checked={returnStatus === 'DAMAGED_WRITE_OFF'}
                  onChange={() => setReturnStatus('DAMAGED_WRITE_OFF')}
                  className="hidden"
                />
                <span className="block text-xs font-bold text-rose-700">2. สินค้าชำรุด / ตัดจำหน่าย</span>
                <span className="block text-[10px] mt-1 text-rose-600 font-normal mt-0.5">สินค้าแตกหักเสียหาย บันทึกเข้าระบบแต่จะไม่เพิ่มสต๊อกพร้อมขาย</span>
              </label>

              {/* PENDING Option */}
              <label className={`block p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                returnStatus === 'PENDING_INSPECT'
                  ? 'bg-blue-50 border-blue-400 font-semibold text-blue-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input
                  type="radio"
                  name="returnStatus"
                  value="PENDING_INSPECT"
                  checked={returnStatus === 'PENDING_INSPECT'}
                  onChange={() => setReturnStatus('PENDING_INSPECT')}
                  className="hidden"
                />
                <span className="block text-xs font-bold text-blue-700">3. รอตรวจสอบสัมผัส (Pending)</span>
                <span className="block text-[10px] mt-1 text-blue-600 font-normal mt-0.5">จัดเก็บกองแยกไว้เพื่อรอช่างตรวจประเมิน สต๊อกนิ่งคงเดิม</span>
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Reference Document */}
          <div>
            <label className="block text-xs font-semibold text-slate-550 mb-1">
              เลขที่เอกสารอ้างอิง
            </label>
            <input
              type="text"
              placeholder={activeTab === 'IN' ? 'เช่น PO-2026-001' : activeTab === 'OUT' ? 'เช่น SO-99120' : 'เช่น RET-10091'}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>

          {/* Operator Staff */}
          <div>
            <label className="block text-xs font-semibold text-slate-550 mb-1">
              พนักงานผู้บันทึกรายการ *
            </label>
            <input
              type="text"
              placeholder="กรอกชื่อ-นามสกุล ของพนักงาน"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              required
            />
          </div>

          {/* Reason notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-550 mb-1">
              เหตุผลการทำรายการ / หมายเหตุเพิ่มเติม
            </label>
            <input
              type="text"
              id="input-reason"
              placeholder="เหตุผลประกอบการทำรายการ..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>
        </div>

        {/* Dynamic Suggested reasons picker for lightning speed */}
        <div className="mb-4">
          <span className="text-[10px] font-semibold text-slate-400 block mb-1">เหตุผลแนะนำยอดพบบ่อย:</span>
          <div className="flex flex-wrap gap-1.5">
            {getSuggestedReason(activeTab).map((suggested, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setReason(suggested)}
                className="px-2 py-1 text-[10px] text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer animate-fade-in"
              >
                {suggested}
              </button>
            ))}
          </div>
        </div>

        </fieldset>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={!canRecordTransactions}
            className={`cursor-pointer px-6 py-2.5 rounded-lg text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1.5 ${
              !canRecordTransactions
                ? 'bg-slate-350 text-white cursor-not-allowed opacity-60'
                : activeTab === 'IN'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : activeTab === 'OUT'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {canRecordTransactions ? (
              <>📋 ยืนยันบันทึกรายการ</>
            ) : (
              <>🔒 ถูกจำกัดสิทธิ์บันทึกประวัติ (View Only)</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
