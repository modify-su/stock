import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Cpu,
  Clipboard,
  Check,
  Settings,
  HelpCircle,
  Info,
  ExternalLink,
  RefreshCw,
  Sliders,
  ShieldAlert,
  User,
  Bot
} from 'lucide-react';
import { AppSettings, Product, UserProfile } from '../types';

interface LineBotSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => Promise<void>;
  products: Product[];
  currentUser: UserProfile;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export default function LineBotSettings({
  settings,
  onUpdateSettings,
  products,
  currentUser
}: LineBotSettingsProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'prompt' | 'simulator' | 'guide'>('config');

  // LINE configuration states
  const [lineBotEnabled, setLineBotEnabled] = useState(settings.lineBotEnabled ?? false);
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState(settings.lineChannelAccessToken ?? '');
  const [lineChannelSecret, setLineChannelSecret] = useState(settings.lineChannelSecret ?? '');
  const [lineBotSystemPrompt, setLineBotSystemPrompt] = useState(settings.lineBotSystemPrompt ?? '');

  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Chat simulator states
  const [simulatedMessages, setSimulatedMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'สวัสดีครับ! ยินดีต้อนรับสู่ระบบจำลองบอทคลังสินค้าอัจฉริยะ (Gemini AI Simulator) ลองพิมพ์ถามเกี่ยวกับสินค้า สต๊อกใกล้หมด หรือทักทายได้เลยครับ! 📦',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [debugPrompt, setDebugPrompt] = useState('');
  const [showDebugPrompt, setShowDebugPrompt] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll simulated chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simulatedMessages, isGenerating]);

  // Sync state with settings prop when it loads or changes
  useEffect(() => {
    setLineBotEnabled(settings.lineBotEnabled ?? false);
    setLineChannelAccessToken(settings.lineChannelAccessToken ?? '');
    setLineChannelSecret(settings.lineChannelSecret ?? '');
    setLineBotSystemPrompt(settings.lineBotSystemPrompt ?? '');
  }, [settings]);

  const hasSettingsPermission = currentUser.role === 'ADMIN';

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSettingsPermission) return;

    try {
      await onUpdateSettings({
        ...settings,
        lineBotEnabled,
        lineChannelAccessToken: lineChannelAccessToken.trim(),
        lineChannelSecret: lineChannelSecret.trim(),
        lineBotSystemPrompt: lineBotSystemPrompt.trim()
      });
      setSaveSuccessMessage('💾 บันทึกการกำหนดค่า LINE Bot & Gemini AI สำเร็จเรียบร้อยแล้ว!');
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกค่า');
    }
  };

  const handleCopyWebhook = () => {
    const url = `${window.location.origin}/api/line-webhook`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Predefined prompts for simulator
  const presetsPrompt = [
    { label: '👋 สวัสดีทักทาย', text: 'สวัสดี' },
    { label: '⚠️ เช็คสินค้าสต๊อกเหลือน้อย', text: 'เช็คสต๊อกใกล้หมดคลัง' },
    { label: '📊 รายงานสรุปสต๊อกทั้งหมด', text: 'สรุปภาพรวมสต๊อกสินค้า' },
    { label: '🔍 ค้นหาสินค้าตามคีย์เวิร์ด', text: products.length > 0 ? `เช็คสต๊อก ${products[0].name}` : 'เช็คสินค้าเสื้อ' },
    { label: '📍 ถามหาพิกัดชั้นจัดเก็บ', text: products.length > 0 ? `ชั้นวางสินค้าชิ้น ${products[0].name} อยู่ที่ไหน` : 'สินค้าเก็บอยู่ชั้นไหน' }
  ];

  // Simulator chatbot fetch handler
  const handleSimulateChat = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };

    setSimulatedMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/simulate-line-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textToSend,
          systemPromptTemplate: lineBotSystemPrompt || settings.lineBotSystemPrompt,
          products: products
        })
      });

      if (!response.ok) {
        throw new Error('เซิร์ฟเวอร์วิเคราะห์ล้มเหลว หรือคีย์ Gemini ไม่พร้อมใช้งาน');
      }

      const data = await response.json();
      
      setSimulatedMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      }]);

      if (data.finalPrompt) {
        setDebugPrompt(data.finalPrompt);
      }
    } catch (err: any) {
      setSimulatedMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `⚠️ ขัดข้องชั่วคราว: ไม่สามารถดึงการวิเคราะห์ตอบกลับจาก Gemini AI ได้ในขณะนี้\n(เหตุผล: ${err.message || 'ไม่มีข้อมูลรายละเอียดข้อผิดพลาดเพิ่มเติม'})`,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Prompts custom presets loader
  const applyPromptPreset = (type: 'friendly' | 'polite' | 'concise') => {
    if (type === 'friendly') {
      setLineBotSystemPrompt(`คุณคือผู้ดูแลบอร์ดจัดการคลังสินค้าอัจฉริยะประมวลผลด้วย AI (Warehouse Stock Assistant Bot) สื่อสารผ่านแอพ LINE ด้วยภาษาไทยที่เป็นมิตร สนุกสนาน คอยช่วยเหลือด้วยความกระตือรือร้น

นี่คือข้อมูลคงคลังสินค้าล่าสุดจริงภายในระบบ (เรียลไทม์):
{{productsContext}}

พนักงานหรือผู้ใช้พิมพ์คำถามว่า: "{{text}}"

โปรดทำตามข้อตกลงในการวิเคราะห์ข้อมูลเพื่อตอบพนักงาน:
1. หากทักทาย ให้ทักทายอย่างสดใส "สวัสดีจ้าเพื่อนพนักงาน! ยินดีต้อนรับสู่สต๊อกบอทอัจฉริยะจ้า! 🚀" และอธิบายสิ่งที่บอททำได้
2. หากพิมพ์เกี่ยวกับสต๊อกเหลือน้อย ให้รวบรวมข้อมูลด้วยสัญญาลักษณ์แจ้งเตือนเด่นชัด ⚠️ พร้อมแนะนำให้รีบทำใบสั่งซื้อ
3. สรุปรายละเอียดกระชับ อ่านง่าย เหมาะสำหรับอ่านบนหน้าจอมือถือ
4. ลงท้ายอย่างเป็นมิตร เสนอตัวช่วยเสมอ เช่น "พิมพ์ถามข้ออื่นเพิ่มเติมได้เลยน้า ยินดีบริการจ้า! 😊"`);
    } else if (type === 'polite') {
      setLineBotSystemPrompt(`คุณคือผู้ดูแลบอร์ดจัดการคลังสินค้าอัจฉริยะประมวลผลด้วย AI (Warehouse Stock Assistant Bot) สื่อสารผ่านแอพ LINE ด้วยภาษาไทยที่สุภาพ เรียบร้อย อ่อนโยน มีความเป็นมืออาชีพสูง ลงท้ายด้วย "ครับ/ค่ะ" ทุกข้อความ

นี่คือข้อมูลคงคลังสินค้าล่าสุดจริงภายในระบบ (เรียลไทม์):
{{productsContext}}

พนักงานหรือผู้ใช้พิมพ์คำถามว่า: "{{text}}"

โปรดทำตามข้อตกลงในการวิเคราะห์ข้อมูลเพื่อตอบพนักงาน:
1. หากทักทาย ให้ทักทายกลับด้วยความอ่อนน้อม สุภาพ เช่น "สวัสดีครับ/ค่ะ ยินดีต้อนรับสู่ระบบตรวจสต๊อกคลังสินค้าอัจฉริยะครับ..."
2. หากพิมพ์เกี่ยวกับสต๊อกเหลือน้อย ให้จัดทำรายงานอย่างเป็นระเบียบ เรียบร้อย ชัดเจน และระบุจำนวนขั้นต่ำให้พนักงานทราบอย่างแม่นยำ
3. แสดงผลด้วยข้อความจัดกลุ่ม จัดย่อหน้าเรียบร้อย สวยงาม`);
    } else if (type === 'concise') {
      setLineBotSystemPrompt(`คุณคือผู้ดูแลบอร์ดจัดการคลังสินค้าอัจฉริยะประมวลผลด้วย AI (Warehouse Stock Assistant Bot) ตอบพนักงานสั้นๆ ได้ใจความที่สุด ไม่พูดยาวเกินจำเป็น เพื่อประหยัดพื้นที่ในช่องแชต LINE

นี่คือข้อมูลคงคลังสินค้าล่าสุดจริงภายในระบบ (เรียลไทม์):
{{productsContext}}

พนักงานหรือผู้ใช้พิมพ์คำถามว่า: "{{text}}"

โปรดทำตามข้อตกลงในการวิเคราะห์ข้อมูลเพื่อตอบพนักงาน:
1. ห้ามเกริ่นทักทายยาวเกิน 1 บรรทัด
2. ตอบคำถามตรงประเด็นทันทีด้วยตัวเลขและข้อมูลสำคัญ เช่น ชื่อสินค้า คงเหลือ และ พิกัด เท่านั้น ไม่ต้องพูดประโยคสรุปอื่นๆ ยืดยาว
3. นำเสนอข้อมูลในรูปแบบลิสต์สั้นๆ ไร้คำฟุ่มเฟือย`);
    }
  };

  return (
    <div id="line-bot-panel" className="space-y-6">
      
      {/* 1. Feature Title Block */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-xs shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
                <span>บอทถามตอบแชตอัตโนมัติ (LINE Bot & Gemini AI)</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  AI Powered
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                ตั้งค่าระบบตอบกลับข้อมูลคงคลังอัตโนมัติผ่านแชตแอป LINE เชื่อมโยง Gemini AI ช่วยดึงข้อมูลและรายงานสต๊อกแบบเรียลไทม์
              </p>
            </div>
          </div>
        </div>
        
        {/* Status indicator pill */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <span className="text-xs font-semibold text-slate-500">สถานะระบบ:</span>
          {lineBotEnabled ? (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>เปิดทำงาน (ACTIVE)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>ปิดทำงาน (INACTIVE)</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto scrollbar-none bg-slate-100/60 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'config'
              ? 'bg-white text-slate-850 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>1. เชื่อมต่อระบบ LINE API</span>
        </button>
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'prompt'
              ? 'bg-white text-slate-850 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>2. ปรับแต่งคำสั่งบอท AI</span>
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-white text-slate-850 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>3. ห้องทดลองแชตบอท (Playground)</span>
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'guide'
              ? 'bg-white text-slate-850 shadow-xs border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>4. คู่มือการเซ็ตติ้ง Rich Menu</span>
        </button>
      </div>

      {/* Success Notifications */}
      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Tab Contents */}

      {/* TAB 1: Config */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: Form fields */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span>ข้อมูลการเชื่อมโยงเครือข่าย LINE</span>
            </h3>

            {/* Checkbox */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="block text-xs font-bold text-slate-700">สวิตช์เปิดทำงาน LINE Bot</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  เมื่อเปิดใช้งาน ระบบจะสามารถตอบกลับข้อความจากแชต LINE OA ได้ทันที
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={lineBotEnabled}
                  onChange={(e) => hasSettingsPermission && setLineBotEnabled(e.target.checked)}
                  disabled={!hasSettingsPermission}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Access token */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">
                LINE Channel Access Token (Long-lived) *
              </label>
              <input
                type="password"
                placeholder="ใส่ Channel Access Token ที่ออกและยืนยันจากหน้าแชนเนล Messaging API"
                value={lineChannelAccessToken}
                onChange={(e) => setLineChannelAccessToken(e.target.value)}
                disabled={!hasSettingsPermission}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 focus:outline-hidden disabled:opacity-60"
                required={lineBotEnabled}
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                โทเค็นสำหรับการส่งและตอบกลับข้อความ คัดลอกได้จากแท็บ Messaging API ของช่องบัญชีคุณ
              </p>
            </div>

            {/* Secret */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">
                LINE Channel Secret (รหัสลับยืนยันความปลอดภัย)
              </label>
              <input
                type="password"
                placeholder="ใส่ Channel Secret เพื่อตรวจสอบ Signature ป้องกันการส่งข้อมูลปลอม"
                value={lineChannelSecret}
                onChange={(e) => setLineChannelSecret(e.target.value)}
                disabled={!hasSettingsPermission}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 focus:outline-hidden disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                ใช้ในกระบวนการตรวจสอบ Signature ยืนยันว่าคำขอมาจากระบบเซิร์ฟเวอร์ LINE ป้องกันผู้ไม่ประสงค์ดี
              </p>
            </div>

            {/* Save trigger */}
            {hasSettingsPermission ? (
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
              >
                💾 บันทึกสัญญารับข้อมูลและค่าเชื่อมต่อ
              </button>
            ) : (
              <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-[10.5px] text-red-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>คุณไม่มีสิทธิ์ในการแก้ไขค่าตั้งค่าระบบบอทเฉพาะเจาะจง (เฉพาะแอดมินเท่านั้น)</span>
              </div>
            )}
          </div>

          {/* Right panel: Webhook and Setup manual */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Webhook Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>เว็บบอร์ดปลายทาง Webhook URL</span>
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  นำลิงก์ข้างล่างนี้ไปวางกรอกใส่กล่อง Webhook URL ใน LINE Developers Console ของแชนเนลนั้น
                </p>
              </div>

              <div className="p-3 border border-slate-200 bg-slate-50 rounded-lg flex items-center justify-between gap-2 overflow-hidden">
                <span className="font-mono text-emerald-600 font-bold text-[10.5px] truncate select-all">
                  {window.location.origin}/api/line-webhook
                </span>
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="px-2.5 py-1.5 bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded text-xs font-bold cursor-pointer shrink-0 inline-flex items-center gap-1 transition-all"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick manual */}
            <div className="bg-slate-900 text-slate-300 rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>ขั้นตอนเชื่อมต่อด่วนใน 3 นาที</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-2 text-[11px] text-slate-400 leading-relaxed">
                <li>
                  ลงทะเบียนเป็นผู้พัฒนาที่เว็บ{' '}
                  <a href="https://developers.line.biz/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-bold">
                    <span>LINE Developers</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </li>
                <li>สร้าง Provider และเพิ่มแชนเนลชนิด **Messaging API**</li>
                <li>ไปที่แท็บ **Messaging API** คลิกเปิดใช้งานบริการ ออกโทเค็นยาว (Channel Access Token) มาบันทึกด้านซ้าย</li>
                <li>นำ **Webhook URL** ด้านบนไปกรอกวาง พร้อมสวิตช์เปิดใช้ **Use Webhook** และเปิดให้ผู้รับตอบกลับ</li>
                <li>
                  <span className="text-amber-400 font-semibold">ข้อความแจ้งเตือนปุ่มตรวจสอบ (Verify):</span>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                    เนื่องจากการทดสอบระบบบนสภาพแวดล้อม Sandbox มีรหัสผ่าน Google OAuth ป้องกันความปลอดภัย จึงแนะนำให้สแกนแอดเพิ่มบอทในแอป LINE แล้วลองพิมพ์ทดสอบจริงเลยเพื่อความสะดวกสูงสุด!
                  </p>
                </li>
              </ol>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: AI Prompt Customizer */}
      {activeTab === 'prompt' && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-xs">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>ปรับบุคลิกภาพและการรายงานของบอท AI (System Prompt)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เขียนข้อบังคับ โทนเสียง และเงื่อนไขให้บอทประมวลผลดึงสต๊อกมาเรียบเรียงตอบคำถามพนักงานตามจินตนาการ
              </p>
            </div>
            
            {/* Preset selectors */}
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <span className="text-xs font-semibold text-slate-400 self-center mr-1">เลือกเทมเพลตด่วน:</span>
              <button
                type="button"
                onClick={() => applyPromptPreset('friendly')}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold cursor-pointer transition-all"
              >
                😊 สไตล์เป็นกันเอง
              </button>
              <button
                type="button"
                onClick={() => applyPromptPreset('polite')}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition-all"
              >
                💼 สไตล์สุภาพเรียบร้อย
              </button>
              <button
                type="button"
                onClick={() => applyPromptPreset('concise')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold cursor-pointer transition-all"
              >
                ⚡ สไตล์กระชับด่วน
              </button>
            </div>
          </div>

          {/* Prompt textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>คำสั่งระบุลักษณะการคิด (Prompt Instruction):</span>
              <span className="text-[10px] text-slate-400 font-normal">
                แนะให้คงตัวแปรสัญลักษณ์ไว้ เพื่อให้ระบบนำข้อมูลคลังล่าสุดใส่เชื่อมโยงจริง
              </span>
            </div>
            <textarea
              value={lineBotSystemPrompt}
              onChange={(e) => setLineBotSystemPrompt(e.target.value)}
              disabled={!hasSettingsPermission}
              placeholder="กรอกชุดคำสั่งจัดเตรียมข้อความ..."
              rows={12}
              className="w-full px-3.5 py-3 text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 focus:outline-hidden disabled:opacity-60 leading-relaxed font-mono"
            />
          </div>

          {/* Guide boxes on tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-800">
            <div>
              <p className="font-bold flex items-center gap-1 mb-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>ตัวแปรข้อมูลแทรกอัตโนมัติ (Dynamic Tags)</span>
              </p>
              <ul className="space-y-1.5 text-[11px] text-emerald-700 list-disc pl-4">
                <li>
                  <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-mono font-bold">{"{{productsContext}}"}</code>
                  <span className="ml-1">ระบบจะแทนที่ด้วยลิสต์รายละเอียดและรหัส SKU สินค้าคงคลังในร้านล่าสุดทั้งหมดทันที</span>
                </li>
                <li>
                  <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-mono font-bold">{"{{text}}"}</code>
                  <span className="ml-1">จะถูกแทนที่ด้วยข้อความแชตสดๆ ที่ผู้ใช้หรือพนักงานพิมพ์ถามเข้ามาทาง LINE</span>
                </li>
              </ul>
            </div>
            <div className="space-y-1.5 text-[11px] text-emerald-700">
              <p className="font-bold flex items-center gap-1 text-emerald-800">
                <Info className="w-4 h-4 text-emerald-600" />
                <span>คำแนะนำเพิ่มเติมจาก AI Expert</span>
              </p>
              <p className="leading-relaxed">
                การเว้นบรรทัดบ่อยๆ และสรุปยอดเป็นรูปแบบ Bullet Point ใน Prompt จะช่วยให้คำตอบที่แสดงผลทางห้องแชตหน้าจอมือถืออ่านง่าย กระชับ สะดวกสบายตา และลดการเลื่อนจอลงได้สูงมากเลยครับ!
              </p>
            </div>
          </div>

          {/* Save Button */}
          {hasSettingsPermission && (
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
            >
              💾 ทำการบันทึกแก้ไข Prompt บอท AI
            </button>
          )}
        </form>
      )}

      {/* TAB 3: Interactive Simulator Playground */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left: Chat simulator phone mock */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md flex flex-col h-[520px]">
              
              {/* Phone Header styled like LINE Chatroom */}
              <div className="bg-[#1C2C4C] p-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#1C2C4C] rounded-full" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-sans">Warehouse Bot (Simulated)</h4>
                    <span className="text-[10px] text-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>พร้อมตอบคำถามเรียลไทม์ ด้วยพลัง AI</span>
                    </span>
                  </div>
                </div>
                
                {/* Clear chat icon */}
                <button
                  type="button"
                  onClick={() => setSimulatedMessages([
                    {
                      id: '1',
                      sender: 'bot',
                      text: 'สวัสดีครับ! ยินดีต้อนรับสู่ระบบจำลองบอทคลังสินค้าอัจฉริยะ (Gemini AI Simulator) ลองพิมพ์ถามเกี่ยวกับสินค้า สต๊อกใกล้หมด หรือทักทายได้เลยครับ! 📦',
                      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                    }
                  ])}
                  className="px-2.5 py-1 text-[10px] font-bold bg-[#2C3C5C] hover:bg-[#3C4C6C] text-slate-200 rounded border border-[#3C4C6C] cursor-pointer transition-all"
                  title="รีเซ็ตห้องแชต"
                >
                  เคลียร์แชต
                </button>
              </div>

              {/* Chat Messages Log Body */}
              <div className="flex-grow bg-[#849CBB] p-4 overflow-y-auto space-y-3.5 scrollbar-thin">
                {simulatedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 max-w-[85%] ${
                      msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {/* Avatar */}
                    {msg.sender === 'bot' ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 self-start text-[10px]">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 self-start text-[10px]">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}

                    {/* Speech Bubble Container */}
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-700/80 font-bold block">
                        {msg.sender === 'bot' ? 'บอทคลังอัจฉริยะ' : 'พนักงาน (จำลอง)'}
                      </span>
                      <div
                        className={`p-3 rounded-2xl text-[11.5px] leading-relaxed shadow-xs whitespace-pre-wrap ${
                          msg.sender === 'user'
                            ? 'bg-[#5BE368] text-slate-900 rounded-tr-none'
                            : 'bg-white text-slate-800 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-slate-600/80 block text-right">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Generating Loading bubble */}
                {isGenerating && (
                  <div className="flex gap-2 max-w-[85%] mr-auto">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 self-start text-[10px]">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-700/80 font-bold block">บอทคลังอัจฉริยะ</span>
                      <div className="p-3 bg-white text-slate-500 rounded-2xl rounded-tl-none shadow-xs text-xs flex items-center gap-1.5 font-sans">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>บอท AI กำลังประมวลผลวิเคราะห์คำตอบ...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="bg-white p-3 border-t border-slate-200 shrink-0 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="พิมพ์คุยกับบอทสต๊อกของคุณที่นี่..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSimulateChat(inputMessage)}
                  className="flex-grow px-3.5 py-2 text-xs border border-slate-200 rounded-full focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                  disabled={isGenerating}
                />
                <button
                  type="button"
                  onClick={() => handleSimulateChat(inputMessage)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full cursor-pointer shrink-0 shadow-xs transition-transform active:scale-90"
                  disabled={isGenerating || !inputMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Right: Debug console and quick trigger buttons */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            
            {/* Quick action triggers */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>คลิกปุ่มเพื่อจำลองสถานการณ์ด่วน (Quick Test)</span>
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal">
                จำลองหัวข้อที่พนักงานคลังชอบถามบ่อยๆ เพื่อตรวจสอบว่าบอทประมวลข้อมูลถูกต้อง สรุปสวยงามน่าอ่านหรือไม่
              </p>
              <div className="flex flex-col gap-1.5 pt-1.5">
                {presetsPrompt.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSimulateChat(preset.text)}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-350 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all flex justify-between items-center group"
                    disabled={isGenerating}
                  >
                    <span>{preset.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono group-hover:text-emerald-600">
                      "{preset.text}" →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Debug console view prompt */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex-grow flex flex-col justify-between space-y-3">
              <div>
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    🖥️ ระบบตรวจสอบบริบทคำสั่ง (AI Debugger)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowDebugPrompt(!showDebugPrompt)}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    {showDebugPrompt ? '🙈 ซ่อนข้อความหลัก' : '👁️ แสดงข้อความหลัก'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  ดูข้อความ System Prompt และชุดบริบทรายการสินค้าคงคลังจริงล่าสุดที่สตรีมส่งให้โมเดลประมวลผล
                </p>
              </div>

              {showDebugPrompt ? (
                <div className="flex-grow overflow-y-auto max-h-[180px] p-2.5 bg-slate-900 text-slate-300 font-mono text-[9px] rounded-lg border border-slate-800 whitespace-pre-wrap scrollbar-thin">
                  {debugPrompt || 'ยังไม่มีการเรียกวิเคราะห์ ลำดับความสัมพันธ์ว่างเปล่า กรุณากดทดลองจำลองคุยด้านซ้ายมือก่อนครับ'}
                </div>
              ) : (
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-[10px] text-blue-800 leading-relaxed flex items-start gap-1.5 flex-grow justify-center flex-col">
                  <p className="font-bold flex items-center gap-1 text-[10.5px]">💡 คำแนะนำความโปร่งใส:</p>
                  <p>ระบบถามตอบจำลองนี้ประมวลผลดึงสินค้าคงคลังล่าสุด 15-20 รายการแรกจากร้านคุณไปแปลงรูปเป็นบริบท (Product List Context) ทำให้ตอบสต๊อกตรงความจริง 100% เลยครับ!</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: Rich Menu Guide */}
      {activeTab === 'guide' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>วิธีการสร้างเมนูปุ่มทางลัดท้ายห้องแชต (LINE OA Rich Menu)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              อำนวยความสะดวกสูงสุดด้วยการตั้งค่าปุ่มกดหน้าต่างด้านล่างหน้าจอแชต LINE เพื่อให้พนักงานกดเข้าไปดูประวัติ บันทึกการรับเข้า หรือเช็คสต๊อกได้รวดเร็วเพียงปลายนิ้วสัมผัส
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Steps list */}
            <div className="lg:col-span-7 space-y-4 text-xs leading-relaxed text-slate-600">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-slate-700">ลงชื่อเข้าใช้ LINE Official Account Manager:</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      เปิดเว็บเพจไปที่{' '}
                      <a href="https://manager.line.biz/" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">
                        <span>LINE Official Account Manager</span>
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>{' '}
                      เลือกบัญชี LINE OA ที่ต้องการเชื่อมโยง
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-slate-700">สร้างริชเมนู (Rich Menu):</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      ที่แถบเมนูซ้ายมือ เลือกหัวข้อ **"ริชเมนู" (Rich Menus)** ภายใต้กลุ่มฟีเจอร์แชต แล้วคลิกปุ่ม **"สร้างใหม่"**
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="font-bold text-slate-700">อัปโหลดรูปพื้นหลัง และแบ่งสัดส่วนปุ่ม (Template Selection):</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      เลือกเทมเพลตที่ชอบ (เช่น แบบ 3 ปุ่ม หรือ 6 ปุ่ม) และอัปโหลดภาพไอคอนปุ่มสวยๆ สามารถจัดเตรียมจาก Canva ค้นคำว่า "LINE Rich Menu Template"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    4
                  </span>
                  <div>
                    <p className="font-bold text-slate-700">กำหนด Action ให้ปุ่มทางลัด:</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      ในแต่ละช่องปุ่ม ให้กำหนดเงื่อนไขการคลิกปุ่ม ดังนี้:
                    </p>
                    <ul className="list-disc pl-4 space-y-1.5 text-[10.5px] text-slate-500 mt-1.5">
                      <li>
                        <span className="font-bold text-slate-700">ปุ่มเข้าหน้าเว็บสต๊อก (Link):</span> เลือก Action เป็น **"ลิงก์" (Link)** แล้วป้อน URL คลังของคุณ:{' '}
                        <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono select-all font-bold">{window.location.origin}</code>
                      </li>
                      <li>
                        <span className="font-bold text-slate-700">ปุ่มสั่งให้บอทตรวจของด่วน (Text):</span> เลือก Action เป็น **"ข้อความ" (Text)** แล้วป้อนคำสั่งลัด เช่น <code className="bg-slate-100 px-1 rounded text-emerald-700 font-bold">"เช็คสต๊อกใกล้หมด"</code> เมื่อพนักงานคลิกปุ่ม บอท AI จะวิเคราะห์ส่งรายงานกลับคืนแชตให้อัตโนมัติทันที!
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Rich Menu graphics mock */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                🎨 ตัวอย่างไอเดียการจัดแบ่งริชเมนู (Rich Menu Idea Layout)
              </h4>
              
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
                <div className="p-3 bg-slate-100 border-b border-slate-200 text-[10px] text-slate-500 font-bold text-center uppercase tracking-wide">
                  หน้าจอปุ่มลัดด้านล่างแชต LINE (6 ช่องมาตรฐาน)
                </div>
                
                <div className="grid grid-cols-3 border-collapse text-center">
                  <div className="p-4 border-r border-b border-slate-200 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[70px] cursor-pointer">
                    <span className="text-[14px]">📦</span>
                    <span className="text-[9.5px] font-bold text-slate-700 mt-1">1. ดูคลังสินค้า</span>
                    <span className="text-[8px] text-slate-400 mt-0.5">(ลิงก์หน้าแรก)</span>
                  </div>
                  <div className="p-4 border-r border-b border-slate-200 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[70px] cursor-pointer">
                    <span className="text-[14px]">📥</span>
                    <span className="text-[9.5px] font-bold text-slate-700 mt-1">2. รับของเข้าคลัง</span>
                    <span className="text-[8px] text-slate-400 mt-0.5">(คลิกกรอกเบิก)</span>
                  </div>
                  <div className="p-4 border-b border-slate-200 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[70px] cursor-pointer">
                    <span className="text-[14px]">📸</span>
                    <span className="text-[9.5px] font-bold text-slate-700 mt-1">3. สแกนพัสดุ AI</span>
                    <span className="text-[8px] text-slate-400 mt-0.5">(สแกนอัปโหลด)</span>
                  </div>
                  <div className="p-4 border-r border-slate-200 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[70px] cursor-pointer">
                    <span className="text-[14px]">⚠️</span>
                    <span className="text-[9.5px] font-bold text-slate-700 mt-1">4. สินค้าเหลือน้อย</span>
                    <span className="text-[8px] text-emerald-600 font-bold mt-0.5">(บอทตอบคำสั่ง)</span>
                  </div>
                  <div className="p-4 border-r border-slate-200 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[70px] cursor-pointer">
                    <span className="text-[14px]">📜</span>
                    <span className="text-[9.5px] font-bold text-slate-700 mt-1">5. ประวัติ Ledger</span>
                    <span className="text-[8px] text-slate-400 mt-0.5">(ลิงก์ดูบันทึก)</span>
                  </div>
                  <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[70px] cursor-pointer">
                    <span className="text-[14px]">🙋‍♀️</span>
                    <span className="text-[9.5px] font-bold text-slate-700 mt-1">6. คุยกับแอดมิน</span>
                    <span className="text-[8px] text-slate-400 mt-0.5">(สลับพิมพ์คุยสด)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-150 rounded-lg text-[10px] text-blue-800 leading-normal flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <b>เคล็ดลับ:</b> คุณสามารถนำลิงก์ปลายทางของระบบนี้ไปสอดแทรกได้ในทุกริชเมนู เพื่ออำนวยความสะดวกสูงสุดแก่เพื่อนร่วมทีมและพนักงานตรวจสอบครับ!
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
