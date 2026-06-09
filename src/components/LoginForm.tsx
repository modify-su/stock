import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, HelpCircle, ArrowRight, ShieldCheck, RefreshCw, KeyRound, Check } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (user: any) => void;
  appSettings: {
    logoUrl: string;
    logoText: string;
    loginBgColor: string;
    loginTitle: string;
  };
}

export default function LoginForm({ onLoginSuccess, appSettings }: LoginFormProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration States
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('ชื่อครูคนแรกของคุณคือชื่อว่าอะไร?');
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Forgot Password States
  const [forgotUsername, setForgotUsername] = useState('');
  const [retrievedQuestion, setRetrievedQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  // General States
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear messages on transition
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [activeTab]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      let data: any;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่เป็น JSON (${res.status}): ${text.substring(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data.message || 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล');
      }
      setSuccess(data.message);
      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQuestion = securityQuestion === 'other' ? customQuestion : securityQuestion;

    if (!regUsername || !regPassword || !finalQuestion || !securityAnswer) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          securityQuestion: finalQuestion,
          securityAnswer
        })
      });
      
      let data: any;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่เป็น JSON (${res.status}): ${text.substring(0, 150)}`);
      }

      if (!res.ok) {
        throw new Error(data.message || 'การลงทะเบียนล้มเหลว');
      }
      setSuccess(data.message);
      // If approved, send user directly or let them log in
      setTimeout(() => {
        setActiveTab('signin');
        setUsername(regUsername);
        setPassword(regPassword);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get user's security question
  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername) {
      setError('กรุณากรอกชื่อผู้ใช้เพื่อค้นหาบัญชี');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/security-question/${forgotUsername}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ไม่พบชื่อผู้ใช้นี้ในคลังข้อมูล');
      }
      setRetrievedQuestion(data.question);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset password using answer
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotAnswer || !newPassword) {
      setError('กรุณากรอกข้อมูลคำตอบสำหรับรีเซ็ตและรหัสผ่านใหม่');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUsername,
          securityAnswer: forgotAnswer,
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ข้อมูลการคำนวณสิทธิ์ไม่ถูกต้อง');
      }
      setSuccess(data.message);
      setTimeout(() => {
        setActiveTab('signin');
        setUsername(forgotUsername);
        setPassword(newPassword);
        setStep(1);
        setForgotUsername('');
        setForgotAnswer('');
        setNewPassword('');
      }, 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 backdrop-blur-sm relative" id="login-screen">
      <div 
        className="absolute inset-0 z-0 transition-all duration-700" 
        style={{ background: appSettings.loginBgColor || 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}
      />
      
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] z-0 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl"
        id="login-card"
      >
        <div className="p-8 pb-4 text-center">
          <div className="flex justify-center mb-4">
            {appSettings.logoUrl ? (
              <img 
                src={appSettings.logoUrl} 
                alt="Logo" 
                className="h-16 w-auto object-contain rounded-xl"
                referrerPolicy="no-referrer"
                id="login-logo-img"
              />
            ) : (
              <div className="h-16 w-16 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-md border border-cyan-300">
                📦
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase" id="login-app-logo-text">
            {appSettings.logoText || 'STOCKMASTER'}
          </h1>
          <p className="text-slate-500 text-sm mt-1" id="login-app-subtitle">
            {appSettings.loginTitle || 'ระบบจัดการสต็อกสินค้าอัจฉริยะ'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 px-6">
          <button 
            onClick={() => setActiveTab('signin')} 
            className={`flex-1 py-3 text-sm font-bold tracking-wide border-b-2 transition-all cursor-pointer ${activeTab === 'signin' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            id="btn-tab-signin"
          >
            เข้าสู่ระบบ
          </button>
          <button 
            onClick={() => setActiveTab('signup')} 
            className={`flex-1 py-3 text-sm font-bold tracking-wide border-b-2 transition-all cursor-pointer ${activeTab === 'signup' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            id="btn-tab-signup"
          >
            ลงทะเบียน
          </button>
          <button 
            onClick={() => setActiveTab('forgot')} 
            className={`flex-1 py-3 text-xs font-bold tracking-wide border-b-2 transition-all cursor-pointer ${activeTab === 'forgot' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            id="btn-tab-forgot"
          >
            ลืมรหัสผ่าน
          </button>
        </div>

        {/* Message Feeds */}
        <div className="px-8 mt-4 select-none">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium"
                id="login-error-alert"
              >
                ⚠️ {error}
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 font-medium"
                id="login-success-alert"
              >
                <Check className="h-4 w-4 text-emerald-600" />
                {success}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tab Forms */}
        <div className="p-8 pt-4">
          <AnimatePresence mode="wait">
            {activeTab === 'signin' && (
              <motion.form 
                key="signin"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                onSubmit={handleSignIn}
                className="space-y-4"
                id="form-signin"
              >
                <div>
                  <label className="text-slate-600 text-xs font-bold block mb-1">ชื่อผู้ใช้งาน (Username)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition"
                      placeholder="เช่น admin, staff"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      id="input-login-username"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-600 text-xs font-bold block">รหัสผ่าน (Password)</label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      id="input-login-password"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 mt-2 cursor-pointer"
                  id="btn-login-submit"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'เข้าสู่คลังสินค้า'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 space-y-1 font-medium">
                  <span className="font-bold text-cyan-600 block">บัญชีทดสอบที่สามารถเข้าได้ทันที:</span>
                  <div>• สิทธิ์ผู้ดูแล: <b className="text-slate-800">admin</b> / รหัสผ่าน: <b className="text-slate-800 font-mono">admin123</b></div>
                  <div>• สิทธิ์ทีมสต็อก: <b className="text-slate-800">staff</b> / รหัสผ่าน: <b className="text-slate-800 font-mono">staff123</b></div>
                </div>
              </motion.form>
            )}

            {activeTab === 'signup' && (
              <motion.form 
                key="signup"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                onSubmit={handleSignUp}
                className="space-y-3.5"
                id="form-signup"
              >
                <div>
                  <label className="text-slate-600 text-xs font-bold block mb-1">ขื่อผู้ใช้งานใหม่ (Username)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      placeholder="ตัวอักษรภาษาอังกฤษหรือตัวเลข"
                      value={regUsername}
                      onChange={e => setRegUsername(e.target.value)}
                      id="input-reg-username"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 text-xs font-bold block mb-1">รหัสผ่าน (Password)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-505 focus:bg-white transition"
                      placeholder="ขั้นต่ำ 4 ตัวอักษร"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      id="input-reg-password"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 text-xs font-bold block mb-1">คำถามความปลอดภัย (สำหรับกู้รหัสผ่าน)</label>
                  <select 
                    value={securityQuestion}
                    onChange={e => setSecurityQuestion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    id="select-reg-question"
                  >
                    <option value="ชื่อเมืองที่คุณเกิดคืออะไร?">ชื่อเมืองที่คุณเกิดคืออะไร?</option>
                    <option value="สีที่คุณชอบที่สุดคืออะไร?">สีที่คุณชอบที่สุดคืออะไร?</option>
                    <option value="ชื่อสัตว์เลี้ยงตัวแรกคืออะไร?">ชื่อสัตว์เลี้ยงตัวแรกคืออะไร?</option>
                    <option value="ชื่อครูคนแรกของคุณคือชื่อว่าอะไร?">ชื่อครูคนแรกของคุณคือชื่อว่าอะไร?</option>
                    <option value="other">ตั้งคำถามเอง...</option>
                  </select>
                </div>

                {securityQuestion === 'other' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <label className="text-slate-600 text-xs font-bold block mb-1">พิมพ์คำถามของคุณ</label>
                    <div className="relative">
                      <HelpCircle className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                        placeholder="คำถามส่วนตัวของคุณ..."
                        value={customQuestion}
                        onChange={e => setCustomQuestion(e.target.value)}
                        id="input-reg-custom-question"
                      />
                    </div>
                  </motion.div>
                )}

                <div>
                  <label className="text-slate-600 text-xs font-bold block mb-1">คำตอบ (Security Answer)</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      placeholder="กรอกคำตอบของคุณเป็นภาษาไทย/อังกฤษ"
                      value={securityAnswer}
                      onChange={e => setSecurityAnswer(e.target.value)}
                      id="input-reg-answer"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2 cursor-pointer"
                  id="btn-register-submit"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'ลงทะเบียนและขออนุมัติสิทธิ์'}
                </button>
              </motion.form>
            )}

            {activeTab === 'forgot' && (
              <motion.div 
                key="forgot"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="space-y-4"
              >
                {step === 1 ? (
                  <form onSubmit={handleFetchQuestion} className="space-y-4" id="form-forgot-step1">
                    <p className="text-slate-500 text-xs leading-relaxed font-medium">
                      เพียงระบุชื่อผู้ใช้ของคุณ เพื่อค้นหาบัญชีและเรียกดูคำถามความปลอดภัยที่คุณเคยตั้งไว้
                    </p>
                    <div>
                      <label className="text-slate-600 text-xs font-bold block mb-1">ชื่อผู้ใช้งาน (Username)</label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                          placeholder="กรอกชื่อผู้ใช้ที่ต้องการดึงคำถาม"
                          value={forgotUsername}
                          onChange={e => setForgotUsername(e.target.value)}
                          id="input-forgot-username"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                      id="btn-forgot-find"
                    >
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'ค้นหาคำถามความปลอดภัย'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4" id="form-forgot-step2">
                    <div className="p-3 bg-amber-50 border border-amber-250 text-amber-900 rounded-xl font-medium">
                      <span className="text-[10px] text-amber-700 font-bold block uppercase">คำถามความปลอดภัยของคุณ:</span>
                      <p className="text-sm font-semibold select-all mt-1">🤔 "{retrievedQuestion}"</p>
                    </div>

                    <div>
                      <label className="text-slate-600 text-xs font-bold block mb-1">กรอกคำตอบของคุณ (Security Answer)</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                          placeholder="คำตอบของคุณ..."
                          value={forgotAnswer}
                          onChange={e => setForgotAnswer(e.target.value)}
                          id="input-forgot-answer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-600 text-xs font-bold block mb-1">ตั้งรหัสผ่านใหม่ (New Password)</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          type="password"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-405 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                          placeholder="รหัสผ่านใหม่ที่จำได้ง่าย"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          id="input-forgot-newpw"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex-1 text-slate-500 bg-white border border-slate-200 text-xs py-2 rounded-xl hover:text-slate-800 transition cursor-pointer"
                        id="btn-forgot-back"
                      >
                        ย้อนกลับ
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition disabled:opacity-50 cursor-pointer"
                        id="btn-forgot-reset-submit"
                      >
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'รีเซ็ตและเปลี่ยนรหัสผ่าน'}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
