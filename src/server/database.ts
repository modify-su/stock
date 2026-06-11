import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, Firestore } from 'firebase/firestore';

export interface User {
  username: string;
  passwordHash: string; // Hashed with bcrypt after upgrade
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  securityQuestion: string;
  securityAnswer: string;
}

export interface UserSession {
  token: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

export interface StockProduct {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockInEntry {
  id: string;
  sku: string;
  quantity: number;
  timestamp: string;
  user: string;
  category: string;
  notes?: string;
}

export interface StockOutEntry {
  id: string;
  sku: string;
  quantity: number;
  platform: 'TikTok' | 'Shopee' | 'Lazada' | 'Facebook';
  courier: 'Flash' | 'J&T' | 'LEX' | 'Best';
  timestamp: string;
  user: string;
}

export interface AppSettings {
  logoUrl: string;
  logoText: string;
  loginBgColor: string;
  loginTitle: string;
  lowStockAlertEnabled: boolean;
  categories?: string[];
}

export interface DBStructure {
  users: User[];
  products: StockProduct[];
  stockInHistory: StockInEntry[];
  stockOutHistory: StockOutEntry[];
  settings: AppSettings;
  sessions?: UserSession[];
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    if (hash && (hash.startsWith('$2a$') || hash.startsWith('$2b$'))) {
      return bcrypt.compareSync(plain, hash);
    }
  } catch (e) {
    // fallback
  }
  return plain === hash;
}

const DB_FILE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'stock_db.json')
  : path.join(process.cwd(), 'src', 'stock_db.json');

