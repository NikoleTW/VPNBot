import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { storage } from "./storage";
import { insertUserSchema, insertProductSchema, insertOrderSchema, insertVpnConfigSchema, admins, type Product, type VpnConfig } from "@shared/schema";
import { z } from "zod";
import TelegramBot from "node-telegram-bot-api";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Helper function to convert order status to readable text
function getOrderStatusText(status: string): string {
  switch(status) {
    case 'pending': return '⏳ Ожидает оплаты';
    case 'awaiting_confirmation': return '🔍 Ожидает подтверждения';
    case 'completed': return '✅ Выполнен';
    case 'cancelled': return '❌ Отменен';
    default: return status;
  }
}

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | undefined;

if (!stripeSecretKey) {
  console.error("Missing Stripe secret key (STRIPE_SECRET_KEY)");
} else {
  try {
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-03-31.basil",
    });
    console.log("Stripe initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

// Initialize Telegram Bot
let bot: TelegramBot | undefined;

async function initBot() {
  const setting = await storage.getSetting("telegram_bot_token");
  const token = setting?.value;
  
  if (token && token.length > 0) {
    try {
      if (bot) {
        bot.stopPolling();
      }
      
      bot = new TelegramBot(token, { polling: true });
      setupBotHandlers(bot);
      return true;
    } catch (error) {
      console.error("Failed to initialize Telegram bot:", error);
      return false;
    }
  }
  return false;
}

function setupBotHandlers(bot: TelegramBot) {
  // Register bot commands
  bot.setMyCommands([
    { command: "start", description: "Запустить бота" },
    { command: "help", description: "Получить помощь" },
    { command: "products", description: "Показать доступные тарифы" },
    { command: "my_configs", description: "Мои VPN конфигурации" },
    { command: "support", description: "Связаться с поддержкой" },
  ]);
  // Helper function to show product carousel
  async function showProductCarousel(chatId: number | string, products: Product[], currentIndex: number) {
    if (products.length === 0) return;
    
    const product = products[currentIndex];
    const productPrice = (product.price / 100).toFixed(2);
    
    // Get protocol icon
    let protocolIcon = '';
    switch (product.configType.toLowerCase()) {
      case 'vless':
        protocolIcon = '🟠';
        break;
      case 'vmess':
        protocolIcon = '🟣';
        break;
      case 'trojan':
        protocolIcon = '🔵';
        break;
      default:
        protocolIcon = '⚫';
    }
    
    // Create beautiful product card message
    let message = `*${product.name}*\n\n`;
    message += `${protocolIcon} *Протокол:* ${product.configType.toUpperCase()}\n`;
    message += `⏱ *Срок действия:* ${product.durationDays} дней\n`;
    message += `💰 *Цена:* ${productPrice} руб.\n\n`;
    message += `📝 *Описание:*\n${product.description || 'Нет описания'}\n\n`;
    message += `🔢 *Номер тарифа:* ${currentIndex + 1}/${products.length}`;
    
    const isUserAdmin = await isAdmin(chatId.toString());
    
    // Create keyboard with pagination and buy button
    const keyboard = [];
    
    // Navigation row
    const navigationRow = [];
    if (currentIndex > 0) {
      navigationRow.push({ text: "⬅️ Предыдущий", callback_data: `product_show_${currentIndex - 1}` });
    }
    if (currentIndex < products.length - 1) {
      navigationRow.push({ text: "Следующий ➡️", callback_data: `product_show_${currentIndex + 1}` });
    }
    if (navigationRow.length > 0) {
      keyboard.push(navigationRow);
    }
    
    // Buy and share buttons
    if (isUserAdmin) {
      keyboard.push([
        { text: "🔑 Бесплатная покупка (тест)", callback_data: `product_free_${product.id}` }
      ]);
    }
    
    keyboard.push([
      { text: "🛒 Купить тариф", callback_data: `product_buy_${product.id}` },
      { text: "📲 Поделиться", callback_data: `product_share_${product.id}` }
    ]);
    
    // Send message with product card (using text message instead of photo to avoid external URL issues)
    await bot.sendMessage(chatId, `🔐 *${product.name}*\n\n${message}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }
  
  // Helper function to generate random VPN config (for testing)
  async function generateRandomVpnConfig(userId: number, productId: number): Promise<VpnConfig> {
    const product = await storage.getProduct(productId);
    if (!product) {
      throw new Error("Продукт не найден");
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    
    // Generate random configuration data based on product type
    const configType = product.configType.toLowerCase();
    const uuid = crypto.randomUUID();
    const now = new Date();
    const validUntil = new Date(now.getTime() + product.durationDays * 24 * 60 * 60 * 1000);
    
    let configData = '';
    const serverAddress = '123.123.123.123'; // Placeholder server address
    
    if (configType === 'vless') {
      configData = `vless://${uuid}@${serverAddress}:443?encryption=none&security=tls&sni=example.com&type=ws&host=example.com&path=%2Fvless#${encodeURIComponent(`${user.username || user.firstName}-${product.name}`)}`;
    } else if (configType === 'vmess') {
      const vmessConfig = {
        v: '2',
        ps: `${user.username || user.firstName}-${product.name}`,
        add: serverAddress,
        port: '443',
        id: uuid,
        aid: '0',
        net: 'ws',
        type: 'none',
        host: 'example.com',
        path: '/vmess',
        tls: 'tls',
        sni: 'example.com'
      };
      configData = 'vmess://' + Buffer.from(JSON.stringify(vmessConfig)).toString('base64');
    } else if (configType === 'trojan') {
      configData = `trojan://${uuid}@${serverAddress}:443?security=tls&sni=example.com&type=ws&host=example.com&path=%2Ftrojan#${encodeURIComponent(`${user.username || user.firstName}-${product.name}`)}`;
    } else {
      throw new Error(`Неподдерживаемый тип конфигурации: ${configType}`);
    }
    
    // Create VPN configuration
    const vpnConfig = await storage.createVpnConfig({
      userId: userId,
      configType: configType,
      name: `${product.name} (${configType.toUpperCase()})`,
      configData: configData,
      validUntil: validUntil,
      isActive: true,
      xUiClientId: Math.floor(Math.random() * 1000000) // Random client ID
    });
    
    return vpnConfig;
  }
  
  // Check if user is an admin
  async function isAdmin(telegramId: string): Promise<boolean> {
    const adminIdsSetting = await storage.getSetting("telegram_admin_ids");
    if (!adminIdsSetting || !adminIdsSetting.value) return false;
    
    const adminIds = adminIdsSetting.value.split(',').map(id => id.trim());
    return adminIds.includes(telegramId);
  }
  
  // Handle /admin command for administrators
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    // Check if user is admin
    if (!(await isAdmin(telegramId))) {
      bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
      return;
    }
    
    // Get statistics for quick overview
    const users = await storage.getAllUsers();
    const activeUsers = users.filter(user => !user.isBlocked).length;
    
    const orders = await storage.getAllOrders();
    const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'awaiting_confirmation').length;
    
    let adminMessage = "🔐 *Панель администратора*\n\n";
    adminMessage += `👥 Пользователей: ${users.length} (активных: ${activeUsers})\n`;
    adminMessage += `🛍️ Ожидающих заказов: ${pendingOrders}\n\n`;
    adminMessage += "Выберите действие:";
    
    bot.sendMessage(chatId, adminMessage, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 Управление пользователями", callback_data: "admin_users" }],
          [{ text: "✉️ Отправить сообщение", callback_data: "admin_message" }],
          [{ text: "📊 Полная статистика", callback_data: "admin_stats" }],
          [{ text: "⚙️ Настройки бота", callback_data: "admin_settings" }]
        ]
      }
    });
    
    // Also update the user's keyboard with the admin button
    const keyboardButtons = [
      [{ text: "📦 Продукты" }, { text: "🔐 Мои конфигурации" }],
      [{ text: "❓ Помощь" }, { text: "👤 Профиль" }],
      [{ text: "⚙️ Админ-панель" }]
    ];
    
    bot.sendMessage(chatId, "Для быстрого доступа к панели администратора используйте кнопку ⚙️ Админ-панель ниже.", {
      reply_markup: {
        keyboard: keyboardButtons,
        resize_keyboard: true
      }
    });
  });
  
  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const firstName = msg.from?.first_name || '';
    const lastName = msg.from?.last_name || '';
    const username = msg.from?.username || telegramId || '';
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    // Check if user exists
    let user = await storage.getUserByTelegramId(telegramId);
    
    // Create user if not exists
    if (!user) {
      user = await storage.createUser({
        telegramId,
        username,
        firstName,
        lastName,
        isBlocked: false,
        registrationDate: new Date()
      });
    }
    
    // Send welcome message
    const welcomeSetting = await storage.getSetting("welcome_message");
    const welcomeMessage = welcomeSetting?.value || "Добро пожаловать!";
    
    // Check if user is admin and add admin button if needed
    const isUserAdmin = await isAdmin(telegramId);
    const keyboardButtons = [
      [{ text: "📦 Продукты" }, { text: "🔐 Мои конфигурации" }],
      [{ text: "❓ Помощь" }, { text: "👤 Профиль" }]
    ];
    
    if (isUserAdmin) {
      keyboardButtons.push([{ text: "⚙️ Админ-панель" }]);
    }
    
    bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        keyboard: keyboardButtons,
        resize_keyboard: true
      }
    });
  });
  
  // Handle "Продукты" button
  bot.onText(/📦 Продукты/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    // Проверка блокировки пользователя
    const user = await storage.getUserByTelegramId(telegramId);
    if (user?.isBlocked) {
      bot.sendMessage(chatId, "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки.");
      return;
    }
    
    const products = await storage.getActiveProducts();
    
    if (products.length === 0) {
      bot.sendMessage(chatId, "В настоящее время продукты недоступны.");
      return;
    }
    
    // Отправляем информационное сообщение о продуктах
    await bot.sendMessage(chatId, "🔰 *Наши VPN-тарифы*\n\nВыберите подходящий вам тариф. Используйте стрелки для просмотра всех вариантов.", {
      parse_mode: "Markdown"
    });
    
    // Показываем карусель продуктов, начиная с первого продукта
    await showProductCarousel(chatId, products, 0);
  });
  
  // Handle product selection (number input)
  bot.onText(/^[1-9]\d*$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    const productNumber = parseInt(msg.text || "0", 10);
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    // Проверка блокировки пользователя
    const user = await storage.getUserByTelegramId(telegramId);
    if (!user) {
      bot.sendMessage(chatId, "Пользователь не найден. Введите /start для регистрации.");
      return;
    }
    
    if (user.isBlocked) {
      bot.sendMessage(chatId, "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки.");
      return;
    }
    
    const products = await storage.getActiveProducts();
    
    if (productNumber <= 0 || productNumber > products.length) {
      return; // Not a valid product number
    }
    
    const selectedProduct = products[productNumber - 1];
    
    // Create pending order
    const order = await storage.createOrder({
      userId: user.id,
      productId: selectedProduct.id,
      amount: selectedProduct.price,
      status: "pending"
    });
    
    // Format payment instructions
    const productPrice = (selectedProduct.price / 100).toFixed(2);
    
    // Get payment info from settings
    const paymentInfoSetting = await storage.getSetting("payment_info");
    const paymentInfo = paymentInfoSetting?.value || "1. Банковская карта: 5000 0000 0000 0000\n2. СБП по номеру телефона: +7 (999) 000-00-00";
    
    let message = `🛒 *Новый заказ #${order.id}*\n\n`;
    message += `Продукт: ${selectedProduct.name}\n`;
    message += `Цена: ${productPrice} руб.\n\n`;
    message += "Способы оплаты:\n";
    message += paymentInfo + "\n\n";
    message += "После оплаты, нажмите кнопку ниже и отправьте скриншот подтверждения платежа.";
    
    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Я оплатил", callback_data: `payment_${order.id}` }],
          [{ text: "❌ Отменить заказ", callback_data: `cancel_${order.id}` }]
        ]
      }
    });
  });
  
  // Handle callback queries
  bot.on("callback_query", async (query) => {
    if (!query.data || !query.message) return;
    
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    
    // Проверка блокировки пользователя (кроме админского функционала)
    if (!query.data.startsWith('admin_')) {
      const user = await storage.getUserByTelegramId(telegramId);
      if (user?.isBlocked) {
        bot.answerCallbackQuery(query.id, {
          text: "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки."
        });
        return;
      }
    }
    
    // Handle help menu buttons
    if (query.data === "help_products") {
      // Ответ на кнопку в меню помощи для просмотра тарифов
      bot.answerCallbackQuery(query.id);
      
      // Показываем тарифы
      const products = await storage.getActiveProducts();
      
      if (products.length === 0) {
        bot.sendMessage(chatId, "В настоящее время продукты недоступны.");
        return;
      }
      
      // Отправляем информационное сообщение о продуктах
      await bot.sendMessage(chatId, "🔰 *Наши VPN-тарифы*\n\nВыберите подходящий вам тариф. Используйте стрелки для просмотра всех вариантов.", {
        parse_mode: "Markdown"
      });
      
      // Показываем карусель продуктов, начиная с первого продукта
      await showProductCarousel(chatId, products, 0);
      return;
    }
    
    if (query.data === "help_configs") {
      // Ответ на кнопку в меню помощи для просмотра конфигураций
      bot.answerCallbackQuery(query.id);
      
      // Получаем пользователя
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        bot.sendMessage(chatId, "Пользователь не найден.");
        return;
      }
      
      // Получаем активные конфигурации пользователя
      const configs = await storage.getUserVpnConfigs(user.id);
      const activeConfigs = configs.filter(config => {
        const now = new Date();
        return config.isActive && config.validUntil > now;
      });
      
      if (activeConfigs.length === 0) {
        bot.sendMessage(chatId, "У вас пока нет активных VPN-конфигураций. Приобретите тариф в разделе «📦 Продукты».");
        return;
      }
      
      // Формируем сообщение со списком конфигураций
      let message = "🔐 *Ваши активные VPN-конфигурации*\n\n";
      activeConfigs.forEach((config, index) => {
        const validUntil = new Date(config.validUntil).toLocaleDateString('ru-RU');
        const daysLeft = Math.ceil((config.validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        message += `*${index + 1}. ${config.name}*\n`;
        message += `🟢 Тип: ${config.configType.toUpperCase()}\n`;
        message += `⏱ Действует до: ${validUntil} (${daysLeft} дн.)\n\n`;
      });
      
      // Формируем клавиатуру с кнопками для каждой конфигурации
      const keyboard = activeConfigs.map((config, index) => [
        { text: `Скачать ${config.name}`, callback_data: `config_${config.id}` },
        { text: `QR-код для ${config.name}`, callback_data: `qr_${config.id}` }
      ]);
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      return;
    }
    
    if (query.data === "help_profile") {
      // Ответ на кнопку в меню помощи для просмотра профиля
      bot.answerCallbackQuery(query.id);
      
      // Получаем пользователя
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        bot.sendMessage(chatId, "Пользователь не найден.");
        return;
      }
      
      // Получаем данные для профиля
      const orders = await storage.getUserOrders(user.id);
      const configs = await storage.getUserVpnConfigs(user.id);
      
      const activeConfigs = configs.filter(config => {
        const now = new Date();
        return config.isActive && config.validUntil > now;
      });
      
      // Count completed orders
      const completedOrders = orders.filter(order => order.status === 'completed').length;
      const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'awaiting_confirmation').length;
      
      // Calculate total spent
      const totalSpent = orders
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + order.amount, 0) / 100;
      
      let message = `👤 *Профиль пользователя*\n\n`;
      message += `📋 *Личная информация:*\n`;
      message += `Имя: ${user.firstName} ${user.lastName || ''}\n`;
      message += `Имя пользователя: @${user.username}\n`;
      message += `Дата регистрации: ${user.registrationDate.toLocaleDateString()}\n\n`;
      
      message += `🛒 *История заказов:*\n`;
      message += `Всего заказов: ${orders.length}\n`;
      message += `Выполненных: ${completedOrders}\n`;
      message += `Ожидающих: ${pendingOrders}\n`;
      message += `Потрачено: ${totalSpent.toFixed(2)} руб.\n\n`;
      
      message += `🔐 *VPN конфигурации:*\n`;
      message += `Всего конфигураций: ${configs.length}\n`;
      message += `Активных конфигураций: ${activeConfigs.length}\n\n`;
      
      message += `📞 *Поддержка:*\n`;
      message += `Если у вас возникли вопросы или проблемы с VPN, свяжитесь с нашей технической поддержкой, нажав на кнопку ниже.`;
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📮 Написать в поддержку", callback_data: "contact_support" }],
            [{ text: "📦 Купить новую конфигурацию", callback_data: "show_products" }]
          ]
        }
      });
      return;
    }
    
    // Обработка запроса связи с поддержкой
    if (query.data === "contact_support") {
      bot.answerCallbackQuery(query.id);
      
      // Получаем контакты поддержки из настроек
      const supportContactSetting = await storage.getSetting("support_contact");
      const supportContact = supportContactSetting?.value || "@support_username"; // Дефолтное значение
      
      let message = `📞 *Техническая поддержка*\n\n`;
      message += `Для решения любых вопросов, связанных с использованием VPN-сервиса, обращайтесь:\n\n`;
      message += `• Телеграм: ${supportContact}\n`;
      message += `• Время работы: 24/7\n\n`;
      message += `Пожалуйста, при обращении указывайте ваш ID в системе: \`${telegramId}\``;
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown"
      });
      return;
    }
    
    // Показать все продукты (из разных мест)
    if (query.data === "show_products") {
      bot.answerCallbackQuery(query.id);
      
      const products = await storage.getActiveProducts();
      
      if (products.length === 0) {
        bot.sendMessage(chatId, "В настоящее время продукты недоступны.");
        return;
      }
      
      // Отправляем информационное сообщение о продуктах
      await bot.sendMessage(chatId, "🔰 *Наши VPN-тарифы*\n\nВыберите подходящий вам тариф. Используйте стрелки для просмотра всех вариантов.", {
        parse_mode: "Markdown"
      });
      
      // Показываем карусель продуктов, начиная с первого продукта
      await showProductCarousel(chatId, products, 0);
      return;
    }
    
    // Handle navigation between product carousel pages
    if (query.data.startsWith("product_show_")) {
      const showIndex = parseInt(query.data.split("_")[2], 10);
      
      const products = await storage.getActiveProducts();
      if (showIndex >= 0 && showIndex < products.length) {
        // Clear the previous message
        await bot.deleteMessage(chatId, query.message.message_id);
        // Show the new product
        await showProductCarousel(chatId, products, showIndex);
      }
      
      return;
    }
    
    // Handle free product testing (admin only)
    if (query.data.startsWith("product_free_")) {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.answerCallbackQuery(query.id, {
          text: "Эта функция доступна только администраторам",
          show_alert: true
        });
        return;
      }
      
      const productId = parseInt(query.data.split("_")[2], 10);
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        bot.answerCallbackQuery(query.id, {
          text: "Пользователь не найден. Введите /start для регистрации.",
          show_alert: true
        });
        return;
      }
      
      try {
        // Create order record
        const product = await storage.getProduct(productId);
        
        if (!product) {
          bot.answerCallbackQuery(query.id, {
            text: "Продукт не найден",
            show_alert: true
          });
          return;
        }
        
        const order = await storage.createOrder({
          userId: user.id,
          productId: product.id,
          amount: 0, // Free for testing
          status: "completed"
        });
        
        // Generate random VPN config
        const vpnConfig = await generateRandomVpnConfig(user.id, productId);
        
        // Associate config with order
        await storage.updateOrderConfig(order.id, vpnConfig.id);
        
        // Send confirmation to admin
        const configType = vpnConfig.configType.toUpperCase();
        const validUntil = new Date(vpnConfig.validUntil).toLocaleDateString('ru-RU');
        
        let message = `✅ *Тестовая конфигурация создана успешно*\n\n`;
        message += `🔑 *ID конфигурации:* ${vpnConfig.id}\n`;
        message += `📋 *Тип:* ${configType}\n`;
        message += `📅 *Действительна до:* ${validUntil}\n\n`;
        message += `Используйте команду /my_configs для просмотра всех ваших конфигураций.`;
        
        bot.sendMessage(chatId, message, {
          parse_mode: "Markdown"
        });
        
      } catch (error: any) {
        bot.answerCallbackQuery(query.id, {
          text: `Ошибка при создании конфигурации: ${error.message}`,
          show_alert: true
        });
      }
      
      return;
    }
    
    // Handle product sharing
    if (query.data.startsWith("product_share_")) {
      const productId = parseInt(query.data.split("_")[2], 10);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        bot.answerCallbackQuery(query.id, {
          text: "Продукт не найден",
          show_alert: true
        });
        return;
      }
      
      const botSetting = await storage.getSetting("telegram_bot_link");
      const botLink = botSetting?.value || "https://t.me/your_bot";
      
      const productPrice = (product.price / 100).toFixed(2);
      let protocolIcon = '';
      switch (product.configType.toLowerCase()) {
        case 'vless': protocolIcon = '🟠'; break;
        case 'vmess': protocolIcon = '🟣'; break;
        case 'trojan': protocolIcon = '🔵'; break;
        default: protocolIcon = '⚫';
      }
      
      // Create sharable message
      let message = `💎 *${product.name}*\n\n`;
      message += `${protocolIcon} *Протокол:* ${product.configType.toUpperCase()}\n`;
      message += `⏱ *Срок действия:* ${product.durationDays} дней\n`;
      message += `💰 *Цена:* ${productPrice} руб.\n\n`;
      message += `📝 *Описание:*\n${product.description || 'Нет описания'}\n\n`;
      message += `🔗 Подключиться и купить: ${botLink}`;
      
      // Send as a separate message that can be forwarded (using text message instead of photo)
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
      
      bot.answerCallbackQuery(query.id, {
        text: "Сообщение для пересылки создано. Вы можете переслать его другим пользователям."
      });
      
      return;
    }
    
    // Handle direct purchase
    if (query.data.startsWith("product_buy_")) {
      const productId = parseInt(query.data.split("_")[2], 10);
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        bot.answerCallbackQuery(query.id, {
          text: "Пользователь не найден. Введите /start для регистрации.",
          show_alert: true
        });
        return;
      }
      
      const product = await storage.getProduct(productId);
      if (!product) {
        bot.answerCallbackQuery(query.id, {
          text: "Продукт не найден",
          show_alert: true
        });
        return;
      }
      
      // Create pending order
      const order = await storage.createOrder({
        userId: user.id,
        productId: product.id,
        amount: product.price,
        status: "pending"
      });
      
      // Format payment instructions
      const productPrice = (product.price / 100).toFixed(2);
      
      // Get payment info from settings
      const paymentInfoSetting = await storage.getSetting("payment_info");
      const paymentInfo = paymentInfoSetting?.value || "1. Банковская карта: 5000 0000 0000 0000\n2. СБП по номеру телефона: +7 (999) 000-00-00";
      
      let message = `🛒 *Новый заказ #${order.id}*\n\n`;
      message += `Продукт: ${product.name}\n`;
      message += `Цена: ${productPrice} руб.\n\n`;
      message += "Способы оплаты:\n";
      message += paymentInfo + "\n\n";
      message += "После оплаты, нажмите кнопку ниже и отправьте скриншот подтверждения платежа.";
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Я оплатил", callback_data: `payment_${order.id}` }],
            [{ text: "❌ Отменить заказ", callback_data: `cancel_${order.id}` }]
          ]
        }
      });
      
      return;
    }
    
    // Admin panel features
    if (query.data === "admin_users") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      // Get all users
      const users = await storage.getAllUsers();
      
      if (users.length === 0) {
        bot.sendMessage(chatId, "Пользователи не найдены.");
        return;
      }
      
      // Show first page of users (10 users)
      const pageSize = 10;
      let message = "👥 *Список пользователей*\n\n";
      
      const displayUsers = users.slice(0, pageSize);
      displayUsers.forEach((user, index) => {
        message += `${index + 1}. ${user.firstName} ${user.lastName || ''} (@${user.username})\n`;
        message += `   ID: ${user.id} | Telegram ID: ${user.telegramId}\n`;
        message += `   Статус: ${user.isBlocked ? '🔴 Заблокирован' : '🟢 Активен'}\n\n`;
      });
      
      const totalUsers = users.length;
      const totalPages = Math.ceil(totalUsers / pageSize);
      message += `Страница 1 из ${totalPages} (всего ${totalUsers} пользователей)`;
      
      const keyboard = displayUsers.map(user => [
        { 
          text: `${user.isBlocked ? '🔓 Разблокировать' : '🔒 Заблокировать'} ${user.firstName}`, 
          callback_data: `admin_toggle_block_${user.id}_${user.isBlocked ? 'unblock' : 'block'}` 
        },
        { 
          text: `✉️ Сообщение ${user.firstName}`, 
          callback_data: `admin_message_user_${user.id}` 
        }
      ]);
      
      // Add navigation buttons if needed
      if (totalPages > 1) {
        keyboard.push([
          { text: "⬅️ Пред.", callback_data: "admin_users_prev_0" },
          { text: "След. ➡️", callback_data: "admin_users_next_2" }
        ]);
      }
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } else if (query.data.startsWith("admin_toggle_block_")) {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const parts = query.data.split("_");
      const userId = parseInt(parts[3], 10);
      const action = parts[4]; // 'block' or 'unblock'
      
      const user = await storage.getUser(userId);
      if (!user) {
        bot.sendMessage(chatId, "Пользователь не найден.");
        return;
      }
      
      // Toggle block status
      const isBlocked = action === 'block';
      await storage.blockUser(userId, isBlocked);
      
      // Notify admin
      bot.sendMessage(chatId, `Пользователь ${user.firstName} ${user.lastName || ''} (@${user.username}) ${isBlocked ? 'заблокирован' : 'разблокирован'}.`);
      
      // Notify user
      if (user.telegramId) {
        const message = isBlocked
          ? "Ваш аккаунт был заблокирован администратором. Обратитесь в поддержку для уточнения деталей."
          : "Ваш аккаунт был разблокирован администратором. Теперь вы можете продолжить пользоваться сервисом.";
        
        bot.sendMessage(user.telegramId, message);
      }
    } else if (query.data === "admin_message") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      // Show message options
      bot.sendMessage(chatId, "Выберите получателя сообщения:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Сообщение всем пользователям", callback_data: "admin_message_all" }],
            [{ text: "🔍 Выбрать пользователя", callback_data: "admin_users" }]
          ]
        }
      });
    } else if (query.data === "admin_message_all") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      // Set up context for admin to send broadcast message
      bot.sendMessage(chatId, "Введите сообщение для отправки ВСЕМ пользователям:", {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        // Add listener for the next message from this admin
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const messageText = msg.text;
          
          if (!messageText) {
            bot.sendMessage(chatId, "Сообщение не может быть пустым.");
            return;
          }
          
          // Send to all users
          const users = await storage.getAllUsers();
          const activeUsers = users.filter(user => !user.isBlocked && user.telegramId);
          
          let successCount = 0;
          let failCount = 0;
          
          // Send message with progress updates
          const progressMsg = await bot.sendMessage(chatId, "Отправка сообщений...");
          
          for (let i = 0; i < activeUsers.length; i++) {
            const user = activeUsers[i];
            if (user.telegramId) {
              try {
                await bot.sendMessage(user.telegramId, `*Сообщение от администратора:*\n\n${messageText}`, {
                  parse_mode: "Markdown"
                });
                successCount++;
                
                // Update progress every 5 users or at the end
                if (i % 5 === 0 || i === activeUsers.length - 1) {
                  await bot.editMessageText(
                    `Отправка сообщений... ${i + 1} из ${activeUsers.length} (${successCount} успешно, ${failCount} ошибок)`,
                    { chat_id: chatId, message_id: progressMsg.message_id }
                  );
                }
              } catch (error: any) {
                failCount++;
                console.error(`Ошибка отправки сообщения пользователю ${user.id}: ${error.message}`);
              }
            }
          }
          
          // Final result
          bot.editMessageText(
            `✅ Отправка завершена\n\nОтправлено: ${successCount} пользователям\nОшибок: ${failCount}`,
            { chat_id: chatId, message_id: progressMsg.message_id }
          );
        });
      });
    } else if (query.data.startsWith("admin_message_user_")) {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const userId = parseInt(query.data.split("_")[3], 10);
      
      const user = await storage.getUser(userId);
      if (!user) {
        bot.sendMessage(chatId, "Пользователь не найден.");
        return;
      }
      
      // Set up context for admin to send message
      bot.sendMessage(chatId, `Введите сообщение для отправки пользователю ${user.firstName} ${user.lastName || ''} (@${user.username}):`, {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        // Add listener for the next message from this admin
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const messageText = msg.text;
          
          if (!messageText) {
            bot.sendMessage(chatId, "Сообщение не может быть пустым.");
            return;
          }
          
          if (!user.telegramId) {
            bot.sendMessage(chatId, "Невозможно отправить сообщение: у пользователя нет Telegram ID.");
            return;
          }
          
          // Send message to user
          try {
            await bot.sendMessage(user.telegramId, `*Сообщение от администратора:*\n\n${messageText}`, {
              parse_mode: "Markdown"
            });
            
            bot.sendMessage(chatId, `Сообщение успешно отправлено пользователю ${user.firstName} ${user.lastName || ''} (@${user.username}).`);
          } catch (error: any) {
            bot.sendMessage(chatId, `Ошибка при отправке сообщения: ${error.message}`);
          }
        });
      });
    } else if (query.data === "admin_settings") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      // Get current settings
      const welcomeMessage = await storage.getSetting("welcome_message");
      const helpMessage = await storage.getSetting("help_message");
      const orderCompletedMessage = await storage.getSetting("order_completed_message");
      const adminIds = await storage.getSetting("telegram_admin_ids");
      const paymentInfo = await storage.getSetting("payment_info");
      
      let message = "⚙️ *Настройки бота*\n\n";
      message += "Доступные настройки:\n";
      message += "1. Приветственное сообщение\n";
      message += "2. Текст справки\n";
      message += "3. Сообщение о выполнении заказа\n";
      message += "4. ID администраторов\n";
      message += "5. Информация об оплате\n";
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📝 Изменить приветствие", callback_data: "admin_settings_welcome" }],
            [{ text: "📝 Изменить справку", callback_data: "admin_settings_help" }],
            [{ text: "📝 Изменить сообщение о заказе", callback_data: "admin_settings_order" }],
            [{ text: "👥 Изменить админов", callback_data: "admin_settings_admins" }],
            [{ text: "💰 Изменить информацию об оплате", callback_data: "admin_settings_payment" }]
          ]
        }
      });
    } else if (query.data === "admin_settings_welcome") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const currentSetting = await storage.getSetting("welcome_message");
      const currentValue = currentSetting?.value || "Добро пожаловать!";
      
      bot.sendMessage(chatId, `Текущее приветственное сообщение:\n\n${currentValue}\n\nВведите новое приветственное сообщение:`, {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const newValue = msg.text;
          
          if (!newValue) {
            bot.sendMessage(chatId, "Сообщение не может быть пустым.");
            return;
          }
          
          await storage.updateSetting("welcome_message", newValue);
          bot.sendMessage(chatId, "✅ Приветственное сообщение обновлено.");
        });
      });
    } else if (query.data === "admin_settings_help") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const currentSetting = await storage.getSetting("help_message");
      const currentValue = currentSetting?.value || "Этот бот позволяет приобрести доступ к VPN сервису. Используйте кнопки меню для навигации.";
      
      bot.sendMessage(chatId, `Текущий текст справки:\n\n${currentValue}\n\nВведите новый текст справки:`, {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const newValue = msg.text;
          
          if (!newValue) {
            bot.sendMessage(chatId, "Сообщение не может быть пустым.");
            return;
          }
          
          await storage.updateSetting("help_message", newValue);
          bot.sendMessage(chatId, "✅ Текст справки обновлен.");
        });
      });
    } else if (query.data === "admin_settings_order") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const currentSetting = await storage.getSetting("order_completed_message");
      const currentValue = currentSetting?.value || "Ваш заказ выполнен! Конфигурация готова.";
      
      bot.sendMessage(chatId, `Текущее сообщение о выполнении заказа:\n\n${currentValue}\n\nВведите новое сообщение:`, {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const newValue = msg.text;
          
          if (!newValue) {
            bot.sendMessage(chatId, "Сообщение не может быть пустым.");
            return;
          }
          
          await storage.updateSetting("order_completed_message", newValue);
          bot.sendMessage(chatId, "✅ Сообщение о выполнении заказа обновлено.");
        });
      });
    } else if (query.data === "admin_settings_admins") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const currentSetting = await storage.getSetting("telegram_admin_ids");
      const currentValue = currentSetting?.value || telegramId;
      
      bot.sendMessage(chatId, `Текущие ID администраторов:\n\n${currentValue}\n\nВведите новые ID администраторов (через запятую):`, {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const newValue = msg.text;
          
          if (!newValue) {
            bot.sendMessage(chatId, "Список не может быть пустым.");
            return;
          }
          
          // Validate input (simple check)
          const adminIds = newValue.split(",").map(id => id.trim());
          if (adminIds.some(id => !/^\d+$/.test(id))) {
            bot.sendMessage(chatId, "Ошибка: ID администраторов должны содержать только цифры. Попробуйте снова.");
            return;
          }
          
          // Make sure current admin is still in the list
          if (!adminIds.includes(telegramId)) {
            adminIds.push(telegramId);
            bot.sendMessage(chatId, "Примечание: ваш ID был добавлен в список, чтобы вы не потеряли доступ.");
          }
          
          await storage.updateSetting("telegram_admin_ids", adminIds.join(","));
          bot.sendMessage(chatId, "✅ Список администраторов обновлен.");
        });
      });
    } else if (query.data === "admin_settings_payment") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      const currentSetting = await storage.getSetting("payment_info");
      const currentValue = currentSetting?.value || "1. Банковская карта: 5000 0000 0000 0000\n2. СБП по номеру телефона: +7 (999) 000-00-00";
      
      bot.sendMessage(chatId, `Текущая информация об оплате:\n\n${currentValue}\n\nВведите новую информацию об оплате:`, {
        reply_markup: {
          force_reply: true
        }
      }).then(sentMsg => {
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (msg) => {
          const newValue = msg.text;
          
          if (!newValue) {
            bot.sendMessage(chatId, "Информация не может быть пустой.");
            return;
          }
          
          await storage.updateSetting("payment_info", newValue);
          bot.sendMessage(chatId, "✅ Информация об оплате обновлена.");
        });
      });
    } else if (query.data === "show_products") {
      // Show available products
      const products = await storage.getActiveProducts();
      
      if (products.length === 0) {
        bot.sendMessage(chatId, "В настоящее время продукты недоступны.");
        return;
      }
      
      let message = "Доступные продукты:\n\n";
      products.forEach((product, index) => {
        message += `${index + 1}. ${product.name}\n`;
        message += `   Цена: ${(product.price / 100).toFixed(2)} руб.\n`;
        message += `   Тип: ${product.configType.toUpperCase()}\n`;
        message += `   Срок: ${product.durationDays} дней\n\n`;
      });
      
      message += "Для покупки, введите номер продукта. Например: 1";
      
      bot.sendMessage(chatId, message);
    } else if (query.data === "show_orders") {
      // Get user by Telegram ID
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        bot.sendMessage(chatId, "Пользователь не найден. Введите /start для регистрации.");
        return;
      }
      
      // Get user orders
      const orders = await storage.getUserOrders(user.id);
      
      if (orders.length === 0) {
        bot.sendMessage(chatId, "У вас пока нет заказов.");
        return;
      }
      
      // Sort orders by date (newest first)
      orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      let message = "🛒 *История заказов*\n\n";
      
      for (const order of orders) {
        // Get product details
        const product = await storage.getProduct(order.productId);
        if (!product) continue;
        
        message += `*Заказ #${order.id}*\n`;
        message += `Продукт: ${product.name}\n`;
        message += `Статус: ${getOrderStatusText(order.status || 'pending')}\n`;
        message += `Цена: ${(order.amount / 100).toFixed(2)} руб.\n`;
        message += `Дата: ${order.createdAt.toLocaleDateString()}\n\n`;
      }
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Вернуться в профиль", callback_data: "back_to_profile" }]
          ]
        }
      });
    } else if (query.data === "back_to_profile") {
      // Get user by Telegram ID
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        bot.sendMessage(chatId, "Пользователь не найден. Введите /start для регистрации.");
        return;
      }
      
      const orders = await storage.getUserOrders(user.id);
      const configs = await storage.getUserVpnConfigs(user.id);
      
      const activeConfigs = configs.filter(config => {
        const now = new Date();
        return config.isActive && config.validUntil > now;
      });
      
      // Count completed orders
      const completedOrders = orders.filter(order => order.status === 'completed').length;
      const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'awaiting_confirmation').length;
      
      // Calculate total spent
      const totalSpent = orders
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + order.amount, 0) / 100;
      
      let message = `👤 *Профиль пользователя*\n\n`;
      message += `📋 *Личная информация:*\n`;
      message += `Имя: ${user.firstName} ${user.lastName || ''}\n`;
      message += `Имя пользователя: @${user.username}\n`;
      message += `Дата регистрации: ${user.registrationDate.toLocaleDateString()}\n\n`;
      
      message += `🛒 *История заказов:*\n`;
      message += `Всего заказов: ${orders.length}\n`;
      message += `Выполненных: ${completedOrders}\n`;
      message += `Ожидающих: ${pendingOrders}\n`;
      message += `Потрачено: ${totalSpent.toFixed(2)} руб.\n\n`;
      
      message += `🔐 *VPN конфигурации:*\n`;
      message += `Всего конфигураций: ${configs.length}\n`;
      message += `Активных конфигураций: ${activeConfigs.length}\n`;
      
      // List active configs
      if (activeConfigs.length > 0) {
        message += "\nВаши активные конфигурации:\n";
        activeConfigs.forEach((config, index) => {
          const daysLeft = Math.ceil((config.validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          message += `${index + 1}. ${config.name}\n`;
          message += `   Тип: ${config.configType.toUpperCase()}\n`;
          message += `   Осталось дней: ${daysLeft}\n`;
        });
      }
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📦 Купить новую конфигурацию", callback_data: "show_products" }],
            [{ text: "🛒 История заказов", callback_data: "show_orders" }]
          ]
        }
      });
    } else if (query.data === "admin_stats") {
      // Check if user is admin
      if (!(await isAdmin(telegramId))) {
        bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
        return;
      }
      
      // Get statistics
      const users = await storage.getAllUsers();
      const activeUsers = users.filter(user => !user.isBlocked).length;
      const blockedUsers = users.filter(user => user.isBlocked).length;
      
      const orders = await storage.getAllOrders();
      const completedOrders = orders.filter(order => order.status === 'completed').length;
      const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'awaiting_confirmation').length;
      const cancelledOrders = orders.filter(order => order.status === 'cancelled').length;
      
      const totalRevenue = orders
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + order.amount, 0) / 100; // Convert from cents to rubles
      
      const products = await storage.getAllProducts();
      const activeProducts = products.filter(product => product.isActive).length;
      
      let message = "📊 *Статистика системы*\n\n";
      message += "👥 *Пользователи:*\n";
      message += `Всего: ${users.length}\n`;
      message += `Активных: ${activeUsers}\n`;
      message += `Заблокированных: ${blockedUsers}\n\n`;
      
      message += "🛒 *Заказы:*\n";
      message += `Всего: ${orders.length}\n`;
      message += `Выполненных: ${completedOrders}\n`;
      message += `Ожидающих: ${pendingOrders}\n`;
      message += `Отмененных: ${cancelledOrders}\n\n`;
      
      message += "💰 *Продажи:*\n";
      message += `Общая выручка: ${totalRevenue.toFixed(2)} руб.\n\n`;
      
      message += "📦 *Продукты:*\n";
      message += `Всего: ${products.length}\n`;
      message += `Активных: ${activeProducts}\n`;
      
      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown"
      });
    }
    
    if (query.data.startsWith("payment_")) {
      const orderId = parseInt(query.data.split("_")[1], 10);
      
      // Update order status
      const order = await storage.getOrder(orderId);
      if (!order) {
        bot.sendMessage(chatId, "Заказ не найден.");
        return;
      }
      
      await storage.updateOrderStatus(orderId, "awaiting_confirmation");
      
      // Ask for payment proof
      const confirmationSetting = await storage.getSetting("payment_confirmation_message");
      const confirmationMessage = confirmationSetting?.value || "Пожалуйста, отправьте скриншот платежа.";
      
      bot.sendMessage(chatId, confirmationMessage, {
        reply_markup: {
          force_reply: true
        }
      });
      
      // Store context
      bot.onReplyToMessage(chatId, query.message.message_id + 1, async (photoMsg) => {
        if (photoMsg.photo) {
          // Get the photo file
          const photoId = photoMsg.photo[photoMsg.photo.length - 1].file_id;
          
          // Save payment proof URL
          await storage.updateOrderStatus(orderId, "awaiting_confirmation");
          
          bot.sendMessage(chatId, "Спасибо! Ваша оплата проверяется администратором.");
          
          // Notify admin (should be implemented)
          const adminIds = await storage.getSetting("telegram_admin_ids");
          if (adminIds?.value) {
            const adminIdsList = adminIds.value.split(",");
            for (const adminId of adminIdsList) {
              bot.sendMessage(adminId, `Новое подтверждение оплаты для заказа #${orderId}`);
              bot.sendPhoto(adminId, photoId, {
                caption: `Заказ #${orderId} ожидает подтверждения.`,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "✅ Подтвердить", callback_data: `admin_confirm_${orderId}` },
                      { text: "❌ Отклонить", callback_data: `admin_reject_${orderId}` }
                    ]
                  ]
                }
              });
            }
          }
        } else {
          bot.sendMessage(chatId, "Пожалуйста, отправьте фото подтверждения платежа.");
        }
      });
    } else if (query.data.startsWith("cancel_")) {
      const orderId = parseInt(query.data.split("_")[1], 10);
      await storage.updateOrderStatus(orderId, "cancelled");
      bot.sendMessage(chatId, "Заказ был отменен.");
    } else if (query.data.startsWith("admin_confirm_")) {
      const orderId = parseInt(query.data.split("_")[2], 10);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        bot.sendMessage(chatId, "Заказ не найден.");
        return;
      }
      
      // Find user and product
      const user = await storage.getUser(order.userId);
      const product = await storage.getProduct(order.productId);
      
      if (!user || !product) {
        bot.sendMessage(chatId, "Ошибка: пользователь или продукт не найден.");
        return;
      }
      
      // Update order to completed
      await storage.updateOrderStatus(orderId, "completed", new Date());
      
      // Generate VPN config
      const configName = `${product.configType}-${new Date().getTime()}-${user.id}`;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + product.durationDays);
      
      // Generate sample config data
      const configData = JSON.stringify({
        type: product.configType,
        server: "your-vpn-server.com",
        port: 443,
        id: `user-${user.id}-${Date.now()}`,
        encryption: "auto",
        security: "tls"
      });
      
      // Save config
      const vpnConfig = await storage.createVpnConfig({
        userId: user.id,
        name: configName,
        configType: product.configType,
        configData,
        validUntil,
        isActive: true
      });
      
      // Associate order with config
      await storage.updateOrderConfig(order.id, vpnConfig.id);
      
      // Notify user
      if (user.telegramId) {
        const completedMessage = await storage.getSetting("order_completed_message");
        const message = completedMessage?.value || "Ваш заказ выполнен! Конфигурация готова.";
        
        bot.sendMessage(user.telegramId, message);
        
        // Send config
        bot.sendMessage(user.telegramId, "Ваша VPN конфигурация:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📥 Скачать конфигурацию", callback_data: `config_${vpnConfig.id}` }]
            ]
          }
        });
      }
      
      bot.sendMessage(chatId, `Заказ #${orderId} подтвержден, конфигурация создана.`);
    } else if (query.data.startsWith("admin_reject_")) {
      const orderId = parseInt(query.data.split("_")[2], 10);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        bot.sendMessage(chatId, "Заказ не найден.");
        return;
      }
      
      // Update order to cancelled
      await storage.updateOrderStatus(orderId, "cancelled");
      
      // Notify user
      const user = await storage.getUser(order.userId);
      if (user && user.telegramId) {
        bot.sendMessage(user.telegramId, `Ваш заказ #${orderId} был отклонен. Обратитесь в поддержку для уточнения деталей.`);
      }
      
      bot.sendMessage(chatId, `Заказ #${orderId} отклонен.`);
    } else if (query.data.startsWith("config_")) {
      const configId = parseInt(query.data.split("_")[1], 10);
      const config = await storage.getVpnConfig(configId);
      
      if (!config) {
        bot.sendMessage(chatId, "Конфигурация не найдена.");
        return;
      }
      
      // Send config file as text message
      let configMessage = `Конфигурация ${config.name}\nТип: ${config.configType.toUpperCase()}\nДействительна до: ${config.validUntil.toLocaleDateString()}\n\n`;
      configMessage += "```\n";
      configMessage += config.configData;
      configMessage += "\n```";
      
      bot.sendMessage(chatId, configMessage, {
        parse_mode: "Markdown"
      });
    }
  });
  
  // Handle "Мои конфигурации" button
  bot.onText(/🔐 Мои конфигурации/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    const user = await storage.getUserByTelegramId(telegramId);
    if (!user) {
      bot.sendMessage(chatId, "Пользователь не найден. Введите /start для регистрации.");
      return;
    }
    
    if (user.isBlocked) {
      bot.sendMessage(chatId, "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки.");
      return;
    }
    
    const configs = await storage.getUserVpnConfigs(user.id);
    
    if (configs.length === 0) {
      bot.sendMessage(chatId, "У вас нет активных VPN конфигураций. Приобретите VPN в разделе 'Продукты'.");
      return;
    }
    
    let message = "Ваши VPN конфигурации:\n\n";
    
    const now = new Date();
    configs.forEach((config, index) => {
      const isActive = config.isActive && config.validUntil > now;
      message += `${index + 1}. ${config.name}\n`;
      message += `   Тип: ${config.configType.toUpperCase()}\n`;
      message += `   Действителен до: ${config.validUntil.toLocaleDateString()}\n`;
      message += `   Статус: ${isActive ? '✅ Активен' : '❌ Неактивен'}\n\n`;
    });
    
    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: configs.map((config, index) => [
          { text: `📥 Скачать ${config.name}`, callback_data: `config_${config.id}` }
        ])
      }
    });
  });
  
  // Handle "Помощь" button
  // Support command handler
  bot.onText(/\/support/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    const user = await storage.getUserByTelegramId(telegramId);
    if (!user) {
      bot.sendMessage(chatId, "Пользователь не найден. Введите /start для регистрации.");
      return;
    }
    
    if (user.isBlocked) {
      bot.sendMessage(chatId, "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки.");
      return;
    }
    
    // Получаем контакты поддержки из настроек
    const supportContactSetting = await storage.getSetting("support_contact");
    const supportContact = supportContactSetting?.value || "@support_username"; // Дефолтное значение
    
    let message = `📞 *Техническая поддержка*\n\n`;
    message += `Для решения любых вопросов, связанных с использованием VPN-сервиса, обращайтесь:\n\n`;
    message += `• Телеграм: ${supportContact}\n`;
    message += `• Время работы: 24/7\n\n`;
    message += `Пожалуйста, при обращении указывайте ваш ID в системе: \`${telegramId}\`\n\n`;
    message += `Опишите вашу проблему или вопрос как можно подробнее:`;
    
    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown"
    });
  });
  
  bot.onText(/❓ Помощь/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    // Проверка блокировки пользователя
    const user = await storage.getUserByTelegramId(telegramId);
    if (user?.isBlocked) {
      bot.sendMessage(chatId, "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки.");
      return;
    }
    
    const helpSetting = await storage.getSetting("help_message");
    let defaultHelpMessage = `🔰 *Справка по использованию VPN-сервиса*\n\n`
    + `*📱 Как пользоваться ботом:*\n`
    + `1. Выберите и оплатите тариф в разделе «📦 Продукты»\n`
    + `2. Отправьте скриншот с подтверждением оплаты\n`
    + `3. После проверки платежа администратором, вы получите VPN-конфигурацию\n`
    + `4. Используйте конфигурацию для подключения к VPN\n\n`
    + `*📲 Как подключиться:*\n`
    + `1. Скачайте приложение V2rayNG (Android) или Shadowrocket (iOS)\n`
    + `2. Откройте раздел «🔐 Мои конфигурации» и выберите нужный VPN\n`
    + `3. Отсканируйте QR-код или скопируйте ссылку в приложение\n`
    + `4. Подключитесь одним нажатием в приложении\n\n`
    + `*❓ Частые вопросы:*\n`
    + `• Как продлить подписку? — Оплатите новый тариф в разделе «📦 Продукты»\n`
    + `• Не работает подключение? — Проверьте срок действия конфигурации\n`
    + `• Нужна помощь? — Свяжитесь с поддержкой через раздел «👤 Профиль»\n\n`
    + `*⚠️ Важно:*\n`
    + `• Одна конфигурация рассчитана на одно устройство\n`
    + `• Не передавайте свои конфигурации третьим лицам\n`
    + `• При блокировке IP-адреса вы получите новый бесплатно`;
    
    const helpMessage = helpSetting?.value || defaultHelpMessage;
    
    // Добавляем кнопки быстрого доступа к основным функциям
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "📦 Просмотреть тарифы", callback_data: "help_products" },
          { text: "🔐 Мои конфигурации", callback_data: "help_configs" }
        ],
        [
          { text: "👤 Профиль и поддержка", callback_data: "help_profile" }
        ]
      ]
    };
    
    bot.sendMessage(chatId, helpMessage, {
      parse_mode: "Markdown",
      reply_markup: inlineKeyboard
    });
  });
  
  // Handle admin panel button
  bot.onText(/⚙️ Админ-панель/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    // Check if user is admin
    if (!(await isAdmin(telegramId))) {
      bot.sendMessage(chatId, "У вас нет прав для доступа к административным функциям.");
      return;
    }
    
    bot.sendMessage(chatId, "Панель администратора", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 Управление пользователями", callback_data: "admin_users" }],
          [{ text: "✉️ Отправить сообщение", callback_data: "admin_message" }],
          [{ text: "📊 Статистика", callback_data: "admin_stats" }]
        ]
      }
    });
  });
  
  // Handle "Профиль" button
  bot.onText(/👤 Профиль/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString();
    
    if (!telegramId) {
      bot.sendMessage(chatId, "Не удалось получить информацию о пользователе.");
      return;
    }
    
    const user = await storage.getUserByTelegramId(telegramId);
    if (!user) {
      bot.sendMessage(chatId, "Пользователь не найден. Введите /start для регистрации.");
      return;
    }
    
    if (user.isBlocked) {
      bot.sendMessage(chatId, "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки.");
      return;
    }
    
    const orders = await storage.getUserOrders(user.id);
    const configs = await storage.getUserVpnConfigs(user.id);
    
    const activeConfigs = configs.filter(config => {
      const now = new Date();
      return config.isActive && config.validUntil > now;
    });
    
    // Count completed orders
    const completedOrders = orders.filter(order => order.status === 'completed').length;
    const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'awaiting_confirmation').length;
    
    // Calculate total spent
    const totalSpent = orders
      .filter(order => order.status === 'completed')
      .reduce((sum, order) => sum + order.amount, 0) / 100;
    
    let message = `👤 *Профиль пользователя*\n\n`;
    message += `📋 *Личная информация:*\n`;
    message += `Имя: ${user.firstName} ${user.lastName || ''}\n`;
    message += `Имя пользователя: @${user.username}\n`;
    message += `Дата регистрации: ${user.registrationDate.toLocaleDateString()}\n\n`;
    
    message += `🛒 *История заказов:*\n`;
    message += `Всего заказов: ${orders.length}\n`;
    message += `Выполненных: ${completedOrders}\n`;
    message += `Ожидающих: ${pendingOrders}\n`;
    message += `Потрачено: ${totalSpent.toFixed(2)} руб.\n\n`;
    
    message += `🔐 *VPN конфигурации:*\n`;
    message += `Всего конфигураций: ${configs.length}\n`;
    message += `Активных конфигураций: ${activeConfigs.length}\n`;
    
    // List active configs
    if (activeConfigs.length > 0) {
      message += "\nВаши активные конфигурации:\n";
      activeConfigs.forEach((config, index) => {
        const daysLeft = Math.ceil((config.validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        message += `${index + 1}. ${config.name}\n`;
        message += `   Тип: ${config.configType.toUpperCase()}\n`;
        message += `   Осталось дней: ${daysLeft}\n`;
      });
    }
    
    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📦 Купить новую конфигурацию", callback_data: "show_products" }],
          [{ text: "🛒 История заказов", callback_data: "show_orders" }]
        ]
      }
    });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize bot when server starts
  initBot();
  
  // Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    try {
      // Find admin by username
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Verify password
      const isPasswordValid = await storage.verifyPassword(password, admin.passwordHash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Create new session
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];
      const session = await storage.createAdminSession(admin.id, ipAddress, userAgent);
      
      // Update last login time
      await storage.updateAdmin(admin.id, { lastLogin: new Date() });
      
      // Return token and expiry
      res.json({
        token: session.token,
        username: admin.username,
        expiresAt: session.expiresAt.toISOString()
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/logout", async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    
    try {
      await storage.deleteAdminSession(token);
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/auth/verify", async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, message: "No token provided" });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const session = await storage.getAdminSessionByToken(token);
      
      if (!session) {
        return res.json({ valid: false, message: "Invalid or expired token" });
      }
      
      // Get admin info
      const admin = await storage.getAdminByUsername(session.adminId.toString());
      
      if (!admin) {
        return res.json({ valid: false, message: "Admin not found" });
      }
      
      res.json({
        valid: true,
        username: admin.username,
        expiresAt: session.expiresAt.toISOString()
      });
    } catch (error) {
      console.error("Verify token error:", error);
      res.status(500).json({ valid: false, message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/setup-admin", async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    try {
      // Check if any admin already exists
      const [firstAdmin] = await db.select().from(admins).limit(1);
      
      if (firstAdmin) {
        return res.status(403).json({ message: "Admin already set up" });
      }
      
      // Create first admin
      const admin = await storage.createAdmin({
        username,
        passwordHash: password, // hashPassword is called inside createAdmin
        email
      });
      
      res.status(201).json({
        id: admin.id,
        username: admin.username,
        email: admin.email,
        createdAt: admin.createdAt
      });
    } catch (error) {
      console.error("Setup admin error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API Routes
  // User routes
  app.get("/api/users", async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const user = await storage.getUser(id);
    
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    res.json(user);
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid user data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userData = req.body;
    
    try {
      const updatedUser = await storage.updateUser(id, userData);
      
      if (!updatedUser) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/:id/block", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { isBlocked } = req.body;
    
    if (typeof isBlocked !== 'boolean') {
      res.status(400).json({ message: "isBlocked must be a boolean" });
      return;
    }
    
    try {
      const updatedUser = await storage.blockUser(id, isBlocked);
      
      if (!updatedUser) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Product routes
  app.get("/api/products", async (req, res) => {
    const active = req.query.active === 'true';
    const products = active ? await storage.getActiveProducts() : await storage.getAllProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const product = await storage.getProduct(id);
    
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid product data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const productData = req.body;
    
    try {
      const updatedProduct = await storage.updateProduct(id, productData);
      
      if (!updatedProduct) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    
    try {
      const result = await storage.deleteProduct(id);
      
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Order routes
  app.get("/api/orders", async (req, res) => {
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    const recent = req.query.recent ? parseInt(req.query.recent as string, 10) : undefined;
    
    let orders;
    if (recent) {
      orders = await storage.getRecentOrders(recent);
    } else if (userId) {
      orders = await storage.getUserOrders(userId);
    } else {
      orders = await storage.getAllOrders();
    }
    
    res.json(orders);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const order = await storage.getOrder(id);
    
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    
    res.json(order);
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid order data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    
    try {
      const updatedOrder = await storage.updateOrderStatus(id, status);
      
      if (!updatedOrder) {
        res.status(404).json({ message: "Order not found" });
        return;
      }
      
      // If completing order and auto activation is enabled, create VPN config
      if (status === 'completed') {
        const autoActivateSetting = await storage.getSetting("auto_activate_configs");
        const autoActivate = autoActivateSetting?.value === 'true';
        
        if (autoActivate) {
          const order = await storage.getOrder(id);
          if (order) {
            const product = await storage.getProduct(order.productId);
            
            if (product) {
              const configName = `${product.configType}-${new Date().getTime()}-${order.userId}`;
              const validUntil = new Date();
              validUntil.setDate(validUntil.getDate() + product.durationDays);
              
              // Generate sample config data
              const configData = JSON.stringify({
                type: product.configType,
                server: "your-vpn-server.com",
                port: 443,
                id: `user-${order.userId}-${Date.now()}`,
                encryption: "auto",
                security: "tls"
              });
              
              // Save config
              const vpnConfig = await storage.createVpnConfig({
                userId: order.userId,
                name: configName,
                configType: product.configType,
                configData,
                validUntil,
                isActive: true
              });
              
              // Associate order with config
              await storage.updateOrderConfig(order.id, vpnConfig.id);
              
              // Notify user via Telegram if bot is initialized
              const user = await storage.getUser(order.userId);
              if (user && user.telegramId && bot) {
                const completedMessage = await storage.getSetting("order_completed_message");
                const message = completedMessage?.value || "Ваш заказ выполнен! Конфигурация готова.";
                
                bot.sendMessage(user.telegramId, message);
              }
            }
          }
        }
      }
      
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Block/Unblock user
  app.post("/api/users/:id/block", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isBlocked } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }
      
      const updatedUser = await storage.blockUser(userId, isBlocked);
      
      // If user is being blocked and there's a bot instance running, notify the user
      if (isBlocked && bot && user.telegramId) {
        try {
          await bot.sendMessage(user.telegramId, "⚠️ Ваш аккаунт был заблокирован администратором. Для выяснения причин обратитесь в службу поддержки.");
        } catch (botError) {
          console.error(`Failed to send block notification to user ${userId}:`, botError);
        }
      }
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // VPN Config routes
  app.get("/api/vpn-configs", async (req, res) => {
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    const active = req.query.active === 'true';
    
    let configs;
    if (userId) {
      configs = await storage.getUserVpnConfigs(userId);
    } else if (active) {
      configs = await storage.getActiveVpnConfigs();
    } else {
      // No direct method to get all configs, let's combine those we have access to
      const users = await storage.getAllUsers();
      configs = [];
      for (const user of users) {
        const userConfigs = await storage.getUserVpnConfigs(user.id);
        configs.push(...userConfigs);
      }
    }
    
    res.json(configs);
  });

  app.get("/api/vpn-configs/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const config = await storage.getVpnConfig(id);
    
    if (!config) {
      res.status(404).json({ message: "VPN config not found" });
      return;
    }
    
    res.json(config);
  });

  app.post("/api/vpn-configs", async (req, res) => {
    try {
      const configData = insertVpnConfigSchema.parse(req.body);
      const config = await storage.createVpnConfig(configData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid VPN config data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/vpn-configs/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const configData = req.body;
    
    try {
      const updatedConfig = await storage.updateVpnConfig(id, configData);
      
      if (!updatedConfig) {
        res.status(404).json({ message: "VPN config not found" });
        return;
      }
      
      res.json(updatedConfig);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/vpn-configs/:id/deactivate", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    
    try {
      const updatedConfig = await storage.deactivateVpnConfig(id);
      
      if (!updatedConfig) {
        res.status(404).json({ message: "VPN config not found" });
        return;
      }
      
      res.json(updatedConfig);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsArray = req.body;
      
      if (!Array.isArray(settingsArray)) {
        res.status(400).json({ message: "Settings must be an array" });
        return;
      }
      
      await storage.setSettings(settingsArray);
      
      // Reinitialize bot if telegram_bot_token was updated
      if (settingsArray.some(s => s.key === 'telegram_bot_token')) {
        await initBot();
      }
      
      const updatedSettings = await storage.getAllSettings();
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    const key = req.params.key;
    const setting = await storage.getSetting(key);
    
    if (!setting) {
      res.status(404).json({ message: "Setting not found" });
      return;
    }
    
    res.json(setting);
  });

  // Stats routes
  app.get("/api/stats", async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get("/api/stats/sales", async (req, res) => {
    const salesData = await storage.getSalesData();
    res.json(salesData);
  });

  app.get("/api/stats/popular-products", async (req, res) => {
    const popularProducts = await storage.getPopularProducts();
    res.json(popularProducts);
  });

  // Telegram bot routes
  app.post("/api/bot/restart", async (req, res) => {
    const success = await initBot();
    if (success) {
      res.json({ message: "Bot restarted successfully" });
    } else {
      res.status(500).json({ message: "Failed to restart bot" });
    }
  });

  app.post("/api/bot/check-token", async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({ message: "Token is required" });
      return;
    }
    
    try {
      const testBot = new TelegramBot(token, { polling: false });
      const botInfo = await testBot.getMe();
      
      res.json({
        success: true,
        bot_name: botInfo.first_name,
        username: botInfo.username
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid token"
      });
    }
  });
  
  // Маршрут для отправки сообщения пользователю через Telegram бота
  app.post("/api/bot/send-message", async (req, res) => {
    const { userId, message } = req.body;
    
    if (!bot) {
      return res.status(500).json({ success: false, message: "Telegram bot is not initialized" });
    }
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user || !user.telegramId) {
        return res.status(400).json({ success: false, message: "User has no Telegram ID" });
      }
      
      await bot.sendMessage(user.telegramId.toString(), message, { parse_mode: "Markdown" });
      res.json({ success: true, message: "Message sent successfully" });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ success: false, message: `Failed to send message: ${error.message}` });
    }
  });
  
  // Маршрут для массовой рассылки сообщений всем пользователям через Telegram бота
  app.post("/api/bot/broadcast", async (req, res) => {
    const { message } = req.body;
    
    if (!bot) {
      return res.status(500).json({ success: false, message: "Telegram bot is not initialized" });
    }
    
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }
    
    try {
      const users = await storage.getAllUsers();
      let sent = 0;
      let failed = 0;
      
      for (const user of users) {
        if (user.telegramId && !user.isBlocked) {
          try {
            await bot.sendMessage(user.telegramId.toString(), `*Важное сообщение:*\n\n${message}`, { 
              parse_mode: "Markdown"
            });
            sent++;
          } catch (error) {
            console.error(`Failed to send message to user ${user.id}:`, error);
            failed++;
          }
        } else {
          failed++;
        }
      }
      
      res.json({ success: true, sent, failed });
    } catch (error: any) {
      console.error("Error broadcasting message:", error);
      res.status(500).json({ success: false, message: `Failed to broadcast: ${error.message}` });
    }
  });

  // Admin Authentication routes
  // Login route
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      const isPasswordValid = await storage.verifyPassword(password, admin.passwordHash);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Create a session
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];
      const session = await storage.createAdminSession(admin.id, ipAddress, userAgent);
      
      // Update admin's last login time
      await storage.updateAdmin(admin.id, { lastLogin: new Date() });
      
      // Send token to the client
      res.json({
        token: session.token,
        username: admin.username,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Logout route
  app.post("/api/admin/logout", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      await storage.deleteAdminSession(token);
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Verify token route
  app.post("/api/admin/verify-token", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const session = await storage.getAdminSessionByToken(token);
      
      if (!session) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      // Get admin info
      const admin = await storage.getAdminByUsername(session.adminId.toString());
      
      res.json({
        valid: true,
        username: admin?.username,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Create initial admin if none exists
  app.post("/api/admin/setup", async (req, res) => {
    try {
      // Check if any admin exists
      const allAdmins = await db.select().from(admins);
      
      if (allAdmins.length > 0) {
        return res.status(400).json({ message: "Admin account already exists" });
      }
      
      const { username, password, email } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Create the admin
      const admin = await storage.createAdmin({
        username,
        passwordHash: password,
        email
      });
      
      res.json({
        message: "Admin account created successfully",
        username: admin.username
      });
    } catch (error) {
      console.error("Admin setup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Payment routes
  app.post("/api/create-payment-intent", async (req, res) => {
    if (!stripe) {
      res.status(500).json({ message: "Stripe is not configured" });
      return;
    }
    
    try {
      const { amount } = req.body;
      
      if (!amount || typeof amount !== 'number') {
        res.status(400).json({ message: "Invalid amount" });
        return;
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "rub",
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
