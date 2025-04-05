"""
Функции для управления кэшем в административной панели
"""
from flask import redirect, url_for, flash
from flask_login import login_required

from app import app, db
from models import TelegramUser

@app.route('/admin/clear_user_configs_cache/<int:telegram_id>', methods=['POST'])
@login_required
def admin_clear_user_configs_cache(telegram_id):
    """Очистить кэш конфигураций пользователя вручную (для админов)"""
    from main import clear_user_configs_cache
    
    user = TelegramUser.query.filter_by(telegram_id=telegram_id).first()
    if not user:
        flash(f'Пользователь с Telegram ID {telegram_id} не найден', 'danger')
        return redirect(url_for('admin_users'))
    
    result = clear_user_configs_cache(telegram_id)
    if result:
        flash(f'Кэш конфигураций пользователя {telegram_id} успешно очищен', 'success')
    else:
        flash(f'Кэш конфигураций пользователя {telegram_id} не найден или ошибка при очистке', 'warning')
    
    # Возвращаемся на страницу пользователя
    return redirect(url_for('admin_user_detail', user_id=user.id))