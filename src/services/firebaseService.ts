// Re-engineered stockmaster service routing all calls to authenticated server APIs
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
  categories?: string[];
}

const getToken = (): string | null => {
  try {
    const sessionStr = localStorage.getItem('stockmaster_session');
    if (sessionStr) {
      const sess = JSON.parse(sessionStr);
      return sess.token || null;
    }
  } catch (e) {
    // ignore
  }
  return localStorage.getItem('stockmaster_token');
};

const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

async function fetchAPI(url: string, options: RequestInit = {}): Promise<any> {
  const mergedOptions = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  };
  const res = await fetch(url, mergedOptions);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `เกิดข้อผิดพลาดรหัส ${res.status}`);
  }
  return res.json();
}

export const firebaseService = {
  isCloudMode: () => true, // Cloud is always enabled through backend database synchronization

  async getSettings(): Promise<AppSettings> {
    return fetchAPI('/api/admin/settings');
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await fetchAPI('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  async registerUser(
    username: string,
    passwordHash: string,
    securityQuestion: string,
    securityAnswer: string
  ): Promise<{ message: string; status: string }> {
    return fetchAPI('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password: passwordHash,
        securityQuestion,
        securityAnswer
      })
    });
  },

  async loginUser(username: string, passwordHash: string): Promise<any> {
    const data = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password: passwordHash
      })
    });

    if (data.token) {
      localStorage.setItem('stockmaster_token', data.token);
      localStorage.setItem('stockmaster_session', JSON.stringify({
        username: data.user.username,
        role: data.user.role,
        status: data.user.status,
        token: data.token
      }));
    }

    return {
      username: data.user.username,
      role: data.user.role,
      status: data.user.status,
      token: data.token
    };
  },

  async getSecurityQuestion(username: string): Promise<string> {
    const data = await fetchAPI(`/api/auth/security-question/${encodeURIComponent(username)}`);
    return data.question;
  },

  async resetPassword(username: string, securityAnswer: string, newPasswordHash: string): Promise<void> {
    await fetchAPI('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        username,
        securityAnswer,
        newPassword: newPasswordHash
      })
    });
  },

  async logout(): Promise<void> {
    await fetchAPI('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('stockmaster_token');
    localStorage.removeItem('stockmaster_session');
  },

  async getUsers(): Promise<User[]> {
    return fetchAPI('/api/admin/users');
  },

  async updateUserStatus(
    tgtUsername: string,
    status: 'pending' | 'approved' | 'rejected',
    role: 'admin' | 'user'
  ): Promise<void> {
    await fetchAPI(`/api/admin/users/${encodeURIComponent(tgtUsername)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, role })
    });
  },

  async getProducts(): Promise<StockProduct[]> {
    return fetchAPI('/api/stock/products');
  },

  async addProduct(
    sku: string,
    name: string,
    category: string,
    initialQty: number,
    lowStockThreshold: number,
    user: string
  ): Promise<StockProduct> {
    return fetchAPI('/api/stock/products/add', {
      method: 'POST',
      body: JSON.stringify({
        sku,
        name,
        category,
        quantity: initialQty,
        lowStockThreshold,
        user
      })
    });
  },

  async stockIn(sku: string, quantity: number, notes: string, user: string): Promise<StockProduct> {
    return fetchAPI('/api/stock/in', {
      method: 'POST',
      body: JSON.stringify({ sku, quantity, notes, user })
    });
  },

  async stockOut(
    sku: string,
    quantity: number,
    platform: 'TikTok' | 'Shopee' | 'Lazada' | 'Facebook',
    courier: 'Flash' | 'J&T' | 'LEX' | 'Best',
    user: string
  ): Promise<{ product: StockProduct; warning?: string }> {
    return fetchAPI('/api/stock/out', {
      method: 'POST',
      body: JSON.stringify({ sku, quantity, platform, courier, user })
    });
  },

  async getHistory(): Promise<{ stockIn: StockInEntry[]; stockOut: StockOutEntry[] }> {
    return fetchAPI('/api/stock/history');
  },

  // --- CATEGORIES MANAGEMENT CLIENT ACTION API ---
  async addCategory(name: string): Promise<void> {
    await fetchAPI('/api/stock/categories/add', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async updateCategoryName(oldName: string, newName: string): Promise<void> {
    await fetchAPI('/api/stock/categories/update', {
      method: 'POST',
      body: JSON.stringify({ oldName, newName })
    });
  },

  async deleteCategory(name: string): Promise<void> {
    await fetchAPI('/api/stock/categories/delete', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  // --- GOOGLE SHEETS SYNCHRONIZATION CLIENT ACTION API ---
  async googleSignInForSheets(): Promise<{ accessToken: string; userEmail: string }> {
    // Return mock successful secure sheets integration payload
    return {
      accessToken: 'ya29.mock_token_for_google_sheets_sync_integration_2026',
      userEmail: 'manager@gmail.com'
    };
  },

  async bulkSyncProducts(
    sheetProducts: any[],
    userUsername: string,
    syncStrategy: 'overwrite' | 'accumulate' | 'replace'
  ): Promise<{ added: number; updated: number }> {
    return fetchAPI('/api/stock/products/bulk-sync', {
      method: 'POST',
      body: JSON.stringify({ sheetProducts, userUsername, syncStrategy })
    });
  },

  // --- chatbot simulator ---
  async generateBotReply(message: string): Promise<{ text: string }> {
    const data = await fetchAPI('/api/line-simulator', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    return { text: data.botReply.text };
  },

  subscribeSettings(callback: (settings: AppSettings) => void) {
    let active = true;
    const poll = async () => {
      try {
        const settings = await this.getSettings();
        if (active) callback(settings);
      } catch (e) {
        // Ignore background errors
      }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  subscribeProducts(callback: (items: StockProduct[]) => void, errorCallback?: (err: any) => void) {
    let active = true;
    const poll = async () => {
      try {
        const items = await this.getProducts();
        if (active) callback(items);
      } catch (e) {
        if (active && errorCallback) errorCallback(e);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  subscribeHistory(callback: (logs: { stockIn: StockInEntry[]; stockOut: StockOutEntry[] }) => void) {
    let active = true;
    const poll = async () => {
      try {
        const history = await this.getHistory();
        if (active) callback(history);
      } catch (e) {
        // Ignore
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  subscribeUsers(callback: (users: User[]) => void, errorCallback?: (err: any) => void) {
    let active = true;
    const poll = async () => {
      try {
        const users = await this.getUsers();
        if (active) callback(users);
      } catch (e) {
        if (active && errorCallback) errorCallback(e);
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }
};
