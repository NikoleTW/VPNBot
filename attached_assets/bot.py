"""
Telegram bot implementation for VPN configuration management
"""
import logging
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta

# Настройка логгера
logger = logging.getLogger(__name__)

# Проверка установки python-telegram-bot
try:
    # Импорт для python-telegram-bot v20+
    from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup
    from telegram.constants import ParseMode
    from telegram.ext import (
        Application, 
        CommandHandler, 
        CallbackQueryHandler, 
        MessageHandler, 
        filters,
        ContextTypes,
        ConversationHandler
    )
    import telegram.error
    # В версии 20+ CallbackQuery доступен через update.callback_query
    HAS_PTB_V20 = True
    logger.info("Успешно импортированы модули python-telegram-bot версии 20+")
except ImportError as e:
    logger.error(f"Ошибка импорта модулей python-telegram-bot: {e}")
    logger.error("Убедитесь, что установлена библиотека python-telegram-bot")
    raise

from app import db, app
from models import TelegramUser, Product, Order, VPNConfig, PaymentMethod, Settings
from vpn_utils import generate_config, format_config_for_user
from x_ui_client import XUIClient

# Set up logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Define conversation states
SELECTING_PRODUCT, CONFIRMING_PURCHASE, PAYMENT_METHOD, AWAITING_PAYMENT = range(4)

# Initialize XUI client
xui_client = XUIClient(
    base_url=os.environ.get('XUI_PANEL_URL', 'http://localhost:54321'),
    username=os.environ.get('XUI_USERNAME', 'admin'),
    password=os.environ.get('XUI_PASSWORD', 'admin')
)

# Кэширование для улучшения производительности
# Храним результаты запросов на 5 минут, чтобы уменьшить число обращений к базе данных
USER_BLOCK_CACHE = {}  # {telegram_id: (is_blocked, timestamp)}
PRODUCTS_CACHE = {}  # {cache_key: (products_list, timestamp)}
USER_CONFIGS_CACHE = {}  # {user_id: (configs_list, timestamp)}
CACHE_TTL = 300  # 5 минут (300 секунд)

