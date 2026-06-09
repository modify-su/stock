import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, ChevronRight, Activity, ShoppingBag, Truck } from 'lucide-react';

interface StockProduct {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

interface StockInEntry {
  id: string;
  sku: string;
  quantity: number;
  timestamp: string;
  user: string;
  category: string;
}

interface StockOutEntry {
  id: string;
  sku: string;
  quantity: number;
  platform: 'TikTok' | 'Shopee' | 'Lazada' | 'Facebook';
  courier: 'Flash' | 'J&T' | 'LEX' | 'Best';
  timestamp: string;
  user: string;
}

interface DashboardProps {
  products: StockProduct[];
  stockIn: StockInEntry[];
  stockOut: StockOutEntry[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ products, stockIn, stockOut, onNavigate }: DashboardProps) {
  
  // Real-time computations
  const totals = useMemo(() => {
    const totalRemaining = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalIn = stockIn.reduce((sum, s) => sum + s.quantity, 0);
    const totalOut = stockOut.reduce((sum, s) => sum + s.quantity, 0);
    const lowStockAlerts = products.filter(p => p.quantity <= p.lowStockThreshold).length;

    return {
      totalRemaining,
      totalIn,
      totalOut,
      lowStockAlerts
    };
  }, [products, stockIn, stockOut]);

  // Platform Outward split count
  const platformStats = useMemo(() => {
    const stats = { TikTok: 0, Shopee: 0, Lazada: 0, Facebook: 0 };
    stockOut.forEach(entry => {
      if (stats[entry.platform] !== undefined) {
        stats[entry.platform] += entry.quantity;
      }
    });

    const total = Object.values(stats).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(stats).map(([platform, qty]) => ({
      name: platform,
      value: qty,
      percentage: Math.round((qty / total) * 100),
      color: platform === 'TikTok' ? '#ff0050' : platform === 'Shopee' ? '#ee4d2d' : platform === 'Lazada' ? '#0f1464' : '#1877f2'
    }));
  }, [stockOut]);

  // Courier delivery split count
  const courierStats = useMemo(() => {
    const stats = { Flash: 0, 'J&T': 0, LEX: 0, Best: 0 };
    stockOut.forEach(entry => {
      if (stats[entry.courier] !== undefined) {
        stats[entry.courier] += entry.quantity;
      }
    });

    const total = Object.values(stats).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(stats).map(([courier, qty]) => ({
      name: courier,
      value: qty,
      percentage: Math.round((qty / total) * 100),
      color: courier === 'Flash' ? '#fde047' : courier === 'J&T' ? '#ef4444' : courier === 'LEX' ? '#3b82f6' : '#a855f7'
    }));
  }, [stockOut]);

  // Highlighted alerted products
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= p.lowStockThreshold).slice(0, 4);
  }, [products]);

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Upper Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-stats-grid">
        
        {/* Total Stock Remaining */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-xs"
          id="stat-card-remaining"
        >
          <div>
            <span className="text-xs text-slate-500 font-bold block">สินค้าคงเหลือสะสม (ชิ้น)</span>
            <span className="text-3xl font-black text-slate-900 block mt-1">{totals.totalRemaining}</span>
            <span className="text-[11px] text-teal-600 font-bold mt-2 block flex items-center gap-1 select-none">
              <Activity className="h-3.5 w-3.5" /> ยอดอัปเดตแบบ Real-time
            </span>
          </div>
          <div className="h-12 w-12 bg-teal-50 text-teal-600 border border-teal-200 rounded-xl flex items-center justify-center">
            <Package className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Total Stock In */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-xs"
          id="stat-card-in"
        >
          <div>
            <span className="text-xs text-slate-500 font-bold block">รับเข้าสินค้าสะสม (ชิ้น)</span>
            <span className="text-3xl font-black text-emerald-600 block mt-1">{totals.totalIn}</span>
            <button 
              onClick={() => onNavigate('stock_in')}
              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold mt-2 block flex items-center gap-0.5 cursor-pointer"
            >
              ทำรายการนำเข้า <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-xl flex items-center justify-center">
            <ArrowDownToLine className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Total Stock Out */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-xs"
          id="stat-card-out"
        >
          <div>
            <span className="text-xs text-slate-500 font-bold block">ส่งออกสินค้าสะสม (ชิ้น)</span>
            <span className="text-3xl font-black text-blue-600 block mt-1">{totals.totalOut}</span>
            <button 
              onClick={() => onNavigate('stock_out')}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-bold mt-2 block flex items-center gap-0.5 cursor-pointer"
            >
              จัดส่งออเดอร์ <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="h-12 w-12 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl flex items-center justify-center">
            <ArrowUpFromLine className="h-6 w-6" />
          </div>
        </motion.div>

        {/* Low Stock Warning Alarm */}
        <motion.div 
          whileHover={{ y: -3 }}
          className={`bg-white border p-5 rounded-2xl flex items-center justify-between transition-all shadow-xs ${totals.lowStockAlerts > 0 ? 'border-amber-305 bg-amber-50' : 'border-slate-200'}`}
          id="stat-card-alerts"
        >
          <div>
            <span className="text-xs text-slate-500 font-bold block">สินค้าใกล้หมดคลัง (SKU)</span>
            <span className={`text-3xl font-black block mt-1 ${totals.lowStockAlerts > 0 ? 'text-amber-600 font-black' : 'text-slate-800'}`}>
              {totals.lowStockAlerts}
            </span>
            <button 
              onClick={() => onNavigate('stock_remaining')}
              className={`text-[11px] font-bold mt-2 block flex items-center gap-0.5 cursor-pointer ${totals.lowStockAlerts > 0 ? 'text-amber-700 hover:underline' : 'text-slate-505'}`}
            >
              ตรวจเช็คหมวดหมู่ <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${totals.lowStockAlerts > 0 ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
        </motion.div>
      </div>

      {/* Main Charts & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-panel">
        
        {/* Platforms distributions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs" id="chart-platform">
          <div className="flex items-center gap-2 mb-4 select-none">
            <ShoppingBag className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">ช่องทางการขายล่าสุด (สัดส่วน)</h2>
          </div>
          <div className="space-y-4">
            {platformStats.map((platform) => (
              <div key={platform.name} className="space-y-1.5" id={`stat-platform-${platform.name}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-705 font-bold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: platform.color }} />
                    {platform.name}
                  </span>
                  <span className="text-slate-500 font-medium">
                    <b className="text-slate-800">{platform.value}</b> ชิ้น ({platform.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${platform.percentage}%`, backgroundColor: platform.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          {stockOut.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-400 font-medium">
              ไม่มีข้อมูลยอดขายในระบบคลังสินค้า
            </div>
          )}
        </div>

        {/* Courier mapping distributions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs" id="chart-courier">
          <div className="flex items-center gap-2 mb-4 select-none">
            <Truck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">ผู้ให้บริการจัดส่งและขนส่ง</h2>
          </div>
          <div className="space-y-4">
            {courierStats.map((courier) => (
              <div key={courier.name} className="space-y-1.5" id={`stat-courier-${courier.name}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-705 font-bold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: courier.color }} />
                    {courier.name === 'LEX' ? 'Lazada Logistics (LEX)' : courier.name === 'Flash' ? 'Flash Express' : courier.name === 'J&T' ? 'J&T Express' : 'Best Express'}
                  </span>
                  <span className="text-slate-500 font-medium">
                    <b className="text-slate-800">{courier.value}</b> กล่อง ({courier.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${courier.percentage}%`, backgroundColor: courier.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          {stockOut.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-400 font-medium">
              ไม่มีข้อมูลประวัติส่งออกสินค้าเพื่อวิเคราะห์
            </div>
          )}
        </div>

        {/* Alarm & Warnings Widget */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs" id="alert-items-widget">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">เตือนสต็อกเหลือน้อยด่วน ({lowStockProducts.length})</h2>
            </div>
            
            <div className="space-y-2.5" id="alert-product-list">
              {lowStockProducts.map((p) => (
                <div 
                  key={p.sku} 
                  className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-between gap-2 transition"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-amber-600 block">{p.sku}</span>
                    <span className="text-xs text-slate-800 block font-bold truncate">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-amber-800 block">{p.quantity} ชิ้น</span>
                    <span className="text-[9px] text-slate-500 block font-medium">เกณฑ์เตือน: {p.lowStockThreshold}</span>
                  </div>
                </div>
              ))}

              {lowStockProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-455 space-y-2 font-medium">
                  <span className="text-2xl mt-2 select-none">🌲</span>
                  <p className="text-xs font-medium">ไม่มีรายการสินค้าใกล้หมดคลัง!</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 mt-4">
            <button 
              onClick={() => onNavigate('stock_remaining')}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-650 font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
              id="btn-goto-inventory"
            >
              ตรวจสอบจำนวนคงเหลือคลังสินค้าทั้งหมด <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
