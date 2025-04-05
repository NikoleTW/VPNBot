"""
Main entry point for the VPN Telegram Bot + Web Admin panel application
"""
import logging
import os
import threading
import sys
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
def load_env_file(env_file='.env'):
    """
    Load environment variables from .env file
    """
    logger.info(f"Loading environment variables from {env_file}")
    
    if not os.path.exists(env_file):
        logger.warning(f"Environment file {env_file} not found")
        return False
    
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            key, value = line.split('=', 1)
            os.environ[key] = value
            # Log except for sensitive values
            if 'TOKEN' in key or 'SECRET' in key or 'PASSWORD' in key:
                logger.info(f"Loaded {key}=***")
            else:
                logger.info(f"Loaded {key}={value}")
    
    return True

# Load environment variables
load_env_file()

# Now import app after environment is loaded
from app import app
from flask import jsonify

# Import for admin panel cache clearing
import admin_panel_cache

# Глобальная переменная для хранения event loop для запуска асинхронных функций
# Определение атрибута bot_event_loop в модуле main
import sys
bot_event_loop = None
# Сохраняем текущий модуль в sys.modules для предотвращения циклического импорта
sys.modules['main'] = sys.modules[__name__]

def clear_products_cache():
    """
    Очистить кэш продуктов в боте
    Эта функция используется в админ-панели для сброса кэша после изменения продуктов
    """
    global bot_event_loop
    
    if bot_event_loop is None:
        logger.warning("Event loop не инициализирован, невозможно очистить кэш продуктов")
        return False
    
    try:
        # Импортируем здесь, чтобы избежать циклических импортов
        from bot import clear_products_cache as async_clear_products_cache
        
        # Создаем future для выполнения асинхронной функции
        future = asyncio.run_coroutine_threadsafe(async_clear_products_cache(), bot_event_loop)
        
        # Ждем результата с таймаутом в 2 секунды
        result = future.result(timeout=2)
        logger.info(f"Кэш продуктов очищен: {result}")
        return result
    except Exception as e:
        logger.error(f"Ошибка при очистке кэша продуктов: {str(e)}")
        return False

def clear_user_configs_cache(telegram_id):
    """
    Очистить кэш конфигураций пользователя в боте
    Эта функция используется для сброса кэша конфигураций конкретного пользователя
    """
    global bot_event_loop
    
    if bot_event_loop is None:
        logger.warning("Event loop не инициализирован, невозможно очистить кэш конфигураций пользователя")
        return False
    
    try:
        # Импортируем здесь, чтобы избежать циклических импортов
        from bot import clear_user_configs_cache as async_clear_user_configs_cache
        
        # Создаем future для выполнения асинхронной функции
        future = asyncio.run_coroutine_threadsafe(async_clear_user_configs_cache(telegram_id), bot_event_loop)
        
        # Ждем результата с таймаутом в 2 секунды
        result = future.result(timeout=2)
        logger.info(f"Кэш конфигураций пользователя {telegram_id} очищен: {result}")
        return result
    except Exception as e:
        logger.error(f"Ошибка при очистке кэша конфигураций пользователя {telegram_id}: {str(e)}")
        return False

@app.route('/test/clear_products_cache')
def test_clear_products_cache():
    """
    Тестовый публичный маршрут для очистки кэша продуктов
    """
    global bot_event_loop
    
    # Проверка, инициализирован ли event loop
    max_wait = 10  # максимальное время ожидания в секундах
    wait_interval = 0.5  # интервал проверки в секундах
    
    waited = 0
    while bot_event_loop is None and waited < max_wait:
        import time
        time.sleep(wait_interval)
        waited += wait_interval
        logger.info(f"Ожидание инициализации bot_event_loop: {waited} сек...")
    
    if bot_event_loop is None:
        logger.error(f"bot_event_loop не инициализирован после {max_wait} секунд ожидания")
        return jsonify({
            'success': False,
            'message': f'Ошибка: bot_event_loop не инициализирован после {max_wait} секунд ожидания'
        }), 500
    
    # Очистка кэша продуктов
    result = clear_products_cache()
    return jsonify({
        'success': result,
        'message': 'Кэш продуктов успешно очищен' if result else 'Ошибка при очистке кэша продуктов'
    })

@app.route('/test/clear_user_configs_cache/<int:telegram_id>')
def test_clear_user_configs_cache(telegram_id):
    """
    Тестовый публичный маршрут для очистки кэша конфигураций пользователя
    """
    global bot_event_loop
    
    # Проверка, инициализирован ли event loop
    max_wait = 10  # максимальное время ожидания в секундах
    wait_interval = 0.5  # интервал проверки в секундах
    
    waited = 0
    while bot_event_loop is None and waited < max_wait:
        import time
        time.sleep(wait_interval)
        waited += wait_interval
        logger.info(f"Ожидание инициализации bot_event_loop: {waited} сек...")
    
    if bot_event_loop is None:
        logger.error(f"bot_event_loop не инициализирован после {max_wait} секунд ожидания")
        return jsonify({
            'success': False,
            'message': f'Ошибка: bot_event_loop не инициализирован после {max_wait} секунд ожидания'
        }), 500
    
    # Очистка кэша конфигураций пользователя
    result = clear_user_configs_cache(telegram_id)
    return jsonify({
        'success': result,
        'message': f'Кэш конфигураций пользователя {telegram_id} успешно очищен' if result else f'Ошибка при очистке кэша конфигураций пользователя {telegram_id}'
    })

def start_bot():
    """Start Telegram bot in a separate thread if needed"""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if token:
        logger.info(f"Attempting to start Telegram bot with token: {token[:5]}...{token[-5:]}")
        try:
            # Подробные логи
            logger.info("Импортируем модуль bot и функцию setup_bot")
            from bot import setup_bot
            
            logger.info("Вызываем функцию setup_bot()")
            bot_thread = setup_bot()
            
            if bot_thread:
                logger.info(f"Telegram bot thread successfully started: {bot_thread}")
            else:
                logger.error("Failed to start Telegram bot thread - setup_bot() returned None")
        except Exception as e:
            logger.error(f"Error starting Telegram bot: {e}")
            import traceback
            logger.error(f"Telegram bot error details:\n{traceback.format_exc()}")
            logger.info("Continuing with web application only")
    else:
        logger.warning("TELEGRAM_BOT_TOKEN not set, Telegram bot will not be started")

# For Gunicorn/WSGI
if "gunicorn" in os.environ.get("SERVER_SOFTWARE", ""):
    logger.info("Running under Gunicorn, starting bot in main process only")
    # Start bot in the main Gunicorn process
    try:
        import threading
        # Check if we are in the main Gunicorn process
        if os.environ.get('GUNICORN_WORKER_AGE', '0') == '0':
            logger.info("Starting Telegram bot in main Gunicorn process")
            bot_thread = threading.Thread(target=start_bot)
            bot_thread.daemon = True
            bot_thread.start()
        else:
            logger.info("Not starting bot in Gunicorn worker")
    except Exception as e:
        logger.error(f"Error starting bot in Gunicorn process: {e}")
        import traceback
        logger.error(traceback.format_exc())
elif __name__ == "__main__":
    # Start Flask web application directly (for development)
    
    # Start bot in a separate thread if token is available
    bot_thread = threading.Thread(target=start_bot)
    bot_thread.daemon = True
    bot_thread.start()
    
    # Start Flask web application on port 5000
    app.run(host="0.0.0.0", port=5000, debug=True)