async def check_user_blocked(update: Update) -> bool:
    """Проверка, заблокирован ли пользователь с кэшированием результатов"""
    user = update.effective_user
    if not user:
        return False
        
    current_time = time.time()
    user_id = user.id
    
    # Проверяем кэш сначала
    if user_id in USER_BLOCK_CACHE:
        is_blocked, timestamp = USER_BLOCK_CACHE[user_id]
        # Если кэш свежий (не старше CACHE_TTL секунд)
        if current_time - timestamp < CACHE_TTL:
            if is_blocked:
                # Если пользователь заблокирован, отправляем сообщение
                if update.callback_query:
                    await update.callback_query.answer("Вы заблокированы в системе. Свяжитесь с администратором для разблокировки.")
                    await update.callback_query.message.reply_text(
                        "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки."
                    )
                else:
                    await update.message.reply_text(
                        "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки."
                    )
                return True
            return False
    
    # Если кэша нет или он устарел, проверяем в базе данных
    with app.app_context():
        telegram_user = TelegramUser.query.filter_by(telegram_id=user_id).first()
        is_blocked = False
        
        if telegram_user and telegram_user.is_blocked:
            is_blocked = True
            # Если пользователь заблокирован, отправляем сообщение
            if update.callback_query:
                await update.callback_query.answer("Вы заблокированы в системе. Свяжитесь с администратором для разблокировки.")
                await update.callback_query.message.reply_text(
                    "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки."
                )
            else:
                await update.message.reply_text(
                    "⛔ Ваш аккаунт заблокирован. Свяжитесь с администратором для разблокировки."
                )
        
        # Обновляем кэш
        USER_BLOCK_CACHE[user_id] = (is_blocked, current_time)
        return is_blocked

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /start command"""
    user = update.effective_user
    
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
    
    # Register or get the user
    with app.app_context():
        telegram_user = TelegramUser.query.filter_by(telegram_id=user.id).first()
        if not telegram_user:
            telegram_user = TelegramUser(
                telegram_id=user.id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name
            )
            db.session.add(telegram_user)
            db.session.commit()
            
            # Логируем нового пользователя
            logger.info(f"Зарегистрирован новый пользователь: {user.first_name} (ID: {user.id})")
        
        # Получаем приветственное сообщение из настроек
        welcome_setting = Settings.query.filter_by(key='welcome_message').first()
        if welcome_setting and welcome_setting.value:
            welcome_message = welcome_setting.value.replace('{name}', user.first_name)
        else:
            welcome_message = (
                f"👋 Добро пожаловать в VPN Shop Bot, {user.first_name}!\n\n"
                "Здесь вы можете приобрести безопасные и быстрые VPN-конфигурации "
                "для обхода блокировок и защиты вашей приватности.\n\n"
                "Используйте меню для навигации:"
            )
    
    # Создаем кнопки-вкладки
    buttons = [
        [
            InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
            InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
            InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
        ],
        [
            InlineKeyboardButton("🛒 Купить VPN", callback_data="show_products")
        ],
        [
            InlineKeyboardButton("📱 Мои конфигурации", callback_data="show_configs"),
            InlineKeyboardButton("❓ Помощь", callback_data="show_help")
        ],
        [
            InlineKeyboardButton("👤 Профиль", callback_data="show_profile"),
            InlineKeyboardButton("📞 Поддержка", callback_data="show_support")
        ]
    ]
    
    # Если пользователь является администратором, добавляем ему специальную кнопку
    with app.app_context():
        admin_id_setting = Settings.query.filter_by(key='admin_telegram_id').first()
        if admin_id_setting and admin_id_setting.value:
            try:
                admin_id = int(admin_id_setting.value)
                if user.id == admin_id:
                    buttons.append([InlineKeyboardButton("⚙️ Панель администратора", callback_data="admin_panel")])
                    logger.info(f"Администратор {user.first_name} (ID: {user.id}) подключился к боту")
            except ValueError:
                logger.warning(f"Неверный формат ID администратора в настройках: {admin_id_setting.value}")
    
    # Создаем обычные кнопки для клавиатуры
    keyboard = [
        ["🛒 Купить VPN"],
        ["📱 Мои конфигурации", "❓ Помощь"],
        ["👤 Профиль", "📞 Поддержка"]
    ]
    
    # Добавляем админскую кнопку на клавиатуру если нужно
    with app.app_context():
        admin_id_setting = Settings.query.filter_by(key='admin_telegram_id').first()
        if admin_id_setting and admin_id_setting.value:
            try:
                admin_id = int(admin_id_setting.value)
                if user.id == admin_id:
                    keyboard.append(["⚙️ Панель администратора"])
            except ValueError:
                pass
    
    # Отправляем сообщение с вкладками и кнопками
    await update.message.reply_text(
        welcome_message,
        reply_markup=InlineKeyboardMarkup(buttons)
    )
    
    # Добавляем клавиатуру быстрого доступа
    await update.message.reply_text(
        "Используйте кнопки быстрого доступа:",
        reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    )

async def clear_products_cache():
    """Очистить кэш активных продуктов"""
    global PRODUCTS_CACHE
    
    cache_key = 'active_products'
    if cache_key in PRODUCTS_CACHE:
        del PRODUCTS_CACHE[cache_key]
        return True
    return False

async def get_active_products():
    """Получить список активных продуктов с кэшированием для улучшения производительности"""
    global PRODUCTS_CACHE
    
    cache_key = 'active_products'
    current_time = time.time()
    
    # Проверяем кэш сначала
    if cache_key in PRODUCTS_CACHE:
        products_list, timestamp = PRODUCTS_CACHE[cache_key]
        # Если кэш свежий (не старше CACHE_TTL секунд)
        if current_time - timestamp < CACHE_TTL:
            return products_list
    
    # Если кэша нет или он устарел, загружаем из базы данных
    with app.app_context():
        products = Product.query.filter_by(is_active=True).all()
        
        # Кэшируем результат
        PRODUCTS_CACHE[cache_key] = (products, current_time)
        
        return products

async def show_products(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Display available VPN products/packages"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return ConversationHandler.END
        
    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
    else:
        message = update.message
    
    # Используем кэшированный список продуктов
    products = await get_active_products()
    
    if not products:
        if query:
            await message.edit_text(
                "В данный момент нет доступных VPN-пакетов. Пожалуйста, попробуйте позже.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🏠 Вернуться в меню", callback_data="tab_main")
                ]])
            )
        else:
            await message.reply_text(
                "В данный момент нет доступных VPN-пакетов. Пожалуйста, попробуйте позже."
            )
        return ConversationHandler.END
    
    # Шапка с вкладками
    tabs = [
        InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
        InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
        InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
    ]
    
    text = "🛒 *Доступные VPN пакеты:*\n\nВыберите подходящий вариант:\n\n"
    buttons = []
    
    # Создаем стильные карточки продуктов
    for product in products:
        card = "┌───────────────────────┐\n"
        card += f"│ *{product.name}* \n"
        card += "├───────────────────────┤\n"
        card += f"│ ✅ Протокол: {product.config_type.upper()}\n"
        card += "│ ✅ Скорость: Без ограничений\n"
        card += "│ ✅ Трафик: Безлимитный\n"
        card += f"│ ✅ Срок: {product.duration_days} дней\n"
        card += "└───────────────────────┘\n"
        card += f"💰 Цена: *{product.price} руб.*\n\n"
        
        text += card
        
        buttons.append([InlineKeyboardButton(
            f"Выбрать {product.name}", 
            callback_data=f"product_{product.id}"
        )])
    
    buttons.append([InlineKeyboardButton("❌ Отмена", callback_data="tab_main")])
    
    # Добавляем вкладки в начало списка кнопок
    buttons.insert(0, tabs)
    
    if query:
        await message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )
    else:
        await message.reply_text(
            text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )
    
    return SELECTING_PRODUCT

async def product_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle product selection"""
    query = update.callback_query
    await query.answer()
    
    # Extract product_id from callback data
    product_id = int(query.data.split('_')[1])
    context.user_data['selected_product_id'] = product_id
    
    with app.app_context():
        product = Product.query.get(product_id)
        
        if not product:
            await query.message.edit_text(
                "Продукт не найден. Пожалуйста, выберите другой продукт.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Назад к списку", callback_data="back_to_products")
                ]])
            )
            return SELECTING_PRODUCT
        
        # Store product info in context
        context.user_data['product_info'] = {
            'id': product.id,
            'name': product.name,
            'price': product.price,
            'duration_days': product.duration_days,
            'config_type': product.config_type
        }
        
        confirmation_text = (
            f"🔍 *Детали выбранного пакета:*\n\n"
            f"*{product.name}*\n"
            f"Описание: {product.description}\n"
            f"Тип: {product.config_type.upper()}\n"
            f"Срок действия: {product.duration_days} дней\n"
            f"Цена: {product.price} руб.\n\n"
            f"Подтверждаете покупку?"
        )
        
        await query.message.edit_text(
            confirmation_text,
            reply_markup=InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Подтвердить", callback_data="confirm_purchase"),
                    InlineKeyboardButton("❌ Отмена", callback_data="cancel")
                ],
                [InlineKeyboardButton("⬅️ Назад к списку", callback_data="back_to_products")]
            ]),
            parse_mode="Markdown"
        )
        
        return CONFIRMING_PURCHASE

