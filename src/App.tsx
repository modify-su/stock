import { useState, useEffect } from 'react';
import { 
  PackageOpen, 
  Sparkles, 
  LayoutDashboard, 
  History, 
  ShoppingBag, 
  Truck, 
  Info, 
  RefreshCcw,
  Settings as SettingsIcon,
  Users,
  Lock,
  Boxes,
  Layers,
  Database,
  Shield,
  FileSpreadsheet,
  QrCode,
  MapPin,
  Printer,
  Camera,
  Wrench,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bot
} from 'lucide-react';
import { Product, Transaction, TransactionType, UserProfile, AppSettings, RolePermissions, Category, Shelf } from './types';
import { INITIAL_PRODUCTS, INITIAL_TRANSACTIONS } from './mockData';
import DashboardStats from './components/DashboardStats';
import InventoryTable from './components/InventoryTable';
import ActionForms from './components/ActionForms';
import TransactionLogs from './components/TransactionLogs';
import SystemSettings from './components/SystemSettings';
import SyncAndBackup from './components/SyncAndBackup';
import LoginScreen from './components/LoginScreen';
import ShelfManagement from './components/ShelfManagement';
import ShelfAuditModal from './components/ShelfAuditModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import SmartScanner from './components/SmartScanner';
import LineBotSettings from './components/LineBotSettings';


// Import Firebase
import { db } from './firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  writeBatch, 
  getDocs,
  getDoc
} from 'firebase/firestore';

// Dynamic icon renderer
function AppLogoIcon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  switch (name) {
    case 'PackageOpen': return <PackageOpen className={className} />;
    case 'Boxes': return <Boxes className={className} />;
    case 'ShoppingBag': return <ShoppingBag className={className} />;
    case 'Truck': return <Truck className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'Database': return <Database className={className} />;
    case 'Shield': return <Shield className={className} />;
    default: return <PackageOpen className={className} />;
  }
}

