import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Reply, Bot, ShieldCheck, HelpCircle, AlertOctagon, RefreshCw, Layers } from 'lucide-react';
import { firebaseService } from '../services/firebaseService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export default function LineBotSandbox() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'สวัสดีครับ ยินดีตอบกลับจากบอทคลังสินค้าอัจฉริยะ! 📦🦾🤖\n\nท่านสามารถทดสอบคุยกับน้องบอทไลน์เพื่อเช็คยอดสต็อกและประวัติขนส่งได้เลยครับ\n\nพิมพ์ "เช็คสต็อก" สต็อกยอดคงเหลือ หรือเลือกกดปุ่มด้านล่างเพื่อคุยกับระบบอัตโนมัติ!',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to chat end
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendBotMsg = async (userText: string) => {
    setLoading(true);
    // Push user message to UI
    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const replyObj = await firebaseService.generateBotReply(userText);
      
      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now().toString(),
        sender: 'bot',
        text: replyObj.text,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };
      
      // Delay response slightly to simulate thinking / server rounds
      setTimeout(() => {
        setMessages(prev => [...prev, botMsg]);
        setLoading(false);
      }, 550);

    } catch (e) {
      const errorMsg: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        sender: 'bot',
        text: '❌ เกิดข้อผิดพลาดในการดึงข้อมูลตอบกลับจากระบบอัจฉริยะ',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      setLoading(false);
    }
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    sendBotMsg(text);
  };

  const handleQuickCommand = (cmd: string) => {
    if (loading) return;
    sendBotMsg(cmd);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="line-sandbox-view">
      
      {/* Visual LINE Simulator Terminal (Left) */}
      <div className="lg:col-span-7 flex flex-col h-[520px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" id="line-simulator-panel">
        
        {/* Chat header bar */}
        <div className="bg-[#050C1A] border-b border-slate-900 px-4 py-3 flex items-center justify-between" id="chat-header">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-9 w-9 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold shadow-md select-none border border-emerald-400">
                LINE
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-400 border-2 border-slate-950 rounded-full" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">น้องบอท สต็อกอัจฉริยะ (LINE-Bot Service)</span>
              <span className="text-[9px] text-slate-450 block flex items-center gap-1">
                🟢 อัปเดตข้อมูลอัตโนมัติ • พร้อมให้บริการ
              </span>
            </div>
          </div>
          <div className="text-[10px] bg-slate-900 text-slate-300 font-bold px-2 py-1 rounded-md border border-slate-805">
            LINE Bot Sandbox
          </div>
        </div>

        {/* Chat log bubble space */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B1524] relative scrollbar-thin" id="chat-scroller">
          {/* Wallpaper subtle pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.03] z-0 pointer-events-none" />

          <div className="relative z-10 space-y-3.5">
            <AnimatePresence>
              {messages.map((m) => {
                const isBot = m.sender === 'bot';
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={m.id}
                    className={`flex ${isBot ? 'justify-start' : 'justify-end'} gap-2.5`}
                    id={`chat-bubble-${m.id}`}
                  >
                    {isBot && (
                      <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-1 select-none shadow">
                        🤖
                      </div>
                    )}
                    <div className="max-w-[80%] space-y-0.5">
                      <div 
                        className={`p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                          isBot 
                            ? 'bg-slate-900 text-slate-200 border border-slate-800' 
                            : 'bg-emerald-500 text-teal-950 font-medium rounded-tr-none'
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className={`text-[9px] text-slate-500 block ${!isBot ? 'text-right' : ''}`}>
                        {m.timestamp} {m.sender === 'user' ? '• อ่านแล้ว' : ''}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {loading && (
              <div className="flex justify-start gap-2.5" id="chat-bot-thinking">
                <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs text-white shrink-0">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                </div>
                <div className="bg-slate-900 border border-slate-800 text-slate-400 text-xs py-2 px-3.5 rounded-xl">
                  กำลังพิมพ์...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={handleSendSubmit} className="p-3 bg-[#050C1A] border-t border-slate-900 flex gap-2" id="chat-input-form">
          <input 
            type="text"
            disabled={loading}
            placeholder="ลองพิมพ์ 'เช็คสต็อก' หรือ 'สินค้าใกล้หมด'..."
            className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-4 py-2.5 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            id="chat-text-input"
          />
          <button 
            type="submit"
            disabled={loading || !inputText.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-teal-950 font-bold p-2.5 rounded-xl transition"
            id="chat-send-submit"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>

      </div>

      {/* Shortcuts & Guide parameters Info (Right) */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Standard commands panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5" id="chat-shortcuts-card">
          <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 select-none">
            <Layers className="h-4.5 w-4.5 text-emerald-400" /> แท็กคำสั่งทางลัด (Quick Shortcuts)
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
            คลิกเลือกคำสั่งทางลัดด้านล่าง เพื่อสั่งการจำลองคำตอบของ LINE Bot ได้ทันที ไม่ต้องเสียเวลาป้อนคำสั่งเอง:
          </p>

          <div className="space-y-2.5" id="shortcut-btn-list">
            <button 
              onClick={() => handleQuickCommand('เช็คสต็อก')}
              className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-805 rounded-xl text-slate-200 text-xs font-semibold flex items-center justify-between group transition"
              id="shortcut-check-stock"
            >
              <span className="flex items-center gap-2">📊 <span>เช็คยอดสต็อกคงเหลือทั้งหมด</span></span>
              <span className="text-[10px] text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">กดพิมพ์ ➜</span>
            </button>

            <button 
              onClick={() => handleQuickCommand('รายงานการส่งออก')}
              className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-805 rounded-xl text-slate-200 text-xs font-semibold flex items-center justify-between group transition"
              id="shortcut-check-exports"
            >
              <span className="flex items-center gap-2">🚚 <span>เช็ครายงานการส่งออก 5 รายการล่าสุด</span></span>
              <span className="text-[10px] text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">กดพิมพ์ ➜</span>
            </button>

            <button 
              onClick={() => handleQuickCommand('สินค้าใกล้หมด')}
              className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-805 rounded-xl text-slate-200 text-xs font-semibold flex items-center justify-between group transition"
              id="shortcut-check-lowstock"
            >
              <span className="flex items-center gap-2">🚨 <span>เช็คตรวจรายการสินค้าใกล้หมดสต็อก</span></span>
              <span className="text-[10px] text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">กดพิมพ์ ➜</span>
            </button>

            <button 
              onClick={() => handleQuickCommand('SKU-IPHONE15-PRO')}
              className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-805 rounded-xl text-slate-200 text-xs font-semibold flex items-center justify-between group transition"
              id="shortcut-check-sku-detail"
            >
              <span className="flex items-center gap-2">🔍 <span>เจาะจงข้อมูล SKU: SKU-IPHONE15-PRO</span></span>
              <span className="text-[10px] text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">กดพิมพ์ ➜</span>
            </button>
          </div>
        </div>

        {/* Real LINE Developer account Webhook information */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-350" id="chat-technical-guide">
          <h3 className="text-white text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> เชื่อม LINE Developer Account จริง
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
            เพื่อให้ระบบสามารถตอบกลับแชทผ่านโทรศัพท์ของคุณ ให้ทำขั้นตอนดังนี้:
          </p>
          <div className="space-y-2 text-[11px] font-medium text-slate-300">
            <div>
              1. คัดลอกพิกัดลิงก์ Webhook จาก Workspace ด้านล่างนี้:
              <input 
                type="text" 
                readOnly
                value={`${window.location.origin}/api/line-webhook`}
                className="w-full bg-slate-950 border border-slate-850 p-2 text-[9px] font-mono text-emerald-400 select-all rounded-md mt-1 mb-2 focus:outline-none"
              />
            </div>
            <div>
              2. เข้าสู่ <a href="https://manager.line.me/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">LINE Developers Console</a> ➜ ไปยัง Channel Settings ➜ เปิดใช้ <b>Webhooks</b> และพาดลิงก์นี้ลงไปพร้อมกด <b>Verify</b>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
