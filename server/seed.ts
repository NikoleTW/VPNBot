import { db } from "./db";
import { products, settings, admins } from "@shared/schema";
import bcrypt from "bcryptjs";

/**
 * Seed function to populate the database with initial data
 */
export async function seedDatabase() {
  console.log("Seeding database with initial data...");
  
  try {
    // Check if we already have products
    const existingProducts = await db.select().from(products);
    
    if (existingProducts.length === 0) {
      console.log("Adding sample products...");
      
      // Sample products
      await db.insert(products).values([
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
      ]);
    }
    
    // Check if we already have settings
    const existingSettings = await db.select().from(settings);
    
    if (existingSettings.length === 0) {
      console.log("Adding default settings...");
      
      // Default settings
      await db.insert(settings).values([
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
        { key: "telegram_bot_link", value: "https://t.me/your_bot" },
        { key: "support_contact", value: "@support_username" },
        { key: "payment_info", value: "1. Банковская карта: 5000 0000 0000 0000\n2. СБП по номеру телефона: +7 (999) 000-00-00" },
      ]);
    }
    
    // Check if we already have admin users
    const existingAdmins = await db.select().from(admins);
    
    if (existingAdmins.length === 0) {
      console.log("Adding default admin account...");
      
      // Create default admin with password 'admin'
      const passwordHash = await bcrypt.hash('admin', 10);
      
      await db.insert(admins).values({
        username: 'admin',
        passwordHash,
        email: 'admin@example.com',
        createdAt: new Date()
      });
      
      console.log("Created default admin account (username: admin, password: admin)");
    }
    
    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}