import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FileSpreadsheet, FileDown, Search, ArrowDownToLine, ArrowUpFromLine, Calendar, User, ClipboardList, Filter } from 'lucide-react';

interface StockInEntry {
  id: string;
  sku: string;
  quantity: number;
  timestamp: string;
  user: string;
  category: string;
  notes?: string;
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

interface ReportsProps {
  stockIn: StockInEntry[];
  stockOut: StockOutEntry[];
}

export default function Reports({ stockIn, stockOut }: ReportsProps) {
  const [logTab, setLogTab] = useState<'all_summary' | 'stock_in' | 'stock_out'>('all_summary');
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('All');

  // Find unique users in logs
  const usersList = useMemo(() => {
    const list = new Set<string>();
    stockIn.forEach(i => list.add(i.user));
    stockOut.forEach(o => list.add(o.user));
    return ['All', ...Array.from(list)];
  }, [stockIn, stockOut]);

  // Filtered Stock In Logs
  const filteredStockIn = useMemo(() => {
    let list = [...stockIn];
    if (search.trim()) {
      list = list.filter(i => i.sku.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()));
    }
    if (filterUser !== 'All') {
      list = list.filter(i => i.user === filterUser);
    }
    return list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [stockIn, search, filterUser]);

  // Filtered Stock Out Logs
  const filteredStockOut = useMemo(() => {
    let list = [...stockOut];
    if (search.trim()) {
      list = list.filter(o => o.sku.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()));
    }
    if (filterUser !== 'All') {
      list = list.filter(o => o.user === filterUser);
    }
    return list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [stockOut, search, filterUser]);

  return (
    <div className="space-y-6" id="reports-view">
      
      {/* Upper Export Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="reports-export-panel">
        <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <FileSpreadsheet className="h-5 w-5 text-indigo-400" /> ดาวน์โหลดรายงานสต็อกสินค้าและคู่ค้าและขนส่ง (Excel/CSV Support)
        </h2>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          ระบบรองรับการสร้างรายงานในรูปแบบไฟล์ CSV ที่มีการส่งออกตัวระบุ UTF-8 BOM ทำให้โปรแกรม Microsoft Excel, Google Sheets, หรือโปรแกรมตารางคำนวณภายนอก สามารถเปิดอ่านอักขระภาษาไทยและตัวเลขออเดอร์ต่างๆ ได้ทันทีโดยที่ตัวอักษรไม่เพี้ยนหรือกลายเป็นภาษาต่างด้าว
        </p>

        {/* Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="export-actions-grid">
          
          <a 
            href="/api/stock/report/csv" 
            className="flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl font-medium text-xs text-slate-200 hover:text-white transition group"
            id="btn-export-totals"
          >
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500/20">📊</span>
              <div>
                <span className="block font-bold">1. ยอดสรุปภาพรวม</span>
                <span className="block text-[10px] text-slate-500 font-normal">แผ่นงานวิเคราะห์คลังรวม</span>
              </div>
            </div>
            <FileDown className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
          </a>

          <a 
            href="/api/stock/report/csv?type=products" 
            className="flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl font-medium text-xs text-slate-200 hover:text-white transition group"
            id="btn-export-inventory"
          >
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20">📦</span>
              <div>
                <span className="block font-bold">2. ยอดสต็อกคงเหลือ</span>
                <span className="block text-[10px] text-slate-500 font-normal">ข้อมูล SKU คงเหลือล่าสุด</span>
              </div>
            </div>
            <FileDown className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
          </a>

          <a 
            href="/api/stock/report/csv?type=stock_in" 
            className="flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl font-medium text-xs text-slate-200 hover:text-white transition group"
            id="btn-export-inwards"
          >
            <div className="flex items-center gap-2">
              <span className="p-2 bg-teal-500/10 text-teal-400 rounded-lg group-hover:bg-teal-500/20">📥</span>
              <div>
                <span className="block font-bold">3. ประวัตินำเข้ารายการ</span>
                <span className="block text-[10px] text-slate-500 font-normal">ประวัติเติมสินค้าสะสม</span>
              </div>
            </div>
            <FileDown className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
          </a>

          <a 
            href="/api/stock/report/csv?type=stock_out" 
            className="flex items-center justify-between p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl font-medium text-xs text-slate-200 hover:text-white transition group"
            id="btn-export-outwards"
          >
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:bg-blue-500/20">📤</span>
              <div>
                <span className="block font-bold">4. ประวัติการส่งออก</span>
                <span className="block text-[10px] text-slate-500 font-normal">ประวัติขนส่งและช่องทางขาย</span>
              </div>
            </div>
            <FileDown className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
          </a>

        </div>
      </div>

      {/* Database logs switcher */}
      <div className="space-y-4" id="reports-audit-trail">
        
        {/* Navigation log Tabs & Simple search filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3" id="audit-logs-tab-panel">
          <div className="flex bg-slate-900 border border-slate-850 p-1 rounded-xl self-start" id="audit-tabs">
            <button 
              onClick={() => setLogTab('all_summary')}
              className={`py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all ${logTab === 'all_summary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-350'}`}
              id="btn-tab-log-sum"
            >
              สรุปสถิตินำส่งสะสม
            </button>
            <button 
              onClick={() => setLogTab('stock_in')}
              className={`py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all ${logTab === 'stock_in' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-350'}`}
              id="btn-tab-log-in"
            >
              ประวัติรับเข้าสินค้า
            </button>
            <button 
              onClick={() => setLogTab('stock_out')}
              className={`py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all ${logTab === 'stock_out' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-350'}`}
              id="btn-tab-log-out"
            >
              ประวัติจำหน่ายส่งออก
            </button>
          </div>

          {/* Filtering inputs (only show when not on summary tab) */}
          {logTab !== 'all_summary' && (
            <div className="flex gap-2 w-full sm:w-auto" id="log-filters-container">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input 
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white focus:outline-none"
                  placeholder="ค้นหา SKU หรือ ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  id="input-log-filter-search"
                />
              </div>

              <select 
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                id="select-log-filter-user"
              >
                <option value="All">ทุกผู้ทำรายการ</option>
                {usersList.filter(u => u !== 'All').map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Dynamic Display area */}
        <div id="dynamic-log-grid">
          
          {/* 1. All Summary view */}
          {logTab === 'all_summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="all-summary-panel">
              
              {/* Box 1: stock in values */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="sum-receipts-box">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-1">
                  <ArrowDownToLine className="h-4.5 w-4.5 text-emerald-400" /> ข้อมูลสะสมเติมเข้าคลัง
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-950 py-2.5 px-3 rounded-xl border border-slate-850">
                    <span className="text-xs text-slate-400">จำนวนการเติมรับเข้า:</span>
                    <span className="text-sm font-bold text-emerald-400">{stockIn.length} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950 py-2.5 px-3 rounded-xl border border-slate-850">
                    <span className="text-xs text-slate-400">ปริมาณชิ้นสินค้ารับจัดเก็บเข้าคลังทั้งหมด:</span>
                    <span className="text-sm font-bold text-white">
                      {stockIn.reduce((sum, h) => sum + h.quantity, 0).toLocaleString()} ชิ้น
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-900/5 rounded-xl border border-emerald-950/40 text-[11px] text-slate-400 leading-relaxed">
                    🌟 <b>สรุป:</b> ความคืบหน้าของยอดรับเข้าสินค้า ช่วยให้ฝ่ายจัดเลี้ยงประเมินสิทธิ์ความสามารถในการรองรับขนาดพื้นที่สต็อกและปริมาตรความจุรวมของคลังได้ดีขึ้น
                  </div>
                </div>
              </div>

              {/* Box 2: stock out values */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="sum-deliveries-box">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-1">
                  <ArrowUpFromLine className="h-4.5 w-4.5 text-blue-400" /> ข้อมูลปริมาณจัดส่งจำหน่าย
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-950 py-2.5 px-3 rounded-xl border border-slate-850">
                    <span className="text-xs text-slate-400">จำนวนใบสั่งตัดส่งออก:</span>
                    <span className="text-sm font-bold text-blue-400">{stockOut.length} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950 py-2.5 px-3 rounded-xl border border-slate-850">
                    <span className="text-xs text-slate-400">ปริมาณชิ้นสินค้าจัดส่งขายสมบูรณ์:</span>
                    <span className="text-sm font-bold text-white">
                      {stockOut.reduce((sum, h) => sum + h.quantity, 0).toLocaleString()} ชิ้น
                    </span>
                  </div>
                  <div className="p-3 bg-blue-900/5 rounded-xl border border-blue-950/40 text-[11px] text-slate-400 leading-relaxed">
                    🌟 <b>สรุป:</b> การส่งออกส่วนใหญ่เชื่อมผ่าน TikTok เติบโตขึ้น 20%, แนะนำให้ขนส่งด้วยขนส่ง Flash Express ในลำดับบริการหลักเนื่องจากรอบการเข้ารับที่ตรงเวลา
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 2. Stock In log listing */}
          {logTab === 'stock_in' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg" id="stock-in-table-box">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="table-log-in">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase select-none">
                      <th className="py-2.5 px-4">เลขที่ใบนำเข้า</th>
                      <th className="py-2.5 px-4">สินค้า (SKU)</th>
                      <th className="py-2.5 px-4 text-center">จำนวนนำเข้า</th>
                      <th className="py-2.5 px-4">ผู้ทำรายการ</th>
                      <th className="py-2.5 px-4">หมวดหมู่</th>
                      <th className="py-2.5 px-4">บันทึกหมายเหตุ</th>
                      <th className="py-2.5 px-4">วันเวลาจัดทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                    {filteredStockIn.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-850/40 text-xs" id={`row-in-log-${i.id}`}>
                        <td className="py-2.5 px-4 font-mono font-bold text-white select-all">{i.id}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-200 select-all">{i.sku}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-400">+{i.quantity}</td>
                        <td className="py-2.5 px-4 text-slate-300 font-medium">@{i.user}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-[9px] bg-slate-950 text-slate-450 border border-slate-850 py-0.5 px-2 rounded">
                            {i.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">{i.notes || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500 text-[10px]">
                          {new Date(i.timestamp).toLocaleString('th-TH')}
                        </td>
                      </tr>
                    ))}

                    {filteredStockIn.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          ไม่พบประวัติการนำเข้าตามตัวกรองสำเร็จ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Stock Out log listing */}
          {logTab === 'stock_out' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg" id="stock-out-table-box">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="table-log-out">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase select-none">
                      <th className="py-2.5 px-4">เลขใบตัดสต็อก</th>
                      <th className="py-2.5 px-4">สินค้า (SKU)</th>
                      <th className="py-2.5 px-4 text-center">จำนวนตัด</th>
                      <th className="py-2.5 px-4">แพลตฟอร์ม</th>
                      <th className="py-2.5 px-4">ช่องทางขนส่ง</th>
                      <th className="py-2.5 px-4">ผู้สถิติตัด</th>
                      <th className="py-2.5 px-4">วันเวลาจัดทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                    {filteredStockOut.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-850/40 text-xs" id={`row-out-log-${o.id}`}>
                        <td className="py-2.5 px-4 font-mono font-bold text-white select-all">{o.id}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-200 select-all">{o.sku}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-red-400">-{o.quantity}</td>
                        <td className="py-2.5 px-4 font-medium">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.platform === 'TikTok' ? 'bg-black text-rose-400' :
                            o.platform === 'Shopee' ? 'bg-orange-950/60 text-orange-400' :
                            o.platform === 'Lazada' ? 'bg-blue-950 text-blue-400' :
                            'bg-blue-900/10 text-sky-400'
                          }`}>
                            {o.platform}
                          </span >
                        </td>
                        <td className="py-2.5 px-4 font-medium">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.courier === 'Flash' ? 'bg-yellow-950/60 text-yellow-300' :
                            o.courier === 'J&T' ? 'bg-red-950/60 text-red-500' :
                            o.courier === 'LEX' ? 'bg-indigo-950 text-teal-400' :
                            'bg-purple-950 text-purple-400'
                          }`}>
                            {o.courier === 'LEX' ? 'Lazada LEX' : o.courier === 'Flash' ? 'Flash Express' : o.courier === 'J&T' ? 'J&T Express' : 'Best Express'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 font-medium">@{o.user}</td>
                        <td className="py-2.5 px-4 text-slate-500 text-[10px]">
                          {new Date(o.timestamp).toLocaleString('th-TH')}
                        </td>
                      </tr>
                    ))}

                    {filteredStockOut.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          ไม่พบประวัติการส่งออกตามตัวกรองสำเร็จ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