// Helper to ensure parent folder exists
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Initial Mock Data
const INITIAL_DB: DBStructure = {
  users: [
    {
      username: 'admin',
      passwordHash: 'admin123', // Simple text pw for demonstration / easy testing as requested
      role: 'admin',
      status: 'approved',
      createdAt: new Date('2026-01-01').toISOString(),
      securityQuestion: 'ชื่อเมืองที่คุณเกิดคืออะไร?',
      securityAnswer: 'bangkok'
    },
    {
      username: 'staff',
      passwordHash: 'staff123',
      role: 'user',
      status: 'approved',
      createdAt: new Date('2026-01-02').toISOString(),
      securityQuestion: 'สีที่คุณชอบที่สุดคืออะไร?',
      securityAnswer: 'blue'
    },
    {
      username: 'pending_user',
      passwordHash: '123456',
      role: 'user',
      status: 'pending',
      createdAt: new Date('2026-06-01').toISOString(),
      securityQuestion: 'ชื่อสัตว์เลี้ยงตัวแรกคืออะไร?',
      securityAnswer: 'dog'
    }
  ],
  products: [
    {
      sku: 'SKU-TSHIRT-M-BLK',
      name: 'T-Shirt Black (Size M)',
      category: 'เสื้อผ้า (Apparel)',
      quantity: 25,
      lowStockThreshold: 10,
      createdAt: new Date('2026-05-10').toISOString(),
      updatedAt: new Date('2026-06-08').toISOString()
    },
    {
      sku: 'SKU-TSHIRT-L-WHT',
      name: 'T-Shirt White (Size L)',
      category: 'เสื้อผ้า (Apparel)',
      quantity: 8, // Low Stock Alert status
      lowStockThreshold: 15,
      createdAt: new Date('2026-05-12').toISOString(),
      updatedAt: new Date('2026-06-08').toISOString()
    },
    {
      sku: 'SKU-IPHONE15-PRO',
      name: 'iPhone 15 Pro 256GB',
      category: 'ไอทีและอิเล็กทรอนิกส์ (Electronics)',
      quantity: 4, // Low Stock Alert status
      lowStockThreshold: 5,
      createdAt: new Date('2026-05-15').toISOString(),
      updatedAt: new Date('2026-06-09').toISOString()
    },
    {
      sku: 'SKU-SAM-S24-ULTR',
      name: 'Samsung Galaxy S24 Ultra',
      category: 'ไอทีและอิเล็กทรอนิกส์ (Electronics)',
      quantity: 12,
      lowStockThreshold: 5,
      createdAt: new Date('2026-05-18').toISOString(),
      updatedAt: new Date('2026-06-09').toISOString()
    },
    {
      sku: 'SKU-PANTS-JEAN-32',
      name: 'Denim Jeans Size 32',
      category: 'เสื้อผ้า (Apparel)',
      quantity: 45,
      lowStockThreshold: 12,
      createdAt: new Date('2026-05-20').toISOString(),
      updatedAt: new Date('2026-06-09').toISOString()
    }
  ],
  stockInHistory: [
    {
      id: 'IN-001',
      sku: 'SKU-TSHIRT-M-BLK',
      quantity: 30,
      timestamp: new Date('2026-06-01T10:00:00Z').toISOString(),
      user: 'admin',
      category: 'เสื้อผ้า (Apparel)',
      notes: 'รับสินค้าเข้าล๊อตแรกเดือนมิถุนายน'
    },
    {
      id: 'IN-002',
      sku: 'SKU-IPHONE15-PRO',
      quantity: 6,
      timestamp: new Date('2026-06-02T14:30:00Z').toISOString(),
      user: 'staff',
      category: 'ไอทีและอิเล็กทรอนิกส์ (Electronics)',
      notes: 'รับจากซัพพลายเออร์หลัก'
    },
    {
      id: 'IN-003',
      sku: 'SKU-TSHIRT-L-WHT',
      quantity: 10,
      timestamp: new Date('2026-06-03T11:15:00Z').toISOString(),
      user: 'staff',
      category: 'เสื้อผ้า (Apparel)',
      notes: 'เติมสต็อกด่วน'
    }
  ],
  stockOutHistory: [
    {
      id: 'OUT-001',
      sku: 'SKU-TSHIRT-M-BLK',
      quantity: 5,
      platform: 'TikTok',
      courier: 'Flash',
      timestamp: new Date('2026-06-05T15:20:00Z').toISOString(),
      user: 'admin'
    },
    {
      id: 'OUT-002',
      sku: 'SKU-IPHONE15-PRO',
      quantity: 2,
      platform: 'Shopee',
      courier: 'J&T',
      timestamp: new Date('2026-06-06T09:40:00Z').toISOString(),
      user: 'staff'
    },
    {
      id: 'OUT-003',
      sku: 'SKU-TSHIRT-L-WHT',
      quantity: 2,
      platform: 'Lazada',
      courier: 'LEX',
      timestamp: new Date('2026-06-07T13:10:00Z').toISOString(),
      user: 'staff'
    }
  ],
  settings: {
    logoUrl: '',
    logoText: 'STOCKMASTER',
    loginBgColor: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    loginTitle: 'Stock Management System',
    lowStockAlertEnabled: true,
    categories: ['ทั่วไป', 'ความงาม', 'แฟชั่น', 'เครื่องใช้ไฟฟ้า', 'ไอที & อุปกรณ์เสริม']
  },
  sessions: []
};

let firestoreDb: Firestore | null = null;

// Lazy initialization of Firestore
function getFirestoreDb(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const app = initializeApp(firebaseConfig);
      firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      console.log('Cloud Firestore for Server-Side Initialized Successfully.');
    }
  } catch (err) {
    console.error('Failed to initialize server-side cloud Firestore:', err);
  }
  return firestoreDb;
}

class FileDatabase {
  private cache: DBStructure | null = null;
  private lastLoadTime: number = 0;

  constructor() {
    // Empty constructor to prevent eager filesystem access during module import / build phases on Vercel
  }

  private fallbackInit() {
    try {
      ensureDirectoryExistence(DB_FILE_PATH);
      if (!fs.existsSync(DB_FILE_PATH)) {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
        this.cache = JSON.parse(JSON.stringify(INITIAL_DB));
        console.log('Fallback local database file initialized at:', DB_FILE_PATH);
      } else {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        try {
          this.cache = JSON.parse(fileContent);
        } catch (e) {
          console.error('Error parsing local fallback DB, resetting:', e);
          this.cache = JSON.parse(JSON.stringify(INITIAL_DB));
        }
      }
    } catch (err) {
      console.error('Failed to initialize local fallback database:', err);
      this.cache = JSON.parse(JSON.stringify(INITIAL_DB));
    }
  }

