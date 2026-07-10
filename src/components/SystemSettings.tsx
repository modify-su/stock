import React, { useState, useRef } from 'react';
import { 
  Settings, 
  Users, 
  Shield, 
  Lock, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  ShieldAlert, 
  PackageOpen, 
  Boxes, 
  ShoppingBag, 
  Truck, 
  Layers, 
  Database,
  RefreshCcw,
  FileSpreadsheet,
  Download,
  Upload,
  Clipboard,
  AlertTriangle,
  Info,
  Edit,
  Key,
  X,
  MessageSquare,
  Bot,
  Cpu,
  ExternalLink,
  Check,
  Wrench,
  Power,
  Sparkles
} from 'lucide-react';
import { UserProfile, AppSettings, RolePermissions, Product, Transaction } from '../types';
import ConfirmModal from './ConfirmModal';


interface SystemSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  users: UserProfile[];
  onAddUser: (u: Omit<UserProfile, 'id' | 'isActive'>) => void;
  onUpdateUser: (u: UserProfile) => void;
  onDeleteUser: (id: string) => void;
  rolePermissions: Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>;
  onUpdateRolePermissions: (role: 'ADMIN' | 'KEEPER' | 'AUDITOR', perms: RolePermissions) => void;
  currentUser: UserProfile;
  products: Product[];
  transactions: Transaction[];
  onImportProducts: (parsedProducts: Omit<Product, 'id' | 'updatedAt'>[], overwrite: boolean) => void;
}

const SELECTABLE_LOGOS = [
  { id: 'PackageOpen', label: 'กล่องเปิดพัสดุ (Package Open)', icon: PackageOpen },
  { id: 'Boxes', label: 'คลังกล่องซ้อน (Multiple Boxes)', icon: Boxes },
  { id: 'ShoppingBag', label: 'ถุงช้อปปิ้งสินค้า (Shopping Bag)', icon: ShoppingBag },
  { id: 'Truck', label: 'รถจัดส่งขนส่ง (Logistic Truck)', icon: Truck },
  { id: 'Layers', label: 'คอนเนอร์แบ่งประเภท (Stacked Layers)', icon: Layers },
  { id: 'Database', label: 'ฐานข้อมูลดิจิทัล (Digital Database)', icon: Database },
  { id: 'Shield', label: 'โล่ป้องกันสิทธิ์ (System Shield)', icon: Shield }
];

