import {
  users,
  products,
  orders,
  vpnConfigs,
  settings,
  admins,
  adminSessions,
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type VpnConfig,
  type InsertVpnConfig,
  type Setting,
  type InsertSetting,
  type Admin,
  type InsertAdmin,
  type AdminSession,
  type InsertAdminSession,
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  blockUser(id: number, isBlocked: boolean): Promise<User | undefined>;
  
  // Admin methods
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: { username: string; passwordHash: string; email?: string }): Promise<Admin>;
  updateAdmin(id: number, adminData: Partial<Omit<Admin, "id">>): Promise<Admin | undefined>;
  verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  
  // Admin Session methods
  createAdminSession(adminId: number, ipAddress?: string, userAgent?: string): Promise<AdminSession>;
  getAdminSessionByToken(token: string): Promise<AdminSession | undefined>;
  deleteAdminSession(token: string): Promise<void>;
  
  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getActiveProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Order methods
  getOrder(id: number): Promise<Order | undefined>;
  getUserOrders(userId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  getRecentOrders(limit: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: Order['status'], paidAt?: Date): Promise<Order | undefined>;
  updateOrderConfig(orderId: number, configId: number): Promise<Order | undefined>;
  
  // VPN Config methods
  getVpnConfig(id: number): Promise<VpnConfig | undefined>;
  getUserVpnConfigs(userId: number): Promise<VpnConfig[]>;
  getActiveVpnConfigs(): Promise<VpnConfig[]>;
  createVpnConfig(config: InsertVpnConfig): Promise<VpnConfig>;
  updateVpnConfig(id: number, config: Partial<VpnConfig>): Promise<VpnConfig | undefined>;
  deactivateVpnConfig(id: number): Promise<VpnConfig | undefined>;
  
  // Settings methods
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  setSettings(settings: { key: string; value: string }[]): Promise<void>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;
  
  // Stats methods
  getStats(): Promise<{
    totalUsers: number;
    totalSales: number;
    activeVpns: number;
    totalRevenue: number;
  }>;
  getSalesData(): Promise<{
    date: string;
    sales: number;
    revenue: number;
  }[]>;
  getPopularProducts(): Promise<{
    productId: number;
    productName: string;
    count: number;
    percentage: number;
  }[]>;
}

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private vpnConfigs: Map<number, VpnConfig>;
  private settings: Map<string, Setting>;
  private admins: Map<number, Admin>;
  private adminSessions: Map<string, AdminSession>;
  
  private currentUserId: number;
  private currentProductId: number;
  private currentOrderId: number;
  private currentVpnConfigId: number;
  private currentSettingId: number;
  private currentAdminId: number;
  private currentAdminSessionId: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.vpnConfigs = new Map();
    this.settings = new Map();
    this.admins = new Map();
    this.adminSessions = new Map();
    
    this.currentUserId = 1;
    this.currentProductId = 1;
    this.currentOrderId = 1;
    this.currentVpnConfigId = 1;
    this.currentSettingId = 1;
    this.currentAdminId = 1;
    this.currentAdminSessionId = 1;
    
    // Initialize with some sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample products
    const products: InsertProduct[] = [
      {
        name: "VPN Базовый 30 дней",
        description: "Базовый план VPN на 30 дней",
        price: 80000, // 800 рублей в копейках
        configType: "vless",
        durationDays: 30,
        isActive: true,
      },
      {
        name: "VPN Стандарт 30 дней",
        description: "Стандартный план VPN на 30 дней",
        price: 120000, // 1200 рублей в копейках
        configType: "vmess",
        durationDays: 30,
        isActive: true,
      },
      {
        name: "VPN Премиум 30 дней",
        description: "Премиум план VPN на 30 дней",
        price: 150000, // 1500 рублей в копейках
        configType: "trojan",
        durationDays: 30,
        isActive: true,
      },
      {
        name: "VPN Стандарт 90 дней",
        description: "Стандартный план VPN на 90 дней",
        price: 350000, // 3500 рублей в копейках
        configType: "vmess",
        durationDays: 90,
        isActive: true,
      },
      {
        name: "VPN Премиум 180 дней",
        description: "Премиум план VPN на 180 дней",
        price: 700000, // 7000 рублей в копейках
        configType: "trojan",
        durationDays: 180,
        isActive: true,
      },
    ];

    products.forEach(product => {
      this.createProduct(product);
    });

    // Sample settings
    const defaultSettings = [
      { key: "telegram_bot_token", value: "7589540729:AAHj10-iniRikX4zG534Q39HcyNHQ0lT1bs" },
      { key: "telegram_admin_ids", value: "" },
      { key: "welcome_message", value: "Добро пожаловать в VPN бот! Используйте меню ниже для навигации." },
      { key: "help_message", value: "Этот бот позволяет приобрести доступ к VPN сервису. Используйте кнопки меню для навигации." },
      { key: "payment_confirmation_message", value: "Пожалуйста, отправьте скриншот или квитанцию об оплате. Администратор проверит оплату и активирует ваш доступ." },
      { key: "order_completed_message", value: "Ваш заказ выполнен! Ваша VPN конфигурация готова к использованию. Нажмите 'Мои конфигурации', чтобы получить доступ." },
      { key: "x_ui_url", value: "https://vpn-panel.example.com" },
      { key: "x_ui_username", value: "admin" },
      { key: "x_ui_password", value: "securepassword" },
      { key: "server_address", value: "vpn.example.com" },
      { key: "auto_activate_configs", value: "true" },
    ];

    defaultSettings.forEach(setting => {
      const settingObj: InsertSetting = {
        key: setting.key,
        value: setting.value,
      };
      this.setSetting(settingObj);
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.telegramId === telegramId);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const newUser: User = { ...user, id, registrationDate: new Date() };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async blockUser(id: number, isBlocked: boolean): Promise<User | undefined> {
    return this.updateUser(id, { isBlocked });
  }
  
  // Admin Authentication methods
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return Array.from(this.admins.values()).find(admin => admin.username === username);
  }
  
  async createAdmin(admin: { username: string; passwordHash: string; email?: string }): Promise<Admin> {
    const id = this.currentAdminId++;
    const hashedPassword = await this.hashPassword(admin.passwordHash);
    
    const newAdmin: Admin = {
      id,
      username: admin.username,
      passwordHash: hashedPassword,
      email: admin.email || null,
      createdAt: new Date(),
      lastLogin: null
    };
    
    this.admins.set(id, newAdmin);
    return newAdmin;
  }
  
  async updateAdmin(id: number, adminData: Partial<Omit<Admin, "id">>): Promise<Admin | undefined> {
    const admin = this.admins.get(id);
    if (!admin) return undefined;
    
    // If password is being updated, hash it
    if (adminData.passwordHash) {
      adminData.passwordHash = await this.hashPassword(adminData.passwordHash);
    }
    
    const updatedAdmin: Admin = { ...admin, ...adminData };
    this.admins.set(id, updatedAdmin);
    return updatedAdmin;
  }
  
  async createAdminSession(adminId: number, ipAddress?: string, userAgent?: string): Promise<AdminSession> {
    const id = this.currentAdminSessionId++;
    
    // Create a random token
    const token = randomBytes(32).toString('hex');
    
    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const session: AdminSession = {
      id,
      adminId,
      token,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      createdAt: new Date(),
      expiresAt
    };
    
    this.adminSessions.set(token, session);
    return session;
  }
  
  async getAdminSessionByToken(token: string): Promise<AdminSession | undefined> {
    const session = this.adminSessions.get(token);
    
    if (!session) return undefined;
    
    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.adminSessions.delete(token);
      return undefined;
    }
    
    return session;
  }
  
  async deleteAdminSession(token: string): Promise<void> {
    this.adminSessions.delete(token);
  }
  
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
  
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getActiveProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => product.isActive);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const newProduct: Product = { ...product, id };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct: Product = { ...product, ...productData };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.userId === userId);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getRecentOrders(limit: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const newOrder: Order = { 
      ...order, 
      id, 
      createdAt: new Date(), 
      paidAt: order.status === 'completed' ? new Date() : undefined 
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async updateOrderStatus(id: number, status: Order['status'], paidAt?: Date): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder: Order = { 
      ...order, 
      status,
      paidAt: status === 'completed' ? (paidAt || new Date()) : order.paidAt
    };
    
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }
  
  async updateOrderConfig(orderId: number, configId: number): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    // Update the order to link it with the VPN config
    const updatedOrder: Order = {
      ...order
    };
    
    this.orders.set(orderId, updatedOrder);
    return updatedOrder;
  }

  // VPN Config methods
  async getVpnConfig(id: number): Promise<VpnConfig | undefined> {
    return this.vpnConfigs.get(id);
  }

  async getUserVpnConfigs(userId: number): Promise<VpnConfig[]> {
    return Array.from(this.vpnConfigs.values()).filter(config => config.userId === userId);
  }

  async getActiveVpnConfigs(): Promise<VpnConfig[]> {
    const now = new Date();
    return Array.from(this.vpnConfigs.values()).filter(
      config => config.isActive && config.validUntil > now
    );
  }

  async createVpnConfig(config: InsertVpnConfig): Promise<VpnConfig> {
    const id = this.currentVpnConfigId++;
    const newConfig: VpnConfig = { ...config, id, createdAt: new Date() };
    this.vpnConfigs.set(id, newConfig);
    return newConfig;
  }

  async updateVpnConfig(id: number, configData: Partial<VpnConfig>): Promise<VpnConfig | undefined> {
    const config = this.vpnConfigs.get(id);
    if (!config) return undefined;
    
    const updatedConfig: VpnConfig = { ...config, ...configData };
    this.vpnConfigs.set(id, updatedConfig);
    return updatedConfig;
  }

  async deactivateVpnConfig(id: number): Promise<VpnConfig | undefined> {
    return this.updateVpnConfig(id, { isActive: false });
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async setSettings(settingsArray: { key: string; value: string }[]): Promise<void> {
    for (const setting of settingsArray) {
      await this.setSetting(setting);
    }
  }

  private async setSetting(setting: { key: string; value: string }): Promise<Setting> {
    const existingSetting = await this.getSetting(setting.key);
    
    if (existingSetting) {
      const updatedSetting: Setting = { ...existingSetting, value: setting.value };
      this.settings.set(setting.key, updatedSetting);
      return updatedSetting;
    } else {
      const id = this.currentSettingId++;
      const newSetting: Setting = { id, key: setting.key, value: setting.value };
      this.settings.set(setting.key, newSetting);
      return newSetting;
    }
  }
  
  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    return this.setSetting({ key, value });
  }

  // Stats methods
  async getStats(): Promise<{ totalUsers: number; totalSales: number; activeVpns: number; totalRevenue: number }> {
    const users = await this.getAllUsers();
    const completedOrders = (await this.getAllOrders()).filter(order => order.status === 'completed');
    const activeVpns = await this.getActiveVpnConfigs();
    
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.amount, 0);
    
    return {
      totalUsers: users.length,
      totalSales: completedOrders.length,
      activeVpns: activeVpns.length,
      totalRevenue
    };
  }

  async getSalesData(): Promise<{ date: string; sales: number; revenue: number }[]> {
    // Generate sample data for the last 12 months
    const data = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.toLocaleString('default', { month: 'short' });
      
      data.push({
        date: month,
        sales: Math.floor(Math.random() * 30) + 5,
        revenue: (Math.floor(Math.random() * 50) + 10) * 1000
      });
    }
    
    return data;
  }

  async getPopularProducts(): Promise<{ productId: number; productName: string; count: number; percentage: number }[]> {
    const completedOrders = (await this.getAllOrders()).filter(order => order.status === 'completed');
    const productCounts = new Map<number, number>();
    
    // Count orders by product
    for (const order of completedOrders) {
      const count = productCounts.get(order.productId) || 0;
      productCounts.set(order.productId, count + 1);
    }
    
    // Calculate total
    const totalOrders = completedOrders.length;
    
    // Format data
    const result = [];
    for (const [productId, count] of productCounts.entries()) {
      const product = await this.getProduct(productId);
      if (product) {
        result.push({
          productId,
          productName: product.name,
          count,
          percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
        });
      }
    }
    
    // Sort by count descending
    return result.sort((a, b) => b.count - a.count);
  }
}