  public async load() {
    const db = getFirestoreDb();
    if (!db) {
      if (!this.cache) {
        this.fallbackInit();
      }
      return;
    }

    const now = Date.now();
    // Throttle reads to once every 2 seconds to save Cloud Run/Vercel serverless request and database quota
    if (this.cache && (now - this.lastLoadTime < 2000)) {
      return;
    }

    try {
      console.log('Loading database from Cloud Firestore...');
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: User[] = [];
      usersSnap.forEach((d) => {
        users.push(d.data() as User);
      });

      // 2. Fetch Products
      const productsSnap = await getDocs(collection(db, 'products'));
      const products: StockProduct[] = [];
      productsSnap.forEach((d) => {
        products.push(d.data() as StockProduct);
      });

      // 3. Fetch Stock In logs
      const stockInSnap = await getDocs(collection(db, 'stock_in'));
      const stockInHistory: StockInEntry[] = [];
      stockInSnap.forEach((d) => {
        stockInHistory.push(d.data() as StockInEntry);
      });

      // 4. Fetch Stock Out logs
      const stockOutSnap = await getDocs(collection(db, 'stock_out'));
      const stockOutHistory: StockOutEntry[] = [];
      stockOutSnap.forEach((d) => {
        stockOutHistory.push(d.data() as StockOutEntry);
      });

      // 5. Fetch Settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      let settings: AppSettings;
      if (settingsDoc.exists()) {
        settings = settingsDoc.data() as AppSettings;
      } else {
        settings = INITIAL_DB.settings;
        await setDoc(doc(db, 'settings', 'app'), settings);
      }

      // 6. Fetch Sessions
      const sessionsSnap = await getDocs(collection(db, 'sessions'));
      const sessions: UserSession[] = [];
      sessionsSnap.forEach((d) => {
        sessions.push(d.data() as UserSession);
      });

      // If database is blank on Firestore (e.g. first deploy/launch), seed initial data
      if (users.length === 0 && products.length === 0) {
        console.log('Cloud Firestore database is blank. Seeding initial database tables...');
        
        // Seed Users
        for (const u of INITIAL_DB.users) {
          await setDoc(doc(db, 'users', u.username), u);
          users.push(u);
        }

        // Seed Products
        for (const p of INITIAL_DB.products) {
          await setDoc(doc(db, 'products', p.sku), p);
          products.push(p);
        }

        // Seed Stock In
        for (const si of INITIAL_DB.stockInHistory) {
          await setDoc(doc(db, 'stock_in', si.id), si);
          stockInHistory.push(si);
        }

        // Seed Stock Out
        for (const so of INITIAL_DB.stockOutHistory) {
          await setDoc(doc(db, 'stock_out', so.id), so);
          stockOutHistory.push(so);
        }
      }

      this.cache = {
        users,
        products,
        stockInHistory,
        stockOutHistory,
        settings,
        sessions
      };
      this.lastLoadTime = now;
      console.log(`Cloud database loaded successfully. Found ${users.length} users, ${products.length} products.`);
    } catch (err) {
      console.error('Error fetching database from Firestore. Falling back to local/tmp files...', err);
      if (!this.cache) {
        this.fallbackInit();
      }
    }
  }

  public get(): DBStructure {
    if (!this.cache) {
      this.fallbackInit();
      // Load dynamically in background on first synchronous get
      this.load().catch(err => console.error('Silent background database fetch failed:', err));
    }
    return this.cache || INITIAL_DB;
  }

  public async save(data?: DBStructure) {
    if (!data) return;

    const previous = this.cache ? { ...this.cache } : null;
    this.cache = data;

    // Save to local fallback file for redundancy/development offline speeds
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write to local fallback database file:', err);
    }

    // Save to Cloud Firestore
    const db = getFirestoreDb();
    if (!db) return;

