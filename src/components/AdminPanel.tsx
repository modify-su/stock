import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Settings, Palette, CheckCircle, XCircle, LayoutGrid, Sparkles, RefreshCw, AlertCircle, Save } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';

interface ManagedUser {
  username: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  securityQuestion: string;
}

interface AdminPanelProps {
  onUpdateSettings: (settings: any) => Promise<any>;
  appSettings: {
    logoUrl: string;
    logoText: string;
    loginBgColor: string;
    loginTitle: string;
    lowStockAlertEnabled: boolean;
  };
}

export default function AdminPanel({ onUpdateSettings, appSettings }: AdminPanelProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Custom brand states
  const [logoUrl, setLogoUrl] = useState(appSettings.logoUrl);
  const [logoText, setLogoText] = useState(appSettings.logoText);
  const [loginBgColor, setLoginBgColor] = useState(appSettings.loginBgColor);
  const [loginTitle, setLoginTitle] = useState(appSettings.loginTitle);
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(appSettings.lowStockAlertEnabled);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');

  // Fetch users on load
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await firebaseService.getUsers();
      setUsers(data);
    } catch (e) {
      console.error('Failed to pull registered staff', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Update staff status
  const handleUserStatusUpdate = async (tgtUsername: string, fields: { status?: 'approved' | 'rejected' | 'pending'; role?: 'admin' | 'user' }) => {
    try {
      // Find current user values to handle partial updates
      const userToUpdate = users.find(u => u.username === tgtUsername);
      if (!userToUpdate) return;
      
      const newStatus = fields.status !== undefined ? fields.status : userToUpdate.status;
      const newRole = fields.role !== undefined ? fields.role : userToUpdate.role;

      await firebaseService.updateUserStatus(tgtUsername, newStatus, newRole);
      setFeedback(`อัปเดตสิทธิ์ ${tgtUsername} เรียบร้อยแล้ว`);
      // Re-fetch users
      fetchUsers();
      setTimeout(() => setFeedback(''), 3000);
    } catch (e: any) {
      setErrorFeedback(e.message || 'บันทึกสถานะผู้ใช้ล้มเหลว');
      setTimeout(() => setErrorFeedback(''), 3000);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setFeedback('');
    setErrorFeedback('');
    try {
      const response = await onUpdateSettings({
        logoUrl,
        logoText: logoText.toUpperCase().trim(),
        loginBgColor,
        loginTitle,
        lowStockAlertEnabled
      });
      setFeedback(response.message);
      setTimeout(() => setFeedback(''), 300);
    } catch (err: any) {
      setErrorFeedback(err.message || 'บันทึกการตั้งค่าล้มเหลว');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Quick preset swatches for login BG gradients
  const bgPresets = [
    { name: 'Cosmic Slate', scale: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' },
    { name: 'Forest Teal', scale: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' },
    { name: 'Obsidian Amber', scale: 'linear-gradient(135deg, #110c00 0%, #1c1917 100%)' },
    { name: 'Corporate Indigo', scale: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="admin-panel-view">
      
      {/* 1. Staff approvals list (Left - spans 7) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="user-management-panel">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 select-none">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Users className="h-4.5 w-4.5 text-indigo-400" /> ควบคุมและอนุมัติสิทธิ์ผู้ใช้งาน ({users.length})
            </h3>
            <button 
              onClick={fetchUsers}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
              id="btn-refresh-users"
            >
              <RefreshCw className="h-3 w-3" /> รีเฟรชรายชื่อ
            </button>
          </div>

          {/* Feedback banners */}
          {feedback && <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs rounded-xl mb-4">{feedback}</div>}
          {errorFeedback && <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-xl mb-4">{errorFeedback}</div>}

          <div className="space-y-3" id="staff-user-cards">
            {loadingUsers ? (
              <p className="text-xs text-slate-500 py-10 text-center flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> กำลังตรวจสอบพิกัดรายบัญชีเจ้าหน้าที่...
              </p>
            ) : (
              users.map((u) => (
                <div 
                  key={u.username}
                  className="p-4 bg-slate-950/60 hover:bg-slate-950 border border-slate-805 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                  id={`user-card-${u.username}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">@{u.username}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                        u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      สมัครสิทธิ์เมื่อ: {new Date(u.createdAt).toLocaleDateString('th-TH')} • คำถามภัย: <span className="text-slate-450 italic">"{u.securityQuestion}"</span>
                    </div>
                  </div>

                  {/* Operational status switches */}
                  <div className="flex flex-wrap items-center gap-1.5" id={`ops-user-${u.username}`}>
                    
                    {/* Status approvals switcher */}
                    <div className="flex items-center gap-1 select-none">
                      <span className="text-[10px] text-slate-500 font-semibold mr-1">สถานะ:</span>
                      
                      <button 
                        onClick={() => handleUserStatusUpdate(u.username, { status: 'approved' })}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border transition ${u.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-350'}`}
                        id={`btn-approve-${u.username}`}
                      >
                        อนุมัติ
                      </button>

                      <button 
                        onClick={() => handleUserStatusUpdate(u.username, { status: 'rejected' })}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border transition ${u.status === 'rejected' ? 'bg-red-500/15 text-red-500 border-red-500/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-350'}`}
                        id={`btn-reject-${u.username}`}
                      >
                        ปฏิเสธ
                      </button>
                    </div>

                    {/* Roles hierarchy switcher (Disabled for Admin username) */}
                    {u.username !== 'admin' && (
                      <div className="flex items-center gap-1 select-none border-l border-slate-800 pl-2 ml-1">
                        <span className="text-[10px] text-slate-500 font-semibold mr-1">บทบาท:</span>
                        <button 
                          onClick={() => handleUserStatusUpdate(u.username, { role: u.role === 'admin' ? 'user' : 'admin' })}
                          className="bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-semibold py-1 px-2 rounded-md hover:text-white hover:border-slate-700 hover:bg-slate-850 transition"
                          id={`btn-toggle-role-${u.username}`}
                        >
                          สลับสิทธิ์
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              ))
            )}

            {!loadingUsers && users.length === 0 && (
              <p className="text-xs text-center py-8 text-slate-500">ไม่มีรายข้อมูลผู้ใช้ในระบบบัญชี</p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Theme Customizer & Branding (Right - spans 5) */}
      <div className="lg:col-span-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="branding-settings-panel">
          
          <h3 className="text-white text-xs font-bold uppercase tracking-wider border-b border-slate-800 pb-3 mb-4 flex items-center gap-1.5 select-none font-sans">
            <Palette className="h-4.5 w-4.5 text-indigo-400" /> ปรับแต่งภาพลักษณ์ระบบ & หน้าล็อกอิน
          </h3>

          <form onSubmit={handleSaveSettingsSubmit} className="space-y-4" id="form-branding">
            
            {/* Logo Text input */}
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1">ข้อความโลโก้ส่วนหัว (Brand Label)</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition"
                placeholder="เช่น STOCKMASTER"
                value={logoText}
                onChange={e => setLogoText(e.target.value)}
                id="input-setting-logotext"
              />
            </div>

            {/* Logo URL input */}
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1">ลิงก์ภาพภาพโลโก้แบรนด์ (Logo URL - Optional)</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 text-[11px] font-mono"
                placeholder="เช่น https://example.com/logo.png"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                id="input-setting-logourl"
              />
            </div>

            {/* Login screen Title */}
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1">หัวข้อหน้าจอล็อกอิน (Login Headline)</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition"
                placeholder="ป้อนชื่อระบบหน้าเชิญ"
                value={loginTitle}
                onChange={e => setLoginTitle(e.target.value)}
                id="input-setting-logintitle"
              />
            </div>

            {/* Custom linear gradients backdrop styling */}
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1">สไตล์สีผนังหน้าล็อกอิน (Login Backdrop Gradient CSS)</label>
              <input 
                type="text" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="linear-gradient(...)"
                value={loginBgColor}
                onChange={e => setLoginBgColor(e.target.value)}
                id="input-setting-bggradient"
              />

              {/* Swatch pickers presets */}
              <div className="grid grid-cols-2 gap-2 mt-2" id="bg-preset-grid">
                {bgPresets.map((bg) => (
                  <button
                    key={bg.name}
                    type="button"
                    onClick={() => setLoginBgColor(bg.scale)}
                    className="p-1 px-2.5 bg-slate-950 border border-slate-850 hover:border-slate-700 text-[10px] text-slate-300 rounded-lg text-left truncate flex items-center gap-1"
                    id={`swatch-btn-${bg.name.replace(/\s+/g, '')}`}
                  >
                    <span className="w-2 h-2 rounded-full block shrink-0" style={{ background: bg.scale }} />
                    {bg.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Alarm notifications toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-805 rounded-xl select-none">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">เปิดใช้งานการแจ้งเตือนสต็อกต่ำ</span>
                <span className="text-[10px] text-slate-500 block">แจ้งเตือนสถานะทันทีเมื่อมีรายการต่ำกว่าเกณฑ์</span>
              </div>
              <input 
                type="checkbox"
                checked={lowStockAlertEnabled}
                onChange={e => setLowStockAlertEnabled(e.target.checked)}
                className="h-4.5 w-4.5 accent-indigo-500 cursor-pointer rounded-md border border-slate-800"
                id="checkbox-setting-alarm"
              />
            </div>

            <button 
              type="submit"
              disabled={settingsLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 mt-1 select-none shadow hover:shadow-indigo-950/20"
              id="btn-admin-save-settings"
            >
              {settingsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
              บันทึกการตั้งค่าแบรนด์ระบบ
            </button>

          </form>

        </div>
      </div>

    </div>
  );
}
