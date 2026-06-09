import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Interfaces mapping database schemas
export interface User {
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  securityQuestion: string;
  securityAnswer: string;
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
}

// Initial default database structure
const INITIAL_SETTINGS: AppSettings = {
  logoUrl: '',
  logoText: 'STOCKMASTER',
  loginBgColor: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  loginTitle: 'Stock Management System',
  lowStockAlertEnabled: true
};

const INITIAL_USERS: User[] = [
  {
    username: 'admin',
    passwordHash: 'admin123',
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
  }
];

const INITIAL_PRODUCTS: StockProduct[] = [
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
    quantity: 8,
    lowStockThreshold: 15,
    createdAt: new Date('2026-05-12').toISOString(),
    updatedAt: new Date('2026-06-08').toISOString()
  },
  {
    sku: 'SKU-IPHONE15-PRO',
    name: 'iPhone 15 Pro 256GB',
    category: 'ไอทีและอิเล็กทรอนิกส์ (Electronics)',
    quantity: 4,
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
  }
];

const INITIAL_STOCK_IN: StockInEntry[] = [
  {
    id: 'IN-001',
    sku: 'SKU-TSHIRT-M-BLK',
    quantity: 30,
    timestamp: new Date('2026-06-01T10:00:00Z').toISOString(),
    user: 'admin',
    category: 'เสื้อผ้า (Apparel)',
    notes: 'รับสินค้าเข้าล๊อตแรกเดือนมิถุนายน'
  }
];

const INITIAL_STOCK_OUT: StockOutEntry[] = [
  {
    id: 'OUT-001',
    sku: 'SKU-TSHIRT-M-BLK',
    quantity: 5,
    platform: 'TikTok',
    courier: 'Flash',
    timestamp: new Date('2026-06-05T15:20:00Z').toISOString(),
    user: 'admin'
  }
];

// Error formatting following guidelines
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'client-user',
      email: 'client@example.com'
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check if Firebase configuration is provided
const isFirebaseReady = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

let db: any = null;

if (isFirebaseReady) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log('Firebase initialized successfully. Using Firestore Cloud Database.');
  } catch (err) {
    console.warn('Firebase initialization failed, falling back to Local Database.', err);
  }
} else {
  console.log('Firebase configuration not set. Using high-performance Local Database fallback.');
}

// LOCALSTORAGE KEYS
const KEY_USERS = 'stockmaster_users';
const KEY_PRODUCTS = 'stockmaster_products';
const KEY_STOCK_IN = 'stockmaster_stock_in';
const KEY_STOCK_OUT = 'stockmaster_stock_out';
const KEY_SETTINGS = 'stockmaster_settings';

// Ensure localStorage is populated
function initLocalStorage() {
  if (!localStorage.getItem(KEY_USERS)) {
    localStorage.setItem(KEY_USERS, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(KEY_PRODUCTS)) {
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  }
  if (!localStorage.getItem(KEY_STOCK_IN)) {
    localStorage.setItem(KEY_STOCK_IN, JSON.stringify(INITIAL_STOCK_IN));
  }
  if (!localStorage.getItem(KEY_STOCK_OUT)) {
    localStorage.setItem(KEY_STOCK_OUT, JSON.stringify(INITIAL_STOCK_OUT));
  }
  if (!localStorage.getItem(KEY_SETTINGS)) {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(INITIAL_SETTINGS));
  }
}
initLocalStorage();

