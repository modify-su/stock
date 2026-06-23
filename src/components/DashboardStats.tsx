import { ArrowUpRight, ArrowDownRight, Package, AlertTriangle, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
import { Product, Transaction } from '../types';

interface DashboardStatsProps {
  products: Product[];
  transactions: Transaction[];
  onLowStockFilter: () => void;
  onClearFilters: () => void;
  isLowStockFiltered: boolean;
}

export default function DashboardStats({
  products,
  transactions,
  onLowStockFilter,
  onClearFilters,
  isLowStockFiltered,
}: DashboardStatsProps) {
  // Calculations
  const totalSku = products.length;
  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
  
  // Low stock calculation
  const lowStockProducts = products.filter((p) => p.quantity <= p.minStock);
  const lowStockCount = lowStockProducts.length;

  // Returns calculation
  const returnTransactions = transactions.filter((t) => t.type === 'RETURN');
  const returnUnitsCount = returnTransactions.reduce((sum, t) => sum + t.quantity, 0);
  const returnEventsCount = returnTransactions.length;

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div id="dashboard-stats-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total SKU Stat */}
      <div 
        id="stat-sku" 
        className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-350 transition-colors"
      >
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">สินค้าทั้งหมด (SKU)</p>
          <h3 className="text-3xl font-bold font-sans mt-1 text-slate-800">{totalSku} <span className="text-xs font-normal text-slate-400">รายการ SKU</span></h3>
          <p className="text-xs text-slate-500 mt-1">พร้อมรองรับการขยายตัว</p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Layers className="w-6 h-6" />
        </div>
      </div>

      {/* Total Inventory Stock Stat */}
      <div 
        id="stat-units" 
        className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-350 transition-colors"
      >
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">จำนวนสินค้าในคลัง</p>
          <h3 className="text-3xl font-bold mt-1 text-slate-800">{totalUnits} <span className="text-xs font-normal text-slate-400">หน่วยรวม</span></h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
            นับตามหน่วยที่กำหนดไว้ของแต่ละสินค้า
          </p>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
          <Package className="w-6 h-6" />
        </div>
      </div>

      {/* Low Stock Warning Stat */}
      <button
        id="stat-low-stock"
        onClick={() => {
          if (isLowStockFiltered) {
            onClearFilters();
          } else if (lowStockCount > 0) {
            onLowStockFilter();
          }
        }}
        className={`text-left self-stretch bg-white rounded-xl p-5 border shadow-sm flex items-center justify-between transition-all duration-200 cursor-pointer ${
          lowStockCount > 0 
            ? isLowStockFiltered 
              ? 'border-orange-400 bg-orange-50/20 ring-2 ring-orange-100'
              : 'border-orange-200 hover:border-orange-350 hover:bg-orange-50/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="w-full">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            สินค้าใกล้หมดเกณฑ์
            {isLowStockFiltered && <span className="px-1.5 py-0.2 text-[10px] bg-orange-500 text-white rounded">กรองอยู่</span>}
          </p>
          <h3 className={`text-3xl font-bold mt-1 ${lowStockCount > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
            {lowStockCount} <span className="text-xs font-normal text-slate-400">SKU ต่ำกว่าเกณฑ์</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {lowStockCount > 0 ? '⚠️ ควรทำรายการ "รับเข้าสินค้า" ด่วน' : '✔️ สต๊อกแข็งแกร่งทุกรายการ'}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
          <AlertTriangle className="w-6 h-6 animate-pulse" />
        </div>
      </button>

      {/* Return Rate/Units Stat */}
      <div 
        id="stat-returns" 
        className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between hover:border-slate-350 transition-colors"
      >
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">สินค้ารับคืน / ตีกลับ</p>
          <h3 className="text-3xl font-bold mt-1 text-slate-800">{returnUnitsCount} <span className="text-xs font-normal text-slate-400 font-sans">ชิ้น ({returnEventsCount} ครั้ง)</span></h3>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 flex-wrap">
            <span className="text-slate-500">หมุนเวียนเสร็จสิ้น</span>
            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono border border-slate-200">
              RE-STOCK / DAMAGED
            </span>
          </div>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <RefreshCw className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