// Initial User account setups
const INITIAL_USERS: UserProfile[] = [
  { 
    id: 'usr-1', 
    name: 'ผู้จัดการ (ผู้ดูแลระบบหลัก)', 
    username: 'modify', 
    role: 'ADMIN', 
    isActive: true,
    password: '1234',
    securityQuestion: 'จังหวัดที่คุณเกิดคือจังหวัดอะไร? (เช่น กรุงเทพ)',
    securityAnswer: 'กรุงเทพ'
  },
  { 
    id: 'usr-2', 
    name: 'วิภา แสนสุข (เจ้าหน้าที่คลัง)', 
    username: 'wipa_keeper', 
    role: 'KEEPER', 
    isActive: true,
    password: 'keeper',
    securityQuestion: 'จังหวัดที่คุณเกิดคือจังหวัดอะไร? (เช่น กรุงเทพ)',
    securityAnswer: 'กรุงเทพ'
  },
  { 
    id: 'usr-3', 
    name: 'ปกรณ์ มีบุญ (ผู้ตรวจสอบบัญชี)', 
    username: 'pakorn_auditor', 
    role: 'AUDITOR', 
    isActive: true,
    password: 'auditor',
    securityQuestion: 'จังหวัดที่คุณเกิดคือจังหวัดอะไร? (เช่น กรุงเทพ)',
    securityAnswer: 'กรุงเทพ'
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'ระบบจัดการสต๊อกสินค้า',
  appSubtitle: 'Professional Edition',
  appLogo: 'PackageOpen',
  googleSheetsId: '',
  googleSheetsUrl: '',
  googleSheetsAutoSync: false,
  googleSheetsLastSyncedAt: '',
  isMaintenanceMode: false,
  maintenanceMessage: 'ขออภัย ระบบอยู่ระหว่างการปิดปรับปรุงเพื่ออัปเดตฟีเจอร์ใหม่ชั่วคราว กรุณากลับมาใหม่อีกครั้งในภายหลัง'
};

const DEFAULT_ROLE_PERMISSIONS: Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions> = {
  ADMIN: {
    manageProducts: true,
    recordTransactions: true,
    manageSettings: true,
    resetSystem: true
  },
  KEEPER: {
    manageProducts: true,
    recordTransactions: true,
    manageSettings: false,
    resetSystem: false
  },
  AUDITOR: {
    manageProducts: false,
    recordTransactions: false,
    manageSettings: false,
    resetSystem: false
  }
};

const DEFAULT_MENU_LABELS = {
  OVERVIEW: 'ภาพรวม & แดชบอร์ด',
  OPERATIONS: 'บันทึกความเคลื่อนไหว',
  INVENTORY: 'จัดการสต๊อกสินค้า',
  LOGS: 'ประวัติทำรายการ (Ledger)',
  SHELVES: 'จัดการชั้นวางสินค้า / QR Code',
  SYNC: 'สำรอง & นำเข้าข้อมูล (CSV / Excel)',
  SETTINGS: 'ตั้งค่า & สิทธิ์ผู้ใช้',
  SCANNER: 'ระบบสแกนพัสดุ AI',
};

const fontSizeClasses: Record<string, { btn: string; icon: string }> = {
  xs: { btn: 'text-xs', icon: 'w-3.5 h-3.5' },
  sm: { btn: 'text-sm', icon: 'w-4 h-4' },
  base: { btn: 'text-base', icon: 'w-4.5 h-4.5' },
  lg: { btn: 'text-lg', icon: 'w-5 h-5' },
  xl: { btn: 'text-xl', icon: 'w-5.5 h-5.5' },
};

const paddingClasses: Record<string, string> = {
  xs: 'px-2 py-1',
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
  lg: 'px-5 py-3.5',
  xl: 'px-6 py-4',
};

export default function App() {
  // --- Auto-Wipe stale mock cache on initial load for fresh v3 deploy ---
  if (typeof window !== 'undefined' && !localStorage.getItem('inventory_modify_v3_cleared')) {
    localStorage.removeItem('inventory_products');
    localStorage.removeItem('inventory_transactions');
    localStorage.removeItem('inventory_users');
    localStorage.removeItem('inventory_settings');
    localStorage.removeItem('inventory_role_perm');
    localStorage.removeItem('inventory_current_user');
    localStorage.removeItem('inventory_is_authenticated');
    localStorage.setItem('inventory_modify_v3_cleared', 'true');
  }

  // --- Real-time Collections loading status ---
  const [loadingCollections, setLoadingCollections] = useState({
    users: true,
    products: true,
    transactions: true,
    settings: true,
    rolePermissions: true,
    categories: true,
    shelves: true
  });

  const dbLoading = loadingCollections.users || 
                    loadingCollections.products || 
                    loadingCollections.transactions || 
                    loadingCollections.settings || 
                    loadingCollections.rolePermissions ||
                    loadingCollections.categories ||
                    loadingCollections.shelves;

  // --- Real-time Sync States from Firestore ---
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [rolePermissions, setRolePermissions] = useState<Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>>(DEFAULT_ROLE_PERMISSIONS);

  // --- Device-specific local states ---
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const local = localStorage.getItem('inventory_current_user');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_USERS[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('inventory_is_authenticated') === 'true';
  });

  // --- Sync with Firestore onSnapshot on Mount ---
  useEffect(() => {
    // 1. Users real-time listener
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        // First-run seed with default users
        INITIAL_USERS.forEach(async (u) => {
          await setDoc(doc(db, 'users', u.id), u);
        });
      } else {
        const list: UserProfile[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as UserProfile);
        });
        setUsers(list);
      }
      setLoadingCollections(prev => ({ ...prev, users: false }));
    }, (error) => {
      console.error("users sync error", error);
      setLoadingCollections(prev => ({ ...prev, users: false }));
    });

    // 2. Products real-time listener
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((snap) => {
        const data = snap.data();
        list.push({
          id: data.id || snap.id,
          ...data
        } as Product);
      });
      // Sort: newest updated first
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProducts(list);
      setLoadingCollections(prev => ({ ...prev, products: false }));
    }, (error) => {
      console.error("products sync error", error);
      setLoadingCollections(prev => ({ ...prev, products: false }));
    });

    // 3. Transactions real-time listener
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((snap) => {
        list.push(snap.data() as Transaction);
      });
      // Sort: newest date first
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(list);
      setLoadingCollections(prev => ({ ...prev, transactions: false }));
    }, (error) => {
      console.error("transactions sync error", error);
      setLoadingCollections(prev => ({ ...prev, transactions: false }));
    });

    // 4. Settings real-time listener
    const unsubSettings = onSnapshot(doc(db, 'settings', 'appSettings'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as AppSettings);
      } else {
        // Seed Settings doc
        setDoc(doc(db, 'settings', 'appSettings'), DEFAULT_SETTINGS);
      }
      setLoadingCollections(prev => ({ ...prev, settings: false }));
    }, (error) => {
      console.error("settings sync error", error);
      setLoadingCollections(prev => ({ ...prev, settings: false }));
    });

    // 5. Role Permissions real-time listener
    const unsubRolePerms = onSnapshot(doc(db, 'settings', 'rolePermissions'), (snap) => {
      if (snap.exists()) {
        setRolePermissions(snap.data() as Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>);
      } else {
        // Seed Role Permissions doc
        setDoc(doc(db, 'settings', 'rolePermissions'), DEFAULT_ROLE_PERMISSIONS);
      }
      setLoadingCollections(prev => ({ ...prev, rolePermissions: false }));
    }, (error) => {
      console.error("role permissions sync error", error);
      setLoadingCollections(prev => ({ ...prev, rolePermissions: false }));
    });

    // 6. Categories real-time listener
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const list: Category[] = [];
      snapshot.forEach((snap) => {
        list.push(snap.data() as Category);
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setCategories(list);
      setLoadingCollections(prev => ({ ...prev, categories: false }));
    }, (error) => {
      console.error("categories sync error", error);
      setLoadingCollections(prev => ({ ...prev, categories: false }));
    });

    // 7. Shelves real-time listener
    const unsubShelves = onSnapshot(collection(db, 'shelves'), async (snapshot) => {
      if (snapshot.empty) {
        // Auto-seed shelves from products' unique locations
        try {
          const stateSnap = await getDoc(doc(db, 'settings', 'shelves_state'));
          if (!stateSnap.exists()) {
            // Mark as seeded first to prevent multiple triggers
            await setDoc(doc(db, 'settings', 'shelves_state'), { seeded: true });

            const prodSnap = await getDocs(collection(db, 'products'));
            const locationsSet = new Set<string>();
            prodSnap.forEach(snap => {
              const loc = (snap.data().location || '').trim();
              if (loc) locationsSet.add(loc);
            });
            
            if (locationsSet.size > 0) {
              let index = 1;
              for (const loc of Array.from(locationsSet)) {
                const shelfId = `shelf-${Date.now()}-${index++}`;
                await setDoc(doc(db, 'shelves', shelfId), {
                  id: shelfId,
                  name: loc,
                  description: `ชั้นวางสำหรับเก็บสินค้า ${loc}`,
                  zone: 'โซนทั่วไป',
                  createdAt: new Date().toISOString()
                });
              }
            } else {
              // Seed default shelf
              const shelfId = 'shelf-default-1';
              await setDoc(doc(db, 'shelves', shelfId), {
                id: shelfId,
                name: 'A1',
                description: 'ชั้นวางหลักโซน A แถว 1',
                zone: 'โซน A',
                createdAt: new Date().toISOString()
              });
            }
          } else {
            // Already initialized once, user has explicitly deleted all shelves
            setShelves([]);
          }
        } catch (err) {
          console.error("Failed to seed shelves:", err);
          setShelves([]);
        }
      } else {
        const list: Shelf[] = [];
        snapshot.forEach((snap) => {
          list.push(snap.data() as Shelf);
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
        setShelves(list);
      }
      setLoadingCollections(prev => ({ ...prev, shelves: false }));
    }, (error) => {
      console.error("shelves sync error", error);
      setLoadingCollections(prev => ({ ...prev, shelves: false }));
    });

    return () => {
      unsubUsers();
      unsubProducts();
      unsubTx();
      unsubSettings();
      unsubRolePerms();
      unsubCategories();
      unsubShelves();
    };
  }, []);

  // Sync device session state
  useEffect(() => {
    localStorage.setItem('inventory_current_user', JSON.stringify(currentUser));
  }, [currentUser]);



  useEffect(() => {
    localStorage.setItem('inventory_is_authenticated', String(isAuthenticated));
  }, [isAuthenticated]);

  // --- Real-time Connection Watchdog & Network Status ---
  const [syncStatus, setSyncStatus] = useState<'connected' | 'offline' | 'syncing'>('connected');

  useEffect(() => {
    const handleOnline = () => setSyncStatus('connected');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (!navigator.onLine) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Live App Version Checking and Clean Auto-Update ---
  const [clientVersion, setClientVersion] = useState<string | null>(null);
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch('/api/version');
        if (res.ok) {
          const data = await res.json();
          if (data && data.version) {
            setClientVersion(data.version);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch initial app version:", e);
      }
    };
    fetchVersion();
  }, []);

  useEffect(() => {
    if (!clientVersion) return;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version');
        if (res.ok) {
          const data = await res.json();
          if (data && data.version && data.version !== clientVersion) {
            setIsNewVersionAvailable(true);
            
            // 🔒 ออกจากระบบโดยอัตโนมัติ เพื่อความปลอดภัยและบังคับดึงข้อมูลโค้ดใหม่ล่าสุด
            localStorage.removeItem('inventory_current_user');
            localStorage.removeItem('inventory_is_authenticated');
            sessionStorage.clear();
            
            // สั่งล้างแคชใน Cache Storage และปิด Service Worker ของเบราว์เซอร์ทันที
            try {
              if ('caches' in window) {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
              }
              if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
              }
            } catch (cacheErr) {
              console.warn("Failed to clear cache during autoupdate:", cacheErr);
            }

            // ตั้งเวลาหน่วงให้บันทึกสเตตก่อนทำ Hard Reload ข้ามแคช (Bypass Cache)
            setTimeout(() => {
              setCurrentUser(null);
              setIsAuthenticated(false);
              const origin = window.location.origin;
              const pathname = window.location.pathname;
              const searchParams = new URLSearchParams(window.location.search);
              searchParams.set('nocache', String(Date.now()));
              window.location.href = `${origin}${pathname}?${searchParams.toString()}${window.location.hash}`;
            }, 3000);
          }
        }
      } catch (e) {
        // Silent catch for background polling
      }
    };

    const interval = setInterval(checkVersion, 15000);
    return () => clearInterval(interval);
  }, [clientVersion]);

  // --- Real-time Current User Profile Watcher ---
  // Syncs the active logged-in session instantly if an Admin updates their role, status, or name
  useEffect(() => {
    if (isAuthenticated && currentUser?.id && users.length > 0) {
      const freshUser = users.find(u => u.id === currentUser.id);
      if (freshUser) {
        if (freshUser.isActive === false) {
          setIsAuthenticated(false);
          setTimeout(() => {
            alert("🔒 บัญชีผู้ใช้งานของคุณถูกระงับการเข้าถึงชั่วคราวโดยผู้ดูแลระบบ");
          }, 100);
        } else if (
          freshUser.role !== currentUser.role || 
          freshUser.name !== currentUser.name ||
          freshUser.username !== currentUser.username ||
          freshUser.password !== currentUser.password
        ) {
          setCurrentUser(freshUser);
        }
      }
    }
  }, [users, currentUser?.id, isAuthenticated]);

  // --- Safe Clear Cache & Hard Reload function to bypass any stale iframe caching ---
  const handleClearCacheAndHardReload = async () => {
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      sessionStorage.clear();
    } catch (err) {
      console.warn("Failed to clear browser cache API:", err);
    } finally {
      // Force reload by appending a timestamp to URL search params to break cache proxies
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('nocache', String(Date.now()));
      window.location.href = `${origin}${pathname}?${searchParams.toString()}${window.location.hash}`;
    }
  };

  // --- Filter states ---
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLowStockOnly, setIsLowStockOnly] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'OVERVIEW' | 'INVENTORY' | 'OPERATIONS' | 'LOGS' | 'SETTINGS' | 'SYNC' | 'SHELVES' | 'SCANNER' | 'LINE_BOT'>('OVERVIEW');
  const [showLoginUnderMaintenance, setShowLoginUnderMaintenance] = useState(false);

  // --- Customizable Menu configuration states ---
  const [menuFontSize, setMenuFontSize] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('menu_font_size') || 'sm';
    }
    return 'sm';
  });

  const [menuPadding, setMenuPadding] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('menu_padding') || 'md';
    }
    return 'md';
  });

  const [menuLabels, setMenuLabels] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('menu_labels');
      if (saved) {
        try {
          return { ...DEFAULT_MENU_LABELS, ...JSON.parse(saved) };
        } catch (e) {
          return DEFAULT_MENU_LABELS;
        }
      }
    }
    return DEFAULT_MENU_LABELS;
  });

  const [isMenuCustomizerOpen, setIsMenuCustomizerOpen] = useState(false);

  // --- Sidebar Collapsible State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) return saved === 'true';
      return window.innerWidth < 1024;
    }
    return false;
  });

  // Redirect non-ADMIN users away from admin-only tabs
  useEffect(() => {
    if (currentUser?.role !== 'ADMIN' && (activeMenuTab === 'SETTINGS' || activeMenuTab === 'SYNC' || activeMenuTab === 'LINE_BOT')) {
      setActiveMenuTab('OVERVIEW');
    }
  }, [currentUser, activeMenuTab]);

  // --- Quick-Action Transfer States ---
  const [preSelectedProductId, setPreSelectedProductId] = useState<string | null>(null);
  const [preSelectedType, setPreSelectedType] = useState<TransactionType | null>(null);

  // --- Check if scanned/opened from Shelf QR Code ---
  const [scannedShelfForAudit, setScannedShelfForAudit] = useState<Shelf | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shelfIdParam = params.get('shelf');
    if (shelfIdParam && shelves.length > 0) {
      const foundShelf = shelves.find(
        s => s.id === shelfIdParam || s.name.toLowerCase() === shelfIdParam.toLowerCase()
      );
      if (foundShelf) {
        setScannedShelfForAudit(foundShelf);
      }
    }
  }, [window.location.search, shelves]);

  const handleCloseAuditModal = () => {
    setScannedShelfForAudit(null);
    // Clear shelf query param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('shelf');
    window.history.replaceState({}, '', url.pathname + url.search);
  };

  // --- System Custom Handlers ---
  const handleAddUser = async (newUserData: Omit<UserProfile, 'id' | 'isActive'>) => {
    const id = `usr-${Date.now()}`;
    const newUser: UserProfile = {
      ...newUserData,
      id,
      isActive: true
    };
    await setDoc(doc(db, 'users', id), newUser);
  };

  const handleUpdateUser = async (updatedUser: UserProfile) => {
    await setDoc(doc(db, 'users', updatedUser.id), updatedUser);
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteDoc(doc(db, 'users', userId));
    // Fallback if deleted current user
    if (currentUser.id === userId) {
      const fallback = users.find((u) => u.id !== userId && u.role === 'ADMIN') || users.find((u) => u.id !== userId);
      if (fallback) setCurrentUser(fallback);
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    await setDoc(doc(db, 'settings', 'appSettings'), newSettings);
  };

  const handleAddCategory = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const exists = categories.some(cat => cat.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      throw new Error(`หมวดหมู่ "${cleanName}" มีในระบบคลังเรียบร้อยแล้ว`);
    }
    const id = `cat-${Date.now()}`;
    await setDoc(doc(db, 'categories', id), {
      id,
      name: cleanName
    });
  };

  const handleUpdateCategory = async (id: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    const exists = categories.some(cat => cat.name.toLowerCase() === cleanName.toLowerCase() && cat.id !== id);
    if (exists) {
      throw new Error(`หมวดหมู่ "${cleanName}" มีในระบบคลังเรียบร้อยแล้ว`);
    }
    await updateDoc(doc(db, 'categories', id), {
      name: cleanName
    });
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteDoc(doc(db, 'categories', id));
  };

  const handleUpdateRolePermissions = async (role: 'ADMIN' | 'KEEPER' | 'AUDITOR', perms: RolePermissions) => {
    const updated = {
      ...rolePermissions,
      [role]: perms
    };
    await setDoc(doc(db, 'settings', 'rolePermissions'), updated);
  };

  const handleRegisterUser = async (newUserData: Omit<UserProfile, 'id' | 'isActive'> & { password?: string; securityQuestion?: string; securityAnswer?: string }): Promise<{ success: boolean; message: string }> => {
    const cleanUsername = newUserData.username.trim().toLowerCase();
    
    // Check duplicate
    const duplicate = users.find(u => u.username === cleanUsername);
    if (duplicate) {
      return { success: false, message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาระบุชื่อผู้ใช้อื่น' };
    }

    const id = `usr-${Date.now()}`;
    const newUser: UserProfile = {
      ...newUserData,
      username: cleanUsername,
      id,
      isActive: true
    };

    await setDoc(doc(db, 'users', id), newUser);
    return { success: true, message: 'สมัครสมาชิกเสร็จสมบูรณ์! ระบบอนุมัติบัญชีพร้อมให้ท่านเข้าสู่ระบบแล้ว' };
  };

  const handleResetPassword = async (username: string, securityAnswer: string, newPass: string): Promise<{ success: boolean; message: string }> => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanAnswer = securityAnswer.trim();
    
    const user = users.find(u => u.username === cleanUsername);
    if (!user) {
      return { success: false, message: 'ไม่พบชื่อผู้ใช้ในระบบ' };
    }

    const systemAnswer = user.securityAnswer || 'กรุงเทพ';

    if (cleanAnswer.toLowerCase() !== systemAnswer.toLowerCase()) {
      return { success: false, message: 'คำตอบเพื่อการยืนยันความปลอดภัยไม่ถูกต้อง พยายามอีกครั้ง' };
    }

    // Update password
    await updateDoc(doc(db, 'users', user.id), {
      password: newPass
    });

    // Make sure we also sync current user if they reset themselves
    if (currentUser.username === cleanUsername) {
      setCurrentUser(prev => ({ ...prev, password: newPass }));
    }

    return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ เปลี่ยนรหัสผ่านเข้าคลังสินค้าของท่านเรียบร้อย' };
  };

  // --- Core Methods ---

  // Helper to remove any undefined properties from object for Firestore compatibility
  const cleanFirestoreData = <T extends object>(obj: T): T => {
    const cleaned: any = {};
    Object.keys(obj).forEach((key) => {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = val;
      }
    });
    return cleaned as T;
  };
  
  // Add new dynamic product
  const handleAddProduct = async (newProductData: Omit<Product, 'id' | 'updatedAt'>) => {
    const id = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...newProductData,
      id,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'products', id), cleanFirestoreData(newProduct));
  };

  // Update existing product meta properties
  const handleUpdateProduct = async (updatedProduct: Product) => {
    const originalProduct = products.find(p => p.id === updatedProduct.id);
    if (originalProduct) {
      const qDiff = updatedProduct.quantity - (originalProduct.quantity || 0);
      const wDiff = (updatedProduct.wholesaleStock || 0) - (originalProduct.wholesaleStock || 0);

      const batch = writeBatch(db);
      let txIdSuffix = 0;

      // Check if it's a direct withdrawal (wDiff < 0 and qDiff === -wDiff * conversionFactor)
      const factor = originalProduct.conversionFactor || 1;
      if (wDiff < 0 && qDiff === -wDiff * factor) {
        const txId = `tx-${Date.now()}-${txIdSuffix++}`;
        const newTx: Transaction = {
          id: txId,
          productId: updatedProduct.id,
          productSku: updatedProduct.sku,
          productName: updatedProduct.name,
          type: 'OUT',
          quantity: Math.abs(wDiff),
          date: new Date().toISOString(),
          reason: `เบิกสินค้าจากคลังสินค้าหลัก (คลังใหญ่) มาแบ่งจำหน่าย/พร้อมขาย [เบิกคลังใหญ่: ${Math.abs(wDiff)} ${originalProduct.wholesaleUnit || originalProduct.unit || 'หน่วย'} ➡️ แบ่งย่อยได้: ${qDiff} ${originalProduct.unit || 'หน่วย'} (อัตรา 1:${factor})] [คลังใหญ่: ${originalProduct.wholesaleStock || 0} ➡️ ${updatedProduct.wholesaleStock || 0}, สต๊อกพร้อมขาย: ${originalProduct.quantity || 0} ➡️ ${updatedProduct.quantity || 0}]`,
          operator: currentUser?.name || 'ผู้ดูแลระบบ',
        };
        batch.set(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
      } else {
        // Handle them separately or general edits
        if (qDiff !== 0) {
          const txId = `tx-${Date.now()}-${txIdSuffix++}`;
          const newTx: Transaction = {
            id: txId,
            productId: updatedProduct.id,
            productSku: updatedProduct.sku,
            productName: updatedProduct.name,
            type: qDiff > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(qDiff),
            date: new Date().toISOString(),
            reason: `ปรับปรุงข้อมูลสต๊อกพร้อมขายโดยตรง (เดิม: ${originalProduct.quantity} -> ใหม่: ${updatedProduct.quantity})`,
            operator: currentUser?.name || 'ผู้ดูแลระบบ',
          };
          batch.set(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
        }

        if (wDiff !== 0) {
          const txId = `tx-${Date.now()}-${txIdSuffix++}`;
          const newTx: Transaction = {
            id: txId,
            productId: updatedProduct.id,
            productSku: updatedProduct.sku,
            productName: updatedProduct.name,
            type: wDiff > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(wDiff),
            date: new Date().toISOString(),
            reason: `ปรับปรุงข้อมูลคลังสินค้าหลัก (คลังใหญ่) โดยตรง (เดิม: ${originalProduct.wholesaleStock || 0} -> ใหม่: ${updatedProduct.wholesaleStock || 0})`,
            operator: currentUser?.name || 'ผู้ดูแลระบบ',
          };
          batch.set(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
        }
      }

      batch.set(doc(db, 'products', updatedProduct.id), cleanFirestoreData({
        ...updatedProduct,
        updatedAt: new Date().toISOString()
      }));
      await batch.commit();
    } else {
      await setDoc(doc(db, 'products', updatedProduct.id), cleanFirestoreData({
        ...updatedProduct,
        updatedAt: new Date().toISOString()
      }));
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId: string) => {
    await deleteDoc(doc(db, 'products', productId));
  };

  // Clear all products in the database
  const handleClearAllProducts = async () => {
    const batch = writeBatch(db);
    const pSnapshot = await getDocs(collection(db, 'products'));
    pSnapshot.forEach((snapDoc) => {
      batch.delete(snapDoc.ref);
    });
    await batch.commit();
  };

  // Trigger quick transaction prefill
  const handleTriggerQuickAction = (productId: string, actionType: 'IN' | 'OUT' | 'RETURN') => {
    setPreSelectedProductId(productId);
    setPreSelectedType(actionType);
    setActiveMenuTab('OPERATIONS');
  };

  // Clear prefilled transfers
  const handleClearPreSelection = () => {
    setPreSelectedProductId(null);
    setPreSelectedType(null);
  };

  // Process transaction execution (mutates product counts in Firestore batch)
  const handleRecordTransaction = async (txData: Omit<Transaction, 'id' | 'date'>) => {
    const txId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      ...txData,
      id: txId,
      date: new Date().toISOString(),
    };

    const p = products.find(prod => prod.id === txData.productId);
    if (p) {
      let adjustedQty = p.quantity;

      if (txData.type === 'IN') {
        adjustedQty += txData.quantity;
      } else if (txData.type === 'OUT') {
        adjustedQty = Math.max(0, adjustedQty - txData.quantity);
      } else if (txData.type === 'RETURN') {
        if (txData.returnStatus === 'RE_STOCK') {
          adjustedQty += txData.quantity;
        }
      }

      const batch = writeBatch(db);
      // Write transaction doc
      batch.set(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
      // Update product qty and updatedAt
      batch.update(doc(db, 'products', p.id), {
        quantity: adjustedQty,
        updatedAt: new Date().toISOString()
      });
      await batch.commit();
    } else {
      await setDoc(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
    }
  };

  // Process batch transaction execution (mutates multiple products in Firestore batch)
  const handleRecordMultipleTransactions = async (txsData: Omit<Transaction, 'id' | 'date'>[]) => {
    if (txsData.length === 0) return;
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    
    // Keep track of accumulated running quantity for products updated multiple times in this single batch
    const runningQuantities: Record<string, number> = {};

    for (let i = 0; i < txsData.length; i++) {
      const txData = txsData[i];
      const txId = `tx-${Date.now()}-${i}`;
      const newTx: Transaction = {
        ...txData,
        id: txId,
        date: timestamp,
      };

      const p = products.find(prod => prod.id === txData.productId);
      if (p) {
        if (runningQuantities[p.id] === undefined) {
          runningQuantities[p.id] = p.quantity;
        }

        let adjustedQty = runningQuantities[p.id];

        if (txData.type === 'IN') {
          adjustedQty += txData.quantity;
        } else if (txData.type === 'OUT') {
          adjustedQty = Math.max(0, adjustedQty - txData.quantity);
        } else if (txData.type === 'RETURN') {
          if (txData.returnStatus === 'RE_STOCK') {
            adjustedQty += txData.quantity;
          }
        }

        // Update running quantity tracker
        runningQuantities[p.id] = adjustedQty;

        // Add to batch
        batch.set(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
        batch.update(doc(db, 'products', p.id), {
          quantity: adjustedQty,
          updatedAt: timestamp
        });
      } else {
        batch.set(doc(db, 'transactions', txId), cleanFirestoreData(newTx));
      }
    }

    await batch.commit();
  };

  // Reset Logs / Clear All
  const handleResetLogs = async () => {
    try {
      const pSnapshot = await getDocs(collection(db, 'products'));
      const tSnapshot = await getDocs(collection(db, 'transactions'));
      
      const batch = writeBatch(db);
      pSnapshot.forEach((snapDoc) => {
        batch.delete(snapDoc.ref);
      });
      tSnapshot.forEach((snapDoc) => {
        batch.delete(snapDoc.ref);
      });
      await batch.commit();
      handleClearPreSelection();
    } catch (err) {
      console.error("reset error", err);
    }
  };

  // Import products from Google Sheets / CSV parsed items
  const handleImportProducts = async (parsedProducts: Omit<Product, 'id' | 'updatedAt'>[], overwrite: boolean) => {
    try {
      const batch = writeBatch(db);

      if (overwrite) {
        const pSnapshot = await getDocs(collection(db, 'products'));
        pSnapshot.forEach((snapDoc) => {
          batch.delete(snapDoc.ref);
        });
      }

      parsedProducts.forEach((p) => {
        const existing = overwrite ? null : products.find(prod => prod.sku.trim().toLowerCase() === p.sku.trim().toLowerCase());
        const id = existing ? existing.id : `prod-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        batch.set(doc(db, 'products', id), {
          ...p,
          id,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      await batch.commit();
    } catch (err) {
      console.error("import items error", err);
    }
  };

  // Restore everything from a full backup (Cloud or JSON file)
  const handleRestoreFullBackup = async (
    backupProducts: Product[],
    backupTransactions: Transaction[],
    backupCategories: Category[],
    backupShelves: Shelf[],
    backupSettings?: AppSettings,
    backupRolePermissions?: Record<'ADMIN' | 'KEEPER' | 'AUDITOR', RolePermissions>
  ) => {
    try {
      const actions: { type: 'set' | 'delete', ref: any, data?: any }[] = [];

      // 1. Delete all current products
      const pSnapshot = await getDocs(collection(db, 'products'));
      pSnapshot.forEach((docSnap) => {
        actions.push({ type: 'delete', ref: docSnap.ref });
      });

      // 2. Delete all current transactions
      const tSnapshot = await getDocs(collection(db, 'transactions'));
      tSnapshot.forEach((docSnap) => {
        actions.push({ type: 'delete', ref: docSnap.ref });
      });

      // 3. Delete all current categories
      const cSnapshot = await getDocs(collection(db, 'categories'));
      cSnapshot.forEach((docSnap) => {
        actions.push({ type: 'delete', ref: docSnap.ref });
      });

      // 4. Delete all current shelves
      const sSnapshot = await getDocs(collection(db, 'shelves'));
      sSnapshot.forEach((docSnap) => {
        actions.push({ type: 'delete', ref: docSnap.ref });
      });

      // 5. Add backup products
      backupProducts.forEach((p) => {
        actions.push({ type: 'set', ref: doc(db, 'products', p.id), data: p });
      });

      // 6. Add backup transactions
      backupTransactions.forEach((t) => {
        actions.push({ type: 'set', ref: doc(db, 'transactions', t.id), data: t });
      });

      // 7. Add backup categories
      backupCategories.forEach((c) => {
        actions.push({ type: 'set', ref: doc(db, 'categories', c.id), data: c });
      });

      // 8. Add backup shelves
      backupShelves.forEach((s) => {
        actions.push({ type: 'set', ref: doc(db, 'shelves', s.id), data: s });
      });

      // 9. Add backup settings if present
      if (backupSettings) {
        actions.push({ type: 'set', ref: doc(db, 'settings', 'appSettings'), data: backupSettings });
      }

      // 10. Add backup role permissions if present
      if (backupRolePermissions) {
        actions.push({ type: 'set', ref: doc(db, 'settings', 'rolePermissions'), data: backupRolePermissions });
      }

      // Execute in chunks of 400 to comply with Firestore's 500 max writes per batch
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const action of actions) {
        if (action.type === 'delete') {
          currentBatch.delete(action.ref);
        } else if (action.type === 'set') {
          currentBatch.set(action.ref, action.data);
        }
        opCount++;

        if (opCount === 400) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await currentBatch.commit();
      }

    } catch (err) {
      console.error("Failed to restore backup:", err);
      throw err;
    }
  };

  // Filter actions
  const handleFilterLowStock = () => {
    setIsLowStockOnly(true);
    setSelectedCategory('');
  };

  const handleClearFilters = () => {
    setIsLowStockOnly(false);
    setSelectedCategory('');
  };

  if (dbLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-slate-800 font-sans">
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full mx-auto border border-slate-100 flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin" />
            <RefreshCcw className="w-6 h-6 text-blue-600 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">กำลังซิงก์คลังสินค้าคลาวด์</h3>
            <p className="text-xs text-slate-400 mt-1">กำลังเชื่อมต่อคลาวน์แบบเรียลไทม์เพื่อซิงก์ข้อมูลข้ามระบบของคุณให้ไร้รอยต่อ...</p>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-[45%] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // --- Maintenance & Auth Gate ---
  const isUserAdmin = isAuthenticated && currentUser?.role === 'ADMIN';

  if (settings.isMaintenanceMode && !isUserAdmin) {
    if (showLoginUnderMaintenance) {
      return (
        <div className="relative">
          <div className="bg-amber-500 text-white text-center py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-sm relative z-50 animate-pulse">
            <Wrench className="w-4 h-4" />
            <span>🔧 โหมดปิดปรับปรุงระบบ: สามารถเข้าใช้งานได้เฉพาะบัญชีผู้ดูแลระบบ (ADMIN) เท่านั้น</span>
          </div>
          <LoginScreen
            settings={settings}
            users={users}
            onLogin={(user) => {
              setCurrentUser(user);
              setIsAuthenticated(true);
              if (user.role !== 'ADMIN') {
                setShowLoginUnderMaintenance(false);
              }
            }}
            onRegister={handleRegisterUser}
            onResetPassword={handleResetPassword}
            onBackToMaintenance={() => setShowLoginUnderMaintenance(false)}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-slate-800 font-sans">
        <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-auto border border-slate-100 flex flex-col items-center text-center space-y-6 relative overflow-hidden animate-fade-in">
          {/* Top warning ribbon accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-amber-500" />
          
          <div className="p-4 bg-amber-50 rounded-full text-amber-600 animate-pulse border border-amber-100">
            <Wrench className="w-12 h-12" />
          </div>
          
          <div className="space-y-2">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] uppercase font-bold tracking-wider font-mono border border-amber-200">
              System Maintenance Mode
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              {settings.appName || 'ระบบจัดการสต๊อกสินค้า'}
            </h2>
            {settings.appSubtitle && (
              <p className="text-xs text-slate-400 font-medium tracking-wide uppercase font-mono">
                {settings.appSubtitle}
              </p>
            )}
          </div>
          
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 text-xs sm:text-sm leading-relaxed max-w-sm font-medium">
            {settings.maintenanceMessage || 'ขออภัย ระบบอยู่ระหว่างการปิดปรับปรุงเพื่ออัปเดตฟีเจอร์ใหม่ชั่วคราว กรุณากลับมาใหม่อีกครั้งในภายหลัง'}
          </div>
          
          <div className="w-full pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>โหลดหน้าเว็บใหม่</span>
            </button>
            
            {isAuthenticated ? (
              <button
                onClick={() => setIsAuthenticated(false)}
                className="w-full sm:w-auto px-5 py-2.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ (Log Out)</span>
              </button>
            ) : (
              <button
                onClick={() => setShowLoginUnderMaintenance(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>เข้าสู่ระบบระดับสูง (Admin Login)</span>
              </button>
            )}
          </div>
          
          <div className="text-[10px] text-slate-400 font-mono">
            {isAuthenticated ? (
              <span>สิทธิ์ปัจจุบันของคุณ: {currentUser?.role === 'KEEPER' ? '📦 พนักงานคลังสินค้า' : '🔍 ผู้ตรวจสอบบัญชี'}</span>
            ) : (
              <span>สถานะ: ยังไม่ได้เข้าสู่ระบบ (กรุณาให้ผู้ดูแลระบบล็อกอินผ่าน Admin Login เพื่อเปิดใช้งานระบบ)</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        {isNewVersionAvailable && (
          <div className="bg-blue-600 text-white text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-md relative z-50 animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            <span>🚀 ระบบพบคลิปต์บิลด์ใหม่ล่าสุดจาก AI Studio! บังคับเคลียร์แคชและระบบได้ Logout ชั่วคราวเพื่ออัปเดตไฟล์แบบไม่สะดุดในอีกสักครู่...</span>
          </div>
        )}
        <div className="flex-1 flex flex-col">
          <LoginScreen
            settings={settings}
            users={users}
            onLogin={(user) => {
              setCurrentUser(user);
              setIsAuthenticated(true);
            }}
            onRegister={handleRegisterUser}
            onResetPassword={handleResetPassword}
          />
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      id: 'OVERVIEW',
      label: menuLabels.OVERVIEW || 'ภาพรวม & แดชบอร์ด',
      icon: <LayoutDashboard className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: false,
    },
    {
      id: 'SCANNER',
      label: menuLabels.SCANNER || 'ระบบสแกนพัสดุ AI',
      icon: <Camera className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: false,
    },
    {
      id: 'OPERATIONS',
      label: menuLabels.OPERATIONS || 'บันทึกความเคลื่อนไหว',
      icon: <RefreshCcw className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: false,
      hasDot: !!preSelectedProductId,
    },
    {
      id: 'INVENTORY',
      label: menuLabels.INVENTORY || 'จัดการสต๊อกสินค้า',
      icon: <ShoppingBag className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: false,
      badge: products.filter(p => p.quantity <= p.minStock).length,
      badgeColor: 'bg-orange-500 text-white',
      badgeCondition: products.filter(p => p.quantity <= p.minStock).length > 0,
      onClickExtra: () => handleClearFilters(),
    },
    {
      id: 'LOGS',
      label: menuLabels.LOGS || 'ประวัติทำรายการ (Ledger)',
      icon: <History className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: false,
      badge: transactions.length,
      badgeColor: 'bg-slate-200 text-slate-800',
      badgeCondition: transactions.length > 0,
    },
    {
      id: 'SHELVES',
      label: menuLabels.SHELVES || 'จัดการชั้นวางสินค้า / QR Code',
      icon: <MapPin className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: false,
    },
    {
      id: 'SYNC',
      label: menuLabels.SYNC || 'สำรอง & นำเข้าข้อมูล (CSV / Excel)',
      icon: <FileSpreadsheet className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: true,
    },
    {
      id: 'LINE_BOT',
      label: 'ระบบบอท LINE & Gemini AI',
      icon: <Bot className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: true,
    },
    {
      id: 'SETTINGS',
      label: menuLabels.SETTINGS || 'ตั้งค่า & สิทธิ์ผู้ใช้',
      icon: <SettingsIcon className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />,
      isAdminOnly: true,
    }
  ];

  return (
    <div id="app-wrapper" className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {isNewVersionAvailable && (
        <div className="bg-blue-600 text-white text-center py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-md relative z-50">
          <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
          <span>🚀 ตรวจพบการอัปเดตระบบคลังเวอร์ชันใหม่! ระบบกำลังโหลดข้อมูลและปรับปรุงหน้าจอให้คุณโดยอัตโนมัติในอีกสักครู่ (โดยไม่ต้องกด Ctrl+F5)</span>
        </div>
      )}
      {/* 1. Header Navigation Bar */}
      <nav id="app-navbar" className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40 w-full px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          <div className="flex justify-between h-16 items-center gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
              {/* ปุ่มสไลด์เมนูข้างเข้า-ออก (Sidebar Toggle Button) */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer shrink-0 flex items-center justify-center hover:scale-105 active:scale-95"
                title={isSidebarCollapsed ? "ขยายแถบเมนูซ้ายมือ" : "ย่อแถบเมนูซ้ายมือ"}
              >
                <Menu className="w-4 h-4 md:w-5 h-5 text-slate-700" />
              </button>

              <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs shrink-0 hidden xs:block">
                <AppLogoIcon name={settings.appLogo} className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <span className="text-md sm:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-1.5 leading-none truncate">
                  {settings.appName}
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded-full font-mono border border-blue-105 uppercase tracking-wider font-bold">
                    {settings.appSubtitle}
                  </span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 block mt-0.5 truncate">
                  Virtual Stock Controller • รับเข้า • ส่งออก • ตีกลับสินค้า
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* ⚡ ปุ่มเคลียร์แคชและดึงไฟล์ล่าสุด (Quick Cache Bypass & Update) */}
              <button 
                onClick={handleClearCacheAndHardReload}
                className="px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:text-white hover:bg-amber-600 bg-amber-50 border border-amber-200 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs hover:scale-102"
                title="ล้างแคชเว็บแอปพลิเคชันและอัปเดตระบบ เพื่อดึงโค้ดเวอร์ชันล่าสุดจาก AI Studio"
              >
                <RefreshCcw className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden md:inline">⚡ ดึงไฟล์ล่าสุด (เคลียร์แคช)</span>
                <span className="inline md:hidden">⚡ เคลียร์แคช</span>
              </button>

              {/* Menu Customizer Button in Top Right - ADMIN ONLY */}
              {currentUser?.role === 'ADMIN' && (
                <button 
                  onClick={() => setIsMenuCustomizerOpen(true)}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                  title="ปรับแต่งขนาดและชื่อปุ่มเมนู"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-blue-600 animate-spin-hover" />
                  <span>⚙️ ตั้งค่าปุ่มเมนู</span>
                </button>
              )}

              {/* Authenticated User Badge & Log Out */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    @{currentUser.username} • {currentUser.role === 'ADMIN' ? '👑 Admin' : currentUser.role === 'KEEPER' ? '📦 เจ้าหน้าที่คลัง' : '🔍 ตรวจสอบบัญชี'}
                  </span>
                </div>
                
                <button 
                  onClick={() => setIsAuthenticated(false)}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50/50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="ออกจากระบบ เพื่อความปลอดภัย"
                >
                  <span>🔓 ออกจากระบบ</span>
                </button>
              </div>

              {/* Connection & Live sync indicators */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
                {syncStatus === 'connected' ? (
                  <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-semibold text-emerald-700">ซิงค์เรียลไทม์คลาวด์แล้ว ✅</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 animate-pulse">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                    <span className="font-semibold text-rose-700 animate-pulse">ออฟไลน์ กำลังรีคอนเนกต์... 🔌</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. Layout Wrapper: Left Sidebar + Main Content Area */}
      <div className="flex-grow flex flex-col md:flex-row relative">
        
        {/* Backdrop overlay for mobile sidebar drawer */}
        {!isSidebarCollapsed && (
          <div 
            onClick={() => setIsSidebarCollapsed(true)}
            className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 transition-opacity duration-200 cursor-pointer"
          />
        )}

        {/* Left Sidebar Menu */}
        <aside 
          className={`bg-white border-r border-slate-200 shadow-md md:shadow-none flex flex-col transition-all duration-300 ease-in-out z-35
            fixed md:sticky md:top-16 inset-y-0 left-0 h-screen md:h-[calc(100vh-4rem)] shrink-0
            ${isSidebarCollapsed 
              ? '-translate-x-full md:translate-x-0 w-72 md:w-20' 
              : 'translate-x-0 w-72 md:w-64'
            }
          `}
        >
          {/* Sidebar Section Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <span className={`font-bold text-slate-800 text-[10px] uppercase tracking-wider truncate transition-opacity duration-200 ${isSidebarCollapsed ? 'md:opacity-0 md:w-0' : 'opacity-100'}`}>
              เมนูหลัก / NAVIGATION
            </span>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "ขยายแถบเมนูข้าง" : "ย่อแถบเมนูข้าง"}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 hidden md:block text-slate-500" />
              ) : (
                <ChevronLeft className="w-4 h-4 hidden md:block text-slate-500" />
              )}
              {/* On mobile, this is a close trigger */}
              <span className="md:hidden text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md">ปิด ✕</span>
            </button>
          </div>

          {/* Navigation Items list */}
          <div className="flex-grow overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            {menuItems.map((item) => {
              if (item.isAdminOnly && currentUser.role !== 'ADMIN') return null;
              
              const isActive = activeMenuTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveMenuTab(item.id as any);
                    if (item.onClickExtra) item.onClickExtra();
                    // Auto-close on mobile after selecting
                    if (window.innerWidth < 768) {
                      setIsSidebarCollapsed(true);
                    }
                  }}
                  className={`w-full flex items-center rounded-lg font-semibold transition-all duration-150 cursor-pointer ${
                    fontSizeClasses[menuFontSize]?.btn || 'text-xs md:text-sm'
                  } ${paddingClasses[menuPadding] || 'px-3.5 py-2.5'} ${
                    isSidebarCollapsed ? 'justify-center px-1 md:px-2 md:py-3.5' : 'justify-start gap-3'
                  } ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                  title={item.label}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    {item.icon}
                    {item.hasDot && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border-2 border-white animate-pulse" />
                    )}
                    {isSidebarCollapsed && item.badgeCondition && (
                      <span className="absolute -top-2 -right-2 px-1 py-0.2 text-[8px] font-bold rounded-full bg-red-500 text-white leading-none scale-90">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  
                  {!isSidebarCollapsed && (
                    <span className="truncate flex-grow text-left leading-normal">{item.label}</span>
                  )}
                  
                  {!isSidebarCollapsed && item.badgeCondition && (
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ml-auto shrink-0 leading-none ${
                      isActive ? 'bg-white text-blue-600' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mini Sidebar Footer Info */}
          {!isSidebarCollapsed && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-400 shrink-0 space-y-1">
              <div>ล็อกอินโดย: <span className="font-bold text-slate-600">{currentUser.name}</span></div>
              <div className="font-mono text-slate-400 uppercase text-[9px]">บทบาท: @{currentUser.role}</div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
          
          {/* Banner Announcement / Welcoming Block */}
          <div id="welcome-banner" className="bg-white text-slate-800 p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-blue-600 font-semibold text-xs tracking-wider uppercase">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>แดชบอร์ดศูนย์ควบคุมคลังสินค้า</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800">
                ยินดีต้อนรับสู่ระบบตรวจสต๊อกคลังและจัดการสินค้า 📦
              </h1>
              <p className="text-xs text-slate-500 font-normal">
                ช่วยให้ร้านค้าควบคุมจำนวนสินค้า รับเข้า-ส่งออกคลัง และบันทึกสินค้าเคลมตัดชำรุดจากการตีกลับได้แบบเรียลไทม์
              </p>
            </div>

            <div className="bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-xs flex flex-col gap-1 shrink-0">
              <div className="flex items-center gap-2 text-slate-500">
                <span className="font-semibold text-[10px] uppercase tracking-widest text-slate-400">พิกัดระบบหลัก:</span>
                <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-700">GMT+7 THAILAND</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span>เวลาปัจจุบัน:</span>
                <span className="font-mono text-slate-900 font-semibold">{new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* PWA Installation Assistant Banner */}
          <PWAInstallPrompt />

          {/* Tab Contents */}
        {activeMenuTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* KPI stats section */}
            <DashboardStats
              products={products}
              transactions={transactions}
              onLowStockFilter={() => {
                setActiveMenuTab('INVENTORY');
                handleFilterLowStock();
              }}
              onClearFilters={handleClearFilters}
              isLowStockFiltered={false}
            />

            {/* Overview Grid Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alert Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                    รายการสินค้าใกล้หมดเกณฑ์ ({products.filter((p) => p.quantity <= p.minStock).length} รายการ)
                  </h3>
                  <button
                    onClick={() => {
                      setActiveMenuTab('INVENTORY');
                      handleFilterLowStock();
                    }}
                    className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    ดูสินค้าสต๊อกต่ำทั้งหมด →
                  </button>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {products.filter((p) => p.quantity <= p.minStock).length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-normal">
                      ✔️ ทุกรายการสินค้ามีสต๊อกเพียงพอ ไม่จำเป็นต้องนำเข้าขณะนี้
                    </div>
                  ) : (
                    products
                      .filter((p) => p.quantity <= p.minStock)
                      .slice(0, 5)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs hover:bg-slate-100/50 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-mono text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 text-[10px]">{p.sku}</span>
                            <p className="font-semibold text-slate-800 mt-1">{p.name}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 font-sans block text-[10px]">คงเหลือปัจจุบัน</span>
                            <span className="text-orange-600 font-bold font-mono text-sm">{p.quantity} / {p.minStock} ชิ้น</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Latest transactions stream */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-450" />
                    ประวัติเล็ดเจอร์ด่วนล่าสุด (4 รายการล่าสุด)
                  </h3>
                  <button
                    onClick={() => setActiveMenuTab('LOGS')}
                    className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    ดูประวัติทั้งหมด →
                  </button>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {transactions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      ยังไม่มีรายการเคลื่อนไหวใดๆ ในระบบขณะนี้
                    </div>
                  ) : (
                    transactions.slice(0, 4).map((tx) => {
                      return (
                        <div key={tx.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between hover:bg-slate-100/50 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                                tx.type === 'IN'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : tx.type === 'OUT'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {tx.type === 'IN' ? 'RECEIVE' : tx.type === 'OUT' ? 'DISPATCH' : 'RETURN'}
                              </span>
                              <span className="font-mono text-slate-400 text-[10px]">{new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                            </div>
                            <p className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-xs">{tx.productName}</p>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold font-mono text-xs ${
                              tx.type === 'IN' ? 'text-emerald-700' : tx.type === 'OUT' ? 'text-rose-700' : 'text-blue-700'
                            }`}>
                              {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : '↩️ '}{tx.quantity}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">โดย {tx.operator}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Helpful quick guide layout for real-world scenarios */}
            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100/70 flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-blue-900">แนะนำการบริหารระดับคลัง (Smart Operations Flow Tracking)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  เมื่อตรวจสอบหากพบสินค้า <span className="text-orange-600 font-bold font-semibold">ใกล้หมดระดับเกณฑ์คุมเข้ม</span> แนะนำให้สลับไปยังเมนู <span className="font-bold underline text-blue-700 cursor-pointer" onClick={() => setActiveMenuTab('OPERATIONS')}>"บันทึกความเคลื่อนไหว"</span> เพื่อรับเข้าสินค้าใหม่และกำหนดรหัสใบสั่งซื้อ (PO No.) ในทันที เพื่อให้ข้อมูลคลังจัดเก็บบันทึกได้อย่างเป็นระบบเสมอดังความตั้งใจ
                </p>
              </div>
            </div>
          </div>
        )}

        {activeMenuTab === 'INVENTORY' && (
          <InventoryTable
            products={products}
            categories={categories}
            shelves={shelves}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onClearAllProducts={handleClearAllProducts}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            isLowStockOnly={isLowStockOnly}
            setIsLowStockOnly={setIsLowStockOnly}
            onTriggerQuickAction={handleTriggerQuickAction}
            canManageProducts={rolePermissions[currentUser.role].manageProducts}
            canRecordTransactions={rolePermissions[currentUser.role].recordTransactions}
            canDeleteProducts={rolePermissions[currentUser.role].manageProducts}
            canResetSystem={rolePermissions[currentUser.role].resetSystem}
          />
        )}

        {activeMenuTab === 'OPERATIONS' && (
          <ActionForms
            products={products}
            onRecordTransaction={handleRecordTransaction}
            onRecordMultipleTransactions={handleRecordMultipleTransactions}
            preSelectedProductId={preSelectedProductId}
            preSelectedType={preSelectedType}
            onClearPreSelection={handleClearPreSelection}
            canRecordTransactions={rolePermissions[currentUser.role].recordTransactions}
            currentUser={currentUser}
          />
        )}



        {activeMenuTab === 'LOGS' && (
          <TransactionLogs
            transactions={transactions}
            onResetLogs={handleResetLogs}
            canResetLogs={rolePermissions[currentUser.role].resetSystem}
          />
        )}

        {activeMenuTab === 'SCANNER' && (
          <SmartScanner
            products={products}
            transactions={transactions}
            onRecordMultipleTransactions={handleRecordMultipleTransactions}
            canRecordTransactions={rolePermissions[currentUser.role].recordTransactions}
            currentUser={currentUser}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeMenuTab === 'SYNC' && (
          <SyncAndBackup
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            products={products}
            transactions={transactions}
            onImportProducts={handleImportProducts}
            currentUser={currentUser}
            rolePermissions={rolePermissions}
            categories={categories}
            shelves={shelves}
            onRestoreFullBackup={handleRestoreFullBackup}
          />
        )}

        {activeMenuTab === 'SETTINGS' && (
          <SystemSettings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            rolePermissions={rolePermissions}
            onUpdateRolePermissions={handleUpdateRolePermissions}
            currentUser={currentUser}
            products={products}
            transactions={transactions}
            onImportProducts={handleImportProducts}
            onNavigateToLineBot={() => setActiveMenuTab('LINE_BOT')}
          />
        )}

        {activeMenuTab === 'LINE_BOT' && (
          <LineBotSettings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            products={products}
            currentUser={currentUser}
          />
        )}

        {activeMenuTab === 'SHELVES' && (
          <ShelfManagement
            products={products}
            shelves={shelves}
            currentUser={currentUser}
            canManageProducts={rolePermissions[currentUser.role].manageProducts}
            onRecordTransaction={handleRecordTransaction}
          />
        )}

      </main>
    </div>

      {/* 6.5. Shelf Audit modal for scanned QR codes */}
      {scannedShelfForAudit && (
        <ShelfAuditModal
          shelf={scannedShelfForAudit}
          products={products}
          currentUser={currentUser}
          canRecordTransactions={rolePermissions[currentUser.role].recordTransactions}
          onRecordTransaction={handleRecordTransaction}
          onClose={handleCloseAuditModal}
        />
      )}

      {/* 6.6. Customizable Menu Modal */}
      {currentUser?.role === 'ADMIN' && isMenuCustomizerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <SettingsIcon className="w-5 h-5 text-indigo-600 animate-spin-hover" />
                <h3 className="text-lg font-bold text-slate-800">⚙️ ปรับแต่งปุ่มและชื่อเมนูระบบ</h3>
              </div>
              <button
                onClick={() => setIsMenuCustomizerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              คุณสามารถกำหนดขนาดของปุ่ม (Font Size & Padding) และเปลี่ยนคำอธิบายบนปุ่มเมนูทั้งหมดในระบบได้ตามต้องการ การตั้งค่านี้จะบันทึกไว้ในเบราว์เซอร์ของคุณโดยอัตโนมัติ
            </p>

            {/* Sizes & Paddings Settings */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. ปรับขนาดปุ่มเมนู (Button Resizing)</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Font Size Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">ขนาดตัวอักษร (Text Size)</label>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.keys(fontSizeClasses).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setMenuFontSize(sz)}
                        className={`py-1 text-xs font-medium rounded-md border text-center transition-all cursor-pointer ${
                          menuFontSize === sz
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {sz.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Padding Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">ขนาดระยะห่าง (Button Padding)</label>
                  <div className="grid grid-cols-5 gap-1">
                    {Object.keys(paddingClasses).map((pd) => (
                      <button
                        key={pd}
                        type="button"
                        onClick={() => setMenuPadding(pd)}
                        className={`py-1 text-xs font-medium rounded-md border text-center transition-all cursor-pointer ${
                          menuPadding === pd
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pd.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Block */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">ตัวอย่างปุ่มเมนูที่คุณปรับแต่งขณะนี้:</span>
                <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-center">
                  <button
                    type="button"
                    className={`flex items-center gap-2 bg-blue-600 text-white shadow-xs rounded-lg font-semibold pointer-events-none ${
                      fontSizeClasses[menuFontSize]?.btn || 'text-sm'
                    } ${paddingClasses[menuPadding] || 'px-4 py-2.5'}`}
                  >
                    <Camera className={fontSizeClasses[menuFontSize]?.icon || 'w-4 h-4'} />
                    <span>{menuLabels.SCANNER || 'ระบบสแกนพัสดุ'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Labels Form */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. แก้ไขคำบนปุ่มเมนู (Button Names)</h4>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('คุณต้องการรีเซ็ตชื่อเมนูทั้งหมดกลับเป็นค่าตั้งต้นหรือไม่?')) {
                      setMenuLabels(DEFAULT_MENU_LABELS);
                      localStorage.setItem('menu_labels', JSON.stringify(DEFAULT_MENU_LABELS));
                    }
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer"
                >
                  ↩️ คืนค่าชื่อเดิมทั้งหมด
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[30vh] overflow-y-auto pr-1">
                {Object.keys(DEFAULT_MENU_LABELS).map((key) => {
                  const labelKey = key as keyof typeof DEFAULT_MENU_LABELS;
                  const isAdminOnly = labelKey === 'SYNC' || labelKey === 'SETTINGS';

                  return (
                    <div key={key} className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <span>เมนู {key}</span>
                        {isAdminOnly && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-1 rounded border border-amber-100 font-normal">เฉพาะ Admin</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={menuLabels[labelKey] || ''}
                        onChange={(e) => {
                          const updated = { ...menuLabels, [labelKey]: e.target.value };
                          setMenuLabels(updated);
                          localStorage.setItem('menu_labels', JSON.stringify(updated));
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder={DEFAULT_MENU_LABELS[labelKey]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  const savedLabels = localStorage.getItem('menu_labels');
                  const savedSize = localStorage.getItem('menu_font_size') || 'sm';
                  const savedPadding = localStorage.getItem('menu_padding') || 'md';
                  setMenuFontSize(savedSize);
                  setMenuPadding(savedPadding);
                  if (savedLabels) {
                    try {
                      setMenuLabels(JSON.parse(savedLabels));
                    } catch (e) {
                      setMenuLabels(DEFAULT_MENU_LABELS);
                    }
                  } else {
                    setMenuLabels(DEFAULT_MENU_LABELS);
                  }
                  setIsMenuCustomizerOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('menu_labels', JSON.stringify(menuLabels));
                  localStorage.setItem('menu_font_size', menuFontSize);
                  localStorage.setItem('menu_padding', menuPadding);
                  setIsMenuCustomizerOpen(false);
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                บันทึกการตั้งค่าเรียบร้อย ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Footer Accent */}
      <footer id="app-footer" className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-bold text-slate-300">ระบบคลังสินค้าเสมือนจริง (Virtual Inventory Tracker)</p>
            <p className="text-[11px] text-slate-500">
              พัฒนาขึ้นเพื่ออำนวยความสะดวกในการบริหารสต๊อกอย่างโปร่งใส ไร้กังวลเรื่องข้อมูลสูญหายด้วยการบันทึกระดับ LocalStorage ของเบราว์เซอร์
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-slate-600">|</span>
            <span>ความปลอดภัยระดับสูง</span>
            <span className="text-slate-600">|</span>
            <span>ไม่มีค่าใช้จ่ายลิขสิทธิ์</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
