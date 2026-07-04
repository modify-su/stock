import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

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
  const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.1-flash-lite"];
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
            return; // Empty ping / LINE verify test
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

                replyText = `📊 สรุปรายงานภาพรวมคลังสินค้าเรียลไทม์:
• 📦 สินค้าทั้งหมดในระบบ: *${totalProductsCount}* รายการ
• 🔢 จำนวนชิ้นรวมทั้งหมด: *${totalItemsCount}* ชิ้น
• ❌ สินค้าหมดสต๊อก: *${outOfStockCount}* รายการ
• ⚠️ สินค้าที่เหลือน้อยกว่าเกณฑ์: *${lowStockCount}* รายการ

💡 พิมพ์ชื่อสินค้าหรือ SKU เพื่อค้นหารายละเอียดเฉพาะเจาะจงได้เลยครับ!`;
                processed = true;
              } else {
                // Find products matching SKU or Name directly
                const matchedProducts = productsList.filter(p => {
                  const skuMatch = p.sku && p.sku.toLowerCase().includes(lowerText);
                  const nameMatch = p.name && p.name.toLowerCase().includes(lowerText);
                  return skuMatch || nameMatch;
                });

                if (matchedProducts.length > 0 && matchedProducts.length <= 5) {
                  const listText = matchedProducts.map((p) => {
                    const statusIcon = Number(p.quantity || 0) === 0 ? "❌ หมดสต๊อก" : (Number(p.quantity || 0) <= Number(p.minStock || 0) ? "⚠️ ต่ำกว่าเกณฑ์" : "✅ ปกติ");
                    return `• [${p.sku || 'ไม่มี SKU'}] *${p.name}*\n• หมวดหมู่: ${p.category || 'ทั่วไป'}\n• คงเหลือสต๊อก: *${p.quantity}* ${p.unit || 'ชิ้น'} (เกณฑ์เตือน: ${p.minStock})\n• พิกัดจัดเก็บ: 📍 *${p.location || 'ไม่ระบุ'}*\n• สถานะปัจจุบัน: ${statusIcon}`;
                  }).join("\n\n");
                  replyText = `🔍 ดึงข้อมูลสินค้าตรงคีย์เวิร์ด "${text}" สำเร็จ:\n\n${listText}`;
                  processed = true;
                } else {
                  // Fall back to Gemini API
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

นี่คือข้อมูลคงคลังสินค้าล่าสุดจริงภายในระบบ (เรียลไทม์):
${productsContext}

พนักงานหรือผู้ใช้พิมพ์คำถามว่า: "${text}"

โปรดทำตามข้อตกลงในการวิเคราะห์ข้อมูลเพื่อตอบพนักงาน:
1. หากพนักงานกล่าวทักทาย เช่น "สวัสดี", "ดีครับ/ค่ะ" ให้ทักทายกลับและอธิบายงานที่ช่วยตรวจสอบได้ เช่น "สวัสดีครับ! ผมบอทคลังสินค้าอัจฉริยะ ยินดีให้ความช่วยเหลือครับ คุณสามารถพิมพ์ชื่อสินค้าเพื่อตรวจสต๊อก สอบถามพิกัดที่เก็บสินค้า หรือถามหาสินค้าใกล้เหลือน้อยได้เลยครับ! 📦"
2. หากพิมพ์เกี่ยวกับสต๊อกเหลือน้อย หรือสินค้าใกล้หมด หรือแจ้งเตือน ให้ตรวจสอบสินค้าที่จำนวนเหลือน้อยกว่าค่าจุดแจ้งเตือน (minStock) หรือสต๊อกเป็น 0 แล้วสรุปออกมาเป็นรายการแยกย่อยที่เข้าใจเข้าใจง่าย เช่น "⚠️ สินค้าใกล้หมดในระบบมีดังนี้ครับ..."
3. หากพิมพ์พิมพ์ชื่อสินค้าหรือส่วนหนึ่งของชื่อ หรือ SKU ทางร้าน ให้ตอบข้อมูลเฉพาะเจาะจง เช่น ชื่อสินค้า, จำนวนคงเหลือ, หน่วยนับ, พิกัดจานจัดเก็บ เพื่อแจ้งพนักงานอย่างมั่นใจ
4. หากถามสินค้าบางชิ้นที่ไม่มีในรายการข้างต้นเลย ให้ระบุว่า "ขออภัยครับ ไม่พบรายการที่ตรงกับคีย์เวิร์ดนี้ในระบบคลังปัจจุบันครับ" อย่างสุภาพพร้อมบอกให้ลองพิมพ์ค้นหาด้วยรหัสหรือชื่ออื่น
5. พยายามตอบเรียงเป็นข้อๆ (Bullet points) วงเล็บ และตัวหนาเพื่อให้แสดงผลผ่านหน้าจอแชต LINE บนมือถือได้งดงามและประหยัดพื้นที่มากที่สุด`;
                  }

                  try {
                    const geminiApiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey || "";
                    let responseText = "";
                    if (geminiApiKey) {
                      const geminiResponse = await generateContentWithFallback({
                        contents: systemPrompt
                      });
                      responseText = geminiResponse.text || "ขออภัยครับ ระบบวิเคราะห์ข้อมูลไม่สำเร็จ";
                    } else {
                      responseText = "⚠️ ยังไม่ได้ตั้งค่าคีย์เปิดใช้บริการ GEMINI_API_KEY ในระบบหลังบ้าน กรุณาใส่คีย์เพื่อให้ AI ทำงานได้เต็มประสิทธิภาพนะครับ";
                    }
                    replyText = responseText;
                  } catch (geminiError: any) {
                    console.error("Gemini Content Generation Error:", geminiError);
                    replyText = `ขออภัยครับ ระบบวิเคราะห์ AI ขัดข้องชั่วคราว: ${geminiError?.message || String(geminiError)}`;
                  }
                }
              }

              // Send reply back to LINE
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
                console.error("LINE Reply API error response on Server webhook:", errBody);
              } else {
                console.log("LINE message replied successfully from Server webhook!");
              }
            }
          }
        } catch (backgroundErr) {
          console.error("Error in background webhook execution:", backgroundErr);
        }
      });
    } catch (err: any) {
      console.error("Error in LINE webhook handler:", err);
    }
  };

  // Mount the LINE Webhook handler on the Express App
  app.post("/api/line-webhook", express.raw({ type: "application/json" }), handleLineWebhook);

  // Google Sheets Update Endpoint
  app.post("/api/sheets-update", express.json(), async (req, res) => {
    try {
      const { spreadsheetId, products } = req.body;
      if (!spreadsheetId) {
        return res.status(400).json({ error: "Missing spreadsheetId" });
      }

      // Load actual settings to verify sheets ID
      const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
      if (!settingsDoc.exists()) {
        return res.status(404).json({ error: "AppSettings not found" });
      }
      const settings = settingsDoc.data();
      if (settings.googleSheetsId !== spreadsheetId) {
        return res.status(403).json({ error: "Unauthorized Spreadsheet ID: " + spreadsheetId });
      }

      // Load existing products to map SKU to existing document ID
      const productsSnapshot = await getDocs(collection(db, "products"));
      const skuMap = new Map(); // sku -> docId
      productsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.sku) {
          skuMap.set(data.sku.trim().toLowerCase(), docSnap.id);
        }
      });

      // Update products in Firestore
      if (Array.isArray(products)) {
        for (const prod of products) {
          if (!prod.sku) continue;
          const cleanSku = prod.sku.trim().toLowerCase();
          const existingId = skuMap.get(cleanSku);
          const id = existingId || `prod-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

          const prodRef = doc(db, "products", id);
          await setDoc(prodRef, {
            id: id,
            sku: prod.sku.toUpperCase().trim(),
            name: prod.name || "",
            category: prod.category || "ทั่วไป",
            quantity: Number(prod.quantity) || 0,
            minStock: Number(prod.minStock) || 0,
            unit: prod.unit || "ชิ้น",
            location: prod.location || "ไม่ได้ระบุ",
            updatedAt: new Date().toISOString()
          }, { merge: true });
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
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  // Set up Vite server middleware in dev mode, serve index.html directly in prod mode
  if (process.env.NODE_ENV !== "production" || process.env.DISABLE_HMR === "true") {
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
