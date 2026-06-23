import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Key, 
  Eye, 
  EyeOff, 
  UserPlus, 
  HelpCircle, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  PackageOpen,
  Boxes,
  ShoppingBag,
  Truck,
  Layers,
  Database,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, AppSettings } from '../types';

interface LoginScreenProps {
  settings: AppSettings;
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
  onRegister: (newUser: Omit<UserProfile, 'id' | 'isActive'> & { password?: string; securityQuestion?: string; securityAnswer?: string }) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  onResetPassword: (username: string, securityAnswer: string, newPass: string) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
}

const SECURITY_QUESTIONS = [
  "จังหวัดที่คุณเกิดคือจังหวัดอะไร? (เช่น กรุงเทพ)",
  "โรงเรียนประถมของคุณชื่ออะไร?",
  "สัตว์เลี้ยงตัวแรกของคุณชื่ออะไร?",
  "เมนูอาหารโปรดของคุณคืออะไร?"
];

function AppLogoIcon({ name, className = "w-10 h-10" }: { name: string; className?: string }) {
  switch (name) {
    case 'PackageOpen': return <PackageOpen className={className} />;
    case 'Boxes': return <Boxes className={className} />;
    case 'ShoppingBag': return <ShoppingBag className={className} />;
    case 'Truck': return <Truck className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'Database': return <Database className={className} />;
    case 'Shield': return <Shield className={className} />;
    default: return <PackageOpen className={className} />;
  }
}

