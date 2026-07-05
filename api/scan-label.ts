import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { GoogleGenAI, Type } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";

const firebaseConfig = {
  apiKey: "AIzaSyCp-QfMXtH4PZPx-b-T2bP-qkZyJ1Q9UU4",
  authDomain: "innate-facet-klsxp.firebaseapp.com",
  projectId: "innate-facet-klsxp",
  storageBucket: "innate-facet-klsxp.firebasestorage.app",
  messagingSenderId: "302222547158",
  appId: "1:302222547158:web:174df22e64c6dc9fab9177"
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp, "ai-studio-d2035f6d-8e85-41ea-9141-eedfc5e93833");

// Lazy initialize Gemini with firestore custom key fallback
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
    console.warn("Failed to fetch settings for custom geminiApiKey:", err);
  }

  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("ระบบตรวจไม่พบ API Key สำหรับประมวลผล Gemini AI กรุณาตรวจสอบหรือตั้งค่าในระบบหลังบ้านก่อนครับ");
  }

  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Fallback helper
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
}) {
  const ai = await getGeminiClient();
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    let attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[Vercel Serverless AI] Attempting generateContent with model: ${model} (attempt ${attempt}/${attempts})`);
        const response = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Vercel Serverless AI] Error with model ${model} (attempt ${attempt}/${attempts}):`, err?.message || String(err));
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
  }

  throw lastError || new Error("Failed to generate content with all available models.");
}

async function getRawBody(readable: IncomingMessage): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method Not Allowed");
  }

  try {
    let payload;
    if ((req as any).body !== undefined && (req as any).body !== null && (req as any).body !== "") {
      payload = typeof (req as any).body === "string" ? JSON.parse((req as any).body) : (req as any).body;
    } else {
      const rawBody = await getRawBody(req);
      try {
        payload = JSON.parse(rawBody);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    }

    const { image } = payload;
    if (!image) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "กรุณาส่งรูปภาพใบลาเบลสินค้าเพื่อทำการสแกน" }));
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

    // Query live products from Firestore
    const productsSnap = await getDocs(collection(db, "products"));
    const allProducts: any[] = [];
    productsSnap.forEach((doc) => {
      allProducts.push({ id: doc.id, ...doc.data() });
    });

    // Match extracted items
    const enrichedItems = (result.extractedItems || []).map((item: any) => {
      const cleanSku = (item.sku || "").trim().toLowerCase();
      const cleanName = (item.productName || "").trim().toLowerCase();

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

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      orderId: result.orderId || "",
      trackingNo: result.trackingNo || "",
      labelType: result.labelType || "UNKNOWN",
      detectedAction: result.detectedAction || "UNKNOWN",
      extractedItems: enrichedItems
    }));

  } catch (err: any) {
    console.error("AI Label scanning error in Vercel API:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "ไม่สามารถสแกนวิเคราะห์ภาพด้วย AI ได้: " + (err.message || String(err)) }));
  }
}