async def confirm_purchase(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle purchase confirmation"""
    query = update.callback_query
    await query.answer()
    
    with app.app_context():
        payment_methods = PaymentMethod.query.filter_by(is_active=True).all()
        
        if not payment_methods:
            await query.message.edit_text(
                "К сожалению, сейчас нет доступных способов оплаты. "
                "Пожалуйста, попробуйте позже или обратитесь в поддержку.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Назад", callback_data="back_to_products")
                ]])
            )
            return SELECTING_PRODUCT
        
        payment_text = "💳 Выберите способ оплаты:\n\n"
        buttons = []
        
        for method in payment_methods:
            payment_text += f"• *{method.name}*: {method.description}\n"
            buttons.append([InlineKeyboardButton(
                method.name, 
                callback_data=f"payment_{method.id}"
            )])
        
        buttons.append([InlineKeyboardButton("⬅️ Назад", callback_data="back_to_product")])
        
        await query.message.edit_text(
            payment_text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )
        
        return PAYMENT_METHOD

async def process_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle payment method selection and order creation"""
    query = update.callback_query
    await query.answer()
    
    # Extract payment_method_id from callback data
    payment_method_id = int(query.data.split('_')[1])
    
    user = update.effective_user
    product_info = context.user_data.get('product_info')
    
    with app.app_context():
        # Get payment method
        payment_method = PaymentMethod.query.get(payment_method_id)
        
        # Get or create telegram user
        telegram_user = TelegramUser.query.filter_by(telegram_id=user.id).first()
        if not telegram_user:
            telegram_user = TelegramUser(
                telegram_id=user.id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name
            )
            db.session.add(telegram_user)
            db.session.commit()
        
        # Create order
        order = Order(
            user_id=telegram_user.id,
            product_id=product_info['id'],
            amount=product_info['price'],
            status='pending'
        )
        db.session.add(order)
        db.session.commit()
        
        # Store order ID in context
        context.user_data['order_id'] = order.id
        
        # Prepare payment instructions
        payment_text = (
            f"💰 *Оплата заказа #{order.id}*\n\n"
            f"Сумма к оплате: *{order.amount} руб.*\n"
            f"Способ оплаты: *{payment_method.name}*\n\n"
            f"Инструкции по оплате:\n{payment_method.instructions}\n\n"
            f"После оплаты нажмите кнопку «Я оплатил» ниже. "
            f"Администратор проверит оплату и активирует ваш VPN."
        )
        
        await query.message.edit_text(
            payment_text,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("✅ Я оплатил", callback_data=f"paid_{order.id}")],
                [InlineKeyboardButton("❌ Отмена", callback_data="cancel_payment")]
            ]),
            parse_mode="Markdown"
        )
        
        return AWAITING_PAYMENT

async def payment_confirmed(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle user confirming payment"""
    query = update.callback_query
    await query.answer()
    
    order_id = int(query.data.split('_')[1])
    
    with app.app_context():
        order = Order.query.get(order_id)
        
        if not order:
            await query.message.edit_text(
                "Заказ не найден. Пожалуйста, начните процесс заново.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🔄 Начать заново", callback_data="start")
                ]])
            )
            return ConversationHandler.END
        
        # Mark order as awaiting confirmation
        order.status = 'awaiting_confirmation'
        db.session.commit()
        
        # Notify admin about payment (implement this elsewhere)
        
        await query.message.edit_text(
            "✅ Спасибо за информацию об оплате!\n\n"
            "Ваш платеж находится на проверке у администратора. "
            "Как только платеж будет подтвержден, вы получите доступ к VPN.\n\n"
            "Это обычно происходит в течение 30 минут до нескольких часов "
            "(в зависимости от времени суток).",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🏠 Главное меню", callback_data="start")
            ]])
        )
        
        user = update.effective_user
        # Очистим кэш конфигураций пользователя
        await clear_user_configs_cache(user.id)
        
        # End the conversation
        return ConversationHandler.END

async def cancel_purchase(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel the purchase process"""
    query = update.callback_query
    if query:
        await query.answer()
        await query.message.edit_text(
            "❌ Покупка отменена. Возвращаемся в главное меню.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🏠 Главное меню", callback_data="start")
            ]])
        )
    else:
        await update.message.reply_text(
            "❌ Действие отменено. Возвращаемся в главное меню."
        )
    
    # Clean up any order data if needed
    if context.user_data.get('order_id'):
        with app.app_context():
            order = Order.query.get(context.user_data['order_id'])
            if order and order.status == 'pending':
                order.status = 'cancelled'
                db.session.commit()
    
    # Clear user data
    context.user_data.clear()
    
    return ConversationHandler.END

async def clear_user_configs_cache(telegram_id):
    """Очистить кэш конфигураций пользователя"""
    global USER_CONFIGS_CACHE
    
    cache_key = f"user_configs_{telegram_id}"
    if cache_key in USER_CONFIGS_CACHE:
        del USER_CONFIGS_CACHE[cache_key]
        return True
    return False

async def get_user_active_configs(telegram_id):
    """Получить список активных VPN-конфигураций пользователя с кэшированием"""
    global USER_CONFIGS_CACHE
    
    cache_key = f"user_configs_{telegram_id}"
    current_time = time.time()
    
    # Проверяем кэш сначала
    if cache_key in USER_CONFIGS_CACHE:
        configs_list, timestamp = USER_CONFIGS_CACHE[cache_key]
        # Если кэш свежий (не старше CACHE_TTL секунд)
        if current_time - timestamp < CACHE_TTL:
            return configs_list
    
    # Если кэша нет или он устарел, загружаем из базы данных
    with app.app_context():
        # Сначала получаем объект пользователя по telegram_id
        telegram_user = TelegramUser.query.filter_by(telegram_id=telegram_id).first()
        
        if telegram_user:
            # Получаем все активные конфигурации пользователя
            configs = VPNConfig.query.filter_by(
                user_id=telegram_user.id,
                is_active=True
            ).all()
            
            # Кэшируем результат
            USER_CONFIGS_CACHE[cache_key] = (configs, current_time)
            
            return configs
        else:
            return None

async def refresh_user_configs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обновляет и показывает актуальный список конфигураций пользователя"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    query = update.callback_query
    await query.answer(text="Обновление списка конфигураций...")
    
    # Очищаем кэш для пользователя
    user_id = update.effective_user.id
    await clear_user_configs_cache(user_id)
    
    # Перенаправляем на стандартный обработчик my_configs
    await my_configs(update, context)

