import { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  X, 
  Compass, 
  Share, 
  PlusSquare, 
  CheckCircle, 
  Monitor, 
  HelpCircle,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [installChoice, setInstallChoice] = useState<'success' | 'dismissed' | null>(null);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');

  useEffect(() => {
    // 1. Detect if the app is already running in standalone display mode (PWA installed & opened)
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                               (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        setIsVisible(false); // Hide prompt if already installed
      }
    };

    checkStandalone();

    // 2. Listen to the browser's PWA install banner request event (beforeinstallprompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('PWA: beforeinstallprompt event fired & saved!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Auto-detect platform to preset the guide tab
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setActiveTab('ios');
    } else if (/android/i.test(userAgent)) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    // Check if the user dismissed it before in this session
    const dismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (dismissed) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If native automatic prompt is not supported (e.g. iOS Safari, or line-in-app browser),
      // open our beautiful manual step-by-step modal guide!
      setShowManualModal(true);
      return;
    }

    // Show the browser's native installation prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA: User choice outcome is: ${outcome}`);

    if (outcome === 'accepted') {
      setInstallChoice('success');
      setDeferredPrompt(null);
      // Wait a bit and hide the banner
      setTimeout(() => {
        setIsVisible(false);
      }, 4000);
    } else {
      setInstallChoice('dismissed');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* 
        This is the sleek, floating action button (FAB) in the bottom-left corner 
        as requested by the user. It is styled beautifully and non-intrusive.
      */}
      <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-3 group select-none">
        {/* Pulsing Outer Background Glow */}
        <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md pointer-events-none group-hover:scale-125 transition-transform duration-300"></div>

        <div className="relative flex items-center">
          {/* Main Floating Button */}
          <button
            onClick={() => setShowManualModal(true)}
            className="w-13 h-13 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-full flex items-center justify-center shadow-2xl hover:shadow-blue-500/10 hover:scale-105 active:scale-95 transition-all duration-300 border border-slate-800 cursor-pointer relative"
            title="ติดตั้งแอปพลิเคชันมือถือ (PWA)"
          >
            {/* Subtle continuous ring pulse */}
            <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping pointer-events-none"></span>

            <Smartphone className="w-5 h-5 text-blue-400 relative z-10" />

            {/* Notification Badge indicator */}
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-blue-500 border border-slate-900 animate-pulse"></span>
          </button>

          {/* Dismiss Button */}
          <button 
            onClick={handleDismiss}
            className="absolute -top-1 -left-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 p-0.5 rounded-full transition-colors cursor-pointer z-20 shadow-lg"
            title="ซ่อนปุ่มนี้"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Informative Slide-in Tooltip */}
        <div className="bg-[#0f172a] border border-slate-800 text-white rounded-xl py-2 px-3.5 shadow-2xl pointer-events-none transition-all duration-300 origin-left scale-90 translate-x-1 opacity-0 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 hidden md:flex flex-col shrink-0 min-w-[210px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-blue-400 tracking-tight">📲 ติดตั้งแอปมือถือ (PWA)</span>
            <span className="text-[8px] bg-blue-500/10 text-blue-300 px-1.5 py-0.2 rounded-full border border-blue-500/20 font-bold font-sans uppercase">FREE</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-normal">สแกนพัสดุผ่านกล้องได้เร็วขึ้น & ลื่นไหล</p>
        </div>

        {/* Display native install outcome feedback inside the floating area as small popover if clicked */}
        {installChoice === 'success' && (
          <div className="absolute bottom-16 left-0 bg-emerald-950/95 text-emerald-300 text-[10px] p-2 rounded-lg border border-emerald-500/30 w-64 shadow-2xl leading-normal animate-fade-in font-medium">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-0.5">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>กำลังติดตั้งระบบลงเครื่องคุณ!</span>
            </div>
            <span>สลับไปใช้งานจากหน้าจอหลักได้เลยครับ 🎉</span>
          </div>
        )}
      </div>

      {/* 
        ========================================================================
        INTERACTIVE INSTALLATION GUIDE MODAL (POPUP)
        For absolute robust compatibility with Apple Safari, LINE In-App, and more
        ========================================================================
      */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden relative animate-scale-up">
            {/* Top color accent strip */}
            <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600"></div>

            {/* Close modal button */}
            <button 
              onClick={() => setShowManualModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600 shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    คู่มือการติดตั้งระบบลงเครื่องมือถือและพีซี (PWA)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    เพิ่มระบบสต๊อกเป็นแอปพลิเคชันบนหน้าแรกของโทรศัพท์เพื่อเปิดใช้งานเต็มหน้าจอและเร็วขึ้นเป็นเท่าตัว
                  </p>
                </div>
              </div>

              {/* Platform selector tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('android')}
                  className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'android' 
                      ? 'bg-white text-indigo-700 shadow-sm font-extrabold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Android / Samsung</span>
                </button>
                <button
                  onClick={() => setActiveTab('ios')}
                  className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'ios' 
                      ? 'bg-white text-indigo-700 shadow-sm font-extrabold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-blue-500" />
                  <span>iPhone (iOS Safari)</span>
                </button>
                <button
                  onClick={() => setActiveTab('desktop')}
                  className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'desktop' 
                      ? 'bg-white text-indigo-700 shadow-sm font-extrabold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 text-indigo-500" />
                  <span>คอมพิวเตอร์ / PC</span>
                </button>
              </div>

              {/* Step instructions */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-slate-600 text-xs leading-relaxed space-y-4">
                {activeTab === 'android' && (
                  <div className="space-y-3">
                    <p className="font-bold text-indigo-950 flex items-center gap-1">
                      <Info className="w-4 h-4 text-indigo-600" />
                      <span>วิธีติดตั้งสำหรับ Android (Chrome / Samsung Internet):</span>
                    </p>
                    <ol className="space-y-2.5 pl-0 list-none">
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                        <span>คัดลอกลิงก์ของระบบนี้ ไปเปิดในแอปเบราว์เซอร์ <b>Google Chrome</b> (หลีกเลี่ยงการใช้งานหน้าต่างย่อยภายในไลน์ เพราะระบบจะห้ามดาวน์โหลดแอปภายนอก)</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                        {deferredPrompt ? (
                          <span>กดปุ่ม <b>"ติดตั้งแอปพลิเคชัน"</b> สีน้ำเงินในหน้านี้ ระบบจะขึ้นหน้าต่างให้กดยืนยันการติดตั้งทันที</span>
                        ) : (
                          <span>กดสัญลักษณ์ <b>จุดสามจุด (⋮)</b> แถบขวาบนของหน้าจอ Chrome จากนั้นหาเมนู <b>"ติดตั้งแอป (Install App)"</b> หรือ <b>"เพิ่มไปยังหน้าจอหลัก (Add to Home screen)"</b></span>
                        )}
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                        <span>กดยืนยันติดตั้ง แล้วรอ 5-10 วินาที ไอคอนแอปพลิเคชันระบบสต๊อกจะปรากฏบนหน้ารายชื่อแอปมือถือของคุณครับ</span>
                      </li>
                    </ol>
                  </div>
                )}

                {activeTab === 'ios' && (
                  <div className="space-y-3">
                    <p className="font-bold text-indigo-950 flex items-center gap-1">
                      <Info className="w-4 h-4 text-indigo-600" />
                      <span>วิธีติดตั้งสำหรับ Apple iOS (iPhone / iPad Safari):</span>
                    </p>
                    <div className="bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200 text-[11px] leading-relaxed">
                      💡 Apple iOS บังคับให้ติดตั้งแบบ Manual ด้วยเหตุผลด้านความเป็นส่วนตัว โปรดทำตามขั้นตอนนี้ใน 15 วินาที:
                    </div>
                    <ol className="space-y-2.5 pl-0 list-none">
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                        <span>หากเปิดมาจากแอป LINE ให้กดสัญลักษณ์ <b>แชร์/จุดสามจุดด้านขวาบน</b> แล้วเลือก <b>"เปิดใน Safari" (Open in Safari)</b> เท่านั้น</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          กดปุ่ม <b>"แชร์" (Share)</b> <Share className="w-3.5 h-3.5 text-blue-500 inline inline-block" /> หรือแถบลูกศรชี้ขึ้นที่ขอบจอล่างสุดของหน้าจอ Safari
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          เลื่อนรายชื่อฟังก์ชั่นลงด้านล่างจนพบปุ่ม <b>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</b> <PlusSquare className="w-3.5 h-3.5 text-slate-600 inline inline-block" />
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                        <span>ตั้งชื่อระบบ เช่น "StockMan AI" แล้วกด <b>"เพิ่ม" (Add)</b> ที่มุมขวาบน จะปรากฏไอคอนแอปบนหน้าแรกทันที!</span>
                      </li>
                    </ol>
                  </div>
                )}

                {activeTab === 'desktop' && (
                  <div className="space-y-3">
                    <p className="font-bold text-indigo-950 flex items-center gap-1">
                      <Info className="w-4 h-4 text-indigo-600" />
                      <span>วิธีติดตั้งสำหรับ คอมพิวเตอร์ / โน้ตบุ๊ค (PC & Mac):</span>
                    </p>
                    <ol className="space-y-2.5 pl-0 list-none">
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                        <span>เปิดแอปนี้ด้วยเบราว์เซอร์ <b>Google Chrome, Microsoft Edge, Brave</b> หรือ <b>Opera</b></span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                        <span>มองหาไอคอน <b>"รูปจอคอมพิวเตอร์พร้อมสัญลักษณ์ดาวน์โหลด"</b> หรือ <b>เครื่องหมายบวก (+)</b> บริเวณขวาสุดของช่องกรอกลิงก์เว็บด้านบน (Address bar)</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="bg-indigo-100 text-indigo-800 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                        <span>คลิกไอคอนดังกล่าวเพื่อติดตั้งเป็นแอปเดสก์ท็อป จะปรากฏช็อตคัตไอคอนที่หน้าจอหลักคอมพิวเตอร์ของคุณ</span>
                      </li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Footer action */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowManualModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors"
                >
                  เข้าใจแล้ว ปิดหน้าต่าง
                </button>
                {deferredPrompt && (
                  <button
                    onClick={() => {
                      setShowManualModal(false);
                      handleInstallClick();
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>กดติดตั้งอัตโนมัติ</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
