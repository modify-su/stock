import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Layers, 
  FileSpreadsheet, MessageSquare, Settings, LogOut, RefreshCw, AlertTriangle, Menu, X, UserCheck
} from 'lucide-react';
import { firebaseService, getApiBaseUrl } from './services/firebaseService';

// Import Child Components
import LoginForm from './components/LoginForm.js';
import Dashboard from './components/Dashboard.js';
import StockIn from './components/StockIn.js';
import StockOut from './components/StockOut.js';
import StockRemaining from './components/StockRemaining.js';
import Reports from './components/Reports.js';
import LineBotSandbox from './components/LineBotSandbox.js';
import AdminPanel from './components/AdminPanel.js';
import GoogleSheetsSync from './components/GoogleSheetsSync.js';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appReady, setAppReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // System parameters
  const [appSettings, setAppSettings] = useState({
    logoUrl: '',
    logoText: 'STOCKMASTER',
    loginBgColor: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    loginTitle: 'Stock Management System',
    lowStockAlertEnabled: true
  });

  // Database Arrays
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [stockIn, setStockIn] = useState<StockInEntry[]>([]);
  const [stockOut, setStockOut] = useState<StockOutEntry[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  // Fetch standard brand parameters
  const fetchSettings = async () => {
    try {
      const settings = await firebaseService.getSettings();
      setAppSettings(settings);
    } catch (e) {
      console.error('Settings fetch failed:', e);
    }
  };

  // Check login session (Verifies session against the backend server)
  const checkSession = async () => {
    try {
      const savedUserStr = localStorage.getItem('stockmaster_session');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        // Dispatch authentication check to local or remote port 3000 node session
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${parsed.token || ''}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            // Keep frontend reactive state in sync with latest changes on database
            setCurrentUser({
              ...parsed,
              role: data.user.role,
              status: data.user.status
            });
          } else {
            // Token revoked or unregistered from backend sessions array
            localStorage.removeItem('stockmaster_session');
            localStorage.removeItem('stockmaster_token');
            setCurrentUser(null);
          }
        } else if (res.status === 401 || res.status === 403) {
          // Token is definitively stale or deleted on server
          localStorage.removeItem('stockmaster_session');
          localStorage.removeItem('stockmaster_token');
          setCurrentUser(null);
        } else {
          // Keep current state if server is experiencing transient gateway error (like 502/503/504)
          console.warn(`Temporary API response issue detected during startup: status ${res.status}. Keeping local session state.`);
          setCurrentUser(parsed);
        }
      }
    } catch (e) {
      console.error('Session server-verify failed:', e);
    } finally {
      setAppReady(true);
    }
  };

  // Pull all database listings
  const fetchInventoryData = async () => {
    if (!currentUser) return;
    setLoadingDb(true);
    try {
      // Parallel fetches for optimum speed
      const [items, logs] = await Promise.all([
        firebaseService.getProducts(),
        firebaseService.getHistory()
      ]);

      setProducts(items);
      setStockIn(logs.stockIn || []);
      setStockOut(logs.stockOut || []);
    } catch (e) {
      console.error('Database sync failed:', e);
    } finally {
      setLoadingDb(false);
    }
  };

  // Initial mount sequences
  useEffect(() => {
    // Subscribe to settings in real-time so that login screen branding updates dynamically
    const unsubSettings = firebaseService.subscribeSettings((settings) => {
      setAppSettings(settings);
    });
    checkSession();
    return () => unsubSettings();
  }, []);

  // Update inventory upon user assignment matches
  useEffect(() => {
    if (currentUser) {
      setLoadingDb(true);
      
      // Subscribe to Products list in real-time
      const unsubProducts = firebaseService.subscribeProducts((items) => {
        setProducts(items);
        setLoadingDb(false);
      }, (err) => {
        setLoadingDb(false);
      });

      // Subscribe to Stock logs history in real-time
      const unsubHistory = firebaseService.subscribeHistory((logs) => {
        setStockIn(logs.stockIn || []);
        setStockOut(logs.stockOut || []);
      });

      // Live subscription to user profile state
      let unsubUser: (() => void) | null = null;
      if (firebaseService.isCloudMode()) {
        const keyName = currentUser.username.trim().toLowerCase();
        unsubUser = firebaseService.subscribeUsers((usersList) => {
          const freshUserObj = usersList.find(u => u.username.toLowerCase() === keyName);
          if (freshUserObj) {
            if (freshUserObj.role !== currentUser.role || freshUserObj.status !== currentUser.status) {
              if (freshUserObj.status === 'rejected' || freshUserObj.status === 'pending') {
                console.warn('Session status changed. Log out.');
                localStorage.removeItem('stockmaster_session');
                setCurrentUser(null);
                alert('บัญชีเจ้าหน้าที่ของคุณถูกปรับเปลี่ยนสิทธิ์โดยผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
              } else {
                const updatedUser = { ...currentUser, role: freshUserObj.role, status: freshUserObj.status };
                localStorage.setItem('stockmaster_session', JSON.stringify(updatedUser));
                setCurrentUser(updatedUser);
              }
            }
          }
        });
      }

      return () => {
        unsubProducts();
        unsubHistory();
        if (unsubUser) unsubUser();
      };
    }
  }, [currentUser]);

  // Operations: Stock In Trigger
  const handleStockInSubmit = async (payload: { sku: string; quantity: number; notes: string }) => {
    try {
      const data = await firebaseService.stockIn(payload.sku, payload.quantity, payload.notes, currentUser.username);
      fetchInventoryData();
      return { message: 'นำเข้าสินค้าสำเร็จ!', product: data };
    } catch (err: any) {
      throw new Error(err.message || 'เกิดข้อผิดพลาดในการนำเข้าสินค้า');
    }
  };

  // Operations: Stock Out Trigger
  const handleStockOutSubmit = async (payload: { sku: string; quantity: number; platform: string; courier: string }) => {
    try {
      const data = await firebaseService.stockOut(
        payload.sku, 
        payload.quantity, 
        payload.platform as any, 
        payload.courier as any, 
        currentUser.username
      );
      fetchInventoryData();
      return { message: data.warning || 'ตัดสต็อกส่งออกสินค้าสำเร็จ!', product: data.product };
    } catch (err: any) {
      throw new Error(err.message || 'เกิดข้อผิดพลาดในการส่งออกสินค้า');
    }
  };

  // Operations: New product SKU Registration
  const handleNewProductSubmit = async (payload: { sku: string; name: string; category: string; initialQty: number; lowStockThreshold: number }) => {
    try {
      const data = await firebaseService.addProduct(
        payload.sku,
        payload.name,
        payload.category,
        payload.initialQty,
        payload.lowStockThreshold,
        currentUser.username
      );
      fetchInventoryData();
      return { message: 'ขึ้นทะเบียนสินค้าเรียบร้อยแล้ว', product: data };
    } catch (err: any) {
      throw new Error(err.message || 'ขึ้นทะเบียนสินค้าล้มเหลว');
    }
  };

  // Operations: Branding and System config updates
  const handleSaveAppSettings = async (newConfig: any) => {
    try {
      await firebaseService.saveSettings(newConfig);
      setAppSettings(newConfig);
      return { message: 'อัปเดตการตั้งค่าระบบเรียบร้อยแล้ว' };
    } catch (err: any) {
      throw new Error(err.message || 'บันทึกตั้งค่าไม่สำเร็จ');
    }
  };

  // Operations: Manage categories
  const handleAddCategory = async (newCat: string) => {
    try {
      await firebaseService.addCategory(newCat);
      await fetchSettings();
      return { message: 'เพิ่มหมวดหมู่สำเร็จ!' };
    } catch (err: any) {
      throw new Error(err.message || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
    }
  };

  const handleUpdateCategoryName = async (oldName: string, newName: string) => {
    try {
      await firebaseService.updateCategoryName(oldName, newName);
      await Promise.all([fetchSettings(), fetchInventoryData()]);
      return { message: 'แก้ไขชื่อหมวดหมู่สำเร็จ!' };
    } catch (err: any) {
      throw new Error(err.message || 'แก้ไขชื่อหมวดหมู่ไม่สำเร็จ');
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    try {
      await firebaseService.deleteCategory(catName);
      await Promise.all([fetchSettings(), fetchInventoryData()]);
      return { message: 'ลบหมวดหมู่สำเร็จ!' };
    } catch (err: any) {
      throw new Error(err.message || 'ลบหมวดหมู่ไม่สำเร็จ');
    }
  };

  // Operations: Client logout procedure to destroy session in db
  const handleLogout = async () => {
    try {
      await firebaseService.logout();
      setCurrentUser(null);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Logout request failed', err);
    }
  };

  if (!appReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm text-slate-500 font-semibold uppercase tracking-widest">
            กำลังจัดเตรียมคลังสินค้าดิจิทัล...
          </p>
        </div>
      </div>
    );
  }

  // If no session verified, render LoginForm
  if (!currentUser) {
    return (
      <LoginForm 
        appSettings={appSettings} 
        onLoginSuccess={(user) => {
          localStorage.setItem('stockmaster_session', JSON.stringify(user));
          setCurrentUser(user);
          fetchInventoryData();
        }} 
      />
    );
  }

  // Active alarms count
  const alarmsCount = products.filter(p => p.quantity <= p.lowStockThreshold).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row relative font-sans" id="app-workspace">
      
      {/* 1. Mobile Top Toolbar Header */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-40" id="mobile-top-bar">
        <div className="flex items-center gap-2">
          {appSettings.logoUrl ? (
            <img src={appSettings.logoUrl} alt="Logo" className="h-4.5 w-auto object-contain rounded-md" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-8 w-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-black text-sm">📦</div>
          )}
          <span className="text-xs font-bold text-white uppercase tracking-wider">{appSettings.logoText}</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-slate-405 hover:text-white p-1 rounded-md"
          id="btn-hamburger"
        >
          {sidebarOpen ? <X className="h-5.5 w-5.5" /> : <Menu className="h-5.5 w-5.5" />}
        </button>
      </div>

      {/* 2. Responsive Rails & Sidebar */}
      <div 
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between z-30 transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        id="app-sidebar"
      >
        <div className="space-y-6">
          {/* Logo container */}
          <div className="flex items-center gap-3 select-all">
            {appSettings.logoUrl ? (
              <img 
                src={appSettings.logoUrl} 
                alt="Logo" 
                className="h-10 w-auto object-contain rounded-lg"
                referrerPolicy="no-referrer"
                id="sidebar-logo-img"
              />
            ) : (
              <div className="h-10 w-10 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center text-teal-950 font-black text-lg shadow border border-cyan-300">
                📦
              </div>
            )}
            <div>
              <span className="text-xs font-black text-white block tracking-wider uppercase" id="sidebar-logo-text">
                {appSettings.logoText || 'STOCKMASTER'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide block">Fulfillment v3.0</span>
            </div>
          </div>

          {/* Connected User identity */}
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center gap-2.5" id="user-info-badge">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xs font-black">
              @{currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white block truncate select-all">Hi, {currentUser.username}!</span>
              <span className="text-[10px] text-slate-450 block font-semibold flex items-center gap-0.5">
                <UserCheck className="h-2.5 w-2.5 text-indigo-400" /> สิทธิ์: {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ทีมสต็อก (Staff)'}
              </span>
            </div>
          </div>

          {/* Navigation Items list */}
          <nav className="space-y-1" id="sidebar-nav">
            
            <button 
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'dashboard' ? 'bg-slate-800 text-white border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-dashboard"
            >
              <span className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4.5 w-4.5" /> แดชบอร์ดภาพรวม
              </span>
            </button>

            <button 
              onClick={() => { setActiveTab('stock_in'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'stock_in' ? 'bg-slate-800 text-white border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-stock-in"
            >
              <span className="flex items-center gap-2.5">
                <ArrowDownToLine className="h-4.5 w-4.5" /> รับเข้าสินค้า (Stock In)
              </span>
            </button>

            <button 
              onClick={() => { setActiveTab('stock_out'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'stock_out' ? 'bg-slate-800 text-white border-l-4 border-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-stock-out"
            >
              <span className="flex items-center gap-2.5">
                <ArrowUpFromLine className="h-4.5 w-4.5" /> ส่งออกสินค้า (Stock Out)
              </span>
            </button>

            <button 
              onClick={() => { setActiveTab('stock_remaining'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'stock_remaining' ? 'bg-slate-800 text-white border-l-4 border-teal-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-stock-remaining"
            >
              <span className="flex items-center gap-2.5">
                <Layers className="h-4.5 w-4.5" /> ตรรกะสินค้าคงเหลือ
              </span>
              {appSettings.lowStockAlertEnabled && alarmsCount > 0 && (
                <span className="h-5 w-5 bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-black rounded-lg flex items-center justify-center animate-pulse shrink-0">
                  {alarmsCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'reports' ? 'bg-slate-800 text-white border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-reports"
            >
              <span className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-4.5 w-4.5" /> รายงาน & ประวัติ (Export)
              </span>
            </button>

            <button 
              onClick={() => { setActiveTab('google_sheets'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'google_sheets' ? 'bg-slate-800 text-white border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-google-sheets"
            >
              <span className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-400" /> จัดการผ่าน Google Sheet
              </span>
            </button>

            <button 
              onClick={() => { setActiveTab('line_bot'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'line_bot' ? 'bg-slate-800 text-white border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              id="nav-line-bot"
            >
              <span className="flex items-center gap-2.5">
                <MessageSquare className="h-4.5 w-4.5" /> ไลน์บอทจำลอง (LINE Bot)
              </span>
            </button>

            {currentUser.role === 'admin' && (
              <button 
                onClick={() => { setActiveTab('admin_panel'); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'admin_panel' ? 'bg-slate-800 text-white border-l-4 border-pink-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                id="nav-admin"
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="h-4.5 w-4.5" /> แอดมินแผงคุม (Admin)
                </span>
              </button>
            )}

          </nav>
        </div>

        {/* Sync loading and logout footer */}
        <div className="space-y-3 pt-5 border-t border-slate-800">
          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>ฐานข้อมูล: SQLite/JSON db</span>
            {loadingDb ? (
              <span className="flex items-center gap-1 text-teal-400 animate-pulse font-semibold">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> คลังสินค้าซิงค์...
              </span>
            ) : (
              <span className="text-teal-500 font-bold">🟢 เชื่อมต่อสด</span>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-450 hover:border-rose-900 hover:bg-rose-950/10 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            id="btn-logout"
          >
            <LogOut className="h-4.5 w-4.5" /> ออกจากระบบคลังสินค้า
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
        />
      )}

      {/* 3. Main Workspace Area Frame */}
      <main className="flex-1 p-6 md:p-8 space-y-6 z-10 overflow-x-hidden" id="app-workspace-body">
        
        {/* Dynamic Warning notification banner above folders */}
        {appSettings.lowStockAlertEnabled && alarmsCount > 0 && activeTab !== 'stock_remaining' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4 select-none"
            id="workspace-top-alarm-marquee"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-amber-100 text-amber-750 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
              </span>
              <div>
                <span className="text-xs font-bold text-amber-850 block">แจ้งเตือนปริมาณสต็อกต่ำกว่าเกณฑ์ความปลอดภัย!</span>
                <span className="text-[10px] text-slate-550 block mt-0.5 font-medium">ตรวจพบสินค้า {alarmsCount} รายการ ที่จำนวนสินค้าในคลังน้อยกว่าเป้าหมายการแจ้งเตือน</span>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('stock_remaining')}
              className="bg-amber-600 text-white hover:bg-amber-700 font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
              id="btn-marquee-jump"
            >
              แก้ไขเติมสต็อกล็อตใหม่ ➜
            </button>
          </motion.div>
        )}

        {/* Tab content renderer with slide animations */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.18 }}
            className="min-h-[480px]"
            id="tab-viewport-container"
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                products={products} 
                stockIn={stockIn} 
                stockOut={stockOut} 
                onNavigate={(tab) => setActiveTab(tab)} 
              />
            )}

            {activeTab === 'stock_in' && (
              <StockIn 
                products={products} 
                onStockIn={handleStockInSubmit} 
                onAddNewProduct={handleNewProductSubmit} 
                categories={appSettings.categories || []}
              />
            )}

            {activeTab === 'stock_out' && (
              <StockOut 
                products={products} 
                onStockOut={handleStockOutSubmit} 
              />
            )}

            {activeTab === 'stock_remaining' && (
              <StockRemaining 
                products={products} 
                categories={appSettings.categories || []}
              />
            )}

            {activeTab === 'reports' && (
              <Reports 
                stockIn={stockIn} 
                stockOut={stockOut} 
              />
            )}

            {activeTab === 'google_sheets' && (
              <GoogleSheetsSync
                products={products}
                stockIn={stockIn}
                stockOut={stockOut}
                userUsername={currentUser.username}
                onRefreshProducts={fetchInventoryData}
                googleToken={googleToken}
                setGoogleToken={setGoogleToken}
                googleEmail={googleEmail}
                setGoogleEmail={setGoogleEmail}
              />
            )}

            {activeTab === 'line_bot' && (
              <LineBotSandbox />
            )}

            {activeTab === 'admin_panel' && (
              <AdminPanel 
                appSettings={appSettings} 
                onUpdateSettings={handleSaveAppSettings} 
                products={products}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategoryName}
                onDeleteCategory={handleDeleteCategory}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

    </div>
  );
}
