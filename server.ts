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

              // Format context for Gemini
              const productsContext = productsList.map(p => 
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

              let replyText = "";
              try {
                const geminiResponse = await ai.models.generateContent({
                  model: 'gemini-3.5-flash',
                  contents: systemPrompt
                });
                replyText = geminiResponse.text || "ขออภัยครับ ระบบวิเคราะห์ข้อมูลไม่สำเร็จ";
              } catch (geminiError) {
                console.error("Gemini Content Generation Error:", geminiError);
                replyText = `ขออภัยครับ ระบบวิเคราะห์ AI ขัดข้องชั่วคราว: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`;
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

  // Support JSON parsers for normal REST API pathways
  app.use(express.json());

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