async def my_configs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show user's active VPN configurations"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
    
    user = update.effective_user
    query = update.callback_query
    
    if query:
        await query.answer()
        message = query.message
    else:
        message = update.message
    
    # Получаем пользователя из базы, чтобы убедиться, что он существует
    with app.app_context():
        telegram_user = TelegramUser.query.filter_by(telegram_id=user.id).first()
        
        if not telegram_user:
            if query:
                await message.edit_text(
                    "Вы еще не зарегистрированы в нашей системе. "
                    "Пожалуйста, начните с команды /start."
                )
            else:
                await message.reply_text(
                    "Вы еще не зарегистрированы в нашей системе. "
                    "Пожалуйста, начните с команды /start."
                )
            return
    
    # Используем кэшированный список конфигураций
    configs = await get_user_active_configs(user.id)
    
    # Шапка с вкладками
    tabs = [
        InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
        InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
        InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
    ]
    
    if not configs:
        text = "У вас пока нет активных VPN-конфигураций.\n\nВы можете приобрести VPN-доступ, выбрав вкладку «Продукты»."
        
        buttons = [
            tabs,
            [InlineKeyboardButton("🛒 Купить VPN", callback_data="show_products")]
        ]
        
        if query:
            await message.edit_text(
                text,
                reply_markup=InlineKeyboardMarkup(buttons)
            )
        else:
            await message.reply_text(
                text,
                reply_markup=InlineKeyboardMarkup(buttons)
            )
        return
    
    text = "🔑 *Ваши активные VPN-конфигурации:*\n\n"
    buttons = [tabs]  # Добавляем вкладки в начало списка кнопок
    
    # Создаем стильные карточки для конфигураций
    for config in configs:
        days_left = (config.valid_until - datetime.utcnow()).days
        expiry_date = config.valid_until.strftime("%d.%m.%Y")
        
        # Определяем статус
        if days_left > 0:
            status_text = "✅ Статус: Активен"
        else:
            status_text = "❌ Статус: Истек"
        
        # Карточка конфигурации
        card = "┌───────────────────────┐\n"
        card += f"│ *{config.name}* \n"
        card += "├───────────────────────┤\n"
        card += f"│ ✅ Тип: {config.config_type.upper()}\n"
        card += f"│ {status_text}\n"
        card += f"│ ⏱️ Действует до: {expiry_date}\n"
        
        if days_left > 0:
            card += f"│ (еще {days_left} дней)\n"
        
        card += "└───────────────────────┘\n\n"
        
        text += card
        
        # Кнопки действий для конфигурации
        if days_left > 0:
            buttons.append([
                InlineKeyboardButton("Получить", callback_data=f"get_config_{config.id}"),
                InlineKeyboardButton("QR-код", callback_data=f"get_qr_{config.id}")
            ])
        else:
            buttons.append([
                InlineKeyboardButton("Продлить", callback_data=f"renew_config_{config.id}")
            ])
    
    buttons.append([InlineKeyboardButton("🔄 Обновить", callback_data="refresh_configs")])
    buttons.append([InlineKeyboardButton("🛒 Купить еще", callback_data="show_products")])
    
    if query:
        await message.edit_text(
            text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )
    else:
        await message.reply_text(
            text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )

