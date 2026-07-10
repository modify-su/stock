import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  RefreshCcw, 
  Check, 
  Copy, 
  AlertCircle, 
  Database, 
  Smartphone, 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Plus,
  Minus,
  ListFilter,
  Layers
} from 'lucide-react';
import { Product, Transaction, AppSettings, UserProfile } from '../types';

interface LineBotSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  products: Product[];
  currentUser: UserProfile | null;
  onRecordTransaction: (txData: Omit<Transaction, 'id' | 'date'>) => Promise<void>;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isSimulatedAction?: boolean;
}

export default function LineBotSettings({
  settings,
  onUpdateSettings,
  products,
  currentUser,
  onRecordTransaction,
}: LineBotSettingsProps) {
  // LINE configuration settings state
  const [token, setToken] = useState(settings.lineChannelAccessToken || '');
  const [secret, setSecret] = useState(settings.lineChannelSecret || '');
  const [isEnabled, setIsEnabled] = useState(settings.lineBotEnabled ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Simulated Webhook details
  const simulatedWebhookUrl = `${window.location.origin}/api/line/webhook`;
  const [isCopiedWebhook, setIsCopiedWebhook] = useState(false);

  // Chat simulator states
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: 'สวัสดีครับ! ยินดีต้อนรับสู่ระบบ "บอท LINE & AI คลังสินค้าอัจฉริยะ" 🤖📦\n\nผมพร้อมช่วยอัปเดตและเช็คสต๊อกแบบเรียลไทม์ผ่าน LINE แชตแล้วครับ คุณสามารถพิมพ์ถามสต๊อก, เช็คสินค้า, แจ้งรับเข้า, หรือแจ้งส่งออกสินค้า ได้ทันทีผ่านเมนูปุ่มทางลัดหรือพิมพ์คุยกับผมได้เลย!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isBotTyping, setIsBotTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  // Handle configuration saving
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onUpdateSettings({
        lineChannelAccessToken: token,
        lineChannelSecret: secret,
        lineBotEnabled: isEnabled
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to copy text to clipboard
  const handleCopyText = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // Parse natural language commands in Thai (Simulating LINE chatbot AI logic)
  const processBotReply = async (userText: string) => {
    setIsBotTyping(true);
    
    // Artificial latency for realism
    await new Promise(resolve => setTimeout(resolve, 1000));

    const text = userText.trim();
    let replyText = '';
    let isAction = false;

    // 1. ตรวจสต๊อกสินค้าทั้งหมด หรือ คลังใกล้หมด
    if (
      text.includes('ตรวจสต๊อก') || 
      text.includes('เช็คสต๊อกทั้งหมด') || 
      text.includes('สินค้าทั้งหมด') || 
      text.includes('ดูสต๊อก')
    ) {
      if (products.length === 0) {
        replyText = '⚠️ ปัจจุบันไม่มีข้อมูลสินค้าในคลังระบบครับ กรุณาเพิ่มสินค้าก่อนใช้งาน';
      } else {
        const productLines = products.slice(0, 10).map(p => 
          `• [${p.sku}] ${p.name}\n  คงเหลือ: ${p.quantity} ${p.unit} (พิกัด: ${p.location || 'ไม่ได้ระบุ'})`
        ).join('\n\n');
        
        replyText = `📦 **รายการสินค้าในคลัง (แสดงล่าสุดสูงสุด 10 รายการ):**\n\n${productLines}\n\n${products.length > 10 ? `...และยังมีสินค้าอื่นๆ อีก ${products.length - 10} รายการในระบบ` : ''}\n\n💡 ต้องการดูชิ้นไหนเจาะจง สามารถพิมพ์ถาม เช่น "เช็ค TS-001" หรือ "ขอดู เสื้อยืด" ได้เลยครับ!`;
      }
    } 
    // 2. สินค้าใกล้หมด / สินค้าต่ำกว่าเกณฑ์
    else if (text.includes('ใกล้หมด') || text.includes('วิกฤต') || text.includes('สต๊อกต่ำ')) {
      const lowStockList = products.filter(p => p.quantity <= p.minStock);
      if (lowStockList.length === 0) {
        replyText = '✅ ยินดีด้วยครับ! ตอนนี้สินค้าทุกชิ้นมีสต๊อกเพียงพอ ไม่มีสินค้าชิ้นใดต่ำกว่าเกณฑ์ขั้นต่ำเลยครับ';
      } else {
        const listText = lowStockList.map(p => 
          `🚨 [${p.sku}] ${p.name}\n  คงเหลือ: ${p.quantity} (เกณฑ์ต่ำสุด: ${p.minStock} ${p.unit})`
        ).join('\n\n');
        replyText = `⚠️ **แจ้งเตือนสินค้าสต๊อกต่ำกว่าเกณฑ์ (${lowStockList.length} ชิ้น):**\n\n${listText}\n\n💡 แนะนำให้เบิกสินค้าจากคลังใหญ่เข้ามาเพิ่ม หรือทำการสั่งซื้อสินค้าด่วนครับ`;
      }
    }
    // 3. แจ้งรับเข้าสินค้า (Inbound Transaction)
    // Format: "รับเข้า [SKU หรือชื่อ] จำนวน [ตัวเลข]" หรือ "รับเข้าปลังเขียว 500 ซอง"
    else if (
      text.startsWith('รับเข้า') || 
      text.startsWith('เติมสต๊อก') || 
      text.startsWith('เติม') || 
      text.includes('รับสินค้าเข้า')
    ) {
      // RegEx parsing: try to extract quantity and optional Thai unit at the end
      const qtyRegex = /(\d+)\s*(?:ชิ้น|ตัว|กล่อง|แพ็ค|หน่วย|ซอง|ถุง|แผง|ขวด|ลัง|ม้วน|เมตร|กก|กิโล|อัน|คู่|เม็ด|กระป๋อง)?$/i;
      const qtyMatch = text.match(qtyRegex) || text.match(/(?:จำนวน|เติม|เข้า)\s*(\d+)/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;
      
      // Remove command words & quantity string to find product key
      let searchKey = text
        .replace(/รับเข้า|เติมสต๊อก|เติม|รับสินค้าเข้า/g, '')
        .replace(qtyRegex, '')
        .replace(/(?:จำนวน|เข้า)?\s*\d+/g, '')
        .trim();

      if (quantity <= 0) {
        replyText = '❌ ขออภัยครับ! ไม่พบจำนวนสินค้าที่ระบุในการรับเข้า กรุณาลองใช้รูปแบบ:\n\n👉 *พิมพ์:* "รับเข้า [ชื่อสินค้า/SKU] [ตัวเลข]"\n👉 *ตัวอย่าง:* "รับเข้าปลังเขียว 500 ซอง" หรือ "รับเข้า TS-001 50"';
      } else if (!searchKey) {
        replyText = '❌ กรุณาระบุรหัสสินค้า (SKU) หรือชื่อสินค้าที่ต้องการรับเข้าด้วยครับ\n\n👉 *ตัวอย่าง:* "รับเข้าปลังเขียว 500"';
      } else {
        // Find product with SKU exact match, substring name match, or if searchKey contains the name
        const foundProduct = products.find(p => p.sku.toLowerCase() === searchKey.toLowerCase()) ||
                             products.find(p => p.name.toLowerCase().includes(searchKey.toLowerCase())) ||
                             products.find(p => searchKey.toLowerCase().includes(p.name.toLowerCase()));

        if (foundProduct) {
          try {
            await onRecordTransaction({
              productId: foundProduct.id,
              productSku: foundProduct.sku,
              productName: foundProduct.name,
              type: 'IN',
              quantity: quantity,
              reason: 'แจ้งบันทึกรับเข้าคลังด่วนผ่านบอท LINE OA 🤖',
              operator: currentUser?.name || 'พนักงานคลัง (ผ่าน LINE Bot)',
            });
            isAction = true;
            replyText = `✅ **บันทึกรับเข้าสำเร็จเรียบร้อย!**\n\n📦 **สินค้า:** ${foundProduct.name}\n🆔 **SKU:** ${foundProduct.sku}\n➕ **จำนวนรับเข้า:** +${quantity} ${foundProduct.unit}\n📊 **สต๊อกปัจจุบัน:** ${foundProduct.quantity + quantity} ${foundProduct.unit}\n📍 **พิกัดชั้นวาง:** ${foundProduct.location || 'ไม่ได้ระบุ'}\n\nข้อมูลถูกอัปเดตลงในระบบคลังส่วนกลางและฐานข้อมูลหลักเรียบร้อยแล้วครับ!`;
          } catch (err) {
            replyText = '❌ ขออภัยครับ เกิดข้อผิดพลาดทางเทคนิคในการอัปเดตสต๊อกลงฐานข้อมูล กรุณาลองใหม่อีกครั้ง';
          }
        } else {
          replyText = `❌ ไม่พบสินค้าที่มี SKU หรือชื่อใกล้เคียงกับ "${searchKey}" ในระบบ\n\n💡 กรุณาตรวจสอบรหัสสินค้าอีกครั้ง หรือเปิดดูที่เมนูหน้า "รายการสินค้า" ครับ`;
        }
      }
    }
    // 4. แจ้งส่งออกสินค้า (Outbound Transaction)
    // Format: "ส่งออก [SKU/ชื่อ] [ตัวเลข]" หรือ "เบิก [SKU/ชื่อ] [ตัวเลข]" (เช่น "เบิกปลังเขียว 500 ซอง")
    else if (
      text.startsWith('ส่งออก') || 
      text.startsWith('เบิก') || 
      text.startsWith('เบิกสินค้า') || 
      text.includes('ตัดสต๊อก')
    ) {
      const qtyRegex = /(\d+)\s*(?:ชิ้น|ตัว|กล่อง|แพ็ค|หน่วย|ซอง|ถุง|แผง|ขวด|ลัง|ม้วน|เมตร|กก|กิโล|อัน|คู่|เม็ด|กระป๋อง)?$/i;
      const qtyMatch = text.match(qtyRegex) || text.match(/(?:จำนวน|เบิก|ออก)\s*(\d+)/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;
      
      let searchKey = text
        .replace(/ส่งออก|เบิกสินค้า|เบิก|ตัดสต๊อก/g, '')
        .replace(qtyRegex, '')
        .replace(/(?:จำนวน|ออก)?\s*\d+/g, '')
        .trim();

      if (quantity <= 0) {
        replyText = '❌ ขออภัยครับ! ไม่พบจำนวนสินค้าที่ต้องการส่งออก/เบิก กรุณาลองใช้รูปแบบ:\n\n👉 *พิมพ์:* "เบิก [ชื่อสินค้า/SKU] [ตัวเลข]"\n👉 *ตัวอย่าง:* "เบิกปลังเขียว 10 ซอง" หรือ "เบิก TS-001 10"';
      } else if (!searchKey) {
        replyText = '❌ กรุณาระบุรหัสสินค้า (SKU) หรือชื่อสินค้าที่ต้องการเบิกด้วยครับ\n\n👉 *ตัวอย่าง:* "เบิกปลังเขียว 10"';
      } else {
        const foundProduct = products.find(p => p.sku.toLowerCase() === searchKey.toLowerCase()) ||
                             products.find(p => p.name.toLowerCase().includes(searchKey.toLowerCase())) ||
                             products.find(p => searchKey.toLowerCase().includes(p.name.toLowerCase()));

        if (foundProduct) {
          if (foundProduct.quantity < quantity) {
            replyText = `⚠️ **สต๊อกคงเหลือไม่เพียงพอสำหรับทำรายการ!**\n\n📦 **สินค้า:** ${foundProduct.name}\n🆔 **SKU:** ${foundProduct.sku}\n❌ **จำนวนที่พยายามเบิก:** ${quantity} ${foundProduct.unit}\n📉 **คงเหลือพร้อมส่งจริง:** ${foundProduct.quantity} ${foundProduct.unit}\n\nกรุณาตรวจสอบจำนวนที่เบิก หรือนำเข้าสินค้าเพิ่มเติมเข้ามาในสต๊อกก่อนครับ`;
          } else {
            try {
              await onRecordTransaction({
                productId: foundProduct.id,
                productSku: foundProduct.sku,
                productName: foundProduct.name,
                type: 'OUT',
                quantity: quantity,
                reason: 'แจ้งบันทึกส่งออกคลังผ่านบอท LINE OA 🤖',
                operator: currentUser?.name || 'พนักงานคลัง (ผ่าน LINE Bot)',
              });
              isAction = true;
              replyText = `✅ **บันทึกส่งออก (เบิกสินค้า) สำเร็จ!**\n\n📦 **สินค้า:** ${foundProduct.name}\n🆔 **SKU:** ${foundProduct.sku}\n➖ **จำนวนส่งออก:** -${quantity} ${foundProduct.unit}\n📊 **คงเหลือในชั้นวาง:** ${foundProduct.quantity - quantity} ${foundProduct.unit}\n📍 **พิกัดคลังสินค้า:** ${foundProduct.location || 'ไม่ได้ระบุ'}\n\nระบบดำเนินการตัดสต๊อกและสร้างประวัติบันทึกการเบิกพัสดุเรียบร้อยแล้ว!`;
            } catch (err) {
              replyText = '❌ ขออภัยครับ เกิดข้อผิดพลาดทางเทคนิคในการตัดสต๊อก กรุณาลองใหม่อีกครั้ง';
            }
          }
        } else {
          replyText = `❌ ไม่พบสินค้าที่มี SKU หรือชื่อใกล้เคียงกับ "${searchKey}" ในคลัง\n\n💡 โปรดลองพิมพ์ด้วยรหัส SKU เต็มเพื่อความแม่นยำ`;
        }
      }
    }
    // 5. สอบถามด้วยชื่อสินค้า กรณีจำรหัส SKU ไม่ได้
    else if (
      text.includes('จำ SKU ไม่ได้') ||
      text.includes('จำรหัสไม่ได้') ||
      text.includes('ลืม SKU') ||
      text.includes('ลืมรหัส') ||
      text.startsWith('ชื่อสินค้า') ||
      text.startsWith('ค้นหาด้วยชื่อ') ||
      text.startsWith('ค้นชื่อ')
    ) {
      let searchKey = text
        .replace(/จำ SKU ไม่ได้|จำรหัสไม่ได้|ลืม SKU|ลืมรหัส|ชื่อสินค้า|ค้นหาด้วยชื่อ|ค้นชื่อ/g, '')
        .trim();

      if (!searchKey) {
        replyText = `💡 **จำรหัส SKU ไม่ได้ใช่ไหมครับ? ไม่เป็นไรครับ!**\n\nท่านสามารถพิมพ์ค้นหาด้วย "ชื่อสินค้า" เพื่อตรวจเช็ค SKU และจำนวนคงเหลือได้ทันที\n\n👉 **ตัวอย่างคำสั่งที่พิมพ์คุยได้:**\n- "ชื่อสินค้า [ชื่อสินค้า]" (เช่น: ชื่อสินค้า ${sampleName})\n- "ค้นชื่อ [ชื่อสินค้า]" (เช่น: ค้นชื่อ ${sampleName})\n- "จำ SKU ไม่ได้"\n\nผมจะดึงรายชื่อสินค้าที่สอดคล้องพร้อมระบุรหัส SKU เพื่อให้ท่านคัดลอกไปทำรายการต่อได้สะดวกครับ!`;
      } else {
        const matches = products.filter(p => 
          p.name.toLowerCase().includes(searchKey.toLowerCase()) || 
          p.category.toLowerCase().includes(searchKey.toLowerCase())
        );

        if (matches.length === 0) {
          replyText = `🔍 ไม่พบสินค้าในระบบที่ตรงกับคำสำคัญ "${searchKey}" เลยครับ\n\n💡 คำแนะนำ: ลองพิมพ์คำสำคัญสั้นๆ เช่น "เสื้อ", "กล่อง" หรือพิกัดหมวดหมู่สินค้าครับ`;
        } else {
          const listText = matches.slice(0, 10).map(p => 
            `📌 **[SKU: ${p.sku}]**\n📦 **ชื่อสินค้า:** ${p.name}\n📊 **คงเหลือ:** ${p.quantity} ${p.unit}\n📍 **ตำแหน่งชั้นวาง:** ${p.location || 'ไม่ได้ระบุ'}`
          ).join('\n\n');

          replyText = `🔍 **ผลการค้นหาด้วยชื่อสินค้าสำหรับคำว่า "${searchKey}" (พบ ${matches.length} รายการ):**\n\n${listText}\n\n${matches.length > 10 ? `...และยังมีรายการอื่นๆ อีก ${matches.length - 10} รายการในคลัง` : ''}\n\n💡 คัดลอกรหัส **SKU** ด้านบนไปกรอกเพื่อแจ้ง "รับเข้า" หรือ "เบิก" ต่อได้เลยครับ!`;
        }
      }
    }
    // 6. สอบถามรายละเอียดสินค้า หรือ สอบถามชื่อสินค้า หรือ จำนวนสินค้าเฉพาะเจาะจง
    // Format: "เช็ค [SKU/ชื่อ]" หรือ "เช็คสินค้า [SKU/ชื่อ]" หรือ "สอบถาม [SKU]" หรือ "จำนวน [SKU]"
    else if (
      text.startsWith('เช็ค') || 
      text.startsWith('สอบถาม') || 
      text.startsWith('จำนวน') || 
      text.startsWith('ค้นหา') || 
      text.includes('มีสินค้า')
    ) {
      let searchKey = text
        .replace(/เช็คสินค้า|เช็ค|สอบถาม|จำนวน|ค้นหา|มีสินค้า/g, '')
        .trim();

      if (!searchKey) {
        replyText = '🔍 ต้องการให้ผมเช็คสินค้าชิ้นไหนดีครับ? สามารถพิมพ์สอบถามรหัสสินค้าต่อท้ายได้เลย\n\n👉 *ตัวอย่าง:* "เช็ค TS-001" หรือ "สอบถาม เสื้อยืด"';
      } else {
        const foundProduct = products.find(p => p.sku.toLowerCase() === searchKey.toLowerCase()) ||
                             products.find(p => p.sku.toLowerCase().includes(searchKey.toLowerCase())) ||
                             products.find(p => p.name.toLowerCase().includes(searchKey.toLowerCase()));

        if (foundProduct) {
          const statusText = foundProduct.quantity <= foundProduct.minStock 
            ? '🔴 สินค้าใกล้หมดแล้ว! ควรเติมสินค้า' 
            : '🟢 มีสินค้าเพียงพอในคลัง';

          replyText = `🔍 **ข้อมูลพัสดุจากคลังอัจฉริยะ:**\n\n📦 **ชื่อสินค้า:** ${foundProduct.name}\n🆔 **SKU:** ${foundProduct.sku}\n🏷️ **หมวดหมู่:** ${foundProduct.category}\n\n📊 **สต๊อกคงเหลือในระบบ:**\n- **คงเหลือหน้าร้าน:** ${foundProduct.quantity} ${foundProduct.unit}\n- **สต๊อกคลังใหญ่ (Wholesale):** ${foundProduct.wholesaleStock || 0} ${foundProduct.wholesaleUnit || foundProduct.unit}\n\n📍 **พิกัดชั้นวาง:** ${foundProduct.location || 'ไม่ได้ระบุ'}\n💰 **ราคาสินค้า:** ${foundProduct.price ? `${foundProduct.price.toLocaleString()} บาท` : 'ไม่ได้ระบุ'}\n⚖️ **น้ำหนักสินค้า:** ${foundProduct.weight ? `${foundProduct.weight} ${foundProduct.weightUnit || 'กก.'}` : 'ไม่ได้ระบุ'}\n\n⚠️ **สถานะการติดตาม:** ${statusText}`;
        } else {
          replyText = `🔍 ไม่พบสินค้าที่ค้นหาใกล้เคียงกับคำว่า "${searchKey}"\n\n💡 ท่านสามารถลองพิมพ์เฉพาะรหัส SKU เช่น "TS-001" หรือตรวจดูรายการทั้งหมดด้วยพิมพ์ "ตรวจสต๊อก" ครับ`;
        }
      }
    }
    // 6. Default Fallback Chatbot prompt
    else {
      // If none matched, do a fallback smart search based on exact words if matching any known SKU or product name directly
      const fallbackProduct = products.find(p => text.toLowerCase().includes(p.sku.toLowerCase())) ||
                              products.find(p => text.toLowerCase().includes(p.name.toLowerCase()));

      if (fallbackProduct) {
        const statusText = fallbackProduct.quantity <= fallbackProduct.minStock 
          ? '🔴 สต๊อกต่ำกว่าเกณฑ์ความปลอดภัย' 
          : '🟢 สต๊อกปกติพร้อมจำหน่าย';

        replyText = `🤖 ผมตรวจพบว่าท่านระบุชื่อสินค้าในข้อความ ขอนำเสนอข้อมูลด่วนครับ:\n\n📦 **สินค้า:** ${fallbackProduct.name}\n🆔 **SKU:** ${fallbackProduct.sku}\n📊 **จำนวนคงเหลือ:** ${fallbackProduct.quantity} ${fallbackProduct.unit}\n📍 **พิกัดชั้นวาง:** ${fallbackProduct.location || 'คลัง A'}\n⚠️ **สถานะ:** ${statusText}\n\n💡 ต้องการเติมหรือเบิกสินค้าหรือไม่? พิมพ์เช่น "รับเข้า ${fallbackProduct.sku} จำนวน 10" หรือ "เบิก ${fallbackProduct.sku} จำนวน 5" ได้เลยครับ!`;
      } else {
        replyText = `🤖 **ผมขออภัยครับ ไม่ค่อยเข้าใจคำสั่งนี้**\n\nเพื่อให้บอทคลังสินค้า AI ดำเนินการได้อย่างแม่นยำ กรุณาใช้คำสั่งด่วนเหล่านี้ครับ:\n\n🔍 **กรณีจำ SKU ไม่ได้ / ค้นหาด้วยชื่อ:**\n- พิมพ์ "จำ SKU ไม่ได้" หรือ "ลืมรหัส"\n- พิมพ์ "ชื่อสินค้า [ชื่อที่ต้องการค้นหา]" (เช่น: ชื่อสินค้า ${sampleName})\n\n📊 **เช็คของและคงเหลือ:**\n- พิมพ์ "ตรวจสต๊อก" (ดูสินค้าทั้งหมด)\n- พิมพ์ "เช็ค [ชื่อสินค้า/SKU]" (เช่น: เช็ค ${sampleName})\n- พิมพ์ "ใกล้หมด" (ดูสินค้าใกล้หมดเกณฑ์)\n\n🔄 **แจ้งอัปเดตความเคลื่อนไหวคลัง:**\n- พิมพ์ "รับเข้า [SKU] จำนวน [ตัวเลข]" เพื่อรับของ\n- พิมพ์ "เบิก [SKU] จำนวน [ตัวเลข]" เพื่อส่งออกของ`;
      }
    }

    setMessages(prev => [
      ...prev,
      {
        id: `bot-reply-${Date.now()}`,
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSimulatedAction: isAction
      }
    ]);
    setIsBotTyping(false);
  };

  const handleSendSimulatedMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsgText = chatInput;
    setMessages(prev => [
      ...prev,
      {
        id: `user-msg-${Date.now()}`,
        sender: 'user',
        text: userMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setChatInput('');
    processBotReply(userMsgText);
  };

  const handleQuickCommand = (commandText: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `quick-msg-${Date.now()}`,
        sender: 'user',
        text: commandText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    processBotReply(commandText);
  };

  const handleClearChatHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'bot',
        text: 'ระบบจำลองบอทแชตได้รับการเคลียร์เรียบร้อยครับ! สามารถพิมพ์หรือกดปุ่มตัวอย่างด้านล่างเพื่อทดสอบการเช็คสต๊อกหรือรับส่งเข้าสินค้าได้ใหม่ทันที 🤖📈',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Select some mock suggestions based on actual products in DB if available
  const sampleSku = products.length > 0 ? products[0].sku : 'TS-001';
  const sampleName = products.length > 0 ? products[0].name : 'เสื้อยืด';

  return (
    <div id="line-bot-view" className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Tab Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-12 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 shrink-0 self-center">
              <Bot className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider border border-emerald-500/30">
                  LINE OA integration
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider border border-blue-500/30">
                  Gemini AI Chatbot
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 mt-2">
                ระบบบอท LINE & AI คลังสินค้าอัจฉริยะ (LINE Chatbot Companion)
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                เชื่อมโยงแอปพลิเคชันจัดการสินค้าของคุณเข้ากับระบบบัญชี LINE Official Account (LINE OA) เพื่อเปิดทางให้ทีมงานแอดมิน, 
                คนเฝ้าคลัง (Keepers), และผู้จัดการ ตรวจสอบรายละเอียดสินค้า ตรวจเช็คสต๊อก บันทึกของเข้า-ออกคลัง หรือสืบค้นข้อมูลพัสดุได้จากทุกที่ทุกเวลา ผ่านห้องแชต LINE
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Hand: Configuration Parameters & Connection Guides (Col-span 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Connection settings form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              <span>ตั้งค่าคีย์เชื่อมต่อ LINE Developers API</span>
            </h2>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Bot status switch */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-150 flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-slate-700">สถานะเปิดใช้งานบอทตอบแชตอัตโนมัติ</span>
                  <span className="text-[10px] text-slate-400">เมื่อปิด บอทจะไม่ประมวลผลข้อความจากผู้ใช้</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`w-12 h-6.5 rounded-full transition-all duration-200 cursor-pointer p-0.5 ${isEnabled ? 'bg-emerald-500 flex justify-end' : 'bg-slate-300 flex justify-start'}`}
                >
                  <div className="w-5.5 h-5.5 rounded-full bg-white shadow-md transform" />
                </button>
              </div>

              {/* Webhook URL Field */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">🌐 Webhook URL สำหรับส่งข้อมูลใน LINE Developers:</span>
                <div className="flex items-center gap-2">
                  <div className="font-mono bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-700 text-[11.5px] truncate flex-1 select-all">
                    {simulatedWebhookUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(simulatedWebhookUrl, setIsCopiedWebhook)}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                    title="คัดลอก Webhook URL"
                  >
                    {isCopiedWebhook ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  *นำค่านี้ไปกรอกในฟิลด์ "Webhook URL" ในคอนโซล LINE Developers ภายใต้เมนู Messaging API Settings แล้วกด Verify
                </span>
              </div>

              {/* Channel Access Token */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">🔑 Channel Access Token (Long-Lived):</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ใส่ Channel Access Token ของคุณ"
                  className="w-full text-xs font-mono px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:font-sans"
                />
              </div>

              {/* Channel Secret */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 block">🔒 Channel Secret Key:</label>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="ใส่ Channel Secret ของคุณ"
                  className="w-full text-xs font-mono px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:font-sans"
                />
              </div>

              {/* Submit Buttons and Status feedback */}
              <div className="flex items-center justify-between pt-1">
                {saveStatus === 'success' && (
                  <span className="text-[11px] text-emerald-600 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> บันทึกการเชื่อมต่อเรียบร้อย!
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-[11px] text-rose-600 font-bold inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> บันทึกไม่สำเร็จกรุณาลองใหม่
                  </span>
                )}
                <div className="flex-1" />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-98 shrink-0 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังเซฟ...</span>
                    </>
                  ) : (
                    <span>บันทึกการตั้งค่า 💾</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick instructions guide */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-500" />
              <span>คู่มือเริ่มต้นเปิดการทำงานของบอท LINE OA</span>
            </h2>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="border-l-2 border-slate-200 pl-3 py-0.5">
                <p className="font-bold text-slate-800">1. สร้างบัญชีนักพัฒนา LINE</p>
                <p className="text-slate-400 mt-0.5 text-[11px]">สมัครและล็อกอินเข้าใช้งานที่ <a href="https://developers.line.biz/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">LINE Developers Console</a></p>
              </div>

              <div className="border-l-2 border-slate-200 pl-3 py-0.5">
                <p className="font-bold text-slate-800">2. เปิดบริการ Messaging API</p>
                <p className="text-slate-400 mt-0.5 text-[11px]">เลือก Provider หรือสร้างขึ้นใหม่ จากนั้นสร้าง Channel ประเภท <b>Messaging API</b> เพื่อนำบอทเข้าสู่บัญชี LINE OA ของท่าน</p>
              </div>

              <div className="border-l-2 border-slate-200 pl-3 py-0.5">
                <p className="font-bold text-slate-800">3. คัดลอกและบันทึกคีย์ต่างๆ</p>
                <p className="text-slate-400 mt-0.5 text-[11px]">ก๊อปปี้ <b>Channel Access Token</b> และ <b>Channel Secret</b> ที่ได้ในหน้าตั้งค่าเว็บ LINE นำมาป้อนลงในช่องซ้ายมือนี้แล้วกดเซฟ</p>
              </div>

              <div className="border-l-2 border-slate-200 pl-3 py-0.5">
                <p className="font-bold text-slate-800">4. ตั้งค่า Webhook ในหน้า LINE</p>
                <p className="text-slate-400 mt-0.5 text-[11px]">ก๊อปปี้ Webhook URL ด้านบนไปป้อนลงใน Messaging API Settings บนหน้า LINE จากนั้น <b>เปิดปุ่มใช้งาน Webhook (Use Webhook)</b></p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Hand: Interactive Simulated LINE Chat Playroom (Col-span 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
          
          {/* Header of the Simulator */}
          <div className="bg-[#0f172a] text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-base shadow-inner font-bold">
                💚
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wide">ห้องแชตจำลอง LINE Bot AI</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold uppercase">LIVE</span>
                </div>
                <p className="text-[10px] text-slate-400">บอททำการประมวลผลสต๊อกในฐานข้อมูลปัจจุบันจริง (Real DB Sync)</p>
              </div>
            </div>

            <button
              onClick={handleClearChatHistory}
              type="button"
              className="text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="ล้างข้อความประวัติแชต"
            >
              <RefreshCcw className="w-3 h-3" />
              <span>ล้างหน้าแชต</span>
            </button>
          </div>

          {/* Messages Feed Area */}
          <div className="flex-1 overflow-y-auto bg-[#849cc4] p-4 space-y-4">
            
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Bot Profile Icon */}
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm shadow-md shrink-0 border border-slate-200 font-bold">
                    🤖
                  </div>
                )}

                <div className="flex flex-col max-w-[80%] space-y-1">
                  {/* Sender title */}
                  <span className={`text-[9px] font-semibold text-white/80 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.sender === 'user' ? 'คุณ (พนักงานคลัง)' : 'บอทคลังสินค้าอัจฉริยะ AI'}
                  </span>

                  {/* Bubble body */}
                  <div 
                    className={`rounded-2xl px-4 py-2.5 text-xs shadow-md whitespace-pre-line leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-[#24d16d] text-slate-900 rounded-tr-none font-medium' 
                        : 'bg-white text-slate-800 rounded-tl-none font-mono'
                    }`}
                  >
                    {msg.text}

                    {/* Action notification inside bubble if actual DB change happened */}
                    {msg.isSimulatedAction && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-100 flex items-center gap-1 text-[10px] text-emerald-700 font-bold animate-pulse">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>ฐานข้อมูลหลักกลางถูกตัด/เติมยอดขายเรียบร้อย!</span>
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className={`text-[8px] text-white/60 font-medium ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isBotTyping && (
              <div className="flex items-start gap-2.5 justify-start">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm shadow-md shrink-0 border border-slate-200 font-bold">
                  🤖
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-[9px] font-semibold text-white/80">บอทคลังสินค้าอัจฉริยะ AI</span>
                  <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-md flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-1 text-[10px] font-sans">กำลังพิมพ์คำตอบ...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Access Action Cards / Buttons in Thai */}
          <div className="bg-slate-50 border-t border-slate-200 p-3 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>ปุ่มคำสั่งลัดในการทดสอบบอท LINE (Quick Commands Sandbox)</span>
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              
              {/* Category 1: Check items info & general balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-2">
                <span className="text-[9px] font-bold text-blue-600 block flex items-center gap-1">
                  <ListFilter className="w-3 h-3" /> เช็คสต๊อก & ข้อมูลสินค้า
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleQuickCommand('ตรวจสต๊อก')}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-[10px] text-left cursor-pointer transition-all border border-blue-100"
                  >
                    📊 ตรวจสต๊อกสินค้าทั้งหมด
                  </button>
                  <button
                    onClick={() => handleQuickCommand('สินค้าใกล้หมด')}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-lg text-[10px] text-left cursor-pointer transition-all border border-amber-100"
                  >
                    🚨 เช็คสินค้าใกล้หมดเกณฑ์
                  </button>
                  <button
                    onClick={() => handleQuickCommand(`เช็ค ${sampleSku}`)}
                    className="px-2.5 py-1.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-mono rounded-lg text-[10px] text-left cursor-pointer transition-all border border-slate-200"
                  >
                    🔍 ค้นหารหัส: {sampleSku}
                  </button>
                  <button
                    onClick={() => handleQuickCommand(`ชื่อสินค้า ${sampleName}`)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-[10px] text-left cursor-pointer transition-all border border-indigo-100"
                  >
                    🔍 ค้นด้วยชื่อ: "{sampleName}"
                  </button>
                  <button
                    onClick={() => handleQuickCommand('จำ SKU ไม่ได้')}
                    className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold rounded-lg text-[10px] text-left cursor-pointer transition-all border border-violet-100"
                  >
                    💡 จำ SKU ไม่ได้? (วิธีสืบค้น)
                  </button>
                </div>
              </div>

              {/* Category 2: Update stock quantity IN / OUT */}
              <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-2">
                <span className="text-[9px] font-bold text-emerald-600 block flex items-center gap-1">
                  <Layers className="w-3 h-3" /> แจ้งรับสินค้า & เบิกพัสดุ
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleQuickCommand(`รับเข้า ${sampleSku} จำนวน 20`)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-[10px] text-left cursor-pointer transition-all border border-emerald-100 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>แจ้งรับเข้า +20 ({sampleSku})</span>
                  </button>
                  <button
                    onClick={() => handleQuickCommand(`เบิก ${sampleSku} จำนวน 10`)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-[10px] text-left cursor-pointer transition-all border border-rose-100 inline-flex items-center gap-1"
                  >
                    <Minus className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>แจ้งส่งออก -10 ({sampleSku})</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Interactive Chat input form */}
          <form onSubmit={handleSendSimulatedMessage} className="bg-white p-3 border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="พิมพ์คำสั่ง หรือถาม เช่น 'เช็ค TS-001' หรือ 'รับเข้า TS-001 จำนวน 30'..."
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#24d16d]/20 focus:border-[#24d16d] outline-none transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 hover:scale-[1.01] active:scale-95 shadow-md"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">ส่งแชต</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