    try {
      // 1. Sync Users (Diff write)
      for (const u of data.users) {
        const prevUser = previous?.users.find(x => x.username === u.username);
        if (!prevUser || 
            prevUser.passwordHash !== u.passwordHash || 
            prevUser.role !== u.role || 
            prevUser.status !== u.status ||
            prevUser.securityQuestion !== u.securityQuestion ||
            prevUser.securityAnswer !== u.securityAnswer) {
          console.log(`[Firestore Sync] Setting user: ${u.username}`);
          await setDoc(doc(db, 'users', u.username), u);
        }
      }
      // Delete deleted users
      if (previous) {
        for (const prevUser of previous.users) {
          if (!data.users.some(x => x.username === prevUser.username)) {
            console.log(`[Firestore Sync] Deleting user: ${prevUser.username}`);
            await deleteDoc(doc(db, 'users', prevUser.username));
          }
        }
      }

      // 2. Sync Products (Diff write)
      for (const p of data.products) {
        const prevProduct = previous?.products.find(x => x.sku === p.sku);
        if (!prevProduct || 
            prevProduct.name !== p.name || 
            prevProduct.category !== p.category || 
            prevProduct.quantity !== p.quantity || 
            prevProduct.lowStockThreshold !== p.lowStockThreshold ||
            prevProduct.updatedAt !== p.updatedAt) {
          console.log(`[Firestore Sync] Setting product: ${p.sku}`);
          await setDoc(doc(db, 'products', p.sku), p);
        }
      }
      // Delete deleted products
      if (previous) {
        for (const prevProduct of previous.products) {
          if (!data.products.some(x => x.sku === prevProduct.sku)) {
            console.log(`[Firestore Sync] Deleting product: ${prevProduct.sku}`);
            await deleteDoc(doc(db, 'products', prevProduct.sku));
          }
        }
      }

      // 3. Sync Stock In
      for (const si of data.stockInHistory) {
        const prevIn = previous?.stockInHistory.find(x => x.id === si.id);
        if (!prevIn) {
          console.log(`[Firestore Sync] Adding stock_in log: ${si.id}`);
          await setDoc(doc(db, 'stock_in', si.id), si);
        }
      }

      // 4. Sync Stock Out
      for (const so of data.stockOutHistory) {
        const prevOut = previous?.stockOutHistory.find(x => x.id === so.id);
        if (!prevOut) {
          console.log(`[Firestore Sync] Adding stock_out log: ${so.id}`);
          await setDoc(doc(db, 'stock_out', so.id), so);
        }
      }

      // 5. Sync App Settings
      const prevSettings = previous?.settings;
      const s = data.settings;
      if (!prevSettings || 
          prevSettings.logoUrl !== s.logoUrl || 
          prevSettings.logoText !== s.logoText || 
          prevSettings.loginBgColor !== s.loginBgColor || 
          prevSettings.loginTitle !== s.loginTitle || 
          prevSettings.lowStockAlertEnabled !== s.lowStockAlertEnabled ||
          JSON.stringify(prevSettings.categories) !== JSON.stringify(s.categories)) {
        console.log('[Firestore Sync] Saving app settings');
        await setDoc(doc(db, 'settings', 'app'), s);
      }

      // 6. Sync Sessions
      const sessions = data.sessions || [];
      const prevSessions = previous?.sessions || [];
      for (const sess of sessions) {
        const prevSess = prevSessions.find(x => x.token === sess.token);
        if (!prevSess) {
          const docId = crypto.createHash('sha256').update(sess.token).digest('hex');
          await setDoc(doc(db, 'sessions', docId), sess);
        }
      }
      for (const prevSess of prevSessions) {
        if (!sessions.some(x => x.token === prevSess.token)) {
          const docId = crypto.createHash('sha256').update(prevSess.token).digest('hex');
          await deleteDoc(doc(db, 'sessions', docId));
        }
      }

      console.log('Changes successfully synchronized to Cloud Firestore database.');
    } catch (err) {
      console.error('Error synchronizing database changes to Cloud Firestore:', err);
    }
  }
}

export const dbInstance = new FileDatabase();