async def get_config(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send the selected VPN configuration to the user"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    query = update.callback_query
    await query.answer()
    
    config_id = int(query.data.split('_')[2])
    
    with app.app_context():
        config = VPNConfig.query.get(config_id)
        
        if not config or not config.is_active:
            await query.message.reply_text(
                "❌ Конфигурация не найдена или неактивна."
            )
            return
        
        # Get user data
        user_id = update.effective_user.id
        telegram_user = TelegramUser.query.filter_by(telegram_id=user_id).first()
        
        if not telegram_user or config.user_id != telegram_user.id:
            await query.message.reply_text(
                "❌ У вас нет доступа к этой конфигурации."
            )
            return
        
        # Format and send the configuration
        formatted_config = format_config_for_user(config)
        
        await query.message.reply_text(
            f"📱 *Ваша VPN-конфигурация: {config.name}*\n\n"
            f"Тип: {config.config_type.upper()}\n"
            f"Действительна до: {config.valid_until.strftime('%d.%m.%Y')}\n\n"
            f"```\n{formatted_config}\n```\n\n"
            f"Для подключения просто скопируйте эту конфигурацию или используйте QR-код.",
            parse_mode="Markdown"
        )
        
        # Generate and send QR code as image (implement this elsewhere)

async def get_qr_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send QR code for VPN configuration"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    query = update.callback_query
    await query.answer()
    
    config_id = int(query.data.split('_')[2])
    
    with app.app_context():
        config = VPNConfig.query.get(config_id)
        
        if not config or not config.is_active:
            await query.message.reply_text(
                "❌ Конфигурация не найдена или неактивна."
            )
            return
        
        # Get user data
        user_id = update.effective_user.id
        telegram_user = TelegramUser.query.filter_by(telegram_id=user_id).first()
        
        if not telegram_user or config.user_id != telegram_user.id:
            await query.message.reply_text(
                "❌ У вас нет доступа к этой конфигурации."
            )
            return
        
        # Временное сообщение для QR-кода
        await query.message.reply_text(
            f"🔄 Функция QR-кода для конфигурации '{config.name}' в разработке.\n\n"
            f"Пожалуйста, используйте текстовую конфигурацию."
        )

async def handle_tab_navigation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик навигации по вкладкам"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    query = update.callback_query
    await query.answer()
    
    tab = query.data.split('_')[1]
    
    if tab == "main":
        # Показываем главную вкладку
        await show_main_tab(update, context)
    elif tab == "products":
        # Показываем вкладку с продуктами
        await show_products(update, context)
    elif tab == "configs":
        # Показываем вкладку с конфигурациями
        await my_configs(update, context)
    elif tab == "profile":
        # Показываем профиль пользователя
        await show_profile(update, context)
    else:
        # Неизвестная вкладка, возвращаемся на главную
        await show_main_tab(update, context)

async def show_main_tab(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать главную вкладку"""
    query = update.callback_query
    user = update.effective_user
    
    if not query:
        # Если это не callback_query, используем start
        return await start(update, context)
    
    # Шапка с вкладками
    tabs = [
        InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
        InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
        InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
    ]
    
    # Получаем приветственное сообщение из настроек
    with app.app_context():
        welcome_setting = Settings.query.filter_by(key='welcome_message').first()
        if welcome_setting and welcome_setting.value:
            welcome_message = welcome_setting.value.replace('{name}', user.first_name)
        else:
            welcome_message = (
                f"👋 Добро пожаловать в VPN Shop Bot, {user.first_name}!\n\n"
                "Здесь вы можете приобрести безопасные и быстрые VPN-конфигурации "
                "для обхода блокировок и защиты вашей приватности.\n\n"
                "Используйте меню для навигации."
            )
    
    # Создаем кнопки меню
    buttons = [
        tabs,
        [InlineKeyboardButton("🛒 Купить VPN", callback_data="show_products")],
        [InlineKeyboardButton("📱 Мои конфигурации", callback_data="show_configs"),
         InlineKeyboardButton("❓ Помощь", callback_data="show_help")],
        [InlineKeyboardButton("👤 Профиль", callback_data="show_profile"),
         InlineKeyboardButton("📞 Поддержка", callback_data="show_support")]
    ]
    
    # Если пользователь является администратором, добавляем ему специальную кнопку
    with app.app_context():
        admin_id_setting = Settings.query.filter_by(key='admin_telegram_id').first()
        if admin_id_setting and admin_id_setting.value:
            try:
                admin_id = int(admin_id_setting.value)
                if user.id == admin_id:
                    buttons.append([InlineKeyboardButton("⚙️ Панель администратора", callback_data="admin_panel")])
            except ValueError:
                pass
    
    await query.message.edit_text(
        welcome_message,
        reply_markup=InlineKeyboardMarkup(buttons)
    )

async def show_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать профиль пользователя"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    query = update.callback_query
    await query.answer()
    
    user = update.effective_user
    
    # Получаем данные о пользователе
    with app.app_context():
        telegram_user = TelegramUser.query.filter_by(telegram_id=user.id).first()
        
        if not telegram_user:
            await query.message.edit_text(
                "Информация о вашем профиле не найдена. Пожалуйста, перезапустите бота командой /start",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("🏠 Главная", callback_data="tab_main")
                ]])
            )
            return
        
        # Шапка с вкладками
        tabs = [
            InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
            InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
            InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
        ]
        
        # Считаем активные и неактивные конфигурации
        active_configs = VPNConfig.query.filter_by(
            user_id=telegram_user.id,
            is_active=True
        ).count()
        
        # Получаем историю заказов
        orders = Order.query.filter_by(user_id=telegram_user.id).count()
        completed_orders = Order.query.filter_by(
            user_id=telegram_user.id,
            status='completed'
        ).count()
        
        # Готовим сообщение с профилем
        profile_text = (
            f"👤 *Профиль пользователя*\n\n"
            f"Имя: {user.first_name}" + (f" {user.last_name}" if user.last_name else "") + "\n"
            f"ID: `{user.id}`\n"
            f"Дата регистрации: {telegram_user.registration_date.strftime('%d.%m.%Y')}\n\n"
            f"📊 *Статистика:*\n"
            f"Активные VPN: {active_configs}\n"
            f"Всего заказов: {orders}\n"
            f"Завершённых заказов: {completed_orders}\n"
        )
        
        buttons = [
            tabs,
            [InlineKeyboardButton("🛒 Купить VPN", callback_data="show_products")],
            [InlineKeyboardButton("📱 Мои конфигурации", callback_data="show_configs")],
            [InlineKeyboardButton("🏠 Главная", callback_data="tab_main")]
        ]
        
        await query.message.edit_text(
            profile_text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send help message"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    # Обрабатываем как callback_query, так и прямую команду
    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
    else:
        message = update.message
    
    # Получаем справочный текст из настроек
    with app.app_context():
        help_setting = Settings.query.filter_by(key='help_message').first()
        if help_setting and help_setting.value:
            help_text = help_setting.value
        else:
            help_text = (
                "🔍 *Справка по использованию бота*\n\n"
                "Этот бот поможет вам приобрести и управлять VPN-конфигурациями. Используйте интерактивные кнопки в меню бота для выполнения всех операций.\n\n"
                "📌 *Основные функции:*\n\n"
                "• *Купить VPN* - просмотр доступных тарифов и покупка доступа\n"
                "• *Мои конфигурации* - управление вашими VPN-подключениями\n"
                "• *Профиль* - информация о вашем аккаунте\n"
                "• *Поддержка* - связь с администратором\n\n"
                "По всем вопросам обращайтесь в поддержку через соответствующий раздел меню."
            )
    
    # Шапка с вкладками
    tabs = [
        InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
        InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
        InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
    ]
    
    # Добавляем кнопки
    buttons = [
        tabs,
        [InlineKeyboardButton("🛒 Купить VPN", callback_data="show_products")],
        [InlineKeyboardButton("📱 Мои конфигурации", callback_data="show_configs")],
        [InlineKeyboardButton("🏠 Главное меню", callback_data="tab_main")]
    ]
    
    if query:
        await message.edit_text(
            help_text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )
    else:
        await message.reply_text(
            help_text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )

async def support(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle support request"""
    # Проверяем, не заблокирован ли пользователь
    if await check_user_blocked(update):
        return
        
    # Обрабатываем как callback_query, так и прямую команду
    query = update.callback_query
    if query:
        await query.answer()
        message = query.message
    else:
        message = update.message
    
    # Получаем контактные данные для поддержки из настроек
    with app.app_context():
        support_setting = Settings.query.filter_by(key='support_message').first()
        admin_contact = Settings.query.filter_by(key='admin_contact').first()
        
        admin_username = "@admin"
        if admin_contact and admin_contact.value:
            admin_username = admin_contact.value
            
        if support_setting and support_setting.value:
            support_text = support_setting.value.replace('{admin}', admin_username)
        else:
            support_text = (
                "📞 *Поддержка*\n\n"
                f"Если у вас возникли вопросы или проблемы с использованием VPN, "
                f"пожалуйста, напишите администратору: {admin_username}\n\n"
                f"Пожалуйста, опишите вашу проблему как можно более подробно, "
                f"включая информацию о вашей подписке и устройстве."
            )
    
    # Шапка с вкладками
    tabs = [
        InlineKeyboardButton("🏠 Главная", callback_data="tab_main"),
        InlineKeyboardButton("🛒 Продукты", callback_data="tab_products"),
        InlineKeyboardButton("🔑 Мои VPN", callback_data="tab_configs")
    ]
    
    # Добавляем кнопки для удобства
    buttons = [
        tabs,
        [InlineKeyboardButton("🏠 Главное меню", callback_data="tab_main")]
    ]
    
    if query:
        await message.edit_text(
            support_text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )
    else:
        await message.reply_text(
            support_text,
            reply_markup=InlineKeyboardMarkup(buttons),
            parse_mode="Markdown"
        )

async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать панель администратора"""
    user = update.effective_user
    query = update.callback_query
    
    if query:
        await query.answer()
        message = query.message
    else:
        message = update.message
    
    # Проверяем, является ли пользователь администратором
    with app.app_context():
        admin_id_setting = Settings.query.filter_by(key='admin_telegram_id').first()
        is_admin = False
        
        if admin_id_setting and admin_id_setting.value:
            try:
                admin_id = int(admin_id_setting.value)
                is_admin = (user.id == admin_id)
            except ValueError:
                logger.warning(f"Неверный формат ID администратора в настройках: {admin_id_setting.value}")
        
        if not is_admin:
            if query:
                await message.edit_text("⛔ У вас нет доступа к административной панели.")
            else:
                await message.reply_text("⛔ У вас нет доступа к административной панели.")
            return
        
        # Показываем панель администратора
        admin_text = (
            "⚙️ *Панель администратора*\n\n"
            "Здесь вы можете выполнять административные функции:\n\n"
            "• Просмотр заказов\n"
            "• Управление продуктами\n"
            "• Управление пользователями\n"
            "• Статистика\n\n"
            "Выберите нужную функцию:"
        )
        
        buttons = [
            [InlineKeyboardButton("📋 Новые заказы", callback_data="admin_orders_new")],
            [InlineKeyboardButton("👥 Пользователи", callback_data="admin_users")],
            [InlineKeyboardButton("📊 Статистика", callback_data="admin_stats")],
            [InlineKeyboardButton("🔄 Обновить конфиги", callback_data="admin_refresh_configs")],
            [InlineKeyboardButton("🏠 Главное меню", callback_data="tab_main")]
        ]
        
        if query:
            await message.edit_text(
                admin_text,
                reply_markup=InlineKeyboardMarkup(buttons),
                parse_mode="Markdown"
            )
        else:
            await message.reply_text(
                admin_text,
                reply_markup=InlineKeyboardMarkup(buttons),
                parse_mode="Markdown"
            )

async def admin_confirm_order(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Подтверждение заказа администратором и создание VPN-конфигурации"""
    query = update.callback_query
    await query.answer()
    
    user = update.effective_user
    
    # Проверяем, является ли пользователь администратором
    with app.app_context():
        admin_id_setting = Settings.query.filter_by(key='admin_telegram_id').first()
        is_admin = False
        
        if admin_id_setting and admin_id_setting.value:
            try:
                admin_id = int(admin_id_setting.value)
                is_admin = (user.id == admin_id)
            except ValueError:
                pass
        
        if not is_admin:
            await query.message.edit_text("⛔ У вас нет доступа к административной панели.")
            return
        
        # Извлекаем ID заказа из callback_data
        order_id = int(query.data.split('_')[3])
        order = Order.query.get(order_id)
        
        if not order:
            await query.message.edit_text(
                "❌ Заказ не найден. Возможно, он был удален.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Назад", callback_data="admin_orders_new")
                ]])
            )
            return
        
        if order.status != 'awaiting_confirmation':
            await query.message.edit_text(
                f"❌ Заказ #{order_id} уже имеет статус {order.status}.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Назад", callback_data="admin_orders_new")
                ]])
            )
            return
        
        # Получаем информацию о пользователе и продукте
        telegram_user = TelegramUser.query.get(order.user_id)
        product = Product.query.get(order.product_id)
        
        if not telegram_user or not product:
            await query.message.edit_text(
                "❌ Не удалось найти информацию о пользователе или продукте.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Назад", callback_data="admin_orders_new")
                ]])
            )
            return
        
        # Создаем срок действия VPN-конфигурации
        valid_until = datetime.utcnow() + timedelta(days=product.duration_days)
        
        # Создаем конфигурацию (в реальном проекте здесь был бы вызов к XUI API)
        try:
            # Пытаемся получить IP-адрес и порт сервера из настроек
            server_address = Settings.query.filter_by(key='vpn_server_address').first()
            server_address = server_address.value if server_address else "127.0.0.1"
            
            server_port = Settings.query.filter_by(key='vpn_server_port').first()
            server_port = int(server_port.value) if server_port else 443
            
            # Формируем имя конфигурации
            config_name = f"{product.name} - {telegram_user.first_name}"
            user_email = f"{telegram_user.telegram_id}@vpntgbot.com"
            
            # Генерируем конфигурацию с помощью встроенной утилиты
            config_data = generate_config(
                config_type=product.config_type,
                user_email=user_email,
                server_address=server_address,
                server_port=server_port
            )
            
            # Сохраняем сгенерированный config_data как строку
            config_data_str = str(config_data)
            
            # Сохраняем конфигурацию в базе данных
            vpn_config = VPNConfig(
                user_id=telegram_user.id,
                config_type=product.config_type,
                name=config_name,
                config_data=config_data_str,
                valid_until=valid_until,
                is_active=True
            )
            db.session.add(vpn_config)
            
            # Обновляем заказ
            order.status = 'completed'
            order.paid_at = datetime.utcnow()
            order.config_id = vpn_config.id
            
            db.session.commit()
            
            # Очищаем кэш конфигураций пользователя для обновления данных
            # Создаем задачу, чтобы не блокировать основной поток
            loop = asyncio.get_event_loop()
            loop.create_task(clear_user_configs_cache(telegram_user.telegram_id))
            
            # Отправляем уведомление пользователю о подтверждении заказа
            confirmation_message = Settings.query.filter_by(key='payment_confirmation_message').first()
            if confirmation_message and confirmation_message.value:
                notification_text = confirmation_message.value
            else:
                notification_text = (
                    "✅ *Ваш заказ подтвержден!*\n\n"
                    f"Заказ #{order.id} был успешно подтвержден администратором. "
                    f"Ваша VPN-конфигурация готова к использованию и будет действительна до {valid_until.strftime('%d.%m.%Y')}.\n\n"
                    f"Вы можете найти вашу конфигурацию в разделе «Мои конфигурации»."
                )
            
            # Здесь нужно отправить уведомление пользователю через бота
            # В реальном проекте это делается через контекст и application
            # На данном этапе просто сохраняем для будущих улучшений
            
            # Сообщаем администратору об успешном выполнении
            await query.message.edit_text(
                f"✅ Заказ #{order.id} успешно подтвержден!\n\n"
                f"Создана VPN-конфигурация для пользователя {telegram_user.first_name}.\n"
                f"Срок действия: до {valid_until.strftime('%d.%m.%Y')}",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("📋 К списку заказов", callback_data="admin_orders_new")],
                    [InlineKeyboardButton("⚙️ Панель администратора", callback_data="admin_panel")]
                ])
            )
            
        except Exception as e:
            logger.error(f"Ошибка при создании VPN-конфигурации: {str(e)}")
            await query.message.edit_text(
                f"❌ Произошла ошибка при создании VPN-конфигурации: {str(e)}",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Назад", callback_data="admin_orders_new")
                ]])
            )
            import traceback
            logger.error(traceback.format_exc())

