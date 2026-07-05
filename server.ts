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

// Initialize Gemini dynamically using firestore custom key fallback if available
async function getGeminiClient(): Promise<GoogleGenAI> {
  let customApiKey: string | null = null;
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data && data.geminiApiKey) {
        customApiKey = data.geminiApiKey.trim();
      }
    }
  } catch (err) {
    console.warn("Failed to fetch settings for custom geminiApiKey in server:", err);
  }

  const key = customApiKey || process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Helper function to generate content with multiple fallback models and retries
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
}) {
  const ai = await getGeminiClient();
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

  if (lastError) {
    const errMsg = lastError?.message || String(lastError);
    const errStatus = lastError?.status || "";
    const errorString = errMsg + " " + errStatus + " " + (typeof lastError === "object" ? JSON.stringify(lastError) : "");
    if (
      errorString.includes("429") || 
      errorString.includes("RESOURCE_EXHAUSTED") || 
      errorString.includes("Quota exceeded") || 
      errorString.includes("rate-limits")
    ) {
      throw new Error(
        "⚠️ โควต้าบริการ Gemini AI ของระบบแชร์ฟรีเต็มชั่วคราว (Error 429: Quota Exceeded) " +
        "เพื่อแก้ปัญหานี้และใช้งานสแกนพัสดุต่อได้ทันทีโดยไม่จำกัด กรุณาไปที่เมนู 'ตั้งค่าระบบ' -> หัวข้อ 'ตั้งค่าสิทธิ์เข้าใช้งาน Gemini AI API Key' " +
        "แล้วป้อน API Key ส่วนตัวของคุณเอง (ใช้งานได้ฟรี 100% ตามวิธีสมัครในหน้าดังกล่าวครับ)"
      );
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
                    const geminiApiKey = (settings.geminiApiKey || "").trim() || process.env.GEMINI_API_KEY || "";
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

  // Scan Label Endpoint (Base64 file/image/PDF parsing)
  app.post("/api/scan-label", express.json({ limit: "25mb" }), async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image/file data" });
      }

      // Load products to create a reference list for SKU mapping
      let skuReferenceListText = "";
      try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const productsList: string[] = [];
        productsSnapshot.forEach((docSnap) => {
          const p = docSnap.data();
          if (p.sku) {
            productsList.push(`- SKU: ${p.sku} | Name: ${p.name}`);
          }
        });
        skuReferenceListText = productsList.join("\n");
      } catch (dbErr) {
        console.error("Failed to read products reference for AI mapping:", dbErr);
      }

      // Handle base64 format (could be image/png, image/jpeg, or application/pdf)
      let mimeType = "image/jpeg";
      let base64Data = image;

      if (image.startsWith("data:")) {
        const match = image.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      console.log(`[Scan Label] Received file of mimeType: ${mimeType}`);

      const systemInstruction = `You are an expert logistics parser. Analyze the provided document (shipping label, parcel invoice, or PDF file).
Identify and extract fields for ALL shipping labels or parcel invoices present in the document.

CRITICAL INSTRUCTIONS:
1. If the document is a multi-page PDF file, you MUST analyze and parse EVERY SINGLE page (e.g., Page 1, Page 2, Page 3, Page 4, etc.). You must return a separate parsed label object for EACH page in the 'labels' array. DO NOT skip any pages, and do NOT aggregate them into a single label; keep them as separate individual labels in the order they appear. If there are 4 pages, there MUST be exactly 4 elements in the 'labels' array.
2. For each label/page, you MUST extract ALL individual product items listed on the document. If a label has 2, 3, 4, or more separate items/products, you MUST split them and return each of them as a separate object in the 'extractedItems' array. NEVER aggregate different products or omit any items. Show all of them.
3. If there are active SKUs in the system (provided below), map the text to the closest matching SKU in the reference list.

Reference SKUs currently in the System:
${skuReferenceListText || "(No SKUs found in system database)"}

Ensure that each item has its SKU code, product description, and a numeric quantity.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          labels: {
            type: Type.ARRAY,
            description: "List of all parsed shipping labels. Each page or document should correspond to exactly one entry in this array. If there are 4 pages, you MUST return exactly 4 entries in this array.",
            items: {
              type: Type.OBJECT,
              properties: {
                orderId: { type: Type.STRING, description: "The order ID or order number of this specific page, empty if not found" },
                trackingNo: { type: Type.STRING, description: "The tracking number, barcode, or reference code of this specific page, empty if not found" },
                labelType: { type: Type.STRING, description: "Courier or platform of this page e.g. SHOPEE, LAZADA, TIKTOK, FLASH, KERRY, JT, POST, or UNKNOWN" },
                detectedAction: { type: Type.STRING, description: "Must be OUT for typical courier/shipping labels, IN for intakes, RETURN for customer returns. Default is OUT." },
                extractedItems: {
                  type: Type.ARRAY,
                  description: "List of ALL individual product items detected on this label/page. If a label lists 2, 3, 4, or more separate items, you MUST list each of them as a separate object in this array.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sku: { type: Type.STRING, description: "The SKU code matched to the system if possible, otherwise exactly as shown" },
                      productName: { type: Type.STRING, description: "The product description/name as shown on the label" },
                      quantity: { type: Type.INTEGER, description: "The numeric quantity of the item" }
                    },
                    required: ["sku", "productName", "quantity"]
                  }
                }
              },
              required: ["orderId", "trackingNo", "labelType", "detectedAction", "extractedItems"]
            }
          }
        },
        required: ["labels"]
      };

      const aiResponse = await generateContentWithFallback({
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          `This document may have MULTIPLE pages (especially if it is a multi-page PDF with 4 or more pages). 
You MUST analyze and parse EVERY SINGLE page in the document.
Do NOT stop at page 1. Do NOT aggregate pages.
For EACH page, you MUST generate exactly one separate entry in the 'labels' array in the exact order they appear in the file.
If the document has 4 pages, there MUST be exactly 4 elements in the 'labels' array.
Parse this document completely and return the details in structured JSON matching the specified schema.`
        ],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1
        }
      });

      const responseText = aiResponse.text;
      console.log("[Scan Label] Gemini RAW Response:", responseText);

      const parsedData = JSON.parse(responseText.trim());
      return res.json(parsedData);
    } catch (err: any) {
      console.error("Error in /api/scan-label:", err);
      return res.status(500).json({ error: err.message || "Internal server error during PDF/label scan" });
    }
  });

  // Scan PDF Text Endpoint (Direct text analysis)
  app.post("/api/scan-pdf-text", express.json(), async (req, res) => {
    try {
      const { pages } = req.body;
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        return res.status(400).json({ error: "Missing text pages array" });
      }

      // Load products reference for SKU matching
      let skuReferenceListText = "";
      try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const productsList: string[] = [];
        productsSnapshot.forEach((docSnap) => {
          const p = docSnap.data();
          if (p.sku) {
            productsList.push(`- SKU: ${p.sku} | Name: ${p.name}`);
          }
        });
        skuReferenceListText = productsList.join("\n");
      } catch (dbErr) {
        console.error("Failed to read products reference for text mapping:", dbErr);
      }

      const results = [];

      // Process each text page
      for (const page of pages) {
        const textContent = page.text || "";
        if (!textContent.trim()) {
          continue;
        }

        const systemInstruction = `You are an expert logistics text parser.
Analyze the provided plain text contents of a PDF page or parcel label bill.
Identify the Order ID, Tracking Number, Platform/Courier type, stock action (OUT/IN/RETURN), and all product SKU lines with their corresponding quantities.
Split multiple items into separate rows inside 'extractedItems'.
Map any SKU/product names to the closest matching SKU in the reference system provided below.

Reference SKUs currently in the System:
${skuReferenceListText || "(No SKUs found in system database)"}`;

        const pageResultSchema = {
          type: Type.OBJECT,
          properties: {
            orderId: { type: Type.STRING },
            trackingNo: { type: Type.STRING },
            labelType: { type: Type.STRING },
            detectedAction: { type: Type.STRING },
            extractedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sku: { type: Type.STRING },
                  productName: { type: Type.STRING },
                  quantity: { type: Type.INTEGER }
                },
                required: ["sku", "productName", "quantity"]
              }
            }
          },
          required: ["orderId", "trackingNo", "labelType", "detectedAction", "extractedItems"]
        };

        const aiResponse = await generateContentWithFallback({
          contents: [
            `Please analyze this plain text content from page ${page.pageNumber || 1}:\n\n${textContent}`
          ],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: pageResultSchema,
            temperature: 0.1
          }
        });

        const textResponse = aiResponse.text;
        console.log(`[Scan PDF Text] Page ${page.pageNumber || 1} RAW Response:`, textResponse);
        const parsedPage = JSON.parse(textResponse.trim());
        results.push(parsedPage);
      }

      return res.json({ results });
    } catch (err: any) {
      console.error("Error in /api/scan-pdf-text:", err);
      return res.status(500).json({ error: err.message || "Internal server error during PDF text scan" });
    }
  });

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

  // Endpoint to get the server-side version (based on server startup time)
  // This helps clients detect if the server has been redeployed or restarted
  const SERVER_VERSION = "build-" + Date.now();
  app.get("/api/version", (req, res) => {
    res.json({ version: SERVER_VERSION });
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
      // Force cache busting on index.html so clients always load the latest compiled build
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running successfully on port ${PORT}`);
  });
}

startServer();
