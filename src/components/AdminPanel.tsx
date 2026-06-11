import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Settings, Palette, RefreshCw, Save, Plus } from 'lucide-react';
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
    categories?: string[];
  };
  products: Array<{ sku: string; name: string; category: string; quantity: number }>;
  onAddCategory: (name: string) => Promise<any>;
  onUpdateCategory: (oldName: string, newName: string) => Promise<any>;
  onDeleteCategory: (name: string) => Promise<any>;
}

export default function AdminPanel({ 
  onUpdateSettings, 
  appSettings, 
  products,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}: AdminPanelProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // System Transaction logs audit states
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/admin/transaction-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Failed to load transaction logs:', e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 12000); // Poll every 12 seconds
    return () => clearInterval(interval);
  }, []);
  
  // Custom brand states
  const [logoUrl, setLogoUrl] = useState(appSettings.logoUrl);
  const [logoText, setLogoText] = useState(appSettings.logoText);
  const [loginBgColor, setLoginBgColor] = useState(appSettings.loginBgColor);
  const [loginTitle, setLoginTitle] = useState(appSettings.loginTitle);
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(appSettings.lowStockAlertEnabled);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');

  // Add User Form States
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newStatus, setNewStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [newSecurityQuestion, setNewSecurityQuestion] = useState('สัตว์เลี้ยงตัวแรกของคุณชื่ออะไร?');
  const [newSecurityAnswer, setNewSecurityAnswer] = useState('');
  const [userCreationLoading, setUserCreationLoading] = useState(false);

  // Manual refresh helper (Users are actually synced in real-time!)
  const fetchUsers = () => {
    setLoadingUsers(true);
    setTimeout(() => setLoadingUsers(false), 300);
  };

  // Fetch users on load (subscribed in real-time!)
  useEffect(() => {
    setLoadingUsers(true);
    const unsubUsers = firebaseService.subscribeUsers((data) => {
      setUsers(data);
      setLoadingUsers(false);
    }, (err) => {
      setLoadingUsers(false);
    });
    return () => unsubUsers();
  }, []);

  // Admin Create User manually
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setErrorFeedback('กรุณากรอกชื่อผู้ใช้งาน');
      return;
    }
    if (newUsername.trim().length < 3) {
      setErrorFeedback('ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!newPassword.trim()) {
      setErrorFeedback('กรุณากรอกรหัสผ่าน');
      return;
    }
    if (newPassword.trim().length < 4) {
      setErrorFeedback('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (!newSecurityAnswer.trim()) {
      setErrorFeedback('กรุณากรอกคำตอบคำถามความปลอดภัยเพื่อใช้กู้คืนรหัสผ่าน');
      return;
    }

    setUserCreationLoading(true);
    setFeedback('');
    setErrorFeedback('');

    try {
      const res = await firebaseService.adminCreateUser(
        newUsername.trim(),
        newPassword.trim(),
        newRole,
        newStatus,
        newSecurityQuestion,
        newSecurityAnswer.trim()
      );
      setFeedback(res.message);
      
      // Reset State Form
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setNewStatus('approved');
      setNewSecurityAnswer('');
      setShowAddUserForm(false);
    } catch (err: any) {
      setErrorFeedback(err.message || 'ไม่สามารถสร้างผู้ใช้ได้');
    } finally {
      setUserCreationLoading(false);
    }
  };

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
      // No manual fetchUsers() needed as we subscribe in real-time!
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
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setShowAddUserForm(!showAddUserForm)}
                className="text-[10px] bg-indigo-600/15 border border-indigo-500/20 hover:bg-indigo-600/25 text-indigo-400 px-2 py-1 rounded-md flex items-center gap-1 font-bold transition"
                id="btn-toggle-add-user"
              >
                <Plus className="h-3 w-3" /> เพิ่มผู้ใช้งานใหม่
              </button>
              <button 
                type="button"
                onClick={fetchUsers}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                id="btn-refresh-users"
              >
                <RefreshCw className="h-3 w-3" /> รีเฟรชรายชื่อ
              </button>
            </div>
          </div>

          {/* Feedback banners */}
          {feedback && <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs rounded-xl mb-4">{feedback}</div>}
          {errorFeedback && <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs rounded-xl mb-4">{errorFeedback}</div>}

          {/* Add User collapsible form component */}
          <AnimatePresence>
            {showAddUserForm && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreateUser}
                className="bg-slate-950/70 border border-indigo-950 p-4 rounded-xl mb-5 space-y-3.5 overflow-hidden"
                id="form-add-new-user"
              >
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-1 select-none">
                  <span className="text-xs font-bold text-indigo-450 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-indigo-500" /> กรอกข้อมูลเพื่อสร้างสิทธิ์เข้าถึงใหม่
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setShowAddUserForm(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-350"
                  >
                    ปิดฟอร์ม
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">ชื่อผู้ใช้งาน (Username) *</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                      placeholder="เช่น user_staff (ห้ามใช้เครื่องหมายพิเศษ)"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      required
                      id="input-new-user-username"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">รหัสผ่าน (Password) *</label>
                    <input 
                      type="password"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                      placeholder="ความยาวอย่างน้อย 4 ตัวอักษร"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      id="input-new-user-password"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">สิทธิ์เข้าถึงระบบ (Role) *</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as 'admin' | 'user')}
                      id="select-new-user-role"
                    >
                      <option value="user">USER (สิทธิ์ผู้ใช้ทั่วไป / สแกนรับ-จ่ายสินค้า)</option>
                      <option value="admin">ADMIN (สิทธิ์ผู้ดูแลระบบหลัก)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">สถานะสิทธิ์เริ่มต้น (Status) *</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as 'approved' | 'pending' | 'rejected')}
                      id="select-new-user-status"
                    >
                      <option value="approved">APPROVED (เปิดสิทธิ์ใช้งานทันที)</option>
                      <option value="pending">PENDING (รอยืนยันเพื่อล็อกสิทธิ์ชั่วคราว)</option>
                      <option value="rejected">REJECTED (ระงับการเข้าสู่ระบบ)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-850/60 pt-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">เลือกคำถามความสำคัญเพื่อกู้รหัสผ่าน *</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      value={newSecurityQuestion}
                      onChange={e => setNewSecurityQuestion(e.target.value)}
                      id="select-new-user-question"
                    >
                      <option value="สัตว์เลี้ยงตัวแรกของคุณชื่ออะไร?">สัตว์เลี้ยงตัวแรกของคุณชื่ออะไร?</option>
                      <option value="คุณเกิดที่จังหวัดใด?">คุณเกิดที่จังหวัดใด?</option>
                      <option value="โรงเรียนประถมของคุณชื่ออะไร?">โรงเรียนประถมของคุณชื่ออะไร?</option>
                      <option value="สีที่คุณชอบที่สุดคือสีอะไร?">สีที่คุณชอบที่สุดคือสีอะไร?</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">ระบุคีย์คำตอบ (Security Answer) *</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                      placeholder="ป้อนคำตอบสำหรับกู้รหัสผ่าน"
                      value={newSecurityAnswer}
                      onChange={e => setNewSecurityAnswer(e.target.value)}
                      required
                      id="input-new-user-answer"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button 
                    type="button"
                    onClick={() => setShowAddUserForm(false)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 text-xs font-semibold rounded-lg transition"
                    id="btn-cancel-create"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    disabled={userCreationLoading}
                    className="px-4.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    id="btn-submit-create"
                  >
                    {userCreationLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />} ยืนยันเพิ่มบัญชีผู้ใช้
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

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
                        type="button"
                        onClick={() => handleUserStatusUpdate(u.username, { status: 'approved' })}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border transition ${u.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-350'}`}
                        id={`btn-approve-${u.username}`}
                      >
                        อนุมัติ
                      </button>

                      <button 
                        type="button"
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
                          type="button"
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
      <div className="lg:col-span-12">
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

      {/* 3. Real-time Transaction, Commit & Rollback Audit Logs (Spans Full Width) */}
      <div className="lg:col-span-12" id="transaction-logs-panel">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 select-none">
            <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <RefreshCw className="h-4 w-4 text-indigo-400 animate-[spin_8s_linear_infinite]" /> บันทึกธุรกรรมระบบและการทำงานฐานข้อมูล (System Logs, Commits & Failures)
            </h3>
            <button
              type="button"
              onClick={fetchLogs}
              className="px-2.5 py-1 text-[10px] text-indigo-400 hover:text-white bg-indigo-950/40 border border-indigo-905 rounded-lg flex items-center gap-1 transition"
            >
              <RefreshCw className="h-3 w-3" /> รีเฟรชข้อมูลล็อก
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1" id="log-list-scroll">
            {logsLoading ? (
              <p className="text-xs text-slate-500 py-10 text-center flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> กำลังตรวจสอบพิกัดดาต้าเบสทรานส์แอกชัน...
              </p>
            ) : logs.length === 0 ? (
              <div className="text-center py-12" id="empty-logs-placeholder">
                <p className="text-xs text-slate-500">พร้อมใช้งาน ทรานส์แอกชันของระบบจะปรากฏตรงนี้เมื่อระบบประมวลผลคำสั่งซื้อนำเข้า/ตัดจ่ายคลังสินค้า</p>
              </div>
            ) : (
              logs.map((log: any) => {
                const isFail = log.status === 'failure' || log.operation === 'rollback';
                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-4 font-mono text-[10px] transition ${
                      isFail
                        ? 'bg-red-500/5 border-red-500/10 text-red-400'
                        : log.operation === 'auth'
                        ? 'bg-blue-500/5 border-blue-500/10 text-blue-400'
                        : log.operation === 'create'
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                        : 'bg-slate-950/60 border-slate-805 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          isFail
                            ? 'bg-red-500/15 text-red-400 border border-red-500/10'
                            : log.operation === 'auth'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/10'
                            : log.operation === 'create'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {log.operation.toUpperCase()}
                        </span>
                        <span className="text-[9px] font-bold">
                          {log.status === 'success' ? '✅ COMMITTED' : '⚠️ REJECTED / ROLLBACK'}
                        </span>
                        {log.user && (
                          <span className="text-slate-500 font-sans">by @{log.user}</span>
                        )}
                      </div>
                      <p className="text-xs break-all font-sans text-slate-300 mt-1">{log.details}</p>
                      {log.error && (
                        <p className="text-[10px] text-red-500 bg-red-500/10 p-1 px-2 rounded mt-1 font-sans">
                          รายละเอียดขัดข้อง: {log.error}
                        </p>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 select-none">
                      {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