// SERVICE EXPORTS
export const firebaseService = {
  isCloudMode: () => isFirebaseReady && db !== null,

  // 1. Settings operations
  async getSettings(): Promise<AppSettings> {
    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'settings', 'app');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as AppSettings;
        }
        // Seed remote settings if missing
        await setDoc(docRef, INITIAL_SETTINGS);
        return INITIAL_SETTINGS;
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'settings/app');
      }
    }
    const val = localStorage.getItem(KEY_SETTINGS);
    return val ? JSON.parse(val) : INITIAL_SETTINGS;
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'settings', 'app');
        await setDoc(docRef, settings, { merge: true });
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/app');
      }
    }
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  },

  // 2. Auth & Registration
  async getSecurityQuestion(username: string): Promise<string> {
    const cleanUsername = username.trim().toLowerCase();
    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'users', cleanUsername);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return (snap.data() as User).securityQuestion;
        }
        throw new Error('ไม่พบข้อมูลผู้ใช้นี้ในระบบฐานข้อมูล Firebase');
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${cleanUsername}`);
      }
    }
    // Local fallback
    const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const user = users.find(u => u.username.toLowerCase() === cleanUsername);
    if (!user) {
      throw new Error('ไม่พบข้อมูลผู้ใช้นี้ในระบบ');
    }
    return user.securityQuestion;
  },

  async resetPassword(username: string, securityAnswer: string, newPasswordHash: string): Promise<void> {
    const cleanUsername = username.trim().toLowerCase();
    const cleanAnswer = securityAnswer.trim().toLowerCase();
    
    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'users', cleanUsername);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          throw new Error('ไม่พบข้อมูลผู้ใช้นี้ในระบบ');
        }
        const user = snap.data() as User;
        if (user.securityAnswer.toLowerCase() !== cleanAnswer) {
          throw new Error('คำตอบสำหรับคำถามเพื่อความปลอดภัยไม่ถูกต้อง');
        }
        await setDoc(docRef, { passwordHash: newPasswordHash }, { merge: true });
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${cleanUsername}`);
      }
    }

    // Local fallback
    const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const index = users.findIndex(u => u.username.toLowerCase() === cleanUsername);
    if (index === -1) {
      throw new Error('ไม่พบผู้ใช้นี้ในระบบ');
    }
    if (users[index].securityAnswer.toLowerCase() !== cleanAnswer) {
      throw new Error('คำตอบสำหรับคำถามเพื่อความปลอดภัยไม่ถูกต้อง');
    }
    users[index].passwordHash = newPasswordHash;
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  },

  async registerUser(username: string, passwordHash: string, securityQuestion: string, securityAnswer: string): Promise<{ message: string, status: string }> {
    const cleanUsername = username.trim();
    const keyName = cleanUsername.toLowerCase();

    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'users', keyName);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          throw new Error('มีชื่อผู้ใช้นี้อยู่ในระบบระบบแล้ว');
        }

        // Check if first user to assign admin role
        const colSnap = await getDocs(collection(db, 'users'));
        const isEmpty = colSnap.empty;
        const role = isEmpty ? 'admin' : 'user';
        const status = isEmpty ? 'approved' : 'pending';

        const newUser: User = {
          username: cleanUsername,
          passwordHash,
          role,
          status,
          createdAt: new Date().toISOString(),
          securityQuestion: securityQuestion.trim(),
          securityAnswer: securityAnswer.trim().toLowerCase()
        };

        await setDoc(docRef, newUser);
        const msg = isEmpty 
          ? 'ยินดีด้วยครับ! คุณเป็นผู้สมัครใช้งานคนแรก จึงได้รับสิทธิ์ Admin และอนุมัติบัญชีทันที'
          : 'สมัครสมาชิกสำเร็จ! บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติสิทธิ์';

        return { message: msg, status };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${keyName}`);
      }
    }

    // Local fallback
    const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const existing = users.find(u => u.username.toLowerCase() === keyName);
    if (existing) {
      throw new Error('มีชื่อผู้ใช้นี้อยู่ในระบบแล้ว');
    }

    const isEmptyLocal = users.length === 0;
    const role = isEmptyLocal ? 'admin' : 'user';
    const status = isEmptyLocal ? 'approved' : 'pending';

    const newUser: User = {
      username: cleanUsername,
      passwordHash,
      role,
      status,
      createdAt: new Date().toISOString(),
      securityQuestion: securityQuestion.trim(),
      securityAnswer: securityAnswer.trim().toLowerCase()
    };

    users.push(newUser);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    const msg = isEmptyLocal
      ? 'ยินดีด้วยครับ! คุณเป็นผู้สมัครใช้งานคนแรก จึงได้รับสิทธิ์ Admin และอนุมัติบัญชีทันที'
      : 'สมัครสมาชิกสำเร็จ! บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติสิทธิ์';

    return { message: msg, status };
  },

  async loginUser(username: string, passwordHash: string): Promise<User> {
    const cleanUsername = username.trim().toLowerCase();

    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'users', cleanUsername);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        const user = snap.data() as User;
        if (user.passwordHash !== passwordHash) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        if (user.status === 'pending') {
          throw new Error('บัญชีนี้ยังไม่ได้รับอนุมัติใช้งานจาก Admin กรุณารอสักครู่');
        }
        if (user.status === 'rejected') {
          throw new Error('บัญชีนี้ถูกปฏิเสธสิทธิ์การเข้าใช้งานโดยผู้ดูแลระบบ');
        }
        return user;
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${cleanUsername}`);
      }
    }

    // Local fallback
    const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const user = users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!user || user.passwordHash !== passwordHash) {
      throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    if (user.status === 'pending') {
      throw new Error('บัญชีนี้ยังไม่ได้รับอนุมัติใช้งานจาก Admin กรุณารอสักครู่');
    }
    if (user.status === 'rejected') {
      throw new Error('บัญชีนี้ถูกปฏิเสธสิทธิ์การเข้าใช้งานโดยผู้ดูแลระบบ');
    }
    return user;
  },

  // 3. Admin user management
  async getUsers(): Promise<User[]> {
    if (this.isCloudMode()) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const array: User[] = [];
        snap.forEach(doc => {
          array.push(doc.data() as User);
        });
        return array;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    }
    return JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  },

  async updateUserStatus(tgtUsername: string, status: 'pending' | 'approved' | 'rejected', role: 'admin' | 'user'): Promise<void> {
    const keyName = tgtUsername.trim().toLowerCase();
    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'users', keyName);
        await setDoc(docRef, { status, role }, { merge: true });
        return;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${keyName}`);
      }
    }

    // Local fallback
    const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const idx = users.findIndex(u => u.username.toLowerCase() === keyName);
    if (idx !== -1) {
      users[idx].status = status;
      users[idx].role = role;
      localStorage.setItem(KEY_USERS, JSON.stringify(users));
    }
  },

  // 4. Products Management
  async getProducts(): Promise<StockProduct[]> {
    if (this.isCloudMode()) {
      try {
        const snap = await getDocs(collection(db, 'products'));
        const array: StockProduct[] = [];
        snap.forEach(doc => {
          array.push(doc.data() as StockProduct);
        });
        return array;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    }
    return JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
  },

  async addProduct(sku: string, name: string, category: string, initialQty: number, lowStockThreshold: number, user: string): Promise<StockProduct> {
    const cleanSku = sku.trim().toUpperCase();

    if (this.isCloudMode()) {
      try {
        const docRef = doc(db, 'products', cleanSku);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          throw new Error(`มีสินค้า SKU ${cleanSku} อยู่ในระบบระบบแล้ว`);
        }

        const newP: StockProduct = {
          sku: cleanSku,
          name: name.trim(),
          category: category.trim(),
          quantity: initialQty,
          lowStockThreshold,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(docRef, newP);

        // Record stock in history if initialQty > 0
        if (initialQty > 0) {
          const logId = 'IN-' + Date.now().toString().slice(-6);
          const inLog: StockInEntry = {
            id: logId,
            sku: cleanSku,
            quantity: initialQty,
            timestamp: new Date().toISOString(),
            user,
            category: category.trim(),
            notes: 'ยอดเริ่มต้น ณ วันลงทะเบียนสินค้า'
          };
          await setDoc(doc(db, 'stock_in', logId), inLog);
        }

        return newP;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${cleanSku}`);
      }
    }

    // Local fallback
    const products: StockProduct[] = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
    const existing = products.find(p => p.sku === cleanSku);
    if (existing) {
      throw new Error(`มีสินค้า SKU ${cleanSku} อยู่ในระบบแล้ว`);
    }

    const newP: StockProduct = {
      sku: cleanSku,
      name: name.trim(),
      category: category.trim(),
      quantity: initialQty,
      lowStockThreshold,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    products.push(newP);
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));

    if (initialQty > 0) {
      const logs: StockInEntry[] = JSON.parse(localStorage.getItem(KEY_STOCK_IN) || '[]');
      const logId = 'IN-' + Date.now().toString().slice(-6);
      logs.push({
        id: logId,
        sku: cleanSku,
        quantity: initialQty,
        timestamp: new Date().toISOString(),
        user,
        category: category.trim(),
        notes: 'ยอดเริ่มต้น ณ วันลงทะเบียนสินค้า'
      });
      localStorage.setItem(KEY_STOCK_IN, JSON.stringify(logs));
    }

    return newP;
  },

  // 5. Stock Transactions
  async stockIn(sku: string, quantity: number, notes: string, user: string): Promise<StockProduct> {
    const cleanSku = sku.trim().toUpperCase();

    if (this.isCloudMode()) {
      try {
        const productRef = doc(db, 'products', cleanSku);
        const snap = await getDoc(productRef);
        if (!snap.exists()) {
          throw new Error(`ไม่พบสินค้า SKU ${cleanSku} ในระบบ`);
        }
        const prod = snap.data() as StockProduct;
        prod.quantity += quantity;
        prod.updatedAt = new Date().toISOString();

        await setDoc(productRef, prod, { merge: true });

        const logId = 'IN-' + Date.now().toString().slice(-6);
        const logEntry: StockInEntry = {
          id: logId,
          sku: cleanSku,
          quantity,
          category: prod.category,
          timestamp: new Date().toISOString(),
          user,
          notes
        };

        await setDoc(doc(db, 'stock_in', logId), logEntry);
        return prod;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stock_in/${sku}`);
      }
    }

    // Local fallback
    const products: StockProduct[] = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
    const pIdx = products.findIndex(p => p.sku === cleanSku);
    if (pIdx === -1) {
      throw new Error(`ไม่พบสินค้า SKU ${cleanSku} ในระบบ`);
    }

    products[pIdx].quantity += quantity;
    products[pIdx].updatedAt = new Date().toISOString();
    const updatedProd = products[pIdx];

    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));

    // Record logs
    const logs: StockInEntry[] = JSON.parse(localStorage.getItem(KEY_STOCK_IN) || '[]');
    logs.push({
      id: 'IN-' + Date.now().toString().slice(-6),
      sku: cleanSku,
      quantity,
      category: updatedProd.category,
      timestamp: new Date().toISOString(),
      user,
      notes
    });
    localStorage.setItem(KEY_STOCK_IN, JSON.stringify(logs));

    return updatedProd;
  },

  async stockOut(sku: string, quantity: number, platform: 'TikTok' | 'Shopee' | 'Lazada' | 'Facebook', courier: 'Flash' | 'J&T' | 'LEX' | 'Best', user: string): Promise<{ product: StockProduct, warning: string | null }> {
    const cleanSku = sku.trim().toUpperCase();

    if (this.isCloudMode()) {
      try {
        const productRef = doc(db, 'products', cleanSku);
        const snap = await getDoc(productRef);
        if (!snap.exists()) {
          throw new Error('ไม่พบสินค้า SKU นี้ในระบบคลังสินค้า');
        }
        const prod = snap.data() as StockProduct;
        if (prod.quantity < quantity) {
          throw new Error(`สินค้าคงคลังไม่เพียงพอ! เหลือเพียง ${prod.quantity} ชิ้น แต่ต้องการส่งออก ${quantity} ชิ้น`);
        }

        prod.quantity -= quantity;
        prod.updatedAt = new Date().toISOString();
        await setDoc(productRef, prod, { merge: true });

        const logId = 'OUT-' + Date.now().toString().slice(-6);
        const logEntry: StockOutEntry = {
          id: logId,
          sku: cleanSku,
          quantity,
          platform,
          courier,
          timestamp: new Date().toISOString(),
          user
        };
        await setDoc(doc(db, 'stock_out', logId), logEntry);

        let warning = null;
        if (prod.quantity <= prod.lowStockThreshold) {
          warning = `⚠️ แจ้งเตือนด่วน: สินค้า ${prod.name} (SKU: ${prod.sku}) เหลือเพียง ${prod.quantity} ชิ้น ต่ำกว่าเกณฑ์เตือน (${prod.lowStockThreshold} ชิ้น)!`;
        }

        return { product: prod, warning };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stock_out/${sku}`);
      }
    }

    // Local fallback
    const products: StockProduct[] = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
    const pIdx = products.findIndex(p => p.sku === cleanSku);
    if (pIdx === -1) {
      throw new Error('ไม่พบสินค้า SKU นี้ในระบบคลังสินค้า');
    }

    const prod = products[pIdx];
    if (prod.quantity < quantity) {
      throw new Error(`สินค้าคงคลังไม่เพียงพอ! เหลือเพียง ${prod.quantity} ชิ้น แต่ต้องการส่งออก ${quantity} ชิ้น`);
    }

    prod.quantity -= quantity;
    prod.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));

    const logs: StockOutEntry[] = JSON.parse(localStorage.getItem(KEY_STOCK_OUT) || '[]');
    logs.push({
      id: 'OUT-' + Date.now().toString().slice(-6),
      sku: cleanSku,
      quantity,
      platform,
      courier,
      timestamp: new Date().toISOString(),
      user
    });
    localStorage.setItem(KEY_STOCK_OUT, JSON.stringify(logs));

    let warning = null;
    if (prod.quantity <= prod.lowStockThreshold) {
      warning = `⚠️ แจ้งเตือนด่วน: สินค้า ${prod.name} (SKU: ${prod.sku}) เหลือเพียง ${prod.quantity} ชิ้น ต่ำกว่าเกณฑ์เตือน (${prod.lowStockThreshold} ชิ้น)!`;
    }

    return { product: prod, warning };
  },

  // 6. History Logs reports
  async getHistory(): Promise<{ stockIn: StockInEntry[], stockOut: StockOutEntry[] }> {
    if (this.isCloudMode()) {
      try {
        const [inSnap, outSnap] = await Promise.all([
          getDocs(collection(db, 'stock_in')),
          getDocs(collection(db, 'stock_out'))
        ]);

        const stockIn: StockInEntry[] = [];
        inSnap.forEach(d => {
          stockIn.push(d.data() as StockInEntry);
        });

        const stockOut: StockOutEntry[] = [];
        outSnap.forEach(d => {
          stockOut.push(d.data() as StockOutEntry);
        });

        // Sort both collections by timestamp descending for clean reports
        stockIn.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        stockOut.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { stockIn, stockOut };
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'history');
      }
    }

    // Local Storage
    const stockIn: StockInEntry[] = JSON.parse(localStorage.getItem(KEY_STOCK_IN) || '[]');
    const stockOut: StockOutEntry[] = JSON.parse(localStorage.getItem(KEY_STOCK_OUT) || '[]');
    
    stockIn.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    stockOut.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { stockIn, stockOut };
  },

  async generateBotReply(messageText: string): Promise<{ type: string; text: string }> {
    const textClean = messageText.trim().toLowerCase();
    const products = await this.getProducts();
    const { stockIn, stockOut } = await this.getHistory();

    // 1. Stock Status Query
    if (textClean === 'เช็คสต็อก' || textClean === 'สต็อก' || textClean === 'สต็อกคงเหลือ' || textClean === 'stock' || textClean === 'ยอดคงเหลือ') {
      if (products.length === 0) {
        return {
          type: 'text',
          text: 'ขณะนี้ไม่มีสินค้าใดๆ ลงทะเบียนอยู่ในคลังสินค้าของคุณครับ 📦'
        };
      }

      let responseText = '📊 รายงานยอดสินค้าคงเหลือแบบตรวจสอบด่วน (Real-time):\n';
      responseText += '============================\n';
      products.forEach((p, idx) => {
        const warningIcon = p.quantity <= p.lowStockThreshold ? '⚠️ ' : '✅ ';
        responseText += `${idx + 1}. ${warningIcon}${p.name}\n- SKU: ${p.sku}\n- คงเหลือ: **${p.quantity}** ชิ้น\n- หมวดหมู่: [${p.category}]\n\n`;
      });
      responseText += '============================\n';
      responseText += '💡 พิมพ์ชื่อ SKU (เช่น SKU-IPHONE15-PRO) เพื่อดูประวัติการเคลื่อนไหวสินค้าชิ้นนั้น';
      
      return { type: 'text', text: responseText };
    }

    // 2. Export Outward Delivery query
    if (textClean === 'ส่งออก' || textClean === 'รายงานการส่งออก' || textClean === 'ยอดส่งออก' || textClean === 'ขนส่ง' || textClean === 'export' || textClean === 'delivery') {
      if (stockOut.length === 0) {
        return {
          type: 'text',
          text: 'ยังไม่พบประวัติข้อมูลส่งออกสินค้าในช่วงนี้ครับ 🚚'
        };
      }

      let responseText = '🚚 รายงานประวัติการส่งออกและขนส่งล่าสุด (5 รายการ):\n';
      responseText += '============================\n';
      
      const recentOuts = [...stockOut].slice(0, 5);
      
      recentOuts.forEach((o, idx) => {
        const prod = products.find(p => p.sku === o.sku);
        const prodName = prod ? prod.name : o.sku;
        const localDate = new Date(o.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        responseText += `${idx + 1}. 📤 ${prodName}\n- จำนวนส่งออก: ${o.quantity} ชิ้น\n- ขายผ่าน: ${o.platform} | ขนส่งโดย: ${o.courier}\n- จัดทำโดย: ${o.user}\n- วันเวลา: ${localDate}\n\n`;
      });
      responseText += '============================';

      return { type: 'text', text: responseText };
    }

    // 3. Low stock warning query
    if (textClean === 'แจ้งเตือน' || textClean === 'สินค้าใกล้หมด' || textClean === 'เตือน' || textClean === 'low stock') {
      const alertedProducts = products.filter(p => p.quantity <= p.lowStockThreshold);

      if (alertedProducts.length === 0) {
        return {
          type: 'text',
          text: '👍 เยี่ยมมากครับ! สินค้าทุกรายการของคุณ มียอดคงเหลืออยู่ในเกณฑ์ปลอดภัย ไม่มีสินค้าใดต่ำกว่าเกณฑ์เตือนครับ'
        };
      }

      let responseText = '🚨 แจ้งเตือนสินค้าต่ำกว่าเกณฑ์ความปลอดภัยสต็อก:\n';
      responseText += '============================\n';
      alertedProducts.forEach((p, idx) => {
        responseText += `🔥 ${idx + 1}. [${p.sku}]\n- ${p.name}\n- เหลือเพียง: **${p.quantity}** ชิ้น\n- เกณฑ์การเตือน: ${p.lowStockThreshold} ชิ้น\n\n`;
      });
      responseText += '============================\n';
      responseText += '💡 แนะนำให้รีบทำการเชื่อมรับสินค้าเติมคลังเพื่อระบายและรองรับออเดอร์ใหม่ครับ';

      return { type: 'text', text: responseText };
    }

    // 4. SKU Specific query
    const matchingProductBySku = products.find(
      p => p.sku.toLowerCase() === textClean || textClean.includes(p.sku.toLowerCase())
    );

    if (matchingProductBySku) {
      const warnings = matchingProductBySku.quantity <= matchingProductBySku.lowStockThreshold 
        ? '🚨 (ของใกล้หมด!)' 
        : '🟢 (สถานะเพียงพอ)';
      
      const inQty = stockIn.filter(h => h.sku === matchingProductBySku.sku).reduce((sum, h) => sum + h.quantity, 0);
      const outQty = stockOut.filter(o => o.sku === matchingProductBySku.sku).reduce((sum, o) => sum + o.quantity, 0);

      let text = `📦 รายงานสินค้าเฉพาะรายการ:\n`;
      text += `----------------------------\n`;
      text += `• SKU: ${matchingProductBySku.sku}\n`;
      text += `• ชื่อสินค้า: ${matchingProductBySku.name}\n`;
      text += `• หมวดหมู่: ${matchingProductBySku.category}\n`;
      text += `• ยอดคงเหลือ: **${matchingProductBySku.quantity}** ชิ้น ${warnings}\n`;
      text += `• เกณฑ์เตือนภัย: ${matchingProductBySku.lowStockThreshold} ชิ้น\n`;
      text += `• ประวัตินำเข้ารวม: ${inQty} ชิ้น\n`;
      text += `• ประวัติส่งออกรวม: ${outQty} ชิ้น\n`;
      text += `----------------------------`;
      
      return { type: 'text', text };
    }

    // 5. Fallback Guide Speech
    let helpMsg = `สวัสดีครับ ยินดีตอบกลับจากบอทคลังสินค้าของคุณ! 📦🦾🤖\n\n`;
    helpMsg += `พิมพ์เพื่อเรียกดูข้อมูลสรุปได้ทันที:\n`;
    helpMsg += `----------------------------\n`;
    helpMsg += `• พิมพ์ "เช็คสต็อก" 📊 เพื่อดูจำนวนสต็อกแบบเต็มรูปแบบ\n`;
    helpMsg += `• พิมพ์ "รายงานการส่งออก" 🚚 เพื่อดูสินค้าและช่องทางจัดจัดส่งส่งล่าสุด\n`;
    helpMsg += `• พิมพ์ "สินค้าใกล้หมด" 🚨 เพื่อดูรายการที่สต็อกเหลือน้อย\n`;
    helpMsg += `• พิมพ์ "SKU-สินค้า" (เช่น SKU-IPHONE15-PRO) 🔍 เพื่อเจาะลึกสินค้านั้นๆ\n`;
    helpMsg += `----------------------------`;
    
    return { type: 'text', text: helpMsg };
  }
};
