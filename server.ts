import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { GoogleGenAI, Type } from "@google/genai";

const PORT = 3000;

const firebaseConfig = {
  apiKey: "AIzaSyCp-QfMXtH4PZPx-b-T2bP-qkZyJ1Q9UU4",
  authDomain: "innate-facet-klsxp.firebaseapp.com",
  projectId: "innate-facet-klsxp",
  storageBucket: "innate-facet-klsxp.firebasestorage.app",
  messagingSenderId: "302222547158",
  appId: "1:302222547158:web:174df22e64c6dc9fab9177"
};

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, "ai-studio-d2035f6d-8e85-41ea-9141-eedfc5e93833");

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper function to generate content with multiple fallback models and retries
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
}) {
  // We use gemini-3.5-flash as the primary fast and stable model for multimodal/text,
  // followed by gemini-3.1-flash-lite as the fallback.
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[AI] Attempting generateContent with model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: params.contents,
        config: params.config,
      });
      console.log(`[AI] Successfully generated content using model: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[AI] Error with model ${model}:`, errMsg);
    }
  }

  throw lastError || new Error("Failed to generate content with all available models.");
}

async function startServer() {
  const app = express();

  // Webhook for LINE Messaging API
  // Uses raw parser to verify LINE HMAC signature
  const handleLineWebhook = async (req: express.Request, res: express.Response) => {
    try {
      const rawBody = req.body.toString("utf8");
      const signature = req.headers["x-line-signature"] as string;

      // 1. Immediately send 200 OK back to LINE to close the connection and avoid timeouts (Verify button & normal messages)
      res.status(200).send("OK");

      // 2. Process all message/ping events asynchronously in the background
      Promise.resolve().then(async () => {
        try {
          // Parse request body safely
          let payload;
          try {
            payload = JSON.parse(rawBody);
          } catch (e) {
            return; // Non-JSON test payloads, ignore safely
          }

          const events = payload.events || [];
          if (events.length === 0) {
            return; // Empty ping / LINE verify test - already returned 200 OK above!
          }

          // Fetch settings from Firestore for processing real messages
          const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
          if (!settingsDoc.exists()) {
            console.warn("AppSettings does not exist in Firestore.");
            return;
          }
          const settings = settingsDoc.data();
          const accessToken = settings.lineChannelAccessToken;
          const channelSecret = settings.lineChannelSecret;
          const isEnabled = settings.lineBotEnabled;

          if (!isEnabled || !accessToken) {
            console.log("LINE Bot is disabled or access token is missing.");
            return;
          }

          // Validate signature (Optional security layer)
          if (channelSecret && signature) {
            const hash = crypto
              .createHmac("SHA256", channelSecret)
              .update(rawBody)
              .digest("base64");
            if (hash !== signature) {
              console.warn("Invalid LINE Signature in background. Ignoring events.");
              return;
            }
          }

          for (const event of events) {
            if (event.type === "message" && event.message && event.message.type === "text") {
              const text = event.message.text.trim();
              const replyToken = event.replyToken;

              if (!replyToken) continue;

              console.log(`Received LINE Message (Background): "${text}" from ${event.source?.userId}`);

              // Query live inventory snapshot
              const productsSnap = await getDocs(collection(db, "products"));
              const productsList: any[] = [];
              productsSnap.forEach((doc) => {
                productsList.push(doc.data());
              });

              const lowerText = text.toLowerCase();
              let replyText = "";
              let processed = false;

              // 1. Instant Greeting Router
              const isGreeting = ["สวัสดี", "ดีครับ", "ดีค่ะ", "หวัดดี", "เริ่ม", "เริ่มต้น", "hello", "hi", "hey", "บอท", "bot"].some(keyword => lowerText.includes(keyword));
              
              // 2. Instant Low Stock Router
              const isLowStockQuery = ["ใกล้หมด", "เหลือน้อย", "หมด", "เตือน", "แจ้งเตือน", "alert", "low stock", "out of stock"].some(keyword => lowerText.includes(keyword));
              
              // 3. Instant Summary Router
              const isSummaryQuery = (["สรุป", "ภาพรวม", "ทั้งหมด", "summary", "report", "overview"].some(keyword => lowerText.includes(keyword)) && 
                                     ["สต๊อก", "สินค้า", "คลัง", "stock", "product"].some(keyword => lowerText.includes(keyword))) || lowerText === "สต๊อก";

              if (isGreeting) {
                replyText = `สวัสดีครับ! 📦 ผมคือ บอทคลังสินค้าอัจฉริยะ (AI Warehouse Assistant) ยินดีให้บริการครับ!

คุณสามารถพิมพ์ถามคำสั่งด่วนเหล่านี้ได้เลยเพื่อการทำงานที่เร็วที่สุด (ระบบจะวิเคราะห์และดึงข้อมูลสดทันที):
• ⚠️ พิมพ์ "สต๊อกใกล้หมด" เพื่อดูสินค้าที่เหลือน้อยเตือนภัย
• 📊 พิมพ์ "สรุปสต๊อก" เพื่อดูรายงานภาพรวมคลังสินค้า
• 🔍 พิมพ์ [ชื่อสินค้า หรือ รหัส SKU] เช่น "KP-GR" เพื่อเช็คยอดคงเหลือและพิกัดชั้นวางได้ทันที!

ยินดีช่วยพนักงานทุกคนดูแลคลังสินค้าครับ! 😊`;
                processed = true;
              } else if (isLowStockQuery) {
                const alertProducts = productsList.filter(p => (Number(p.quantity || 0) <= Number(p.minStock || 0)) || Number(p.quantity || 0) === 0);
                if (alertProducts.length === 0) {
                  replyText = `🎉 ยินดีด้วยครับ! ขณะนี้ไม่มีสินค้าใดที่ต่ำกว่าเกณฑ์แจ้งเตือนหรือใกล้หมดในคลังสินค้าเลยครับ ทุกรายการมีจำนวนเพียงพอปกติครับ 👍`;
                } else {
                  const listText = alertProducts.slice(0, 20).map((p, idx) => {
                    const statusIcon = Number(p.quantity || 0) === 0 ? "❌ หมดเกลี้ยง" : "⚠️ ต่ำเกณฑ์";
                    return `${idx + 1}. [${p.sku || 'ไม่มี SKU'}] ${p.name}\n   👉 คงเหลือ: *${p.quantity}* ${p.unit || 'ชิ้น'} (เกณฑ์เตือน: ${p.minStock})\n   📍 ชั้นวาง: ${p.location || 'ไม่ระบุ'} (${statusIcon})`;
                  }).join("\n\n");

                  const totalAlerts = alertProducts.length;
                  const footer = totalAlerts > 20 ? `\n\n...และยังมีอีก ${totalAlerts - 20} รายการที่ใกล้หมดในคลัง` : "";
                  replyText = `⚠️ รายงานสินค้าเหลือน้อยและต่ำกว่าเกณฑ์ (${totalAlerts} รายการ):\n\n${listText}${footer}\n\n💡 รีบจัดเตรียมเติมสต๊อกด่วนนะครับ!`;
                }
                processed = true;
              } else if (isSummaryQuery) {
                const totalProductsCount = productsList.length;
                const totalItemsCount = productsList.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
                const outOfStockCount = productsList.filter(p => Number(p.quantity || 0) === 0).length;
                const lowStockCount = productsList.filter(p => Number(p.quantity || 0) <= Number(p.minStock || 0) && Number(p.quantity || 0) > 0).length;

                replyText = `📊 สรุปรายงานภาพรวมคลังสินค้าเรียลไทม์:\n
• 📦 สินค้าทั้งหมดในระบบ: *${totalProductsCount}* รายการ
• 🔢 จำนวนชิ้นรวมทั้งหมด: *${totalItemsCount}* ชิ้น
• ❌ สินค้าหมดสต๊อก: *${outOfStockCount}* รายการ
• ⚠️ สินค้าที่เหลือน้อยกว่าเกณฑ์: *${lowStockCount}* รายการ\n
💡 พิมพ์ชื่อสินค้าหรือรหัส SKU เพื่อตรวจเช็กสต๊อกรายตัวได้เลยครับ!`;
                processed = true;
              } else {
                // Try smart keyword search in local database
                const searchTerms = text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                const matchedProducts = productsList.filter(p => {
                  const pName = (p.name || "").toLowerCase();
                  const pSku = (p.sku || "").toLowerCase();
                  const pCategory = (p.category || "").toLowerCase();
                  const pLocation = (p.location || "").toLowerCase();

                  return searchTerms.some(term => {
                    if (term.length < 2 && !term.match(/[0-9]/)) return false; // skip single non-numeric letters
                    return pName.includes(term) || pSku.includes(term) || pCategory.includes(term) || pLocation.includes(term);
                  });
                });

                // If we found exact specific matches (e.g. 1 to 5 items), answer instantly with exact real-time data
                if (matchedProducts.length > 0 && matchedProducts.length <= 5) {
                  const listText = matchedProducts.map((p, idx) => {
                    const statusIcon = Number(p.quantity || 0) === 0 ? "❌ สินค้าหมดสต๊อก" : (Number(p.quantity || 0) <= Number(p.minStock || 0) ? "⚠️ ต่ำกว่าเกณฑ์เตือน" : "✅ สต๊อกปกติ");
                    return `📦 [${idx + 1}/${matchedProducts.length}] ${p.name}\n• SKU: \`${p.sku || 'ไม่มี'}\`\n• หมวดหมู่: ${p.category || 'ทั่วไป'}\n• คงเหลือสต๊อก: *${p.quantity}* ${p.unit || 'ชิ้น'} (เกณฑ์เตือน: ${p.minStock})\n• พิกัดจัดเก็บ: 📍 *${p.location || 'ไม่ระบุ'}*\n• สถานะปัจจุบัน: ${statusIcon}`;
                  }).join("\n\n");
                  replyText = `🔍 ดึงข้อมูลสินค้าตรงคีย์เวิร์ด "${text}" สำเร็จ:\n\n${listText}`;
                  processed = true;
                } else {
                  // Use Gemini but with highly optimized, slimmed down context!
                  // Only pass matching items if found, or first 15 products to ensure we never bloat the context or timeout.
                  const filteredProducts = matchedProducts.length > 0 ? matchedProducts.slice(0, 20) : productsList.slice(0, 15);
                  const productsContext = filteredProducts.map(p => 
                    `- SKU: ${p.sku}, ชื่อ: ${p.name}, หมวดหมู่: ${p.category || 'ทั่วไป'}, คงเหลือ: ${p.quantity} ${p.unit || 'ชิ้น'}, จุดแจ้งเตือน: ${p.minStock} ${p.unit || 'ชิ้น'}, พิกัดหน่วยเก็บ: ${p.location || 'ไม่ได้ระบุ'}`
                  ).join("\n");

                  let systemPrompt = "";
                  const customPrompt = settings.lineBotSystemPrompt || "";

                  if (customPrompt) {
                    systemPrompt = customPrompt
                      .replace(/\{\{productsContext\}\}/g, productsContext)
                      .replace(/\{\{text\}\}/g, text);
                  } else {
                    systemPrompt = `คุณคือผู้ดูแลบอร์ดจัดการคลังสินค้าอัจฉริยะประมวลผลด้วย AI (Warehouse Stock Assistant Bot) สื่อสารผ่านแอพ LINE ด้วยภาษาไทยที่กระชับ ชัดเจน เปี่ยมความช่วยเหลือ และเป็นมิตร
  
นี่คือข้อมูลสต๊อกสินค้าที่ดึงตามความเกี่ยวข้องล่าสุดจริงภายในระบบ (เรียลไทม์):
${productsContext}

พนักงานพิมพ์ถามคุณว่า: "${text}"

โปรดประมวลผลวิเคราะห์และปฏิบัติดังนี้:
1. ตอบกลับด้วยความกระชับ ตรงประเด็น และถูกต้องตามสถิติตัวเลขข้างบน 100% ห้ามเดาตัวเลข
2. จัดรูปแบบข้อความให้น่าอ่านด้วย Bullet points, ตัวหนา, หรืออิโมจิ เพื่อให้พนักงานดูแชตบนหน้าจอมือถือได้ชัดเจนที่สุด
3. หากพนักงานพิมพ์ค้นหาแล้วไม่พบตรงกับรายการสต๊อก ให้บอกอย่างสุภาพว่าไม่พบข้อมูลและชวนให้พิมพ์ระบุด้วยชื่ออื่นหรือ SKU อื่นครับ`;
                  }

                  try {
                    const geminiResponse = await generateContentWithFallback({
                      contents: systemPrompt
                    });
                    replyText = geminiResponse.text || "ขออภัยครับ ระบบวิเคราะห์ข้อมูลไม่สำเร็จ";
                  } catch (geminiError) {
                    console.error("Gemini Content Generation Error:", geminiError);
                    
                    // Ultra-resilient local fallback so the user always gets their data!
                    if (matchedProducts.length > 0) {
                      const listText = matchedProducts.slice(0, 5).map((p) => {
                        return `📦 ${p.name}\n• SKU: \`${p.sku}\`\n• คงเหลือ: *${p.quantity}* ${p.unit}\n• พิกัดจัดเก็บ: 📍 *${p.location || 'ไม่ระบุ'}*`;
                      }).join("\n\n");
                      replyText = `🔍 ดึงข้อมูลแบบออฟไลน์เรียลไทม์ให้สำเร็จ (เนื่องจาก Google AI ขัดข้องชั่วคราว):\n\n${listText}`;
                    } else {
                      replyText = `ขออภัยครับ ระบบประมวลผล AI ขัดข้องชั่วคราว โปรดระบุชื่อสินค้าหรือรหัส SKU เพื่อค้นหาจากฐานข้อมูลตรงได้เลยครับ!`;
                    }
                  }
                  processed = true;
                }
              }

              // Reply back to LINE using native fetch API
              const lineReplyUrl = "https://api.line.me/v2/bot/message/reply";
              const resLine = await fetch(lineReplyUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                  replyToken,
                  messages: [
                    {
                      type: "text",
                      text: replyText
                    }
                  ]
                })
              });

              if (!resLine.ok) {
                const errBody = await resLine.text();
                console.error("LINE Reply API error response (Background):", errBody);
              } else {
                console.log("LINE message replied successfully in background.");
              }
            }
          }
        } catch (backgroundErr) {
          console.error("Error in background webhook execution process:", backgroundErr);
        }
      });
    } catch (err) {
      console.error("Error inside LINE webhook handler outer shell:", err);
      if (!res.headersSent) {
        res.status(200).send("OK");
      }
    }
  };

  // Support both versions of trailing slashes and raw body parser
  app.post("/api/line-webhook", express.raw({ type: "application/json" }), handleLineWebhook);
  app.post("/api/line-webhook/", express.raw({ type: "application/json" }), handleLineWebhook);

  // Friendly GET endpoint to prevent 404/302 redirects when probing with a browser or verification client
  app.get(["/api/line-webhook", "/api/line-webhook/"], (req, res) => {
    res.status(200).send("LINE Webhook Endpoint is ONLINE & running successfully! Please configure this URL (with HTTPS) in your LINE Developer Console.");
  });

  // Support JSON parsers for normal REST API pathways with generous limit for image uploads
  app.use(express.json({ limit: "20mb" }));

  // LINE Bot Health Check and Context Provider Endpoint
  app.get("/api/line-status", async (req, res) => {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
      if (!settingsDoc.exists()) {
        return res.json({ isConfigured: false, isEnabled: false });
      }
      const settings = settingsDoc.data();
      return res.json({
        isConfigured: !!settings.lineChannelAccessToken,
        isEnabled: !!settings.lineBotEnabled,
        hasSecret: !!settings.lineChannelSecret
      });
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  });

  // Google Sheets integration back-sync webhook
  app.post("/api/sheets-update", async (req, res) => {
    try {
      const { spreadsheetId, products } = req.body;
      if (!spreadsheetId) {
        return res.status(400).json({ error: "Missing spreadsheetId" });
      }

      // Load actual settings to verify spreadsheet ID
      const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
      if (!settingsDoc.exists()) {
        return res.status(404).json({ error: "AppSettings not found" });
      }
      const settings = settingsDoc.data();
      if (settings.googleSheetsId !== spreadsheetId) {
        return res.status(403).json({ error: "Unauthorized Spreadsheet ID: " + spreadsheetId });
      }

      // Update products in Firestore
      if (Array.isArray(products)) {
        for (const prod of products) {
          if (!prod.sku) continue;
          const prodRef = doc(db, "products", prod.sku);
          await setDoc(prodRef, {
            id: prod.sku,
            sku: prod.sku,
            name: prod.name || "",
            category: prod.category || "ทั่วไป",
            quantity: Number(prod.quantity) || 0,
            minStock: Number(prod.minStock) || 0,
            unit: prod.unit || "ชิ้น",
            location: prod.location || "ไม่ได้ระบุ",
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Update settings synced timestamp
      await updateDoc(doc(db, "settings", "appSettings"), {
        googleSheetsLastSyncedAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        success: true, 
        message: `Synced ${products?.length || 0} items successfully!` 
      });
    } catch (err: any) {
      console.error("Sheets update error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Gemini AI Label Scanner Endpoint
  app.post("/api/scan-label", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "กรุณาส่งรูปภาพใบลาเบลสินค้าเพื่อทำการสแกน" });
      }

      let mimeType = "image/jpeg";
      let base64Data = image;
      if (image.startsWith("data:")) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };

      const promptPart = {
        text: "วิเคราะห์ภาพถ่ายนี้ซึ่งเป็นใบปะหน้าพัสดุ (Shipping Label), ใบสั่งซื้อ (Order Receipt), ใบจัดส่งพัสดุจากแพลตฟอร์มต่างๆ เช่น Shopee, TikTok Shop, Lazada หรือบิลระบบขนส่งอื่นๆ (Flash, J&T, Kerry, ไปรษณีย์ไทย) ค้นหาเลขที่สั่งซื้อ (Order ID), เลขแทรคกิ้งขนส่ง (Tracking Number), และรายชื่อสินค้าพร้อมรหัส SKU สินค้าและจำนวนชิ้น (Quantity) \n\nข้อแนะนำสำหรับแพลตฟอร์ม:\n- สำหรับ TikTok Shop: ค้นหาสินค้าในตารางรายการที่มักมีคำว่า 'Seller SKU', 'รหัสสินค้า', 'ชื่อสินค้า', 'จำนวน' หรือ 'Qty'\n- สำหรับ Shopee: ค้นหาส่วนของรายการจัดส่งท้ายฉลากพัสดุหรือมุมขวาบน/ล่าง ที่มักมีคำว่า 'SKU', 'Parent SKU', 'จำนวน/Qty' หรือรหัสย่อสินค้า\n- กรุณาทำความสะอาดรหัส SKU โดยตัดเว้นวรรคที่ไม่จำเป็นออก และแปลงให้อยู่ในโครงสร้าง JSON ที่กำหนด",
      };

      const response = await generateContentWithFallback({
        contents: { parts: [imagePart, promptPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              orderId: { type: Type.STRING, description: "เลขที่สั่งซื้อ หรือเลขอ้างอิงออเดอร์ หากพบในใบลาเบล" },
              trackingNo: { type: Type.STRING, description: "เลขแทรคกิ้งขนส่งพัสดุ (Tracking Number) เช่น SPX..., TH..., KER... หากพบ" },
              labelType: { type: Type.STRING, description: "ประเภทของเอกสารที่สแกน เช่น 'SHIP_LABEL' (ใบปะหน้าขนส่ง), 'INBOUND_RECEIPT' (ใบรับของเข้า), 'BARCODE_TAG' (ป้ายบาร์โค้ดสินค้า), หรือ 'UNKNOWN'" },
              detectedAction: { type: Type.STRING, description: "วัตถุประสงค์ในการทำรายการที่คาดเดาจากใบลาเบล: 'OUT' (ส่งของออก), 'IN' (รับของเข้า), หรือ 'UNKNOWN'" },
              extractedItems: {
                type: Type.ARRAY,
                description: "รายการสินค้าที่แกะข้อมูลได้จากใบลาเบล",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sku: { type: Type.STRING, description: "รหัส SKU หรือรหัสโมเดลสินค้า (พิมพ์ใหญ่, ลบช่องว่างออก)" },
                    productName: { type: Type.STRING, description: "ชื่อหรือรายละเอียดสินค้าสั้นๆ" },
                    quantity: { type: Type.NUMBER, description: "จำนวนสินค้าชิ้นในรายการนั้นๆ หากไม่ระบุให้เป็น 1" }
                  },
                  required: ["sku", "productName", "quantity"]
                }
              }
            }
          }
        }
      });

      const jsonText = response.text || "{}";
      const result = JSON.parse(jsonText);

      // Query live products from Firestore to find matching items
      const productsSnap = await getDocs(collection(db, "products"));
      const allProducts: any[] = [];
      productsSnap.forEach((doc) => {
        allProducts.push({ id: doc.id, ...doc.data() });
      });

      // Match each extracted item
      const enrichedItems = (result.extractedItems || []).map((item: any) => {
        const cleanSku = (item.sku || "").trim().toLowerCase();
        const cleanName = (item.productName || "").trim().toLowerCase();

        // Exact match by SKU
        let matchedProduct = allProducts.find(
          (p) => (p.sku || "").trim().toLowerCase() === cleanSku
        );

        // Partial match by SKU if exact match fails
        if (!matchedProduct && cleanSku) {
          matchedProduct = allProducts.find(
            (p) => (p.sku || "").trim().toLowerCase().includes(cleanSku) || cleanSku.includes((p.sku || "").trim().toLowerCase())
          );
        }

        // Partial match by product name if SKU match fails
        if (!matchedProduct && cleanName) {
          matchedProduct = allProducts.find(
            (p) => (p.name || "").trim().toLowerCase().includes(cleanName) || cleanName.includes((p.name || "").trim().toLowerCase())
          );
        }

        return {
          sku: item.sku || "",
          productName: item.productName || "",
          quantity: item.quantity || 1,
          matched: !!matchedProduct,
          matchedProduct: matchedProduct ? {
            id: matchedProduct.id,
            sku: matchedProduct.sku,
            name: matchedProduct.name,
            quantity: matchedProduct.quantity,
            unit: matchedProduct.unit || "ชิ้น",
            location: matchedProduct.location || "ไม่ได้ระบุ",
            weight: matchedProduct.weight,
            weightUnit: matchedProduct.weightUnit,
          } : null
        };
      });

      return res.status(200).json({
        orderId: result.orderId || "",
        trackingNo: result.trackingNo || "",
        labelType: result.labelType || "UNKNOWN",
        detectedAction: result.detectedAction || "UNKNOWN",
        extractedItems: enrichedItems
      });

    } catch (err: any) {
      console.error("AI Label scanning error:", err);
      return res.status(500).json({ error: "ไม่สามารถสแกนวิเคราะห์ภาพด้วย AI ได้: " + (err.message || String(err)) });
    }
  });

  // Gemini AI PDF Text Scanner Endpoint (Batch processing)
  app.post("/api/scan-pdf-text", async (req, res) => {
    try {
      const { pages } = req.body; // Array of { pageNumber: number, text: string }
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        return res.status(400).json({ error: "กรุณาส่งข้อมูลข้อความจากหน้า PDF เพื่อทำการประมวลผล" });
      }

      // Prepare prompt with page texts
      const formattedPages = pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join("\n\n");
      const promptText = `วิเคราะห์ข้อมูลข้อความที่สกัดจากเอกสาร PDF (ซึ่งเป็นใบปะหน้าพัสดุ, ใบสั่งซื้อ, หรือรายการแพ็คของจากแพลตฟอร์มต่างๆ เช่น Shopee, TikTok Shop, Lazada หรือบิลระบบขนส่งอื่นๆ เช่น Flash, J&T, Kerry) 

ให้ทำการแกะข้อมูลรายชื่อสินค้า รหัส SKU จำนวนชิ้น และเลขอ้างอิงออเดอร์/เลขแทรคกิ้งของแต่ละหน้าอย่างละเอียด

ข้อแนะนำสำหรับแพลตฟอร์ม:
- สำหรับ TikTok Shop: ค้นหาสินค้าในส่วนตารางหรือข้อความที่ระบุ "Seller SKU", "รหัสสินค้า", "ชื่อสินค้า", "จำนวน" หรือ "Qty"
- สำหรับ Shopee: ค้นหาส่วนของรายการจัดส่งท้ายฉลากพัสดุหรือมุมขวาบน/ล่าง ที่มักมีคำว่า "SKU", "Parent SKU", "จำนวน/Qty" หรือรหัสย่อสินค้า
- คีย์บอร์ดหรือรหัสตัวเลขมักเป็นตัวชี้วัด SKU

นี่คือข้อมูลข้อความของหน้าต่างๆ:
${formattedPages}`;

      const response = await generateContentWithFallback({
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                description: "รายการผลลัพธ์การประมวลผลแยกตามเลขหน้า",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.NUMBER, description: "หมายเลขหน้าตรงตามต้นฉบับ" },
                    orderId: { type: Type.STRING, description: "เลขที่สั่งซื้อ (Order ID) หากพบ" },
                    trackingNo: { type: Type.STRING, description: "เลขแทรคกิ้งขนส่ง (Tracking Number) หากพบ" },
                    labelType: { type: Type.STRING, description: "ประเภทเอกสาร: 'SHIP_LABEL' (ใบปะขนส่ง), 'INBOUND_RECEIPT' (ใบรับของเข้า), 'UNKNOWN'" },
                    detectedAction: { type: Type.STRING, description: "การทำงานที่คาดเดา: 'OUT' (ส่งของออก), 'IN' (รับของเข้า), 'UNKNOWN'" },
                    extractedItems: {
                      type: Type.ARRAY,
                      description: "รายการสินค้าที่สกัดข้อมูลได้",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          sku: { type: Type.STRING, description: "รหัส SKU หรือรหัสโมเดลสินค้า (พิมพ์ใหญ่, ลบช่องว่างออก)" },
                          productName: { type: Type.STRING, description: "ชื่อสินค้าหรือรายละเอียดสินค้าสั้นๆ" },
                          quantity: { type: Type.NUMBER, description: "จำนวนชิ้น หากไม่ระบุให้เป็น 1" }
                        },
                        required: ["sku", "productName", "quantity"]
                      }
                    }
                  },
                  required: ["pageNumber", "extractedItems"]
                }
              }
            }
          }
        }
      });

      const jsonText = response.text || "{}";
      const result = JSON.parse(jsonText);

      // Query live products from Firestore to find matching items
      const productsSnap = await getDocs(collection(db, "products"));
      const allProducts: any[] = [];
      productsSnap.forEach((doc) => {
        allProducts.push({ id: doc.id, ...doc.data() });
      });

      // Enrich all results with matched products
      const enrichedResults = (result.results || []).map((pageResult: any) => {
        const enrichedItems = (pageResult.extractedItems || []).map((item: any) => {
          const cleanSku = (item.sku || "").trim().toLowerCase();
          const cleanName = (item.productName || "").trim().toLowerCase();

          // Match by SKU
          let matchedProduct = allProducts.find(
            (p) => (p.sku || "").trim().toLowerCase() === cleanSku
          );

          if (!matchedProduct && cleanSku) {
            matchedProduct = allProducts.find(
              (p) => (p.sku || "").trim().toLowerCase().includes(cleanSku) || cleanSku.includes((p.sku || "").trim().toLowerCase())
            );
          }

          if (!matchedProduct && cleanName) {
            matchedProduct = allProducts.find(
              (p) => (p.name || "").trim().toLowerCase().includes(cleanName) || cleanName.includes((p.name || "").trim().toLowerCase())
            );
          }

          return {
            sku: item.sku || "",
            productName: item.productName || "",
            quantity: item.quantity || 1,
            matched: !!matchedProduct,
            matchedProduct: matchedProduct ? {
              id: matchedProduct.id,
              sku: matchedProduct.sku,
              name: matchedProduct.name,
              quantity: matchedProduct.quantity,
              unit: matchedProduct.unit || "ชิ้น",
              location: matchedProduct.location || "ไม่ได้ระบุ",
              weight: matchedProduct.weight,
              weightUnit: matchedProduct.weightUnit,
            } : null
          };
        });

        const actionType = pageResult.detectedAction === "IN" ? "IN" : pageResult.detectedAction === "RETURN" ? "RETURN" : "OUT";

        return {
          pageNumber: pageResult.pageNumber,
          orderId: pageResult.orderId || "",
          trackingNo: pageResult.trackingNo || "",
          labelType: pageResult.labelType || "UNKNOWN",
          detectedAction: actionType,
          extractedItems: enrichedItems
        };
      });

      return res.status(200).json({ results: enrichedResults });

    } catch (err: any) {
      console.error("AI PDF parsing error:", err);
      return res.status(500).json({ error: "ไม่สามารถประมวลผลข้อความจาก PDF ด้วย AI ได้: " + (err.message || String(err)) });
    }
  });

  // Set up Vite server middleware in dev mode, serve index.html directly in prod mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running successfully on port ${PORT}`);
  });
}

startServer();