export default function SystemSettings({
  settings,
  onUpdateSettings,
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  rolePermissions,
  onUpdateRolePermissions,
  currentUser,
  products,
  transactions,
  onImportProducts
}: SystemSettingsProps) {
  // Local form states
  const [editingTitle, setEditingTitle] = useState(settings.appName);
  const [editingSubtitle, setEditingSubtitle] = useState(settings.appSubtitle);
  const [selectedLogo, setSelectedLogo] = useState(settings.appLogo);

  // Maintenance mode local states
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(settings.isMaintenanceMode || false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    settings.maintenanceMessage || 'ขออภัย ระบบอยู่ระหว่างการปิดปรับปรุงเพื่ออัปเดตฟีเจอร์ใหม่ชั่วคราว กรุณากลับมาใหม่อีกครั้งในภายหลัง'
  );
  const [maintenanceSuccessMessage, setMaintenanceSuccessMessage] = useState('');

  // New user state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'KEEPER' | 'AUDITOR'>('KEEPER');
  const [userError, setUserError] = useState('');

  // Editing user state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'ADMIN' | 'KEEPER' | 'AUDITOR'>('KEEPER');
  const [editUserError, setEditUserError] = useState('');

  // Custom confirmation dialog state
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

  // LINE Bot local states
  const [lineBotEnabled, setLineBotEnabled] = useState(settings.lineBotEnabled || false);
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState(settings.lineChannelAccessToken || '');
  const [lineChannelSecret, setLineChannelSecret] = useState(settings.lineChannelSecret || '');
  const [lineBotSystemPrompt, setLineBotSystemPrompt] = useState(settings.lineBotSystemPrompt || '');
  const [isLineCopied, setIsLineCopied] = useState(false);
  const [lineSuccessMessage, setLineSuccessMessage] = useState('');

  // Gemini API Key local states
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [geminiSuccessMessage, setGeminiSuccessMessage] = useState('');

  const handleSaveGeminiConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      geminiApiKey: geminiApiKey.trim()
    });
    setGeminiSuccessMessage('บันทึก Gemini API Key สำเร็จ! ระบบสแกนพัสดุและบอทแชตจะสลับมาใช้โควต้าส่วนตัวของคุณทันทีครับ 🚀');
    setTimeout(() => setGeminiSuccessMessage(''), 5500);
  };

  const handleSaveLineConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      lineBotEnabled,
      lineChannelAccessToken: lineChannelAccessToken.trim(),
      lineChannelSecret: lineChannelSecret.trim(),
      lineBotSystemPrompt: lineBotSystemPrompt.trim()
    });
    setLineSuccessMessage('บันทึกการเชื่อมต่อและข้อความตอบกลับ LINE Bot สำเร็จ! บอทจะเริ่มใช้คำสั่งวิเคราะห์ข้อเสนอแนะใหม่ทันทีครับ 🚀');
    setTimeout(() => setLineSuccessMessage(''), 5500);
  };

  const handleCopyLineWebhook = () => {
    const webhookUrl = window.location.origin + '/api/line-webhook';
    navigator.clipboard.writeText(webhookUrl);
    setIsLineCopied(true);
    setTimeout(() => setIsLineCopied(false), 2000);
  };

  const [isAppUrlCopied, setIsAppUrlCopied] = useState(false);
  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    setIsAppUrlCopied(true);
    setTimeout(() => setIsAppUrlCopied(false), 2000);
  };

  const [isLoginUrlCopied, setIsLoginUrlCopied] = useState(false);
  const handleCopyLoginUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#login`);
    setIsLoginUrlCopied(true);
    setTimeout(() => setIsLoginUrlCopied(false), 2000);
  };

  const [isRegisterUrlCopied, setIsRegisterUrlCopied] = useState(false);
  const handleCopyRegisterUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#register`);
    setIsRegisterUrlCopied(true);
    setTimeout(() => setIsRegisterUrlCopied(false), 2000);
  };

  // Save settings handler
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      appName: editingTitle.trim() || 'ระบบจัดการสต๊อกสินค้า',
      appSubtitle: editingSubtitle.trim() || 'Professional Edition',
      appLogo: selectedLogo
    });
  };

  // Save maintenance handler
  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      isMaintenanceMode,
      maintenanceMessage: maintenanceMessage.trim()
    });
    setMaintenanceSuccessMessage('บันทึกการตั้งค่าระบบและเปิด/ปิดโหมดปรับปรุงสำเร็จแล้วครับ! 🛠️');
    setTimeout(() => setMaintenanceSuccessMessage(''), 4500);
  };

  // Add user handler
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    if (!newUserName.trim() || !newUserUsername.trim()) {
      setUserError('กรุณากรอกข้อมูลหลักให้ครบถ้วนทุกช่อง');
      return;
    }

    const cleanUsername = newUserUsername.trim().toLowerCase();
    if (users.some(u => u.username === cleanUsername)) {
      setUserError('ชื่อผู้ใช้ (Username) นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      return;
    }

    // Default password is '123456' if left empty
    const finalPassword = newUserPassword.trim() || '123456';

    onAddUser({
      name: newUserName.trim(),
      username: cleanUsername,
      role: newUserRole,
      password: finalPassword,
      securityQuestion: 'จังหวัดที่คุณเกิดคือจังหวัดอะไร? (เช่น กรุงเทพ)',
      securityAnswer: 'กรุงเทพ'
    });

    // Reset inputs
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserRole('KEEPER');
  };

  const handleStartEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserUsername(user.username);
    setEditUserPassword(user.password || '123456');
    setEditUserRole(user.role);
    setEditUserError('');
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    setEditUserError('');

    if (!editUserName.trim() || !editUserUsername.trim()) {
      setEditUserError('กรุณากรอกข้อมูลส่วนสำคัญให้ครบถ้วน');
      return;
    }

    const cleanUsername = editUserUsername.trim().toLowerCase();
    const isDup = users.some(u => u.username === cleanUsername && u.id !== editingUser?.id);
    if (isDup) {
      setEditUserError('ชื่อผู้ใช้ (Username) นี้มีผู้ใช้งานอยู่แล้ว');
      return;
    }

    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        name: editUserName.trim(),
        username: cleanUsername,
        password: editUserPassword.trim() || '123456',
        role: editUserRole
      });
      setEditingUser(null);
    }
  };

  // Check if current user has permission to manage settings
  const hasSettingsPermission = rolePermissions[currentUser.role].manageSettings;

  return (
    <div id="settings-view" className="space-y-6">
      
      {/* Alert if current user is locked out */}
      {!hasSettingsPermission && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3 text-amber-800">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">🔒 คุณไม่มีสิทธิ์เข้าถึงหรือแก้ไขการตั้งค่าระดับระบบ</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              สิทธิ์ในบทบาทปัจจุบันของคุณคือ <span className="font-bold underline">{currentUser.role === 'KEEPER' ? 'เจ้าหน้าที่ดูแลคลังสินค้า (Warehouse Keeper)' : 'ผู้ตรวจสอบบัญชีฝ่ายนอก (Auditor)'}</span> ถูกจำกัดสิทธิ์โดยนโยบายระดับความปลอดภัยด้านบน คุณสามารถอ่านข้อมูลการตั้งค่าเหล่านี้ได้เท่านั้น แต่จะไม่สามารถบันทึกหรือเปลี่ยนค่าเหล่านี้ได้ชั่วคราว
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Stack: Logo/Branding + Maintenance Mode */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Logo / Branding Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between flex-1">
            <div>
              <div className="border-b border-slate-150 pb-4 mb-5">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  ตั้งค่าโลโก้ & ชื่อเว็บแอป
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ปรับเปลี่ยนความเป็นเอกลักษณ์ของสิทธิ์หน้ากากระบบ
                </p>
              </div>

              <form onSubmit={handleSaveBranding} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    ชื่อระบบแสดงผลหลัก *
                  </label>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    disabled={!hasSettingsPermission}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    หัวข้อย่อย / คำโปรยใต้ระบบ
                  </label>
                  <input
                    type="text"
                    value={editingSubtitle}
                    onChange={(e) => setEditingSubtitle(e.target.value)}
                    disabled={!hasSettingsPermission}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    สัญลักษณ์โลโก้ระบบหลัก (System Icon Logo)
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {SELECTABLE_LOGOS.map((item) => {
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => hasSettingsPermission && setSelectedLogo(item.id)}
                          disabled={!hasSettingsPermission}
                          className={`flex items-center gap-2.5 p-2 px-3 text-xs rounded-lg border transition-all cursor-pointer ${
                            selectedLogo === item.id
                              ? 'bg-blue-55 border-blue-500 font-semibold text-blue-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${selectedLogo === item.id ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                          {selectedLogo === item.id && (
                            <span className="ml-auto text-[10px] text-blue-600 font-bold">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasSettingsPermission && (
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors mt-2 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    💾 บันทึกการเปลี่ยนแปลงโลโก้-ชื่อแอป
                  </button>
                )}
              </form>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg text-white shrink-0">
                {(() => {
                  const iconObj = SELECTABLE_LOGOS.find(l => l.id === selectedLogo) || SELECTABLE_LOGOS[0];
                  const Icon = iconObj.icon;
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
              <div className="overflow-hidden">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">พรีวิวการแสดงรูปภาพ</span>
                <p className="font-bold text-sm text-slate-800 truncate">{editingTitle || 'ระบุชื่อระบบ'}</p>
                <p className="text-[10px] text-slate-500 truncate">{editingSubtitle || 'บันทึกระบุคำแสดงผล'}</p>
              </div>
            </div>
          </div>

          {/* Maintenance Mode Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="border-b border-slate-150 pb-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500 animate-pulse" />
                ตั้งค่าเปิด/ปิดปรับปรุงระบบ
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                เปิดระบบเพื่อปิดบอร์ดสำหรับพนักงานทั่วไป และผู้ตรวจสอบเมื่อปรับปรุงโปรแกรม
              </p>
            </div>

            {maintenanceSuccessMessage && (
              <p className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 rounded p-2 flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>{maintenanceSuccessMessage}</span>
              </p>
            )}

            <form onSubmit={handleSaveMaintenance} className="space-y-4">
              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <span className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Power className={`w-3.5 h-3.5 ${isMaintenanceMode ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span>ปิดปรับปรุง (Maintenance Mode)</span>
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                    {isMaintenanceMode ? '🛑 ปิดปรับปรุงอยู่ (ห้ามพนักงาน)' : '🟢 ทำงานปกติ (พนักงานใช้ได้)'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={isMaintenanceMode}
                    onChange={(e) => hasSettingsPermission && setIsMaintenanceMode(e.target.checked)}
                    disabled={!hasSettingsPermission}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Maintenance Message */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600">
                  ข้อความแสดงปรับปรุงระบบสำหรับพนักงาน *
                </label>
                <textarea
                  placeholder="เช่น ขออภัย ระบบอยู่ระหว่างการปิดปรับปรุง..."
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  disabled={!hasSettingsPermission}
                  rows={3}
                  className="w-full px-3 py-2 text-xs font-sans bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-100 focus:border-amber-450 disabled:opacity-55 leading-relaxed"
                  required
                />
              </div>

              {/* Alert Info box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-800 space-y-1 leading-normal font-medium">
                <p className="font-bold flex items-center gap-1">💡 ข้อมูลสิทธิ์ความปลอดภัย:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-700">
                  <li>เมื่อสับสวิตช์เป็น <b>เปิดปรับปรุง</b> พนักงานทั่วไป (Keeper, Auditor) จะติดหน้าจอแจ้งเตือนและเข้าใช้งานไม่ได้ทันที</li>
                  <li>ผู้ดูแลระบบ (Admin) สามารถเข้าล็อกอินและเข้าใช้งานตั้งค่าเปิดระบบคืนได้ปกติ</li>
                </ul>
              </div>

              {hasSettingsPermission && (
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  ⚙️ ทำการบันทึกสถานะปิดปรับปรุง
                </button>
              )}
            </form>
          </div>
        </div>

        {/* User Account Manager */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2 space-y-6">
          <div>
            <div className="border-b border-slate-150 pb-4 mb-5 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  รายชื่อผู้ดูแลระบบ & พนักงาน (User Management)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  เพิ่มและลบสิทธิ์ผู้ใช้ในคลัง เพื่อใช้ลงลายเซ็นความเคลื่อนไหว
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs bg-slate-100 border border-slate-200 text-slate-600 rounded-sm font-semibold">
                ทั้งหมด {users.length} คน
              </span>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                    <th className="py-3 px-4">ชื่อ-นามสกุลจริง</th>
                    <th className="py-3 px-4">ชื่อเข้าใช้ (Username)</th>
                    <th className="py-3 px-4">สิทธิ์ระดับแผนก</th>
                    <th className="py-3 px-4 text-center">สถานะ</th>
                    {hasSettingsPermission && <th className="py-3 px-4 text-center w-[120px]">จัดการบัญชี</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {users.map((item) => {
                    const isAdminUser = item.role === 'ADMIN';
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${currentUser.id === item.id ? 'bg-blue-50/30' : ''}`}>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            {item.name}
                            {currentUser.id === item.id && (
                              <span className="text-[9px] bg-blue-105 text-blue-700 font-bold px-1.5 py-0.2 rounded-full border border-blue-200 animate-pulse">
                                กำลังสวมสิทธิ์คุณ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          @{item.username}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                            item.role === 'ADMIN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : item.role === 'KEEPER'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            <Shield className="w-3 h-3" />
                            {item.role === 'ADMIN' ? 'Owner / Admin' : item.role === 'KEEPER' ? 'Warehouse Keeper' : 'Auditor / Viewer'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full font-semibold text-[10px] bg-emerald-50 text-emerald-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ACTIVE
                          </span>
                        </td>
                        {hasSettingsPermission && (
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {/* Edit password & details button */}
                              <button
                                type="button"
                                onClick={() => handleStartEditUser(item)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                                title="แก้ไขรหัสผ่านและระดับสิทธิ์การเข้าถึง"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {isAdminUser && users.filter(u => u.role === 'ADMIN').length <= 1 ? (
                                <span className="text-[9px] text-slate-400 font-normal select-none" title="ระบบต้องการผู้ดูแลอย่างน้อย 1 แฟ้มบัญชี">แอดมินคนสุดท้าย</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onDeleteUser(item.id)}
                                  disabled={currentUser.id === item.id}
                                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center"
                                  title={currentUser.id === item.id ? "ไม่สามารถลบตัวเองในระบบได้" : "ลบพนักงานคนนี้ออก"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* New user creation form */}
            {hasSettingsPermission && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 mt-4">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  ลงทะเบียนเพิ่มพนักงาน / กำหนดรหัสผ่านสิทธิ์แรกตั้ง
                </h3>

                {userError && (
                  <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 border border-rose-100 rounded p-2">
                    ⚠️ {userError}
                  </p>
                )}

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      ชื่อ-นามสกุลพนักงาน *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น สมพร คารวะสกุล"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Username * (สำหรับล็อกอิน)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น somporn_k"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      รหัสผ่าน (Password) *
                    </label>
                    <input
                      type="text"
                      placeholder="ค่าเริ่มต้น หรือกำหนดใหม่"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-100"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      บทบาทแผนกทำงาน *
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-150"
                    >
                      <option value="ADMIN">Owner / Admin (สิทธิ์สูงสุด)</option>
                      <option value="KEEPER">Warehouse Keeper (ฝ่ายคลัง)</option>
                      <option value="AUDITOR">Auditor / Viewer (ตรวจสอบ)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition-colors cursor-pointer"
                    >
                      🚀 เพิ่มพนักงานใหม่
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>

      </div>



      {/* 2.6 Gemini AI API Settings Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="border-b border-slate-150 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                ตั้งค่าสิทธิ์เข้าใช้งาน Gemini AI API Key (แก้ปัญหาโควต้าเต็ม / Error 429)
              </h2>
              <p className="text-xs text-slate-500 mt-1 pb-0">
                ระบุคีย์ API ส่วนตัวเพื่อใช้งาน Gemini ในการสแกนเอกสาร และตอบข้อความบอท หากต้องการขยายขีดจำกัดในการรันสแกนปริมาณมากพร้อมกัน
              </p>
            </div>
          </div>
        </div>

        {geminiSuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-850 font-semibold flex items-center gap-1.5 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{geminiSuccessMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveGeminiConfig} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-600">
              Gemini API Key ส่วนตัวของคุณ (GEMINI_API_KEY)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ใส่คีย์ AIzaSy... ของคุณเพื่อรันระบบสแกนและบอทด้วยโควต้าแยกต่างหาก"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                disabled={!hasSettingsPermission}
                className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 disabled:opacity-55"
              />
              {geminiApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'ล้าง Gemini API Key คืนค่าเริ่มต้น',
                      message: 'คุณต้องการลบคีย์ API ส่วนตัวและกลับไปใช้โควต้าแชร์ฟรีของระบบใช่หรือไม่?',
                      confirmText: 'ลบคีย์และคืนค่าเริ่มต้น',
                      cancelText: 'ยกเลิก',
                      variant: 'warning',
                      onConfirm: () => {
                        setGeminiApiKey('');
                        onUpdateSettings({
                          ...settings,
                          geminiApiKey: ''
                        });
                        setGeminiSuccessMessage('คืนค่า API Key เป็นค่าเริ่มต้นของระบบเรียบร้อยแล้ว!');
                        setTimeout(() => setGeminiSuccessMessage(''), 3000);
                        setConfirmDialog(p => ({ ...p, isOpen: false }));
                      }
                    });
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                >
                  ล้างคีย์
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              *ข้อมูลคีย์จะถูกจัดเก็บอย่างปลอดภัยบนระบบฐานข้อมูลคลาวน์ Firestore ในโครงการแอปพลิเคชันของคุณ และจะใช้ประมวลผลสำหรับการสแกนทุกประเภทในทันที
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-150 rounded-lg p-3 text-[11px] text-blue-800 space-y-1.5 leading-relaxed">
            <p className="font-bold flex items-center gap-1 text-blue-900">วิธีรับ Gemini API Key ฟรีใน 1 นาที:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-blue-750">
              <li>เข้าไปที่หน้าเว็บไซต์ <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">Google AI Studio (aistudio.google.com)</a></li>
              <li>คลิกปุ่ม <b>"Get API Key"</b> ที่แถบเมนูด้านบนซ้าย</li>
              <li>กดสร้างโปรเจกต์และกด <b>"Create API Key"</b></li>
              <li>คัดลอกคีย์ความลับที่ขึ้นต้นด้วย <span className="font-mono bg-blue-100 px-1 rounded font-bold">AIzaSy...</span> มาป้อนใส่ที่นี่แล้วกดบันทึก</li>
            </ol>
          </div>

          {hasSettingsPermission && (
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              💾 บันทึก Gemini API Key ส่วนตัว
            </button>
          )}
        </form>
      </div>



      {/* 🔑 ลิงก์ตรงสำหรับหน้าเข้าสู่ระบบ & สมัครสมาชิก (Direct Login & Register Links) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="border-b border-slate-150 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                🔑 ลิงก์ด่วนสำหรับการเข้าสู่ระบบและสมัครใช้งาน (พนักงานต้องล็อกอินก่อนใช้งาน)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                ระบบจัดการสต๊อกสินค้าของคุณได้รับการติดตั้งระบบรักษาความปลอดภัย พนักงานทุกคนต้องสมัครสมาชิกและเข้าสู่ระบบก่อนเริ่มทำงานเพื่อความโปร่งใส ป้องกันสินค้าสูญหาย
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Login Link Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold font-mono">#LOGIN</span>
              <h3 className="text-xs font-extrabold text-slate-700">ลิงก์หน้าเข้าสู่ระบบ (Login Page Link)</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              แชร์ลิงก์นี้ให้พนักงานทั่วไปและแอดมิน เพื่อเข้าใช้งานคลังสินค้าโดยตรง พนักงานสามารถกดจำรหัสผ่านผ่านระบบ LocalStorage เพื่อความรวดเร็วในการทำงานครั้งต่อไป
            </p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
              <span className="font-mono text-[11px] text-slate-800 truncate flex-1 select-all">
                {window.location.origin}/#login
              </span>
              <button
                type="button"
                onClick={handleCopyLoginUrl}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold cursor-pointer shrink-0 inline-flex items-center gap-1 shadow-xs transition-all"
              >
                {isLoginUrlCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ก๊อปปี้แล้ว!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>คัดลอกลิงก์</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Register Link Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-105 text-emerald-750 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold font-mono">#REGISTER</span>
              <h3 className="text-xs font-extrabold text-slate-700">ลิงก์สมัครสมาชิกเข้าสู่ระบบ (Register Page Link)</h3>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ส่งลิงก์นี้ให้พนักงานใหม่เพื่อทำการลงทะเบียนเลือกบทบาท (เจ้าหน้าที่คลังสินค้า หรือ ตรวจสอบบัญชี) และกำหนดรหัสผ่านพร้อมคำถามความปลอดภัยสำหรับกู้รหัสด้วยตนเอง
            </p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
              <span className="font-mono text-[11px] text-slate-800 truncate flex-1 select-all">
                {window.location.origin}/#register
              </span>
              <button
                type="button"
                onClick={handleCopyRegisterUrl}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-750 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer shrink-0 inline-flex items-center gap-1 shadow-xs transition-all"
              >
                {isRegisterUrlCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ก๊อปปี้แล้ว!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>คัดลอกลิงก์</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed flex items-start gap-2 shadow-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            💡 <b>คำแนะนำความปลอดภัย:</b> ระบบล็อกอินคลังสินค้าของคุณรองรับความปลอดภัยสูงสุดผ่านระบบคลาวด์เรียลไทม์ ทุกการปรับแต่งสิทธิ์และการสมัครใช้งานจะซิงก์โดยตรงเข้าสู่ Firestore เพื่อความรวดเร็วและปลอดภัยระดับสากล!
          </span>
        </div>
      </div>

      {/* Permission Tuning Matrix card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="border-b border-slate-150 pb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            กำหนดระดับสิทธิ์ความปลอดภัย (User Permission Matrix)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            เปิด/ปิดสิทธิ์การเข้าถึงข้อมูลและการบันทึกทำรายการตามบทบาทหน้าตักแต่ละประเภทบัญชีทีมงาน
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <th className="py-3 px-4 w-[240px]">สิทธิการเข้าถึงของบทบาทคิวงาน (Permission Action)</th>
                <th className="py-3 px-4 text-center">Owner / Admin</th>
                <th className="py-3 px-4 text-center">Warehouse Keeper (คลัง)</th>
                <th className="py-3 px-4 text-center">Auditor / Viewer (ตรวจสอบ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              
              {/* Feature 1: manageProducts */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>📦 จัดการข้อมูลหลักสินค้า (เพิ่ม / แก้ไข / ลบสินค้าในสารบบ)</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">อำนาจสร้างรหัสสินค้า SKU และความจุเกณฑ์ต่ำกระตุ้นสั่งซื้อ</span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.ADMIN.manageProducts}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('ADMIN', { ...rolePermissions.ADMIN, manageProducts: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.KEEPER.manageProducts}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('KEEPER', { ...rolePermissions.KEEPER, manageProducts: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.AUDITOR.manageProducts}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('AUDITOR', { ...rolePermissions.AUDITOR, manageProducts: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
              </tr>

              {/* Feature 2: recordTransactions */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>📝 บันทึกประวัติเคลื่อนไหว (รับสินค้าเข้า / เบิกออกขาย / คืนสินค้าตีกลับ)</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">สิทธิ์ในการลงบันทึกในหน้างานหลัก Operations Workspace</span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.ADMIN.recordTransactions}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('ADMIN', { ...rolePermissions.ADMIN, recordTransactions: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.KEEPER.recordTransactions}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('KEEPER', { ...rolePermissions.KEEPER, recordTransactions: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.AUDITOR.recordTransactions}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('AUDITOR', { ...rolePermissions.AUDITOR, recordTransactions: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
              </tr>

              {/* Feature 3: manageSettings */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>⚙️ ปรับคุณสมบัติแอป & ปรับปรุงความปลอดภัยสิทธิ์ของทีม</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">เปลี่ยนป้ายเว็บ ลิงก์โลโก้ และเกณฑ์ติ๊กถูกสิทธิ์นี้</span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    // Admin cannot untoggle their own setting permission easily, to avoid total lockout
                    checked={rolePermissions.ADMIN.manageSettings}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('ADMIN', { ...rolePermissions.ADMIN, manageSettings: e.target.checked })}
                    disabled={true}
                    title="ต้องมีอย่างน้อย Admin เพื่อควบคุมความปลอดภัยของระบบเสมอ ป้องกันบอร์ดล็อค"
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-not-allowed opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.KEEPER.manageSettings}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('KEEPER', { ...rolePermissions.KEEPER, manageSettings: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.AUDITOR.manageSettings}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('AUDITOR', { ...rolePermissions.AUDITOR, manageSettings: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
              </tr>

              {/* Feature 4: resetSystem */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3.5 px-4 font-semibold text-slate-700">
                  <span>💥 ดำเนินการรีเซ็ตระบบทิ้ง หรือ ลบฐานข้อมูลคลาวน์คืนค่าดั้งเดิม</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">สิทธิ์เด็ดขาดในโซนสีแดง Factory Reset & Clear Cache</span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.ADMIN.resetSystem}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('ADMIN', { ...rolePermissions.ADMIN, resetSystem: e.target.checked })}
                    disabled={true}
                    title="เจ้าของดูแลระบบสูงสุดมีอภิสิทธิ์สากลนี้เสมอ"
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-not-allowed opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.KEEPER.resetSystem}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('KEEPER', { ...rolePermissions.KEEPER, resetSystem: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={rolePermissions.AUDITOR.resetSystem}
                    onChange={(e) => hasSettingsPermission && onUpdateRolePermissions('AUDITOR', { ...rolePermissions.AUDITOR, resetSystem: e.target.checked })}
                    disabled={!hasSettingsPermission}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                  />
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Maintenance / Clear cache zone */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
        {/* 5.1 Safe Cache Clearance (100% Safe, No Data Loss) */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-700 shrink-0">
              <RefreshCcw className="w-4 h-4 animate-spin-hover" />
            </div>
            <div>
              <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                ⚡ ระบบล้างแคชระบบเบราว์เซอร์อย่างปลอดภัย (Safe Cache Clearance - 100% ปลอดภัย)
              </h4>
              <p className="text-[11px] text-indigo-700 mt-1 max-w-2xl leading-relaxed">
                ใช้เมื่อพบปัญหาการบิลด์โค้ดใน AI Studio แล้วหน้าจอไม่เปลี่ยนแปลงหรือทำงานผิดพลาด
                ฟังก์ชันนี้จะทำลาย Cache Storage, ยกเลิก Service Worker ทั่วเบราว์เซอร์ และบังคับโหลดไฟล์โค้ดชุดใหม่ล่าสุดแบบข้ามแคช (Hard Reload Bypass) <strong>โดยที่ข้อมูลสินค้า รายการ และประวัติสต๊อกบนคลาวด์จะไม่สูญหายใดๆ ทั้งสิ้น</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={async () => {
                try {
                  if ('caches' in window) {
                    const cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys.map(key => caches.delete(key)));
                  }
                  if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(reg => reg.unregister()));
                  }
                  sessionStorage.clear();
                  
                  setConfirmDialog({
                    isOpen: true,
                    title: '⚡ เคลียร์แคชระบบสำเร็จ!',
                    message: 'ระบบได้ล้างไฟล์แคชในเบราว์เซอร์และ Service Worker เรียบร้อยแล้ว กำลังจะทำการรีโหลดหน้าจอใหม่แบบ Bypass Cache เพื่อดึงสคริปต์เวอร์ชันล่าสุดจาก AI Studio ครับ',
                    confirmText: 'ตกลง รีโหลดระบบเลย',
                    isAlertOnly: true,
                    variant: 'info',
                    onConfirm: () => {
                      const origin = window.location.origin;
                      const pathname = window.location.pathname;
                      const searchParams = new URLSearchParams(window.location.search);
                      searchParams.set('nocache', String(Date.now()));
                      window.location.href = `${origin}${pathname}?${searchParams.toString()}${window.location.hash}`;
                    }
                  });
                } catch (err: any) {
                  alert("ไม่สามารถล้างแคชได้: " + err.message);
                }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>เคลียร์แคชระบบ & รีเฟรชหน้าจอ (Safe Clear Cache & Hard Reload)</span>
            </button>
          </div>
        </div>

        {/* 5.2 Factory Reset Zone (Danger Zone) */}
        <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-rose-100 rounded-lg text-rose-700 shrink-0">
              <RefreshCcw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                ⚠️ โหมดรีเซ็ตล้างคลังบน Cloud และคืนค่าโรงงาน (Factory Reset & Cloud Wipe - อันตรายมาก)
              </h4>
              <p className="text-[11px] text-rose-700 mt-1 max-w-2xl leading-relaxed">
                ใช้ในกรณีที่ต้องการล้างสินค้า บันทึกประวัติเคลื่อนไหว แฟ้มรายชื่อผู้ใช้งาน และธุรกรรมทุกอย่างในคลังระบบแชร์ออกทั้งหมด เพื่อเริ่มตั้งต้นระบบใหม่จากศูนย์เท่านั้น <strong>*ข้อมูลทุกอย่างจะถูกลบถาวร</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: '⚠️ โหมดลบทำลายล้าง & คืนสิทธิ์แรกสุด',
                  message: 'คำเตือนเร่งด่วนขั้นวิกฤต: ระบบกำลังจะสั่งเคลียร์ประวัติ สรุปผลสต๊อกสินค้า แฟ้มรายชื่อผู้ใช้งาน และธุรกรรมทุกชนิดบน Cloud ทั้งหมด!\n\nต้องการล้างและบูตระบบเริ่มต้นใหม่ทั้งหมดจริงหรือไม่?',
                  confirmText: 'ยืนยันล้างข้อมูลและบูตใหม่',
                  cancelText: 'ยกเลิก',
                  variant: 'danger',
                  onConfirm: async () => {
                    try {
                      // Clear state on firebase
                      await onImportProducts([], true);
                      
                      // Clear local memory
                      localStorage.removeItem('inventory_current_user');
                      localStorage.removeItem('inventory_is_authenticated');
                      localStorage.setItem('inventory_modify_v3_cleared', 'true');
                      window.location.reload();
                    } catch (err: any) {
                      setConfirmDialog({
                        isOpen: true,
                        title: '❌ รีเซ็ตล้มเหลว',
                        message: 'ไม่สามารถสั่งเคลียร์ระบบ Cloud ได้: ' + err.message,
                        confirmText: 'รับทราบ',
                        isAlertOnly: true,
                        variant: 'danger',
                        onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
                      });
                    }
                  }
                });
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>ล้างคลัง Cloud & คืนค่าแรกเริ่ม (Force Cloud Reset & Wipe)</span>
            </button>
            <span className="text-[10px] text-rose-600 font-medium">
              *ระบบจะทำการรีโหลดเบราว์เซอร์และกลับไปสถิติวางสิทธิ์แบบดั้งเดิมหลังการกู้คืนเสร็จสิ้น
            </span>
          </div>
        </div>
      </div>

      {/* Reusable User Editing Modal for Administrators to edit user details, password and role permissions */}
      {editingUser && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div
            onClick={() => setEditingUser(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          {/* Modal Content container */}
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-150 max-w-md w-full overflow-hidden z-10 animate-in fade-in duration-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Edit className="w-4 h-4 text-blue-600" />
                <span>แก้ไขบัญชี: {editingUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditUser}>
              <div className="p-5 space-y-4 text-xs">
                {editUserError && (
                  <p className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg font-semibold">
                    ⚠️ {editUserError}
                  </p>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    ชื่อ-นามสกุลจริง *
                  </label>
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-100 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    ชื่อผู้ใช้ / Username * (สำหรับล็อกอิน)
                  </label>
                  <input
                    type="text"
                    value={editUserUsername}
                    onChange={(e) => setEditUserUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-100 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    แก้ไขรหัสผ่านสิทธิ์เข้าใช้งาน *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editUserPassword}
                      onChange={(e) => setEditUserPassword(e.target.value)}
                      placeholder="กำหนดรหัสผ่านใหม่ (อย่างน้อย 4 หลัก)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-100 text-xs"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-[9px] text-slate-400 select-none font-semibold">แอดมินแก้ไขได้ทันที</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    กลุ่มสิทธิ์ / บทบาทแผนกใช้งาน *
                  </label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-150 text-xs"
                  >
                    <option value="ADMIN">Owner / Admin (สิทธิ์สูงสุดซิงก์แก้ได้หมด)</option>
                    <option value="KEEPER">Warehouse Keeper (บันทึกรับเข้าพัดคลังได้)</option>
                    <option value="AUDITOR">Auditor / Viewer (เรียกดูขอดูรายงานเท่านั้น)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-3.5 bg-slate-55 flex justify-end gap-2 text-right border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  💾 บันทึกเปลี่ยนสิทธิ์และรหัสผ่าน
                </button>
              </div>
            </form>
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
