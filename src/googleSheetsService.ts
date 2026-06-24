import { auth, db } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Product } from './types';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize Google Sheets and Firebase Auth state listener
export const initGoogleAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
};

// Start Google sign-in flow
export const signInWithGoogleSheets = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error('ไม่ได้รับ Access Token จากระบบ Google Auth');
    }
    cachedAccessToken = accessToken;
    return { user: result.user, accessToken };
  } catch (error) {
    console.error('Sign-in Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Clear authentication session
export const signOutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Get the current token in-memory
export const getCachedToken = (): string | null => {
  return cachedAccessToken;
};

// Set token manually (e.g. from app auth handler)
export const setCachedToken = (token: string) => {
  cachedAccessToken = token;
};

// Interface for Sheets Template creation
interface CreateSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Creates a brand new Google Spreadsheet titled "ระบบสต๊อกสินค้าสะสม [Inventory Status]"
 * populated with standard professional inventory header formatting and grid lines.
 */
export const createInventorySpreadsheet = async (
  accessToken: string,
  appName: string
): Promise<CreateSheetResult> => {
  const title = `คลังสินค้าเรียลไทม์ - ${appName || 'ระบบจัดการสต๊อกสินค้า'}`;
  
  // 1. Create Spreadsheet
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.error?.message || 'ไม่สามารถสร้าง Google Sheet ได้');
  }

  const result = await response.json();
  const spreadsheetId = result.spreadsheetId;
  const spreadsheetUrl = result.spreadsheetUrl;
  const sheetId = result.sheets?.[0]?.properties?.sheetId || 0;

  // 2. Format columns & header row beautifully
  const formatResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        // Color header cell background, set white text and bold elements
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 10,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.15, green: 0.35, blue: 0.65 }, // Soft blue
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true,
                  fontSize: 11,
                  fontFamily: 'Roboto',
                },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        // Enable grid lines for display safety
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              gridProperties: {
                showGridLines: true,
              },
            },
            fields: 'gridProperties.showGridLines',
          },
        },
      ],
    }),
  });

  if (!formatResponse.ok) {
    console.warn('Failed to apply custom styling rules, but sheet was created.');
  }

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Helper to fetch the actual name of the first worksheet in the spreadsheet dynamically.
 * This prevents crashes when the sheet name changes under localized accounts (e.g., "ชีต1" or "แผ่น1").
 */
export const getFirstSheetName = async (
  accessToken: string,
  spreadsheetId: string
): Promise<string> => {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      const firstTitle = data.sheets?.[0]?.properties?.title;
      if (firstTitle) {
        return firstTitle;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch spreadsheet sheet titles, using fallback:", err);
  }
  return "Sheet1";
};

/**
 * Syncs/Overwrites products array directly into the target Google Spreadsheet.
 */
export const syncProductsToSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  products: Product[]
): Promise<void> => {
  const sheetName = await getFirstSheetName(accessToken, spreadsheetId);

  // Headers matching Inventory System
  const headers = [
    'รหัสสินค้า (SKU)',
    'ชื่อสินค้า (Product Name)',
    'หมวดหมู่ (Category)',
    'จำนวนคงเหลือ (Stock Quantity)',
    'เกณฑ์แจ้งเตือนสต๊อกต่ำสุด (Min Threshold)',
    'หน่วยนับ (Unit)',
    'ตำแหน่งจัดเก็บ (Storage Location)',
    'อัปเดตล่าสุด (Last Updated Time)',
    'น้ำหนัก (Weight)',
    'หน่วยน้ำหนัก (Weight Unit)',
  ];

  const rows = products.map((p) => [
    p.sku,
    p.name,
    p.category,
    p.quantity,
    p.minStock,
    p.unit || 'ชิ้น',
    p.location || '-',
    p.updatedAt ? new Date(p.updatedAt).toLocaleString('th-TH') : '-',
    p.weight !== undefined && p.weight !== null ? p.weight : '-',
    p.weightUnit || '-',
  ]);

  const values = [headers, ...rows];

  // 1. Clear existing sheets values first so stale items don't linger
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z1000:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // 2. Put new array records
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${sheetName}!A1`,
        majorDimension: 'ROWS',
        values: values,
      }),
    }
  );

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.error?.message || 'เกิดข้อผิดพลาดในการเขียนข้อมูลลง Google Sheets');
  }

  // 3. Auto resize columns to fit text perfectly for amazing readability
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0, // First sheet
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 10,
              },
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Auto resize columns failed:', err);
  }
};

/**
 * Fetches products list from a connected Google Spreadsheet and compiles it
 * back into our standard Product catalog structure for system sync back.
 */
export const fetchSpreadsheetProducts = async (
  accessToken: string,
  spreadsheetId: string
): Promise<Omit<Product, 'id' | 'updatedAt'>[]> => {
  const sheetName = await getFirstSheetName(accessToken, spreadsheetId);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:J1000`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.error?.message || 'ไม่สามารถอ่านพิกเซลข้อมูลจากสเปรดชีตนี้ได้');
  }

  const data = await response.json();
  const rows = data.values as string[][];

  if (!rows || rows.length === 0) {
    return [];
  }

  const parsedProducts: Omit<Product, 'id' | 'updatedAt'>[] = [];

  for (const row of rows) {
    // Columns: [sku, name, category, quantity, minStock, unit, location, updatedAt, weight, weightUnit]
    const sku = row[0]?.trim() || '';
    const name = row[1]?.trim() || '';
    const category = row[2]?.trim() || 'ทั่วไป';
    const quantity = parseInt(row[3]?.trim()) || 0;
    const minStock = parseInt(row[4]?.trim()) || 5;
    const unit = row[5]?.trim() || 'ชิ้น';
    const location = row[6]?.trim() || 'Zone-A';

    // Parse weight and weightUnit if present
    const rawWeight = row[8]?.trim();
    const weight = rawWeight && rawWeight !== '-' ? parseFloat(rawWeight) : undefined;
    const rawWeightUnit = row[9]?.trim();
    const weightUnit = rawWeightUnit && rawWeightUnit !== '-' ? rawWeightUnit : undefined;

    if (!sku || !name) continue;

    parsedProducts.push({
      sku,
      name,
      category,
      quantity,
      minStock,
      unit,
      location,
      weight: (weight !== undefined && !isNaN(weight)) ? weight : undefined,
      weightUnit: weightUnit || undefined,
    });
  }

  return parsedProducts;
};

