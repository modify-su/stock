import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

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

const DB_FILE_PATH = path.join(process.cwd(), 'src', 'stock_db.json');

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

class FileDatabase {
  private cache: DBStructure | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      ensureDirectoryExistence(DB_FILE_PATH);
      if (!fs.existsSync(DB_FILE_PATH)) {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
        this.cache = JSON.parse(JSON.stringify(INITIAL_DB));
        console.log('Database file initialized at:', DB_FILE_PATH);
      } else {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        try {
          this.cache = JSON.parse(fileContent);
          // Run simple migrations if keys missing
          if (this.cache) {
            let changed = false;
            if (!this.cache.settings) {
              this.cache.settings = { ...INITIAL_DB.settings };
              changed = true;
            } else if (!this.cache.settings.categories) {
              this.cache.settings.categories = ['ทั่วไป', 'ความงาม', 'แฟชั่น', 'เครื่องใช้ไฟฟ้า', 'ไอที & อุปกรณ์เสริม'];
              changed = true;
            }
            if (!this.cache.stockInHistory) {
              this.cache.stockInHistory = [];
              changed = true;
            }
            if (!this.cache.stockOutHistory) {
              this.cache.stockOutHistory = [];
              changed = true;
            }
            if (!this.cache.sessions) {
              this.cache.sessions = [];
              changed = true;
            }
            if (changed) {
              this.save();
            }
          }
        } catch (e) {
          console.error('Error parsing DB structure, resetting file to initial database', e);
          fs.writeFileSync(DB_FILE_PATH, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
          this.cache = JSON.parse(JSON.stringify(INITIAL_DB));
        }
      }
    } catch (err) {
      console.error('Failed to initialize database file. Using in-memory fallback.', err);
      this.cache = JSON.parse(JSON.stringify(INITIAL_DB));
    }
  }

  public get(): DBStructure {
    if (!this.cache) {
      this.init();
    }
    return this.cache || INITIAL_DB;
  }

  public save(data?: DBStructure) {
    if (data) {
      this.cache = data;
    }
    try {
      if (this.cache) {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.cache, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('Database save failed:', err);
    }
  }
}

export const dbInstance = new FileDatabase();
