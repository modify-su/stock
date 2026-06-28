import { useState } from 'react';
import { ClipboardList, Search, ArrowDownLeft, ArrowUpRight, RotateCcw, Filter, User2, FileText, Calendar, Trash2, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Transaction } from '../types';
import ConfirmModal from './ConfirmModal';

interface TransactionLogsProps {
  transactions: Transaction[];
  onResetLogs: () => void;
  canResetLogs?: boolean;
}

export default function TransactionLogs({ transactions, onResetLogs, canResetLogs = true }: TransactionLogsProps) {
  // Filters state
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'RETURN'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Reset page when filters change
  const [prevLogSearch, setPrevLogSearch] = useState(logSearch);
  const [prevLogTypeFilter, setPrevLogTypeFilter] = useState(logTypeFilter);

  if (logSearch !== prevLogSearch || logTypeFilter !== prevLogTypeFilter) {
    setCurrentPage(1);
    setPrevLogSearch(logSearch);
    setPrevLogTypeFilter(logTypeFilter);
  }

  // Custom confirmation state
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

  // Filter logs logic
  const filteredLogs = transactions.filter((tx) => {
    const matchesSearch =
      tx.productName.toLowerCase().includes(logSearch.toLowerCase()) ||
      tx.productSku.toLowerCase().includes(logSearch.toLowerCase()) ||
      tx.operator.toLowerCase().includes(logSearch.toLowerCase()) ||
      (tx.referenceNo && tx.referenceNo.toLowerCase().includes(logSearch.toLowerCase())) ||
      (tx.reason && tx.reason.toLowerCase().includes(logSearch.toLowerCase()));

    const matchesType = logTypeFilter === 'ALL' || tx.type === logTypeFilter;

    return matchesSearch && matchesType;
  });

  // Sort logs by date desc
  const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Paginated logs
  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div id="logs-container" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            สมุดบัญชีความเคลื่อนไหวสินค้าและประวัติตีกลับ
          </h2>
          <p className="text-xs text-slate-550 mt-1">
            บันทึกการเคลมสินค้า ตรวจสอบคนเซ็นรับเข้าสินค้าคนล่าสุด หรือสืบค้นใบเสร็จอ้างอิงย้อนหลัง
          </p>
        </div>

        <button
          onClick={() => {
            if (!canResetLogs) return;
            setConfirmDialog({
              isOpen: true,
              title: '⚠️ รีเซ็ตข้อมูลประวัติทั้งหมด',
              message: 'คุณต้องการรีเซ็ตประวัติทำรายการความเคลื่อนไหวทั้งหมดกลับไปเป็นข้อมูลตั้งต้นหรือไม่?\n\n(ข้อมูลประวัติทั้งหมดจะถูกลบและเขียนทับด้วยชุดข้อมูลตัวอย่างเริ่มต้นของระบบ)',
              confirmText: 'รีเซ็ตข้อมูล',
              cancelText: 'ยกเลิก',
              variant: 'danger',
              onConfirm: () => {
                onResetLogs();
                setConfirmDialog(p => ({ ...p, isOpen: false }));
              }
            });
          }}
          disabled={!canResetLogs}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all border font-medium ${
            canResetLogs
              ? 'text-slate-500 hover:text-rose-600 border-slate-200 hover:border-rose-100 bg-white hover:bg-rose-50/20 cursor-pointer'
              : 'text-slate-350 bg-slate-50 border-slate-250 cursor-not-allowed opacity-60'
          }`}
          title={!canResetLogs ? "บทบาทของคุณไม่มีสิทธิ์ในการรีเซ็ตประวัติ" : "รีเซ็ตคลังสินค้าทั้งหมดกลับสู่ค่าเริ่มต้น"}
        >
          {canResetLogs ? <Trash2 className="w-3.5 h-3.5 text-slate-400" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
          รีเซ็ตสมุดบัญชีประวัติ
        </button>
      </div>

      {/* Control filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
        {/* Search Input */}
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัส SKU, ชื่อสินค้า, พนักงานผู้ทำรายการ, หมายเหตุ หรือเลขเอกสาร..."
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={logTypeFilter}
            onChange={(e: any) => setLogTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">ดูทุกประเภทการเคลื่อนไหว (IN / OUT / RETURN)</option>
            <option value="IN">เฉพาะนำเข้าคลังสินค้า [IN]</option>
            <option value="OUT">เฉพาะเบิกสินค้าออกคลัง [OUT]</option>
            <option value="RETURN">เฉพาะสินค้าตีกลับ/เคลมรับคืน [RETURN]</option>
          </select>
        </div>
      </div>

      {/* Result list */}
      <div className="space-y-3">
        {sortedLogs.length === 0 ? (
          <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs bg-slate-50/30">
            ไม่พบรายการเคลื่อนไหวใดๆ ที่ตรงกับการค้นหาปัจจุบัน
          </div>
        ) : (
          paginatedLogs.map((log) => {
            return (
              <div
                key={log.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Product details & movement type tag */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {log.type === 'IN' && (
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg" title="รับสินค้าเข้า">
                        <ArrowDownLeft className="w-5 h-5 line-height-none" />
                      </div>
                    )}
                    {log.type === 'OUT' && (
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-lg" title="เบิกสินค้าออก">
                        <ArrowUpRight className="w-5 h-5 line-height-none" />
                      </div>
                    )}
                    {log.type === 'RETURN' && (
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg" title="สินค้าตีกลับ">
                        <RotateCcw className="w-5 h-5 line-height-none" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-blue-600 block bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                        {log.productSku}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
                        {log.productName}
                      </h4>
                    </div>

                    <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-350" />
                        {new Date(log.date).toLocaleString('th-TH')}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <User2 className="w-3.5 h-3.5 text-slate-350" />
                        ผู้ปฏิบัติงาน: <span className="text-slate-650 font-medium">{log.operator}</span>
                      </span>
                      {log.referenceNo && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">
                            <FileText className="w-3 h-3 text-slate-400" />
                            Ref: {log.referenceNo}
                          </span>
                        </>
                      )}
                      {log.weight !== undefined && log.weight !== null && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1 text-[11px] bg-sky-50 px-1.5 py-0.5 rounded font-sans text-sky-700 border border-sky-100">
                            ⚖️ น้ำหนัก: {log.weight} {log.weightUnit === 'kg' ? 'กก. (kg)' : 'ก. (g)'}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 inline-block font-sans">
                      <span className="font-semibold text-slate-500 text-[11px]">รายละเอียด: </span>
                      {log.reason || 'ไม่ได้ระบุ'}
                    </p>
                  </div>
                </div>

                {/* Quantitative amount and status routing */}
                <div className="flex flex-col items-start md:items-end justify-center self-stretch md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-slate-400">จำนวน:</span>
                    <span className={`text-lg font-bold ${
                      log.type === 'IN' ? 'text-emerald-600' : log.type === 'OUT' ? 'text-rose-600' : 'text-blue-600'
                    }`}>
                      {log.type === 'IN' ? '+' : log.type === 'OUT' ? '-' : '↩️ '}{log.quantity}
                    </span>
                    <span className="text-xs text-slate-400">ชิ้น</span>
                  </div>

                  {/* Return routing state labels */}
                  {log.type === 'RETURN' && log.returnStatus && (
                    <div className="mt-1">
                      {log.returnStatus === 'RE_STOCK' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🟢 ตีกลับคืนคลังพร้อมขายปกติ
                        </span>
                      )}
                      {log.returnStatus === 'DAMAGED_WRITE_OFF' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          🔴 สินค้าเสียหาย/ตัดจ่ายชำรุด
                        </span>
                      )}
                      {log.returnStatus === 'PENDING_INSPECT' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          🟡 พักคัดแยกตรวจสอบสัมผัส
                        </span>
                      )}
                    </div>
                  )}

                  {log.type === 'IN' && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-emerald-500 text-white font-medium">
                      นำเข้า
                    </span>
                  )}
                  {log.type === 'OUT' && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-rose-500 text-white font-medium">
                      ส่งจัดจำหน่าย
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {sortedLogs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-sans">
            แสดง <span className="font-semibold text-slate-700">{startIndex + 1}</span> ถึง{" "}
            <span className="font-semibold text-slate-700">
              {Math.min(startIndex + itemsPerPage, sortedLogs.length)}
            </span>{" "}
            จากทั้งหมด <span className="font-semibold text-slate-700">{sortedLogs.length}</span> รายการเคลื่อนไหว
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={activePage === 1}
              className={`p-2 rounded-lg border text-slate-600 transition-all ${
                activePage === 1
                  ? "bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed opacity-50"
                  : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer active:scale-95"
              }`}
              title="ย้อนกลับไปหน้าก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => {
                  return (
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - activePage) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <div key={p} className="flex items-center gap-1">
                      {showEllipsisBefore && (
                        <span className="text-slate-400 px-1 text-xs select-none">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          activePage === p
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-850"
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={activePage === totalPages}
              className={`p-2 rounded-lg border text-slate-600 transition-all ${
                activePage === totalPages
                  ? "bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed opacity-50"
                  : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer active:scale-95"
              }`}
              title="ไปหน้าถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
