import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
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
    const rawBody = await getRawBody(req);
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid JSON body" }));
    }

    const { spreadsheetId, products } = payload;
    if (!spreadsheetId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing spreadsheetId" }));
    }

    // Load actual settings to verify sheets ID
    const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
    if (!settingsDoc.exists()) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "AppSettings not found" }));
    }
    const settings = settingsDoc.data();
    if (settings.googleSheetsId !== spreadsheetId) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized Spreadsheet ID: " + spreadsheetId }));
    }

    // Load existing products to map SKU to existing document ID
    const productsSnapshot = await getDocs(collection(db, "products"));
    const skuMap = new Map<string, string>(); // sku -> docId
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
        
        // Construct the product document fields cleanly
        const productUpdate: Record<string, any> = {
          id: id,
          sku: prod.sku.toUpperCase().trim(),
          name: prod.name || "",
          category: prod.category || "ทั่วไป",
          quantity: Number(prod.quantity) || 0,
          minStock: Number(prod.minStock) || 0,
          unit: prod.unit || "ชิ้น",
          location: prod.location || "ไม่ได้ระบุ",
          updatedAt: new Date().toISOString()
        };

        if (prod.weight !== undefined && prod.weight !== null && prod.weight !== "") {
          const w = Number(prod.weight);
          if (!isNaN(w)) {
            productUpdate.weight = w;
            productUpdate.weightUnit = prod.weightUnit || "g";
          }
        }

        await setDoc(prodRef, productUpdate, { merge: true });
      }
    }

    // Update settings synced timestamp
    await updateDoc(doc(db, "settings", "appSettings"), {
      googleSheetsLastSyncedAt: new Date().toISOString()
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ 
      success: true, 
      message: `Synced ${products?.length || 0} items successfully!` 
    }));
  } catch (err: any) {
    console.error("Sheets update API error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: err.message || "Internal server error" }));
  }
}
