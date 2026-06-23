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
  Check
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
  const [isLineCopied, setIsLineCopied] = useState(false);
  const [lineSuccessMessage, setLineSuccessMessage] = useState('');

  const handleSaveLineConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      lineBotEnabled,
      lineChannelAccessToken: lineChannelAccessToken.trim(),
      lineChannelSecret: lineChannelSecret.trim()
    });
    setLineSuccessMessage('บันทึกการเชื่อมต่อ LINE Bot สำเร็จ! ขณะนี้ระบบดึงข้อความจากไลน์ผ่าน Webhook ไปประมวลผลสต๊อกด้วย Gemini AI เรียบร้อยครับ 🚀');
    setTimeout(() => setLineSuccessMessage(''), 5500);
  };

  const handleCopyLineWebhook = () => {
    const webhookUrl = window.location.origin + '/api/line-webhook';
    navigator.clipboard.writeText(webhookUrl);
    setIsLineCopied(true);
    setTimeout(() => setIsLineCopied(false), 2000);
  };

  // Save settings handler
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      appName: editingTitle.trim() || 'ระบบจัดการสต๊อกสินค้า',
      appSubtitle: editingSubtitle.trim() || 'Professional Edition',
      appLogo: selectedLogo
    });
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
        
        {/* Logo / Branding Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-1 flex flex-col justify-between">
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

      {/* 2.5 LINE Bot Configuration & Integration Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="border-b border-slate-150 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                คุณสมบัติบอทถามตอบแชตอัตโนมัติ (LINE Messaging Bot ร่วมกับ Gemini AI)
              </h2>
              <p className="text-xs text-slate-500 mt-1 border-none pb-0">
                เชื่อมต่อสต๊อกคลังสินค้าจริงกับห้องแชต LINE OA ของบริษัท เพื่อให้พนักงานพิมพ์สอบถามสต๊อก พิกัด หรือสินค้าขาดมือได้ทันใจ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${
              lineBotEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-105 text-slate-600 border border-slate-200'
            }`}>
              <Bot className="w-4 h-4 text-emerald-600" />
              <span>สถานะ: {lineBotEnabled ? 'เปิดใช้งาน (ONLINE)' : 'ปิดใช้งาน (OFFLINE)'}</span>
            </span>
          </div>
        </div>

        {lineSuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-850 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{lineSuccessMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveLineConfig} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Form Settings */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Enable switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="block text-xs font-bold text-slate-700">สวิตช์เปิดทำงานบอทแชตอัตโนมัติ</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">เปิดระบบรับส่งข้อมูลและตอบผู้ใช้งานด้วยระบบแปลสารภาษา AI</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={lineBotEnabled}
                  onChange={(e) => hasSettingsPermission && setLineBotEnabled(e.target.checked)}
                  disabled={!hasSettingsPermission}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Access token */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600">
                LINE Channel Access Token (โทเค็นเชื่อมต่อระยะยาว) *
              </label>
              <input
                type="password"
                placeholder="ใส่ Channel Access Token (Long-lived) จาก LINE Console"
                value={lineChannelAccessToken}
                onChange={(e) => setLineChannelAccessToken(e.target.value)}
                disabled={!hasSettingsPermission}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-550 disabled:opacity-55"
                required={lineBotEnabled}
              />
              <p className="text-[10px] text-slate-400">โทเค็นสำหรับตอบสาร ใช้ควบคุมประสงค์คุ้มครองแอปและใช้ป้อนค่าคืน LINE Reply API</p>
            </div>

            {/* Secret key */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600">
                LINE Channel Secret (รหัสความลับแชนเนล) - แนะนำใส่เพื่อระบุตัวตน
              </label>
              <input
                type="password"
                placeholder="ใส่รหัส Channel Secret จากหน้า Basic Settings (ถ้ามี) เพื่อยืนยันลายเซ็น"
                value={lineChannelSecret}
                onChange={(e) => setLineChannelSecret(e.target.value)}
                disabled={!hasSettingsPermission}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-550 disabled:opacity-55"
              />
              <p className="text-[10px] text-slate-400">ใช้ตรวจสอบ Signature (x-line-signature) เพื่อป้องกันแฮกเกอร์ป้อนข้อมูลเท็จทำลายเซิร์ฟเวอร์</p>
            </div>

            {/* Save Button */}
            {hasSettingsPermission && (
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
              >
                💾 ทำการบันทึกเชื่อมต่อ LINE Bot
              </button>
            )}

          </div>

          {/* Right Panel: Webhook / Setup Guide */}
          <div className="lg:col-span-5 space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-550 animate-ping shrink-0" />
                  <span>เว็บบอร์ดปลายทางเพื่อเชื่อมต่อ LINE (Webhook URL)</span>
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 border-none pb-0">คัดลอกลิงก์ส่วนล่างนี้ไปกรอกตั้งค่าใน LINE Developer Console เพื่อรับแชตเรียลไทม์</p>
              </div>

              {/* Webhook Clipboard Copy Area */}
              <div className="p-3 border border-slate-200 bg-white rounded-lg flex items-center justify-between gap-2 overflow-hidden shadow-xs">
                <span className="font-mono text-emerald-600 font-semibold text-[10px] truncate select-all">
                  {window.location.origin}/api/line-webhook
                </span>
                <button
                  type="button"
                  onClick={handleCopyLineWebhook}
                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-105 border border-emerald-200 rounded text-xs font-bold cursor-pointer shrink-0 inline-flex items-center gap-1"
                >
                  {isLineCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>ก๊อปแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step Guides */}
              <div className="text-[11px] text-slate-600 space-y-2 border-t border-slate-200 pt-3">
                <h5 className="font-bold text-[11px] text-slate-700 mb-1 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>ขั้นตอนเชื่อมต่อแบบรวดเร็วใน 3 นาที:</span>
                </h5>
                <ol className="list-decimal pl-4 space-y-1 text-slate-500 text-[11.5px] leading-relaxed">
                  <li>เปิดเว็บไซต์ที่ <a href="https://developers.line.biz/" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold">LINE Developers Console</a></li>
                  <li>เพิ่ม Provider และสร้างแชนเนลใหม่เลือกเป็น **"Messaging API"**</li>
                  <li>เลื่อนไปแถบ **Messaging API** คลิกปุ่มออกโทเค็น (Channel Access Token) นำมาป้อนกล่องซ้ายมือ</li>
                  <li>ในแถบ Messaging API หาช่อง **Webhook URL** แล้วกดคัดลอกลิงก์ด้านบนไปกรอกวาง พร้อมสวิตช์ขวาเพื่อเปิด **"Use Webhook"**</li>
                  <li>
                    <span className="text-amber-600 font-semibold font-sans">⚠️ หมายเหตุสำคัญเรื่องปุ่ม Verify:</span>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5 leading-relaxed">
                      ลิงก์พรีวิวทดลองของ Google AI Studio (`ais-dev-` และ `ais-pre-`) มีการป้องกันความลับด้วย Google OAuth บังคับล็อกอิน ทำให้อีเวนต์ภายนอกของ LINE กดปุ่ม [Verify] จะติดบล็อกหน้าล็อกอินและได้ผลลัพธ์ **302 Found** เสมอ เป็นสิทธิ์ความปลอดภัยที่เป็นปกติของ Sandbox ครับ!
                    </p>
                  </li>
                  <li>สแกนแอดบอตเพื่อเปิดใช้งานในโทรศัพท์ ลองคุยโดยพิมพ์: <span className="font-bold text-slate-700">"เช็คสต๊อกเสื้อยืด"</span> หรือ <span className="font-bold text-emerald-750">"มีสินค้าอะไรใกล้ขาดคลังบ้าง?"</span> ระบบ Gemini AI จะตอบกลับให้พนักงานของคุณทลายงานทันที!</li>
                </ol>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-150 rounded-lg text-[10px] text-blue-800 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                💡 บอทสต๊อกประพฤติคำนวณสเกลข้อมูลตามแบบเรียลไทม์จากตัวฐานข้อมูล Firestore ทำให้พนักงานได้รับคำแนะนำสต๊อกที่ถูกต้องแม่นยำ 100% เสมอ!
              </span>
            </div>
          </div>
        </form>
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
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0">
            <RefreshCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900">
              🧹 ฝ่ายควบคุมระบบ: โหมดทำความสะอาดฐานข้อมูล & รีเซ็ตคืนค่าโรงงาน (Factory Reset & Clear Cache)
            </h3>
            <p className="text-xs text-rose-700 mt-1 max-w-3xl leading-relaxed">
              หากต้องการลบธุรกรรมประวัติเก็บ บันทึกรับเข้าส่งออกสินค้า แฟ้มบัญชีผู้ใช้ หรือข้อมูลสินค้าคลาวน์ที่ค้างสถิติทั้งหมด สามารถรันฟังก์ชันทำลายล้างเพื่อกลับเข้าสู่อสัญกรรมแรกสุดของระบบ
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-3 items-center">
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
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>ล้างคลัง Cloud & คืนค่าแรกเริ่ม (Force Cloud Reset & Wipe)</span>
          </button>
          
          <span className="text-[11px] text-rose-600 font-medium">
            *ระบบจะทำการรีโหลดเบราว์เซอร์และกลับไปสถิติวางสิทธิ์แบบดั้งเดิมหลังการกู้คืนเสร็จสิ้น
          </span>
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
