import crypto from "crypto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";

export const config = {
  api: {
    bodyParser: false, // Disable automatic body parsing to hand-verify the LINE webhook signature correctly
  },
};

const firebaseConfig = {
  apiKey: "AIzaSyCp-QfMXtH4PZPx-b-T2bP-qkZyJ1Q9UU4",
  authDomain: "innate-facet-klsxp.firebaseapp.com",
  projectId: "innate-facet-klsxp",
  storageBucket: "innate-facet-klsxp.firebasestorage.app",
  messagingSenderId: "302222547158",
  appId: "1:302222547158:web:174df22e64c6dc9fab9177"
};

// Initialize or reuse Firebase App
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
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

// Helper to accumulate raw body stream
async function getRawBody(readable: IncomingMessage): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: IncomingMessage & { query: any }, res: ServerResponse) {
  // Support GET probe for verification / health check
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end("LINE Webhook Serverless Endpoint is ONLINE! Please configure this URL in your LINE Developers Console.");
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method Not Allowed");
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["x-line-signature"] as string;

    // 1. Parse payload to handle empty test pings instantly
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      // Just respond OK to non-JSON or invalid test streams immediately
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    const events = payload.events || [];
    if (events.length === 0) {
      // LINE verification test ping has no events. Return 200 OK instantly before querying Firestore.
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    // 2. Retrieve settings from Firestore for processing real events
    const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
    if (!settingsDoc.exists()) {
      console.warn("AppSettings does not exist in Firestore.");
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("AppSettings missing");
    }

    const settings = settingsDoc.data();
    const accessToken = settings.lineChannelAccessToken;
    const channelSecret = settings.lineChannelSecret;
    const isEnabled = settings.lineBotEnabled;

    if (!isEnabled || !accessToken) {
      console.log("LINE Bot is disabled or access token is missing.");
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("LINE Bot Disabled");
    }

    // 3. Validate signature if secret is provided
    if (channelSecret && signature) {
      const hash = crypto
        .createHmac("SHA256", channelSecret)
        .update(rawBody)
        .digest("base64");
      if (hash !== signature) {
        console.warn("Invalid LINE Signature. Rejecting request.");
        res.writeHead(401, { "Content-Type": "text/plain" });
        return res.end("Invalid signature");
      }
    }

    for (const event of events) {
      if (event.type === "message" && event.message && event.message.type === "text") {
        const text = event.message.text.trim();
        const replyToken = event.replyToken;

        if (!replyToken) continue;

        console.log(`Received LINE Message on Serverless Webhook: "${text}"`);

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

        const systemPrompt = `คุณคือผู้ดูแลบอร์ดจัดการคลังสินค้าอัจฉริยะประมวลผลด้วย AI (Warehouse Stock Assistant Bot) สื่อสารผ่านแอพ LINE ด้วยภาษาไทยที่กระชับ ชัดเจน เปี่ยมความช่วยเหลือ และเป็นมิตร

นี่คือข้อมูลคงคลังสินค้าล่าสุดจริงภายในระบบ (เรียลไทม์):
${productsContext}

พนักงานหรือผู้ใช้พิมพ์คำถามว่า: "${text}"

โปรดทำตามข้อตกลงในการวิเคราะห์ข้อมูลเพื่อตอบพนักงาน:
1. หากพนักงานกล่าวทักทาย เช่น "สวัสดี", "ดีครับ/ค่ะ" ให้ทักทายกลับและอธิบายงานที่ช่วยตรวจสอบได้ เช่น "สวัสดีครับ! ผมบอทคลังสินค้าอัจฉริยะ ยินดีให้ความช่วยเหลือครับ คุณสามารถพิมพ์ชื่อสินค้าเพื่อตรวจสต๊อก สอบถามพิกัดที่เก็บสินค้า หรือถามหาสินค้าใกล้เหลือน้อยได้เลยครับ! 📦"
2. หากพิมพ์เกี่ยวกับสต๊อกเหลือน้อย หรือสินค้าใกล้หมด หรือแจ้งเตือน ให้ตรวจสอบสินค้าที่จำนวนเหลือน้อยกว่าค่าจุดแจ้งเตือน (minStock) หรือสต๊อกเป็น 0 แล้วสรุปออกมาเป็นรายการแยกย่อยที่เข้าใจเข้าใจง่าย เช่น "⚠️ สินค้าใกล้หมดในระบบมีดังนี้ครับ..."
3. หากพิมพ์พิมพ์ชื่อสินค้าหรือส่วนหนึ่งของชื่อ หรือ SKU ทางร้าน ให้ตอบข้อมูลเฉพาะเจาะจง เช่น ชื่อสินค้า, จำนวนคงเหลือ, หน่วยนับ, พิกัดจานจัดเก็บ เพื่อแจ้งพนักงานอย่างมั่นใจ
4. หากถามสินค้าบางชิ้นที่ไม่มีในรายการข้างต้นเลย ให้ระบุว่า "ขออภัยครับ ไม่พบรายการที่ตรงกับคีย์เวิร์ดนี้ในระบบคลังปัจจุบันครับ" อย่างสุภาพพร้อมบอกให้ลองพิมพ์ค้นหาด้วยรหัสหรือชื่ออื่น
5. พยายามตอบเรียงเป็นข้อๆ (Bullet points) วงเล็บ และตัวหนาเพื่อให้แสดงผลผ่านหน้าจอแชต LINE บนมือถือได้งดงามและประหยัดพื้นที่มากที่สุด`;

        let replyText = "";
        try {
          const geminiApiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey || "";
          
          let responseText = "";
          if (geminiApiKey) {
            const activeAi = new GoogleGenAI({ 
              apiKey: geminiApiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });
            const geminiResponse = await activeAi.models.generateContent({
              model: "gemini-3.5-flash",
              contents: systemPrompt
            });
            responseText = geminiResponse.text || "ขออภัยครับ ระบบวิเคราะห์ข้อมูลไม่สำเร็จ";
          } else {
            responseText = "⚠️ ยังไม่ได้ตั้งค่าคีย์เปิดใช้บริการ GEMINI_API_KEY ในเครื่องมือหลังบ้าน (Environment Variables) ของ Vercel กรุณาใส่คีย์เพื่อให้ AI ทำงานได้นะครับ";
          }
          replyText = responseText;
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
          console.error("LINE Reply API error response on Serverless webhook:", errBody);
        } else {
          console.log("LINE message replied successfully from Serverless webhook!");
        }
      }
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  } catch (err) {
    console.error("Error inside LINE webhook serverless handler:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}