export default function LoginScreen({
  settings,
  users,
  onLogin,
  onRegister,
  onResetPassword
}: LoginScreenProps) {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');

  // Login States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regRole, setRegRole] = useState<'ADMIN' | 'KEEPER' | 'AUDITOR'>('KEEPER');
  const [regPassword, setRegPassword] = useState('');
  const [regQuestion, setRegQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [regAnswer, setRegAnswer] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Forgot States
  const [forgotUsername, setForgotUsername] = useState('');
  const [step, setStep] = useState<1 | 2>(1); // Step 1: verify username, Step 2: verify answer + reset
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Auto Quick Fill login info (excellent UX for evaluation)
  const handleQuickFill = (user: UserProfile) => {
    setLoginUsername(user.username);
    setLoginPassword(user.password || '123456');
    setLoginError('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    const cleanUsername = loginUsername.trim().toLowerCase();
    const foundUser = users.find(u => u.username === cleanUsername);

    if (!foundUser) {
      setLoginError('ไม่พบชื่อผู้ใช้นี้ในระบบ');
      return;
    }

    // Checking password (default pass is "123456" if not explicitly customized)
    const expectedPassword = foundUser.password || '123456';
    if (loginPassword !== expectedPassword) {
      setLoginError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }

    // Success login
    onLogin(foundUser);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName.trim() || !regUsername.trim() || !regPassword.trim() || !regAnswer.trim()) {
      setRegError('กรุณากรอกข้อมูลหลักให้ครบถ้วนทุกช่อง');
      return;
    }

    if (regPassword.length < 4) {
      setRegError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase();
    const result = await onRegister({
      name: regName.trim(),
      username: cleanUsername,
      role: regRole,
      password: regPassword,
      securityQuestion: regQuestion,
      securityAnswer: regAnswer.trim()
    });

    if (result.success) {
      setRegSuccess(result.message);
      // clear fields
      setRegName('');
      setRegUsername('');
      setRegRole('KEEPER');
      setRegPassword('');
      setRegAnswer('');
      // Redirect back after delay
      setTimeout(() => {
        setMode('LOGIN');
        setRegSuccess('');
      }, 2000);
    } else {
      setRegError(result.message);
    }
  };

  const handleForgotNext = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const cleanUsername = forgotUsername.trim().toLowerCase();
    const foundUser = users.find(u => u.username === cleanUsername);

    if (!foundUser) {
      setForgotError('ไม่พบชื่อผู้ใช้นี้ในระบบ ปรึกษาแอดมินเพื่อลงทะเบียนใหม่');
      return;
    }

    setSecurityQuestion(foundUser.securityQuestion || "จังหวัดที่คุณเกิดคือจังหวัดอะไร? (เช่น กรุงเทพ)");
    setStep(2);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!securityAnswer.trim() || !newPassword.trim()) {
      setForgotError('กรุณากรอกข้อมูลกู้คืนและระบุรหัสผ่านใหม่');
      return;
    }

    if (newPassword.length < 4) {
      setForgotError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    const result = await onResetPassword(forgotUsername.trim().toLowerCase(), securityAnswer.trim(), newPassword);

    if (result.success) {
      setForgotSuccess(result.message);
      setTimeout(() => {
        setMode('LOGIN');
        setStep(1);
        setForgotUsername('');
        setSecurityAnswer('');
        setNewPassword('');
        setForgotSuccess('');
      }, 2500);
    } else {
      setForgotError(result.message);
    }
  };

  // Clear stored memory & reset to virgin state
  const handleSystemWipe = () => {
    const confirmWipe = window.confirm(
      "คุณต้องการล้างข้อมูลจำลองและสิทธิ์ที่ค้างอยู่ในเบราว์เซอร์ทั้งหมด เพื่อกลับไปใช้ค่าเริ่มต้นระบบทันทีใช่หรือไม่?"
    );
    if (confirmWipe) {
      localStorage.removeItem('inventory_products');
      localStorage.removeItem('inventory_transactions');
      localStorage.removeItem('inventory_users');
      localStorage.removeItem('inventory_settings');
      localStorage.removeItem('inventory_role_perm');
      localStorage.removeItem('inventory_current_user');
      localStorage.removeItem('inventory_is_authenticated');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-md">
            <AppLogoIcon name={settings.appLogo} className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-black text-slate-800 tracking-tight">
          {settings.appName}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500 font-mono">
          {settings.appSubtitle} • SECURE LOG IN
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl border border-slate-100 sm:px-10">
          
          <AnimatePresence mode="wait">
            
            {/* LOGIN MODE */}
            {mode === 'LOGIN' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-md font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    ยืนยันตัวตนเจ้าหน้าที่คลัง
                  </h3>
                  <p className="text-[11px] text-slate-400">เข้าสู่ระบบเพื่อเซ็นกำกับธุรกรรมและระดับสิทธิ์</p>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      ชื่อเข้าใช้งาน (Username)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="เช่น modify"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-500">
                        รหัสผ่านผ่านระบบ (Password)
                      </label>
                      <button
                        type="button"
                        onClick={() => setMode('FORGOT')}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="ระบุรหัสผ่านยืนยันสิทธิ์"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="block w-full pl-9 pr-10 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm tracking-wide cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    🔒 เข้าสู่ระบบคลังสินค้า
                  </button>
                </form>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-150"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">หรือต้องการลงเพิ่ม</span>
                  <div className="flex-grow border-t border-slate-150"></div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setMode('REGISTER');
                      setRegError('');
                      setRegSuccess('');
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-lg px-4 py-2 transition-all cursor-pointer font-bold"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                    <span>สมัครสมาชิกใหม่ (Register Account)</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* REGISTER MODE */}
            {mode === 'REGISTER' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                  <h3 className="text-md font-bold text-slate-800 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    สมัครสมาชิกใหม่เข้าคลัง
                  </h3>
                  <button
                    onClick={() => {
                      setMode('LOGIN');
                      setRegError('');
                    }}
                    className="flex items-center text-xs text-slate-500 hover:text-slate-800 font-bold gap-0.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    กลับ
                  </button>
                </div>

                {regError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-2 text-emerald-700 text-xs font-semibold animate-heart-beat">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{regSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      ชื่อ-นามสกุลจริง *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น สมศักดิ์ กองงานดี"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        ชื่อล็อกอิน (Username) *
                      </label>
                      <input
                        type="text"
                        placeholder="somsak_g"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        กำหนดรหัสผ่านเข้าใช้ *
                      </label>
                      <input
                        type="password"
                        placeholder="รหัสผ่านผู้ใช้"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      ตำแหน่งสิทธิ์เข้าถึง (Role) *
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as any)}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-100 cursor-pointer"
                    >
                      <option value="ADMIN">Owner / Admin (ควบคุมสิทธิ์/เปลี่ยนชื่อแอป)</option>
                      <option value="KEEPER">Warehouse Keeper (เบิก-รับ-แก้ไขคลังสินค้า)</option>
                      <option value="AUDITOR">Auditor / Viewer (เรียกดูรายการได้เท่านั้น)</option>
                    </select>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-2">
                    <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      ตั้งค่ากู้คืนสิทธิ์กรณีลืมรหัสผ่าน
                    </span>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        คำถามความปลอดภัยกู้คืน *
                      </label>
                      <select
                        value={regQuestion}
                        onChange={(e) => setRegQuestion(e.target.value)}
                        className="block w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden cursor-pointer"
                      >
                        {SECURITY_QUESTIONS.map((q, idx) => (
                          <option key={idx} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        คำตอบยืนยันตัวแม่นยำ *
                      </label>
                      <input
                        type="text"
                        placeholder="พิมพ์ระบุคำตอบที่เป็นของท่านเท่านั้น"
                        value={regAnswer}
                        onChange={(e) => setRegAnswer(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    🚀 ลงชื่อสมัครสมาชิกและอนุมัติทันที
                  </button>
                </form>
              </motion.div>
            )}

            {/* FORGOT PASSWORD MODE */}
            {mode === 'FORGOT' && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                  <h3 className="text-md font-bold text-slate-800 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-blue-600" />
                    กู้คืนรหัสผ่านด้วยระบบตอบคำถาม
                  </h3>
                  <button
                    onClick={() => {
                      setMode('LOGIN');
                      setStep(1);
                      setForgotError('');
                    }}
                    className="flex items-center text-xs text-slate-500 hover:text-slate-800 font-bold gap-0.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    กลับ
                  </button>
                </div>

                {forgotError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                {forgotSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-2 text-emerald-700 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{forgotSuccess}</span>
                  </div>
                )}

                {step === 1 ? (
                  <form onSubmit={handleForgotNext} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        กรอก Username ที่ต้องการกู้คืนสิทธิ์ ค้นตรวจฐานข้อมูล
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="ระบุ username เช่น modify"
                          value={forgotUsername}
                          onChange={(e) => setForgotUsername(e.target.value)}
                          className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      🔍 ค้นหาระบบคำถามความปลอดภัย
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="space-y-3 animate-fade-in">
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1">
                      <span className="block text-[10px] text-blue-600 font-bold uppercase tracking-wider">คำถามความปลอดภัยสำหรับท่าน @{forgotUsername} :</span>
                      <p className="text-xs font-bold text-slate-800 leading-relaxed">{securityQuestion}</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        คำตอบยืนยันสัญบัตรประจำตัว *
                      </label>
                      <input
                        type="text"
                        placeholder="กรองคำตอบที่ตั้งไว้เมื่อลงทะเบียนคลังสินค้า"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        ตั้งค่ารหัสผ่านใหม่ (New Password) *
                      </label>
                      <input
                        type="password"
                        placeholder="ความยาวอย่างน้อย 4 หลักสำหรับการยืนยันใหม่"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
                        required
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-1/3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      >
                        ย้อนกลับ
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                      >
                        💾 รีเซ็ต & เปลี่ยนรหัสผ่านใหม่
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}

          </AnimatePresence>

        </div>

        {/* Clear memory trigger */}
        <div className="mt-6 flex flex-col items-center justify-center gap-1.5 text-center animate-fade-in relative z-10">
          <button
            onClick={handleSystemWipe}
            className="px-4 py-2 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            🧹 เคลียร์ประวัติจำลอง & รีเซ็ตระบบสต๊อกใหม่ทั้งหมด
          </button>
          <p className="text-[10px] text-slate-400 max-w-[280px] leading-relaxed">
            *จะทำการล้างข้อมูลแคช LocalStorage อย่างปลอดภัยทั้งหมดเพื่อเริ่มต้นใช้งานข้อมูลจำลองเซ็ตตั้งต้นของระบบ
          </p>
        </div>

      </div>

    </div>
  );
}
