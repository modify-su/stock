import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, AlertTriangle, CheckCircle2, Layers, ShoppingBag, ArrowUpDown, ShieldCheck } from 'lucide-react';

interface StockProduct {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

interface StockRemainingProps {
  products: StockProduct[];
  categories?: string[];
}

export default function StockRemaining({ products, categories = [] }: StockRemainingProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterThreshold, setFilterThreshold] = useState<'All' | 'Low' | 'Normal'>('All');
  const [sortBy, setSortBy] = useState<'sku' | 'qty_asc' | 'qty_desc'>('sku');

  // Pull unique categories present in the products DB + settings categories
  const categoriesList = useMemo(() => {
    const list = new Set([...categories, ...products.map(p => p.category)]);
    return ['All', ...Array.from(list)];
  }, [products, categories]);

  // Compute remaining filter criteria
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query matches
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }

    // Category matches
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Threshold alert condition Matches
    if (filterThreshold === 'Low') {
      result = result.filter(p => p.quantity <= p.lowStockThreshold);
    } else if (filterThreshold === 'Normal') {
      result = result.filter(p => p.quantity > p.lowStockThreshold);
    }

    // Sorting parameters
    if (sortBy === 'sku') {
      result.sort((a, b) => a.sku.localeCompare(b.sku));
    } else if (sortBy === 'qty_asc') {
      result.sort((a, b) => a.quantity - b.quantity);
    } else if (sortBy === 'qty_desc') {
      result.sort((a, b) => b.quantity - a.quantity);
    }

    return result;
  }, [products, search, selectedCategory, filterThreshold, sortBy]);

  return (
    <div className="space-y-6" id="stock-remaining-view">
      
      {/* Upper Filter Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4" id="inventory-filter-panel">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Search SKU input */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
            <input 
              type="text"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              placeholder="ค้นหารหัส SKU หรือชื่อเรียกสินค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="input-inventory-search"
            />
          </div>

          {/* Category SELECT dropdown */}
          <div className="md:col-span-3">
            <select 
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
              id="select-inventory-category-filter"
            >
              <option value="All">ทุกหมวดหมู่ (แสดงทั้งหมด)</option>
              {categoriesList.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Stock status filter */}
          <div className="md:col-span-2">
            <select 
              value={filterThreshold}
              onChange={e => setFilterThreshold(e.target.value as any)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
              id="select-inventory-status-filter"
            >
              <option value="All">ทุกสถานะของสินค้า</option>
              <option value="Low">⚠️ สต็อกเหลือน้อย (Alert)</option>
              <option value="Normal">🟢 พร้อมจัดส่งสองระดับ</option>
            </select>
          </div>

          {/* Sort selection */}
          <div className="md:col-span-2">
            <select 
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
              id="select-inventory-sort-filter"
            >
              <option value="sku">เรียงรหัส SKU (ก-ฮ)</option>
              <option value="qty_asc">ยอดสต็อกเหลือน้อยที่สุด</option>
              <option value="qty_desc">ยอดสต็อกเหลือมากที่สุด</option>
            </select>
          </div>

        </div>

        {/* Categories statistics tag lines */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400 select-none">
          <span className="flex items-center gap-1">ตัวเลือกรวมคงรอย: <b>{filteredProducts.length}</b> รายการ</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-amber-500">
            สต็อกเหลือน้อย: <b>{products.filter(p => p.quantity <= p.lowStockThreshold).length}</b> รายการ
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-teal-400">
            สถานะปกติ: <b>{products.filter(p => p.quantity > p.lowStockThreshold).length}</b> รายการ
          </span>
        </div>
      </div>

      {/* Main remaining lists table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id="inventory-table-container">
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="inventory-data-table">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-bold tracking-wider select-none">
                <th className="py-3 px-5">#</th>
                <th className="py-3 px-5">รหัสสินค้า (SKU)</th>
                <th className="py-3 px-5">รายละเอียดสินค้า (Product Name)</th>
                <th className="py-3 px-5">หมวดหมู่ (Category)</th>
                <th className="py-3 px-5 text-right">จำนวนคงเหลือ (Stock)</th>
                <th className="py-3 px-5">เกณฑ์เตือนสต็อกต่ำ</th>
                <th className="py-3 px-5 text-center">สถานะสต็อก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {filteredProducts.map((p, idx) => {
                const isLow = p.quantity <= p.lowStockThreshold;
                return (
                  <tr 
                    key={p.sku} 
                    className={`hover:bg-slate-800/30 transition-all ${isLow ? 'bg-amber-500/[0.01]' : ''}`}
                    id={`row-product-${p.sku}`}
                  >
                    <td className="py-3 px-5 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="py-3 px-5 font-bold font-mono text-white select-all">{p.sku}</td>
                    <td className="py-3 px-5 max-w-sm">
                      <span className="font-semibold text-slate-100 block truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-500 block">จดระบบ: {new Date(p.createdAt).toLocaleDateString('th-TH')}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="py-1 px-2 uppercase text-[10px] bg-slate-950 text-slate-300 rounded-md border border-slate-800">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-black text-sm pr-8">
                      <span className={isLow ? 'text-amber-500' : 'text-teal-400'}>
                        {p.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-medium pr-6 text-slate-400 font-mono">
                      {p.lowStockThreshold} ชิ้น
                    </td>
                    <td className="py-3 px-5 align-middle">
                      <div className="flex justify-center select-none">
                        {isLow ? (
                          <div className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] py-0.5 px-2.5 rounded-full font-bold">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> สต็อกเหลือน้อยด่วน
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] py-0.5 px-2.5 rounded-full font-bold">
                            <CheckCircle2 className="h-3 w-3 shrink-0" /> สต็อกปลอดภัย
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2 select-none">
                      <span className="text-3xl">🧩</span>
                      <p className="text-sm font-semibold text-slate-400">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหาคลังสินค้า</p>
                      <button 
                        onClick={() => { setSearch(''); setSelectedCategory('All'); setFilterThreshold('All'); }}
                        className="text-xs text-cyan-400 hover:underline pt-1"
                      >
                        ล้างตัวกรองทั้งหมด
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
