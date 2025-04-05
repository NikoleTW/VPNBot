import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").unique(),
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  isBlocked: boolean("is_blocked").default(false),
  registrationDate: timestamp("registration_date").defaultNow().notNull(),
});

// Admins table
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin sessions table
export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Product table
export const productTypeEnum = pgEnum("product_type", ["vless", "vmess", "trojan"]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // in cents
  configType: productTypeEnum("config_type").notNull(),
  durationDays: integer("duration_days").notNull(),
  isActive: boolean("is_active").default(true),
});

// Order status enum
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "awaiting_confirmation",
  "completed",
  "cancelled",
]);

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  amount: integer("amount").notNull(), // in cents
  status: orderStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  paymentProofImage: text("payment_proof_image"),
  configId: integer("config_id").references(() => vpnConfigs.id),
});

// VPN Configurations table
export const vpnConfigs = pgTable("vpn_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  configType: productTypeEnum("config_type").notNull(),
  configData: text("config_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").default(true),
  xUiClientId: integer("x_ui_client_id"),
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  vpnConfigs: many(vpnConfigs),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  vpnConfig: one(vpnConfigs, {
    fields: [orders.configId],
    references: [vpnConfigs.id],
  }),
}));

export const vpnConfigsRelations = relations(vpnConfigs, ({ one, many }) => ({
  user: one(users, {
    fields: [vpnConfigs.userId],
    references: [users.id],
  }),
  orders: many(orders, {
    fields: [vpnConfigs.id],
    references: [orders.configId],
  })
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(admins, {
    fields: [adminSessions.adminId],
    references: [admins.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, paidAt: true });
export const insertVpnConfigSchema = createInsertSchema(vpnConfigs).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true, lastLogin: true });
export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type VpnConfig = typeof vpnConfigs.$inferSelect;
export type InsertVpnConfig = z.infer<typeof insertVpnConfigSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