async def admin_orders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать список заказов для администратора"""
    query = update.callback_query
    if query:
        await query.answer()
    
    user = update.effective_user
    
    # Проверяем, является ли пользователь администратором
    with app.app_context():
        admin_id_setting = Settings.query.filter_by(key='admin_telegram_id').first()
        is_admin = False
        
        if admin_id_setting and admin_id_setting.value:
            try:
                admin_id = int(admin_id_setting.value)
                is_admin = (user.id == admin_id)
            except ValueError:
                pass
        
        if not is_admin:
            if query:
                await query.message.edit_text("⛔ У вас нет доступа к административной панели.")
            else:
                await update.message.reply_text("⛔ У вас нет доступа к административной панели.")
            return
        
        # Получаем новые заказы
        new_orders = Order.query.filter_by(status='awaiting_confirmation').all()
        
        if not new_orders:
            text = "📋 *Новые заказы*\n\nНет новых заказов, ожидающих подтверждения."
            buttons = [[InlineKeyboardButton("⬅️ Назад", callback_data="admin_panel")]]
            
            if query:
                await query.message.edit_text(
                    text,
                    reply_markup=InlineKeyboardMarkup(buttons),
                    parse_mode="Markdown"
                )
            else:
                await update.message.reply_text(
                    text,
                    reply_markup=InlineKeyboardMarkup(buttons),
                    parse_mode="Markdown"
                )
            return
        
        text = "📋 *Новые заказы, ожидающие подтверждения*\n\n"
        buttons = []
        
        for order in new_orders:
            user = TelegramUser.query.get(order.user_id)
            product = Product.query.get(order.product_id)
            
            if user and product:
                text += f"🔹 *Заказ #{order.id}*\n"
                text += f"  ├ Пользователь: {user.first_name} (@{user.username})\n"
                text += f"  ├ Продукт: {product.name}\n"
                text += f"  ├ Сумма: {order.amount} руб.\n"
                text += f"  └ Дата: {order.created_at.strftime('%d.%m.%Y %H:%M')}\n\n"
                
                buttons.append([InlineKeyboardButton(
                    f"Подтвердить заказ #{order.id}",
                    callback_data=f"admin_confirm_order_{order.id}"
                )])
        
        buttons.append([InlineKeyboardButton("⬅️ Назад", callback_data="admin_panel")])
        
        if query:
            await query.message.edit_text(
                text,
                reply_markup=InlineKeyboardMarkup(buttons),
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                text,
                reply_markup=InlineKeyboardMarkup(buttons),
                parse_mode="Markdown"
            )

async def handle_text_buttons(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle text button presses from the main menu"""
    text = update.message.text
    
    if text == "🛒 Купить VPN":
        return await show_products(update, context)
    elif text == "📱 Мои конфигурации":
        return await my_configs(update, context)
    elif text == "❓ Помощь":
        return await help_command(update, context)
    elif text == "📞 Поддержка":
        return await support(update, context)
    elif text == "👤 Профиль":
        # For text buttons that call functions expecting callback queries,
        # we'll directly adjust behavior within those functions rather than
        # creating a mock callback_query object
        # Return to start command to use the inline keyboard instead
        return await start(update, context)
    elif text == "⚙️ Панель администратора":
        return await admin_panel(update, context)

