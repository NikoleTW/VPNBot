import { User, Product, Order, VpnConfig, Setting } from "@shared/schema";

// Base API URL
const API_URL = "/api";

// Helper function for API requests
async function apiRequest<T>(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `API request failed with status ${response.status}`
    );
  }

  return response.json();
}

// User API
export const userApi = {
  getUsers: () => apiRequest<User[]>("GET", "/users"),
  getUser: (id: number) => apiRequest<User>("GET", `/users/${id}`),
  createUser: (user: Omit<User, "id">) =>
    apiRequest<User>("POST", "/users", user),
  updateUser: (id: number, user: Partial<User>) =>
    apiRequest<User>("PATCH", `/users/${id}`, user),
  blockUser: (id: number, isBlocked: boolean) =>
    apiRequest<User>("POST", `/users/${id}/block`, { isBlocked }),
};

// Product API
export const productApi = {
  getProducts: (active?: boolean) =>
    apiRequest<Product[]>("GET", `/products${active ? "?active=true" : ""}`),
  getProduct: (id: number) => apiRequest<Product>("GET", `/products/${id}`),
  createProduct: (product: Omit<Product, "id">) =>
    apiRequest<Product>("POST", "/products", product),
  updateProduct: (id: number, product: Partial<Product>) =>
    apiRequest<Product>("PATCH", `/products/${id}`, product),
  deleteProduct: (id: number) =>
    apiRequest<void>("DELETE", `/products/${id}`),
};

// Order API
export const orderApi = {
  getOrders: () => apiRequest<Order[]>("GET", "/orders"),
  getUserOrders: (userId: number) =>
    apiRequest<Order[]>("GET", `/orders?userId=${userId}`),
  getRecentOrders: (limit: number) =>
    apiRequest<Order[]>("GET", `/orders?recent=${limit}`),
  getOrder: (id: number) => apiRequest<Order>("GET", `/orders/${id}`),
  createOrder: (order: Omit<Order, "id" | "createdAt" | "paidAt">) =>
    apiRequest<Order>("POST", "/orders", order),
  updateOrderStatus: (id: number, status: string) =>
    apiRequest<Order>("PATCH", `/orders/${id}/status`, { status }),
};

// VPN Config API
export const vpnConfigApi = {
  getVpnConfigs: () => apiRequest<VpnConfig[]>("GET", "/vpn-configs"),
  getUserVpnConfigs: (userId: number) =>
    apiRequest<VpnConfig[]>("GET", `/vpn-configs?userId=${userId}`),
  getActiveVpnConfigs: () =>
    apiRequest<VpnConfig[]>("GET", "/vpn-configs?active=true"),
  getVpnConfig: (id: number) =>
    apiRequest<VpnConfig>("GET", `/vpn-configs/${id}`),
  createVpnConfig: (config: Omit<VpnConfig, "id" | "createdAt">) =>
    apiRequest<VpnConfig>("POST", "/vpn-configs", config),
  updateVpnConfig: (id: number, config: Partial<VpnConfig>) =>
    apiRequest<VpnConfig>("PATCH", `/vpn-configs/${id}`, config),
  deactivateVpnConfig: (id: number) =>
    apiRequest<VpnConfig>("POST", `/vpn-configs/${id}/deactivate`),
};

// Settings API
export const settingsApi = {
  getAllSettings: () => apiRequest<Setting[]>("GET", "/settings"),
  getSetting: (key: string) => apiRequest<Setting>("GET", `/settings/${key}`),
  updateSettings: (settings: { key: string; value: string }[]) =>
    apiRequest<Setting[]>("POST", "/settings", settings),
};

// Stats API
export const statsApi = {
  getStats: () =>
    apiRequest<{
      totalUsers: number;
      totalSales: number;
      activeVpns: number;
      totalRevenue: number;
    }>("GET", "/stats"),
  getSalesData: () =>
    apiRequest<{ date: string; sales: number; revenue: number }[]>(
      "GET",
      "/stats/sales"
    ),
  getPopularProducts: () =>
    apiRequest<{ productId: number; productName: string; count: number; percentage: number }[]>(
      "GET",
      "/stats/popular-products"
    ),
};

// Telegram Bot API
export const telegramBotApi = {
  restartBot: () => apiRequest<{ message: string }>("POST", "/bot/restart"),
  checkToken: (token: string) =>
    apiRequest<{ success: boolean; bot_name?: string; error?: string }>(
      "POST",
      "/bot/check-token",
      { token }
    ),
  sendMessage: (userId: number, message: string) =>
    apiRequest<{ success: boolean; message?: string }>(
      "POST",
      "/bot/send-message",
      { userId, message }
    ),
  sendBroadcast: (message: string) =>
    apiRequest<{ success: boolean; sent: number; failed: number }>(
      "POST",
      "/bot/broadcast",
      { message }
    ),
};

// Payment API
export const paymentApi = {
  createPaymentIntent: (amount: number) =>
    apiRequest<{ clientSecret: string }>(
      "POST",
      "/create-payment-intent",
      { amount }
    ),
};
