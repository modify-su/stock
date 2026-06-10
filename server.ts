import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { dbInstance, User, StockProduct, StockInEntry, StockOutEntry, AppSettings, UserSession, hashPassword, verifyPassword } from './src/server/database.js';

// Extend Express Request type to include currentUser
declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        username: string;
        role: 'admin' | 'user';
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'STOCKMASTER-SUPER-SECRET-JWT-KEY-2026';
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Allow cors if requested, but internal iframe handles it naturally
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL'); // Enable nested preview frame
    next();
  });

  // --- AUTHENTICATION MIDDLEWARE ---
  function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = req.cookies.token || (typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role: 'admin' | 'user' };
      const db = dbInstance.get();

      // Check if session is stored and active in the database
      const activeSession = db.sessions?.some(s => s.token === token);
      if (!activeSession) {
        res.clearCookie('token');
        return res.status(401).json({ message: 'เซสชันไม่ถูกต้องหรือหมดอายุการใช้งานแล้ว กรุณาลงชื่อเข้าใช้อีกครั้ง' });
      }

      req.currentUser = decoded;
      next();
    } catch (err) {
      res.clearCookie('token');
      return res.status(403).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' });
    }
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.currentUser) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }
    if (req.currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'สิทธิ์การเข้าถึงเฉพาะผู้ดูแลระบบ (Admin) เท่านั้น' });
    }
    next();
  }

  // --- AUTH API ---

  // Me endpoint to verify session on app load
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = req.cookies.token || (typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return res.json({ user: null });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role: 'admin' | 'user' };
      const db = dbInstance.get();

      const activeSession = db.sessions?.some(s => s.token === token);
      if (!activeSession) {
        res.clearCookie('token');
        return res.json({ user: null });
      }

      const user = db.users.find(u => u.username === decoded.username);
      if (!user) {
        res.clearCookie('token');
        return res.json({ user: null });
      }
      return res.json({
        user: {
          username: user.username,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        }
      });
    } catch (err) {
      res.clearCookie('token');
      return res.json({ user: null });
    }
  });

  // Register
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, password, securityQuestion, securityAnswer } = req.body;

    if (!username || !password || !securityQuestion || !securityAnswer) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const db = dbInstance.get();
    const existing = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      return res.status(400).json({ message: 'มีชื่อผู้ใช้นี้ในระบบแล้ว' });
    }

    // First user is automatically approved Admin! Others are pending normal users.
    const isFirstUser = db.users.length === 0;
    const role = isFirstUser ? 'admin' : 'user';
    const status = isFirstUser ? 'approved' : 'pending';

    const newUser: User = {
      username: username.trim(),
      passwordHash: hashPassword(password), // Safely hash the password with bcrypt helper
      role,
      status,
      createdAt: new Date().toISOString(),
      securityQuestion: securityQuestion.trim(),
      securityAnswer: securityAnswer.trim().toLowerCase()
    };

    db.users.push(newUser);
    dbInstance.save(db);

    const message = isFirstUser 
      ? 'ยินดีด้วยครับ! คุณเป็นผู้สมัครใช้งานคนแรก จึงได้รับสิทธิ์ Admin และอนุมัติบัญชีทันที'
      : 'สมัครสมาชิกสำเร็จ! บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติสิทธิ์';

    res.json({ message, status, username });
  });

  // Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
      }

      console.log(`[API Login Request] username: ${username}`);
      const db = dbInstance.get();
      if (!db || !db.users) {
        console.error('[API Login Error] Database or users array is empty');
        return res.status(500).json({ message: 'ฐานข้อมูลขัดข้อง (Database not loaded)' });
      }

      const user = db.users.find(u => u && u.username && u.username.toLowerCase() === username.toLowerCase());

      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(400).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }

      if (user.status === 'pending') {
        return res.status(403).json({ message: 'บัญชีนี้ยังไม่ได้รับอนุมัติใช้งานจาก Admin กรุณารอสักครู่' });
      }

      if (user.status === 'rejected') {
        return res.status(403).json({ message: 'บัญชีนี้ถูกปฏิเสธสิทธิ์การเข้าใช้งานโดยผู้ดูแลระบบ' });
      }

      // Issue JWT cookie (JWT + Cookie flow)
      const token = jwt.sign(
        { username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: false, // Set false to make sure it plays nicely inside sandbox localhost frames
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });

      // Save user session to database
      if (!db.sessions) {
        db.sessions = [];
      }
      db.sessions.push({
        token,
        username: user.username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      // Prune expired sessions from database to prevent bloated file sizes
      db.sessions = db.sessions.filter(s => new Date(s.expiresAt).getTime() > Date.now());

      dbInstance.save(db);

      console.log(`[API Login Success] username: ${username}, role: ${user.role}`);
      return res.json({
        message: 'ยินดีต้อนรับเข้าสู่ระบบคลังสินค้า!',
        token,
        user: {
          username: user.username,
          role: user.role,
          status: user.status
        }
      });
    } catch (err: any) {
      console.error('[API Login Crash Error]:', err);
      return res.status(500).json({ message: `เกิดข้อผิดพลาดขัดข้องภายในเซิร์ฟเวอร์หลัก: ${err.message}` });
    }
  });

  // Forgot password endpoint
  app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
    const { username, securityAnswer, newPassword } = req.body;
    if (!username || !securityAnswer || !newPassword) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วนเพื่อทำการตั้งค่ารหัสผ่านใหม่' });
    }

    const db = dbInstance.get();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้นี้ในระบบ' });
    }

    if (user.securityAnswer.toLowerCase() !== securityAnswer.trim().toLowerCase()) {
      return res.status(400).json({ message: 'คำตอบคำถามความปลอดภัยไม่ถูกต้อง' });
    }

    user.passwordHash = hashPassword(newPassword); // Hash replacement password
    dbInstance.save(db);

    res.json({ message: 'เปลี่ยนรหัสผ่านใหม่สำเร็จแล้ว! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' });
  });

  // Get question of the user for password reset
  app.get('/api/auth/security-question/:username', (req: Request, res: Response) => {
    const username = req.params.username;
    const db = dbInstance.get();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้นี้ในระบบ' });
    }

    res.json({ question: user.securityQuestion });
  });

  // Profiling API requested directly by standard
  app.get('/api/auth/profile', authenticateToken, (req: Request, res: Response) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการตรวจสอบโปรไฟล์' });
    }
    const db = dbInstance.get();
    const user = db.users.find(u => u.username === req.currentUser?.username);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งานนี้ในระบบฐานข้อมูล' });
    }
    res.json({
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      securityQuestion: user.securityQuestion
    });
  });

  // Private Settings Endpoint
  app.get('/api/auth/settings', authenticateToken, (req: Request, res: Response) => {
    const db = dbInstance.get();
    res.json(db.settings);
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = req.cookies.token || (typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (token) {
      const db = dbInstance.get();
      if (db.sessions) {
        db.sessions = db.sessions.filter(s => s.token !== token);
        dbInstance.save(db);
      }
    }
    res.clearCookie('token');
    res.json({ message: 'ออกจากระบบคลังสินค้าเรียบร้อยแล้ว' });
  });


  // --- ADMIN PANEL API ---

  // Get all users
  app.get('/api/admin/users', authenticateToken, requireAdmin, (req: Request, res: Response) => {
    const db = dbInstance.get();
    const sanitisedUsers = db.users.map(u => ({
      username: u.username,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      securityQuestion: u.securityQuestion
    }));
    res.json(sanitisedUsers);
  });

  // Update user status/roles
  app.post('/api/admin/users/:tgtUsername/status', authenticateToken, requireAdmin, (req: Request, res: Response) => {
    const tgtUsername = req.params.tgtUsername;
    const { status, role } = req.body;

    const db = dbInstance.get();
    const user = db.users.find(u => u.username.toLowerCase() === tgtUsername.toLowerCase());

    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งานรายนี้' });
    }

    if (user.username === 'admin' && req.currentUser?.username !== 'admin') {
      return res.status(403).json({ message: 'ไม่สามารถแก้ไขข้อมูผู้ดูแลระบบหลักได้' });
    }

    if (status) user.status = status;
    if (role) user.role = role;

    dbInstance.save(db);
    res.json({ message: `อัปเดตสิทธิ์ ${tgtUsername} เป็น ${status || ''} ${role || ''} เรียบร้อยแล้ว`, user });
  });

  // Update System Settings (Logo / custom title)
  app.get('/api/admin/settings', (req: Request, res: Response) => {
    const db = dbInstance.get();
    res.json(db.settings);
  });

  app.post('/api/admin/settings', authenticateToken, requireAdmin, (req: Request, res: Response) => {
    const { logoUrl, logoText, loginBgColor, loginTitle, lowStockAlertEnabled } = req.body;
    const db = dbInstance.get();

    if (logoUrl !== undefined) db.settings.logoUrl = logoUrl;
    if (logoText !== undefined) db.settings.logoText = logoText;
    if (loginBgColor !== undefined) db.settings.loginBgColor = loginBgColor;
    if (loginTitle !== undefined) db.settings.loginTitle = loginTitle;
    if (lowStockAlertEnabled !== undefined) db.settings.lowStockAlertEnabled = lowStockAlertEnabled;

    dbInstance.save(db);
    res.json({ message: 'อัปเดตการตั้งค่าระบบเรียบร้อยแล้ว', settings: db.settings });
  });


  // --- STOCK MANAGEMENT API ---

  // Get dynamic listings of products and quantities
  app.get('/api/stock/products', authenticateToken, (req: Request, res: Response) => {
    const db = dbInstance.get();
    res.json(db.products);
  });

  // Add SKU / Product Definition
  app.post('/api/stock/products/add', authenticateToken, (req: Request, res: Response) => {
    const { sku, name, category, initialQty, lowStockThreshold } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูล SKU, ชื่อสินค้า และ หมวดหมู่' });
    }

    const parsedSku = sku.trim().toUpperCase();
    const db = dbInstance.get();
    const existing = db.products.find(p => p.sku === parsedSku);

    if (existing) {
      return res.status(400).json({ message: `มีสินค้า SKU ${parsedSku} อยู่ในระบบแล้ว` });
    }

    const newProduct: StockProduct = {
      sku: parsedSku,
      name: name.trim(),
      category: category.trim(),
      quantity: Number(initialQty) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.products.push(newProduct);

    // If initialQty > 0, we can write a stock-in audit entry
    if (Number(initialQty) > 0) {
      const auditEntry: StockInEntry = {
        id: 'IN-' + Date.now().toString().slice(-6),
        sku: parsedSku,
        quantity: Number(initialQty),
        timestamp: new Date().toISOString(),
        user: req.currentUser?.username || 'system',
        category: category.trim(),
        notes: 'ยอดเริ่มต้น ณ วันลงทะเบียนสินค้า'
      };
      db.stockInHistory.push(auditEntry);
    }

    dbInstance.save(db);
    res.json({ message: `เพิ่มสินค้า SKU ${parsedSku} แล้ว`, product: newProduct });
  });

  // Stock In Order
  app.post('/api/stock/in', authenticateToken, (req: Request, res: Response) => {
    const { sku, quantity, notes } = req.body;
    const qty = Number(quantity);

    if (!sku || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: 'กรุณาระบุ SKU และจำนวนสินค้าที่ถูกต้องที่มากกว่า 0' });
    }

    const db = dbInstance.get();
    const product = db.products.find(p => p.sku === sku);

    if (!product) {
      return res.status(404).json({ message: `ไม่พบสินค้า SKU ${sku} ในะบบ กรุณาเพิ่มสินค้าก่อน` });
    }

    // Increment
    product.quantity += qty;
    product.updatedAt = new Date().toISOString();

    const entryId = 'IN-' + Date.now().toString().slice(-6);
    const newIn: StockInEntry = {
      id: entryId,
      sku: product.sku,
      quantity: qty,
      category: product.category,
      notes: notes || '',
      timestamp: new Date().toISOString(),
      user: req.currentUser?.username || 'staff'
    };

    db.stockInHistory.push(newIn);
    dbInstance.save(db);

    res.json({
      message: `นำเข้าสินค้าสำเร้จ! SKU: ${sku}, เพิ่มเติม: +${qty} ชิ้น, ยอดคงเหลือล่าสุด: ${product.quantity} ชิ้น`,
      product,
      entry: newIn
    });
  });

  // Stock Out Order
  app.post('/api/stock/out', authenticateToken, (req: Request, res: Response) => {
    const { sku, quantity, platform, courier } = req.body;
    const qty = Number(quantity);

    if (!sku || isNaN(qty) || qty <= 0 || !platform || !courier) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลส่งออกสินค้า SKU, จำนวน, แพลตฟอร์ม และผู้ให้บริการจัดส่ง' });
    }

    const db = dbInstance.get();
    const product = db.products.find(p => p.sku === sku);

    if (!product) {
      return res.status(404).json({ message: 'ไม่พบสินค้า SKU นี้ในระบบคลังสินค้า' });
    }

    if (product.quantity < qty) {
      return res.status(400).json({
        message: `สินค้าคงคลังไม่เพียงพอ! ${product.name} ปัจจุบันเหลือ ${product.quantity} ชิ้น แต่ต้องการส่งออก ${qty} ชิ้น`
      });
    }

    // Decrement
    product.quantity -= qty;
    product.updatedAt = new Date().toISOString();

    const entryId = 'OUT-' + Date.now().toString().slice(-6);
    const newOut: StockOutEntry = {
      id: entryId,
      sku: product.sku,
      quantity: qty,
      platform,
      courier,
      timestamp: new Date().toISOString(),
      user: req.currentUser?.username || 'staff'
    };

    db.stockOutHistory.push(newOut);
    dbInstance.save(db);

    // Determine low stock notification triggers
    let lowStockWarning = null;
    if (product.quantity <= product.lowStockThreshold) {
      lowStockWarning = `⚠️ แจ้งเตือนด่วน: สินค้า ${product.name} (SKU: ${product.sku}) เหลือเพียง ${product.quantity} ชิ้น ต่ำกว่าเกณฑ์เตือน (${product.lowStockThreshold} ชิ้น)!`;
    }

    res.json({
      message: `ตัดสต็อกส่งออกสินค้าสำเร็จ! SKU: ${sku}, ตัดสุทธิ: -${qty} ชิ้น, แพลตฟอร์ม: ${platform}, ขนส่ง: ${courier}`,
      product,
      entry: newOut,
      lowStockWarning
    });
  });

  // Combine full logs for historical reports
  app.get('/api/stock/history', authenticateToken, (req: Request, res: Response) => {
    const db = dbInstance.get();
    res.json({
      stockIn: db.stockInHistory,
      stockOut: db.stockOutHistory
    });
  });

  // --- CATEGORIES MANAGEMENT ENDPOINTS ---

  app.post('/api/stock/categories/add', authenticateToken, (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'กรุณากรอกชื่อหมวดหมู่ที่เหมาะสม' });
    }
    const db = dbInstance.get();
    if (!db.settings.categories) {
      db.settings.categories = ['ทั่วไป', 'ความงาม', 'แฟชั่น', 'เครื่องใช้ไฟฟ้า', 'ไอที & อุปกรณ์เสริม'];
    }
    const cleanName = name.trim();
    if (db.settings.categories.includes(cleanName)) {
      return res.status(400).json({ message: 'มีชื่อหมวดหมู่นี้ในระบบคลังอยู่แล้ว' });
    }
    db.settings.categories.push(cleanName);
    dbInstance.save(db);
    res.json({ message: 'เพิ่มหมวดหมู่เรียบร้อยแล้ว!', categories: db.settings.categories });
  });

  app.post('/api/stock/categories/update', authenticateToken, (req: Request, res: Response) => {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ message: 'กรุณาระบุหมวดหมู่เดิมและหมวดหมู่ใหม่เพื่อดำเนินงานต่อ' });
    }
    const db = dbInstance.get();
    if (!db.settings.categories) {
      db.settings.categories = ['ทั่วไป', 'ความงาม', 'แฟชั่น', 'เครื่องใช้ไฟฟ้า', 'ไอที & อุปกรณ์เสริม'];
    }
    const idx = db.settings.categories.indexOf(oldName.trim());
    if (idx === -1) {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ต้นทางในระบบ' });
    }
    const cleanNewName = newName.trim();
    db.settings.categories[idx] = cleanNewName;

    // Apply cascading category updates to products and history
    db.products.forEach(p => {
      if (p.category === oldName.trim()) {
        p.category = cleanNewName;
      }
    });

    db.stockInHistory.forEach(h => {
      if (h.category === oldName.trim()) {
        h.category = cleanNewName;
      }
    });

    dbInstance.save(db);
    res.json({ message: 'อัปเดตป้ายชื่อหมวดหมู่และสินค้าที่เกี่ยวข้องสำเร็จ!', categories: db.settings.categories });
  });

  app.post('/api/stock/categories/delete', authenticateToken, (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'กรุณากรอกหมวดหมู่เป้าหมายที่จะเอาออก' });
    }
    const db = dbInstance.get();
    if (!db.settings.categories) {
      db.settings.categories = ['ทั่วไป', 'ความงาม', 'แฟชั่น', 'เครื่องใช้ไฟฟ้า', 'ไอที & อุปกรณ์เสริม'];
    }
    const idx = db.settings.categories.indexOf(name.trim());
    if (idx === -1) {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ดังกล่าว' });
    }
    db.settings.categories.splice(idx, 1);

    // Default products in the deleted category back to 'ทั่วไป' (General)
    db.products.forEach(p => {
      if (p.category === name.trim()) {
        p.category = 'ทั่วไป';
      }
    });

    db.stockInHistory.forEach(h => {
      if (h.category === name.trim()) {
        h.category = 'ทั่วไป';
      }
    });

    dbInstance.save(db);
    res.json({ message: 'ลบชื่อหมวดหมู่รวบรวมสินค้าสำเร็จ!', categories: db.settings.categories });
  });

  // --- GOOGLE SHEETS BULK SYNCHRONIZATION API ---

  app.post('/api/stock/products/bulk-sync', authenticateToken, (req: Request, res: Response) => {
    const { sheetProducts, userUsername, syncStrategy } = req.body;
    if (!sheetProducts || !Array.isArray(sheetProducts)) {
      return res.status(400).json({ message: 'รูปแบบไฟล์รายการนำเข้าไม่ถูกต้อง' });
    }

    const db = dbInstance.get();
    let added = 0;
    let updated = 0;

    sheetProducts.forEach((sp: any) => {
      const sku = String(sp.sku || sp.SKU || '').trim().toUpperCase();
      if (!sku) return;

      const idx = db.products.findIndex(p => p.sku === sku);
      const isNew = idx === -1;

      if (isNew) {
        const initialQty = Number(sp.quantity ?? sp.quantityStr ?? sp.qty ?? sp['คงเหลือสะสม'] ?? 0);
        const nameVal = String(sp.name || sp['ชื่อสินค้า'] || 'สินค้าใหม่').trim();
        const catVal = String(sp.category || sp['หมวดหมู่สินค้า'] || 'ทั่วไป').trim();
        const alertVal = Number(sp.lowStockThreshold || sp['จำนวนแจ้งเตือนขั้นต่ำ'] || 10);

        const newP: StockProduct = {
          sku,
          name: nameVal,
          category: catVal,
          quantity: initialQty,
          lowStockThreshold: alertVal,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.products.push(newP);
        added++;

        if (initialQty > 0) {
          const logId = 'IN-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
          db.stockInHistory.push({
            id: logId,
            sku,
            quantity: initialQty,
            timestamp: new Date().toISOString(),
            user: userUsername || req.currentUser?.username || 'admin',
            category: catVal,
            notes: 'ซิงค์นำเข้าจาก Google Sheets'
          });
        }
      } else {
        const existing = db.products[idx];
        existing.name = String(sp.name || sp['ชื่อสินค้า'] || existing.name).trim();
        existing.category = String(sp.category || sp['หมวดหมู่สินค้า'] || existing.category).trim();
        existing.lowStockThreshold = Number(sp.lowStockThreshold || sp['จำนวนแจ้งเตือนขั้นต่ำ'] || existing.lowStockThreshold);

        const sheetQty = Number(sp.quantity ?? sp.quantityStr ?? sp.qty ?? sp['คงเหลือสะสม'] ?? existing.quantity);

        if (syncStrategy === 'overwrite') {
          existing.quantity = sheetQty;
        } else if (syncStrategy === 'accumulate') {
          existing.quantity += sheetQty;
        } else {
          // Default Replace
          existing.quantity = sheetQty;
        }

        existing.updatedAt = new Date().toISOString();
        updated++;
      }
    });

    dbInstance.save(db);
    res.json({ added, updated });
  });


  // --- REPORT EXPORTS AS CSV (EXCEL/GOOGLE SHEET READABLE) ---

  app.get('/api/stock/report/csv', authenticateToken, (req: Request, res: Response) => {
    const { type } = req.query; // 'products', 'stock_in', 'stock_out'
    const db = dbInstance.get();

    let csvContent = '\ufeff'; // Add UTF-8 BOM so Excel opens Thai languages without encoding issues

    if (type === 'products') {
      csvContent += 'SKU,ชื่อสินค้า,หมวดหมู่,จำนวนคงเหลือ,เกณฑ์เตือนสต็อกต่ำ,วันที่สร้าง,อัปเดตล่าสุด\n';
      db.products.forEach(p => {
        csvContent += `"${p.sku}","${p.name.replace(/"/g, '""')}","${p.category.replace(/"/g, '""')}",${p.quantity},${p.lowStockThreshold},"${p.createdAt}","${p.updatedAt}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=stock_remaining_report.csv');
      return res.send(csvContent);
    } 
    
    if (type === 'stock_in') {
      csvContent += 'รหัสรายการ,SKU,จำนวนที่นำเข้า,หมวดหมู่,ผู้ดำเนินรายการ,หมายเหตุ,วันเวลา\n';
      db.stockInHistory.forEach(i => {
        csvContent += `"${i.id}","${i.sku}",${i.quantity},"${i.category}","${i.user}","${(i.notes || '').replace(/"/g, '""')}","${i.timestamp}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=stock_receiving_report.csv');
      return res.send(csvContent);
    }

    if (type === 'stock_out') {
      csvContent += 'รหัสรายการ,SKU,จำนวนส่งออก,ช่องทางจำหน่าย,บริษัทขนส่ง,ผู้ตัดสต็อก,วันเวลา\n';
      db.stockOutHistory.forEach(o => {
        csvContent += `"${o.id}","${o.sku}",${o.quantity},"${o.platform}","${o.courier}","${o.user}","${o.timestamp}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=stock_delivery_report.csv');
      return res.send(csvContent);
    }

    // Default: return general summarized CSV
    csvContent += 'สถิติคลังสินค้าภาพรวม\n';
    csvContent += `จำนวนรายการสินค้าทั้งหมดในระบบ,${db.products.length},รายการ\n`;
    csvContent += `จำนวนนำเข้ารวมสะสม,${db.stockInHistory.reduce((s, x) => s + x.quantity, 0)},ชิ้น\n`;
    csvContent += `จำนวนส่งออกรวมสะสม,${db.stockOutHistory.reduce((s, x) => s + x.quantity, 0)},ชิ้น\n`;
    csvContent += `สินค้าใกล้หมดเตือนแดชบอร์ด,${db.products.filter(p => p.quantity <= p.lowStockThreshold).length},รายการ\n`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_inventory_summary.csv');
    res.send(csvContent);
  });


  // --- BOT RESPONSE ENGINE (SHARED FOR WEBHOOK & SIMULATOR) ---

  function generateBotReply(messageText: string): any {
    const textClean = messageText.trim().toLowerCase();
    const db = dbInstance.get();

    // 1. Stock Status Query
    if (textClean === 'เช็คสต็อก' || textClean === 'สต็อก' || textClean === 'สต็อกคงเหลือ' || textClean === 'stock' || textClean === 'ยอดคงเหลือ') {
      if (db.products.length === 0) {
        return {
          type: 'text',
          text: 'ขณะนี้ไม่มีสินค้าใดๆ ลงทะเบียนอยู่ในคลังสินค้าของคุณครับ 📦'
        };
      }

      let responseText = '📊 รายงานยอดสินค้าคงเหลือแบบตรวจสอบด่วน (Real-time):\n';
      responseText += '============================\n';
      db.products.forEach((p, idx) => {
        const warningIcon = p.quantity <= p.lowStockThreshold ? '⚠️ ' : '✅ ';
        responseText += `${idx + 1}. ${warningIcon}${p.name}\n- SKU: ${p.sku}\n- คงเหลือ: **${p.quantity}** ชิ้น\n- หมวดหมู่: [${p.category}]\n\n`;
      });
      responseText += '============================\n';
      responseText += '💡 พิมพ์ชื่อ SKU (เช่น SKU-IPHONE15-PRO) เพื่อดูประวัติการเคลื่อนไหวสินค้าชิ้นนั้น';
      
      return { type: 'text', text: responseText };
    }

    // 2. Export Outward Delivery query
    if (textClean === 'ส่งออก' || textClean === 'รายงานการส่งออก' || textClean === 'ยอดส่งออก' || textClean === 'ขนส่ง' || textClean === 'export' || textClean === 'delivery') {
      if (db.stockOutHistory.length === 0) {
        return {
          type: 'text',
          text: 'ยังไม่พบประวัติข้อมูลส่งออกสินค้าในช่วงนี้ครับ 🚚'
        };
      }

      let responseText = '🚚 รายงานประวัติการส่งออกและขนส่งล่าสุด (5 รายการ):\n';
      responseText += '============================\n';
      
      const recentOuts = [...db.stockOutHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
      
      recentOuts.forEach((o, idx) => {
        const prod = db.products.find(p => p.sku === o.sku);
        const prodName = prod ? prod.name : o.sku;
        const localDate = new Date(o.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        responseText += `${idx + 1}. 📤 ${prodName}\n- จำนวนส่งออก: ${o.quantity} ชิ้น\n- ขายผ่าน: ${o.platform} | ขนส่งโดย: ${o.courier}\n- จัดทำโดย: ${o.user}\n- วันเวลา: ${localDate}\n\n`;
      });
      responseText += '============================';

      return { type: 'text', text: responseText };
    }

    // 3. Low stock warning query
    if (textClean === 'แจ้งเตือน' || textClean === 'สินค้าใกล้หมด' || textClean === 'เตือน' || textClean === 'low stock') {
      const alertedProducts = db.products.filter(p => p.quantity <= p.lowStockThreshold);

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
    const matchingProductBySku = db.products.find(
      p => p.sku.toLowerCase() === textClean || textClean.includes(p.sku.toLowerCase())
    );

    if (matchingProductBySku) {
      const warnings = matchingProductBySku.quantity <= matchingProductBySku.lowStockThreshold 
        ? '🚨 (ของใกล้หมด!)' 
        : '🟢 (สถานะเพียงพอ)';
      
      const inQty = db.stockInHistory.filter(h => h.sku === matchingProductBySku.sku).reduce((sum, h) => sum + h.quantity, 0);
      const outQty = db.stockOutHistory.filter(o => o.sku === matchingProductBySku.sku).reduce((sum, o) => sum + o.quantity, 0);

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


  // --- REAL WEBHOOK ENDPOINT FOR REAL LINE CHANNELS ---
  app.post('/api/line-webhook', (req: Request, res: Response) => {
    // Standard LINE Webhook receiver structure
    const events = req.body.events;
    if (!events || !Array.isArray(events)) {
      return res.status(200).send('No Events');
    }

    // Process events in background
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        const msgText = event.message.text;
        const modelReply = generateBotReply(msgText);
        
        console.log(`[LINE Webhook] Received message: "${msgText}". Responding: "${JSON.stringify(modelReply)}"`);
        
        // In a real application, you would invoke the Line Messaging client here to trigger reply:
        // axios.post('https://api.line.me/v2/bot/message/reply', { replyToken, messages: [modelReply] }, ...)
      }
    }

    res.status(200).send('OK');
  });

  // --- BOT SIMULATOR ENDPOINT FOR OUR BROWSER SIMULATOR CHAT APP ---
  app.post('/api/line-simulator', (req: Request, res: Response) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'ต้องการข้อมูลส่งสนทนา' });
    }

    const payloadReply = generateBotReply(message);
    res.json({
      userInput: message,
      botReply: payloadReply
    });
  });


  // --- VITE DEV / PRODUCTION MIDDLEWARE INTEGRATION ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets for production Cloud Run deployment
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
  // --- GLOBAL ERROR HANDLER ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Express Global Error Handler]:', err);
    res.status(err.status || 500).json({
      message: err.message || 'เกิดข้อผิดพลาดขัดข้องภายในระบบเซิร์ฟเวอร์หลัก'
    });
  });

  // Fallback to main app (dev only)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server launched successfully at: http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server bootstrapping crashed:', err);
});