def setup_bot():
    """Initialize and start the Telegram bot"""
    # Get the token from environment variable
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN environment variable is not set! Bot will not start.")
        return None
    
    logger.info(f"Setting up Telegram bot with token: {token[:5]}...{token[-5:] if len(token) > 10 else '***'}")
    
    # Проверяем работу библиотеки
    logger.info("Проверка библиотеки python-telegram-bot...")
    try:
        from telegram import __version__
        logger.info(f"Версия библиотеки python-telegram-bot: {__version__}")
    except Exception as e:
        logger.error(f"Ошибка при импорте библиотеки python-telegram-bot: {e}")
        return None
    
    try:
        # Создаем функцию для запуска бота
        # Для python-telegram-bot v20+ используем асинхронный подход
        async def run_bot_async():
            try:
                logger.info("Initializing Telegram application...")
                # Build the application
                logger.info("Создание объекта Application...")
                application = Application.builder().token(token).build()
                logger.info("Application создан успешно")
                
                logger.info("Регистрация основных обработчиков команд...")
                # Add handlers
                application.add_handler(CommandHandler("start", start))
                application.add_handler(CommandHandler("help", help_command))
                application.add_handler(CommandHandler("support", support))
                logger.info("Основные обработчики зарегистрированы")
                
                logger.info("Настройка ConversationHandler для покупки...")
                # Purchase conversation handler
                purchase_handler = ConversationHandler(
                    entry_points=[
                        CommandHandler("buy", show_products),
                        MessageHandler(filters.Text(["🛒 Купить VPN"]), show_products),
                        CallbackQueryHandler(show_products, pattern="^back_to_products$")
                    ],
                    states={
                        SELECTING_PRODUCT: [
                            CallbackQueryHandler(product_selected, pattern="^product_"),
                            CallbackQueryHandler(cancel_purchase, pattern="^cancel$"),
                            CallbackQueryHandler(show_products, pattern="^back_to_products$")
                        ],
                        CONFIRMING_PURCHASE: [
                            CallbackQueryHandler(confirm_purchase, pattern="^confirm_purchase$"),
                            CallbackQueryHandler(show_products, pattern="^back_to_products$"),
                            CallbackQueryHandler(product_selected, pattern="^back_to_product$"),
                            CallbackQueryHandler(cancel_purchase, pattern="^cancel$")
                        ],
                        PAYMENT_METHOD: [
                            CallbackQueryHandler(process_payment, pattern="^payment_"),
                            CallbackQueryHandler(product_selected, pattern="^back_to_product$"),
                            CallbackQueryHandler(cancel_purchase, pattern="^cancel$")
                        ],
                        AWAITING_PAYMENT: [
                            CallbackQueryHandler(payment_confirmed, pattern="^paid_"),
                            CallbackQueryHandler(cancel_purchase, pattern="^cancel_payment$")
                        ]
                    },
                    fallbacks=[
                        CommandHandler("cancel", cancel_purchase),
                        CallbackQueryHandler(cancel_purchase, pattern="^cancel$")
                    ],
                    name="purchase_conversation",
                    persistent=False
                )
                
                application.add_handler(purchase_handler)
                
                # Tab navigation handlers
                application.add_handler(CallbackQueryHandler(handle_tab_navigation, pattern="^tab_"))
                application.add_handler(CallbackQueryHandler(show_profile, pattern="^show_profile$"))
                application.add_handler(CallbackQueryHandler(show_main_tab, pattern="^start$"))
                
                # Config management handlers
                application.add_handler(CommandHandler("configs", my_configs))
                application.add_handler(CallbackQueryHandler(get_config, pattern="^get_config_"))
                application.add_handler(CallbackQueryHandler(get_qr_code, pattern="^get_qr_"))
                application.add_handler(CallbackQueryHandler(my_configs, pattern="^show_configs$"))
                application.add_handler(CallbackQueryHandler(refresh_user_configs, pattern="^refresh_configs$"))
                
                # Helper handlers
                application.add_handler(CallbackQueryHandler(help_command, pattern="^show_help$"))
                application.add_handler(CallbackQueryHandler(support, pattern="^show_support$"))
                application.add_handler(CallbackQueryHandler(show_products, pattern="^show_products$"))
                
                # Admin handlers
                application.add_handler(CallbackQueryHandler(admin_panel, pattern="^admin_panel$"))
                application.add_handler(CallbackQueryHandler(admin_orders, pattern="^admin_orders_new$"))
                application.add_handler(CallbackQueryHandler(admin_confirm_order, pattern="^admin_confirm_order_"))
                
                # Handle text buttons
                application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_buttons))
                
                logger.info("Starting Telegram bot polling...")
                # Start the bot asynchronously with retry logic
                try:
                    logger.info("Initializing bot application...")
                    await application.initialize()
                    logger.info("Starting bot application...")
                    await application.start()
                    logger.info("Starting updater polling...")
                    await application.updater.start_polling(
                        allowed_updates=Update.ALL_TYPES,
                        read_timeout=30,
                        connect_timeout=30,
                        pool_timeout=30
                    )
                    logger.info("Telegram bot polling started successfully")
                except telegram.error.TimedOut:
                    logger.error("Timed out connecting to Telegram API. Possible network issues or invalid token.")
                    # Return gracefully to allow for restart
                    return None
                except telegram.error.InvalidToken:
                    logger.error("Invalid Telegram bot token. Please check your token.")
                    return None
                except Exception as e:
                    logger.error(f"Error starting bot polling: {e}")
                    import traceback
                    logger.error(f"Polling error details:\n{traceback.format_exc()}")
                    return None
                
                # Keep the bot running
                while True:
                    await asyncio.sleep(1)
                    
            except Exception as e:
                logger.error(f"Error in Telegram bot: {e}")
                import traceback
                logger.error(f"Bot error details:\n{traceback.format_exc()}")
                return None
            finally:
                # Graceful shutdown
                logger.info("Shutting down bot...")
                try:
                    if 'application' in locals():
                        await application.updater.stop()
                        await application.stop()
                        await application.shutdown()
                except Exception as e:
                    logger.error(f"Error during bot shutdown: {e}")
        
        # Запускаем бота в отдельном потоке с новым event loop
        def run_bot_thread():
            try:
                import asyncio
                # Получаем доступ к глобальной переменной из main.py
                from main import bot_event_loop
                
                # Создаем новый event loop для этого потока
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                # Сохраняем ссылку на event loop для использования в других частях приложения
                # Это позволит вызывать асинхронные функции из синхронного кода (например, из admin_panel.py)
                import main
                main.bot_event_loop = loop
                
                # Запускаем асинхронную функцию в этом loop
                loop.run_until_complete(run_bot_async())
            except Exception as e:
                logger.error(f"Error in bot thread: {e}")
                import traceback
                logger.error(f"Bot thread error details:\n{traceback.format_exc()}")
        
        import threading
        import asyncio
        logger.info("Creating bot thread...")
        bot_thread = threading.Thread(target=run_bot_thread, name="TelegramBotThread")
        bot_thread.daemon = True  # Завершить поток, когда завершится основной процесс
        bot_thread.start()
        logger.info(f"Telegram bot started in thread ID: {bot_thread.ident}")
        return bot_thread
        
    except Exception as e:
        logger.error(f"Error setting up Telegram bot: {e}")
        import traceback
        logger.error(f"Bot setup error details:\n{traceback.format_exc()}")
        return None