// Database Storage implementation
import { eq, and, gte, gt, lte, desc, count, sum } from "drizzle-orm";
import { db } from "./db";

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async blockUser(id: number, isBlocked: boolean): Promise<User | undefined> {
    return this.updateUser(id, { isBlocked });
  }
  
  // Admin Authentication methods
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin;
  }
  
  async createAdmin(admin: { username: string; passwordHash: string; email?: string }): Promise<Admin> {
    const hashedPassword = await this.hashPassword(admin.passwordHash);
    const [newAdmin] = await db.insert(admins).values({
      username: admin.username,
      passwordHash: hashedPassword,
      email: admin.email
    }).returning();
    return newAdmin;
  }
  
  async updateAdmin(id: number, adminData: Partial<Omit<Admin, "id">>): Promise<Admin | undefined> {
    // If password is being updated, hash it
    if (adminData.passwordHash) {
      adminData.passwordHash = await this.hashPassword(adminData.passwordHash);
    }
    
    const [updatedAdmin] = await db
      .update(admins)
      .set(adminData)
      .where(eq(admins.id, id))
      .returning();
    return updatedAdmin;
  }
  
  async createAdminSession(adminId: number, ipAddress?: string, userAgent?: string): Promise<AdminSession> {
    // Create a random token
    const token = randomBytes(32).toString('hex');
    
    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const [session] = await db.insert(adminSessions).values({
      adminId,
      token,
      ipAddress,
      userAgent,
      expiresAt
    }).returning();
    
    return session;
  }
  
  async getAdminSessionByToken(token: string): Promise<AdminSession | undefined> {
    const [session] = await db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.token, token),
          gte(adminSessions.expiresAt, new Date())
        )
      );
    return session;
  }
  
  async deleteAdminSession(token: string): Promise<void> {
    await db.delete(adminSessions).where(eq(adminSessions.token, token));
  }
  
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
  
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products);
  }

  async getActiveProducts(): Promise<Product[]> {
    return db.select().from(products).where(eq(products.isActive, true));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const [updatedProduct] = await db
      .update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.userId, userId));
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders);
  }

  async getRecentOrders(limit: number): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: number, status: Order['status'], paidAt?: Date): Promise<Order | undefined> {
    const updateData: Partial<Order> = { status };
    if (status === 'completed' && paidAt) {
      updateData.paidAt = paidAt;
    }
    
    const [updatedOrder] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }
  
  async updateOrderConfig(orderId: number, configId: number): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ configId })
      .where(eq(orders.id, orderId))
      .returning();
    return updatedOrder;
  }

  // VPN Config methods
  async getVpnConfig(id: number): Promise<VpnConfig | undefined> {
    const [config] = await db.select().from(vpnConfigs).where(eq(vpnConfigs.id, id));
    return config;
  }

  async getUserVpnConfigs(userId: number): Promise<VpnConfig[]> {
    return db.select().from(vpnConfigs).where(eq(vpnConfigs.userId, userId));
  }

  async getActiveVpnConfigs(): Promise<VpnConfig[]> {
    const now = new Date();
    return db
      .select()
      .from(vpnConfigs)
      .where(and(
        eq(vpnConfigs.isActive, true),
        gt(vpnConfigs.validUntil, now)
      ));
  }

  async createVpnConfig(config: InsertVpnConfig): Promise<VpnConfig> {
    const [newConfig] = await db.insert(vpnConfigs).values(config).returning();
    return newConfig;
  }

  async updateVpnConfig(id: number, configData: Partial<VpnConfig>): Promise<VpnConfig | undefined> {
    const [updatedConfig] = await db
      .update(vpnConfigs)
      .set(configData)
      .where(eq(vpnConfigs.id, id))
      .returning();
    return updatedConfig;
  }

  async deactivateVpnConfig(id: number): Promise<VpnConfig | undefined> {
    return this.updateVpnConfig(id, { isActive: false });
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async getAllSettings(): Promise<Setting[]> {
    return db.select().from(settings);
  }

  async setSettings(settingsArray: { key: string; value: string }[]): Promise<void> {
    for (const setting of settingsArray) {
      await this.setSetting(setting);
    }
  }

  private async setSetting(setting: { key: string; value: string }): Promise<Setting> {
    const existingSetting = await this.getSetting(setting.key);
    
    if (existingSetting) {
      const [updatedSetting] = await db
        .update(settings)
        .set({ value: setting.value })
        .where(eq(settings.key, setting.key))
        .returning();
      return updatedSetting;
    } else {
      const [newSetting] = await db
        .insert(settings)
        .values({ key: setting.key, value: setting.value })
        .returning();
      return newSetting;
    }
  }
  
  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    return this.setSetting({ key, value });
  }

  // Stats methods
  async getStats(): Promise<{ totalUsers: number; totalSales: number; activeVpns: number; totalRevenue: number }> {
    // Count users
    const [userResult] = await db.select({ count: count() }).from(users);
    const totalUsers = Number(userResult?.count || 0);
    
    // Count completed sales
    const [salesResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.status, 'completed'));
    const totalSales = Number(salesResult?.count || 0);
    
    // Count active VPNs
    const now = new Date();
    const [vpnResult] = await db
      .select({ count: count() })
      .from(vpnConfigs)
      .where(and(
        eq(vpnConfigs.isActive, true),
        gt(vpnConfigs.validUntil, now)
      ));
    const activeVpns = Number(vpnResult?.count || 0);
    
    // Sum revenue
    const [revenueResult] = await db
      .select({ sum: sum(orders.amount) })
      .from(orders)
      .where(eq(orders.status, 'completed'));
    const totalRevenue = Number(revenueResult?.sum || 0);
    
    return {
      totalUsers,
      totalSales,
      activeVpns,
      totalRevenue
    };
  }

  async getSalesData(): Promise<{ date: string; sales: number; revenue: number }[]> {
    // Get sales data for the last 12 months
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      // Count sales for this month
      const [salesResult] = await db
        .select({ count: count() })
        .from(orders)
        .where(and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ));
      const sales = Number(salesResult?.count || 0);
      
      // Sum revenue for this month
      const [revenueResult] = await db
        .select({ sum: sum(orders.amount) })
        .from(orders)
        .where(and(
          eq(orders.status, 'completed'),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        ));
      const revenue = Number(revenueResult?.sum || 0);
      
      months.push({
        date: startDate.toLocaleString('default', { month: 'short' }),
        sales,
        revenue
      });
    }
    
    return months;
  }

  async getPopularProducts(): Promise<{ productId: number; productName: string; count: number; percentage: number }[]> {
    // Get the count of orders by product
    const results = await db
      .select({
        productId: orders.productId,
        count: count(),
      })
      .from(orders)
      .where(eq(orders.status, 'completed'))
      .groupBy(orders.productId);
    
    // Get total completed orders
    const [totalResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.status, 'completed'));
    const totalOrders = Number(totalResult?.count || 0);
    
    // Get product names and calculate percentages
    const formattedResults = [];
    for (const result of results) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, result.productId));
      
      if (product) {
        const count = Number(result.count);
        formattedResults.push({
          productId: result.productId,
          productName: product.name,
          count,
          percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
        });
      }
    }
    
    // Sort by count descending
    return formattedResults.sort((a, b) => b.count - a.count);
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
