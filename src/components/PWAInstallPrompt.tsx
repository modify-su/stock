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
    if (isStandalone) {
      return (
        <div className="bg-emerald-950/90 border border-emerald-800 text-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between shadow-xs max-w-7xl mx-auto mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-100">เปิดใช้งานในรูปแบบแอปพลิเคชัน (PWA) เรียบร้อยแล้ว! รวดเร็วและใช้กล้องสแกนได้ลื่นไหล</span>
          </div>
          <span className="font-mono text-[9px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded-full font-bold">STANDALONE APP</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto mb-4 relative">
      {/* 
        This is the sleek, dark, high-contrast PWA card custom-designed to match 
        the user's exact uploaded layout & reference.
      */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 md:p-5 text-white shadow-xl relative overflow-hidden transition-all duration-300">
        
        {/* Background ambient radial glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Dismiss Button */}
        <button 
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800/80 transition-colors cursor-pointer z-10"
          title="ปิดแบนเนอร์ชั่วคราว"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-5">
          {/* Header & Description */}
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-600/15 rounded-xl border border-blue-500/20 shrink-0 self-center">
              <Smartphone className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-[15px] md:text-base font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
                  พร้อมติดตั้งบนอุปกรณ์นี้
                </h3>
                <span className="text-[9px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                  แอปพลิเคชัน PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                ติดตั้งระบบเพื่อให้เปิดใช้งานได้รวดเร็วดุจแอปจริงบนมือถือและพีซีของคุณ สแกนลื่นขึ้น ไม่หนักพื้นที่เครื่อง
              </p>
            </div>
          </div>

          {/* Action Button & Instructions Link */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowManualModal(true)}
              className="text-slate-400 hover:text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-1 cursor-pointer border border-transparent hover:border-slate-750"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>คู่มือการติดตั้งแมนนวล</span>
            </button>

            <button
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-blue-500 hover:scale-[1.02]"
            >
              <Download className="w-4 h-4" />
              <span>ติดตั้งแอปพลิเคชัน</span>
            </button>
          </div>
        </div>

        {/* Show interactive status feedbacks */}
        {installChoice === 'success' && (
          <div className="mt-3 bg-emerald-950/50 text-emerald-300 text-[11px] p-2 rounded-lg border border-emerald-500/30 flex items-center gap-2 font-medium">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>กำลังรันการติดตั้งระบบลงในเครื่องคุณเรียบร้อย! สามารถสลับไปเปิดแอปจากไอคอนบนหน้าแรกได้เลยครับ 🎉</span>
          </div>
        )}

        {installChoice === 'dismissed' && (
          <div className="mt-2 text-[10px] text-amber-400/90 font-medium">
            * การติดตั้งอัตโนมัติแบบคลิกเดียวถูกปัดผ่าน หากต้องการติดตั้งในภายหลังสามารถเปิดผ่าน "คู่มือการติดตั้งแมนนวล" ได้ตลอดเวลาครับ
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
    </div>
  );
}
