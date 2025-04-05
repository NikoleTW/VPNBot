"""
Web admin panel for VPN Telegram Bot
"""
import os
from datetime import datetime, timedelta
import json
import requests

from flask import (
    render_template, request, redirect, url_for, 
    session, flash, jsonify, Response
)
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash

from app import app, db
from models import (
    Admin, TelegramUser, VPNConfig, Product, 
    Order, PaymentMethod, Settings
)
from x_ui_client import XUIClient, XUIClientError
from vpn_utils import generate_config, format_config_for_user

# Initialize XUI client
xui_client = XUIClient(
    base_url=os.environ.get('XUI_PANEL_URL', 'http://localhost:54321'),
    username=os.environ.get('XUI_USERNAME', 'admin'),
    password=os.environ.get('XUI_PASSWORD', 'admin')
)

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login page"""
    if current_user.is_authenticated:
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        admin = Admin.query.filter_by(username=username).first()
        
        if admin and check_password_hash(admin.password_hash, password):
            login_user(admin)
            flash('Login successful!', 'success')
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Invalid username or password', 'danger')
    
    return render_template('admin/login.html')

@app.route('/admin/logout')
@login_required
def admin_logout():
    """Admin logout"""
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('admin_login'))

@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    """Admin dashboard with statistics"""
    # Get counts
    user_count = TelegramUser.query.count()
    active_configs = VPNConfig.query.filter_by(is_active=True).count()
    expired_configs = VPNConfig.query.filter(
        VPNConfig.valid_until < datetime.utcnow(),
        VPNConfig.is_active == True
    ).count()
    
    # Get recent orders
    recent_orders = Order.query.order_by(Order.created_at.desc()).limit(5).all()
    
    # Get recent users
    recent_users = TelegramUser.query.order_by(TelegramUser.registration_date.desc()).limit(5).all()
    
    # Calculate revenue
    total_revenue = db.session.query(db.func.sum(Order.amount)).filter(
        Order.status == 'completed'
    ).scalar() or 0
    
    # Monthly revenue
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_revenue = db.session.query(db.func.sum(Order.amount)).filter(
        Order.status == 'completed',
        Order.paid_at >= start_of_month
    ).scalar() or 0
    
    # Try to get system stats from 3x-ui
    try:
        system_stats = xui_client.get_stats()
    except XUIClientError as e:
        system_stats = None
        flash(f"Error getting system stats: {str(e)}", "warning")
    
    return render_template(
        'admin/dashboard.html',
        user_count=user_count,
        active_configs=active_configs,
        expired_configs=expired_configs,
        total_revenue=total_revenue,
        monthly_revenue=monthly_revenue,
        recent_orders=recent_orders,
        recent_users=recent_users,
        system_stats=system_stats
    )

@app.route('/admin/users')
@login_required
def admin_users():
    """Admin user management"""
    users = TelegramUser.query.order_by(TelegramUser.registration_date.desc()).all()
    return render_template('admin/users.html', users=users)

@app.route('/admin/user/<int:user_id>', methods=['GET', 'POST'])
@login_required
def admin_user_detail(user_id):
    """Admin user detail page"""
    user = TelegramUser.query.get_or_404(user_id)
    configs = VPNConfig.query.filter_by(user_id=user.id).all()
    orders = Order.query.filter_by(user_id=user.id).order_by(Order.created_at.desc()).all()
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'toggle_block':
            # Изменяем статус блокировки пользователя
            user.is_blocked = not user.is_blocked
            db.session.commit()
            
            status = "заблокирован" if user.is_blocked else "разблокирован"
            flash(f'Пользователь {user.first_name} успешно {status}', 'success')
            
        elif action == 'send_message':
            # Отправка сообщения пользователю через Telegram-бот
            message = request.form.get('message')
            
            try:
                # Получаем токен бота из переменных окружения
                token = os.environ.get("TELEGRAM_BOT_TOKEN")
                
                if not token:
                    flash('Токен Telegram-бота не настроен', 'danger')
                else:
                    # Отправляем сообщение через API Telegram
                    import logging
                    import requests
                    logger = logging.getLogger(__name__)
                    
                    try:
                        response = requests.post(
                            f'https://api.telegram.org/bot{token}/sendMessage',
                            json={
                                'chat_id': user.telegram_id,
                                'text': message,
                                'parse_mode': 'Markdown'
                            },
                            timeout=10
                        )
                        
                        if response.status_code == 200:
                            logger.info(f"Сообщение пользователю {user.telegram_id} отправлено успешно")
                            flash('Сообщение успешно отправлено', 'success')
                        else:
                            logger.error(f"Ошибка при отправке сообщения: {response.text}")
                            flash(f'Ошибка при отправке сообщения: {response.json().get("description", "Неизвестная ошибка")}', 'danger')
                    except Exception as e:
                        logger.error(f"Ошибка при отправке сообщения: {e}")
                        flash(f'Ошибка при отправке сообщения: {str(e)}', 'danger')
            except Exception as e:
                flash(f'Ошибка при отправке сообщения: {str(e)}', 'danger')
    
    return render_template(
        'admin/user_detail.html',
        user=user,
        configs=configs,
        orders=orders
    )

@app.route('/admin/configs')
@login_required
def admin_configs():
    """Admin VPN configuration management"""
    configs = VPNConfig.query.order_by(VPNConfig.created_at.desc()).all()
    return render_template('admin/configs.html', configs=configs)

@app.route('/admin/config/<int:config_id>', methods=['GET', 'POST'])
@login_required
def admin_config_detail(config_id):
    """Admin VPN configuration detail"""
    config = VPNConfig.query.get_or_404(config_id)
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'toggle_status':
            # Изменяем статус активности VPN-конфигурации
            config.is_active = not config.is_active
            
            # Если есть подключение к x-ui, обновляем статус клиента там тоже
            try:
                if config.x_ui_client_id:
                    # Получаем все инбаунды
                    inbounds = xui_client.get_inbounds()
                    
                    # Находим инбаунд, соответствующий типу конфигурации
                    matching_inbounds = [inb for inb in inbounds if inb.get("protocol") == config.config_type]
                    
                    if matching_inbounds:
                        inbound_id = matching_inbounds[0].get("id")
                        
                        # Обновляем статус клиента в x-ui
                        xui_client.update_client(
                            inbound_id=inbound_id,
                            email=f"tguser_{config.owner.telegram_id}_{config.created_at.strftime('%Y%m%d%H%M%S')}",
                            enable=config.is_active
                        )
            except Exception as e:
                flash(f'Не удалось обновить статус в X-UI: {str(e)}', 'warning')
            
            db.session.commit()
            status = "активирована" if config.is_active else "деактивирована"
            flash(f'VPN-конфигурация успешно {status}', 'success')
            
        elif action == 'extend':
            # Продлеваем срок действия VPN-конфигурации
            days = int(request.form.get('days', 30))
            
            # Если конфигурация истекла, начинаем от текущей даты
            if config.valid_until < datetime.utcnow():
                config.valid_until = datetime.utcnow() + timedelta(days=days)
            else:
                # Иначе добавляем дни к текущей дате истечения
                config.valid_until = config.valid_until + timedelta(days=days)
            
            # Активируем конфигурацию, если она неактивна
            if not config.is_active:
                config.is_active = True
            
            # Если есть подключение к x-ui, обновляем там тоже
            try:
                if config.x_ui_client_id:
                    # Получаем все инбаунды
                    inbounds = xui_client.get_inbounds()
                    
                    # Находим инбаунд, соответствующий типу конфигурации
                    matching_inbounds = [inb for inb in inbounds if inb.get("protocol") == config.config_type]
                    
                    if matching_inbounds:
                        inbound_id = matching_inbounds[0].get("id")
                        
                        # Обновляем срок действия клиента в x-ui
                        xui_client.update_client(
                            inbound_id=inbound_id,
                            email=f"tguser_{config.owner.telegram_id}_{config.created_at.strftime('%Y%m%d%H%M%S')}",
                            new_expiry_days=days,
                            enable=True
                        )
            except Exception as e:
                flash(f'Не удалось обновить срок действия в X-UI: {str(e)}', 'warning')
            
            db.session.commit()
            flash(f'Срок действия VPN-конфигурации продлен на {days} дней', 'success')
    
    formatted_config = format_config_for_user(config)
    
    return render_template(
        'admin/config_detail.html',
        config=config,
        formatted_config=formatted_config
    )

@app.route('/admin/products', methods=['GET', 'POST'])
@login_required
def admin_products():
    """Admin product management"""
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        price = float(request.form.get('price'))
        duration_days = int(request.form.get('duration_days'))
        config_type = request.form.get('config_type')
        is_active = request.form.get('is_active') == 'on'
        
        product = Product(
            name=name,
            description=description,
            price=price,
            duration_days=duration_days,
            config_type=config_type,
            is_active=is_active
        )
        
        db.session.add(product)
        db.session.commit()
        
        # Очищаем кэш продуктов, чтобы пользователи видели актуальные данные
        from main import clear_products_cache
        if clear_products_cache():
            flash('Product added successfully and cache cleared', 'success')
        else:
            flash('Product added successfully, but cache clearing failed', 'warning')
        return redirect(url_for('admin_products'))
    
    products = Product.query.all()
    return render_template('admin/products.html', products=products)

@app.route('/admin/product/<int:product_id>/delete', methods=['POST'])
@login_required
def admin_product_delete(product_id):
    """Delete a product"""
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    
    # Очищаем кэш продуктов, чтобы пользователи видели актуальные данные
    from main import clear_products_cache
    if clear_products_cache():
        flash('Product deleted successfully and cache cleared', 'success')
    else:
        flash('Product deleted successfully, but cache clearing failed', 'warning')
    return redirect(url_for('admin_products'))

@app.route('/admin/product/<int:product_id>/edit', methods=['GET', 'POST'])
@login_required
def admin_product_edit(product_id):
    """Edit a product"""
    product = Product.query.get_or_404(product_id)
    
    if request.method == 'POST':
        product.name = request.form.get('name')
        product.description = request.form.get('description')
        product.price = float(request.form.get('price'))
        product.duration_days = int(request.form.get('duration_days'))
        product.config_type = request.form.get('config_type')
        product.is_active = request.form.get('is_active') == 'on'
        
        db.session.commit()
        
        # Очищаем кэш продуктов, чтобы пользователи видели актуальные данные
        from main import clear_products_cache
        if clear_products_cache():
            flash('Продукт успешно обновлен и кэш очищен', 'success')
        else:
            flash('Продукт успешно обновлен, но очистка кэша не удалась', 'warning')
        return redirect(url_for('admin_products'))
    
    return render_template('admin/product_edit.html', product=product)

@app.route('/admin/product/<int:product_id>/json')
@login_required
def admin_product_json(product_id):
    """Return product data as JSON for AJAX requests"""
    product = Product.query.get_or_404(product_id)
    
    return jsonify({
        'id': product.id,
        'name': product.name,
        'description': product.description or '',
        'price': product.price,
        'config_type': product.config_type,
        'duration_days': product.duration_days,
        'is_active': product.is_active
    })

@app.route('/admin/orders')
@login_required
def admin_orders():
    """Admin order management"""
    # Получаем параметры фильтрации
    status_filter = request.args.get('status', 'all')
    sort_by = request.args.get('sort', 'date_desc')
    
    # Базовый запрос
    query = Order.query
    
    # Применяем фильтр по статусу
    if status_filter != 'all':
        query = query.filter(Order.status == status_filter)
    
    # Применяем сортировку
    if sort_by == 'date_asc':
        query = query.order_by(Order.created_at.asc())
    elif sort_by == 'date_desc':
        query = query.order_by(Order.created_at.desc())
    elif sort_by == 'amount_asc':
        query = query.order_by(Order.amount.asc())
    elif sort_by == 'amount_desc':
        query = query.order_by(Order.amount.desc())
    else:
        query = query.order_by(Order.created_at.desc())
    
    # Получаем заказы
    orders = query.all()
    
    return render_template(
        'admin/orders.html', 
        orders=orders,
        status_filter=status_filter,
        sort_by=sort_by
    )

@app.route('/admin/order/<int:order_id>')
@login_required
def admin_order_detail(order_id):
    """Admin order detail page"""
    order = Order.query.get_or_404(order_id)
    return render_template('admin/order_detail.html', order=order)

@app.route('/admin/order/<int:order_id>/complete', methods=['GET', 'POST'])
@login_required
def admin_order_complete(order_id):
    """Mark an order as completed and generate a VPN configuration"""
    order = Order.query.get_or_404(order_id)
    
    if order.status == 'completed':
        flash('Order is already completed', 'warning')
        return redirect(url_for('admin_order_detail', order_id=order.id))
    
    # Mark order as completed
    order.status = 'completed'
    order.paid_at = datetime.utcnow()
    
    # Get the associated product
    product = Product.query.get(order.product_id)
    
    # Get the user
    user = TelegramUser.query.get(order.user_id)
    
    # Generate a new VPN configuration
    try:
        # Create a user identifier
        user_email = f"tguser_{user.telegram_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Get inbounds that match the product type
        inbounds = xui_client.get_inbounds()
        matching_inbounds = [inb for inb in inbounds if inb.get("protocol") == product.config_type]
        
        if not matching_inbounds:
            raise ValueError(f"No inbound found for protocol: {product.config_type}")
        
        # Use the first matching inbound
        inbound = matching_inbounds[0]
        inbound_id = inbound.get("id")
        
        # Add client to 3x-ui
        client = xui_client.add_client(
            inbound_id=inbound_id,
            email=user_email,
            config_type=product.config_type,
            expiry_days=product.duration_days
        )
        
        # Generate config
        server_address = inbound.get("address") or request.host
        server_port = inbound.get("port")
        
        config_data = generate_config(
            config_type=product.config_type,
            user_email=user_email,
            server_address=server_address,
            server_port=server_port,
            uuid_str=client.get("id") or client.get("password")
        )
        
        # Store in our database
        config = VPNConfig(
            user_id=user.id,
            config_type=product.config_type,
            x_ui_client_id=client.get("id") or client.get("password"),
            name=f"{product.name} {datetime.utcnow().strftime('%d-%m-%Y')}",
            config_data=json.dumps(config_data),
            valid_until=datetime.utcnow() + timedelta(days=product.duration_days),
            is_active=True
        )
        
        db.session.add(config)
        order.config_id = config.id
        db.session.commit()
        
        flash('Order completed and VPN configuration generated successfully', 'success')
    
    except Exception as e:
        db.session.rollback()
        flash(f'Error generating VPN configuration: {str(e)}', 'danger')
    
    return redirect(url_for('admin_order_detail', order_id=order.id))

@app.route('/admin/order/<int:order_id>/cancel', methods=['GET', 'POST'])
@login_required
def admin_order_cancel(order_id):
    """Cancel an order"""
    order = Order.query.get_or_404(order_id)
    
    if order.status == 'completed':
        flash('Cannot cancel a completed order', 'danger')
    else:
        order.status = 'cancelled'
        db.session.commit()
        flash('Order cancelled successfully', 'success')
    
    return redirect(url_for('admin_order_detail', order_id=order.id))

@app.route('/admin/payment_methods', methods=['GET', 'POST'])
@login_required
def admin_payment_methods():
    """Admin payment method management"""
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        instructions = request.form.get('instructions')
        is_active = request.form.get('is_active') == 'on'
        
        payment_method = PaymentMethod(
            name=name,
            description=description,
            instructions=instructions,
            is_active=is_active
        )
        
        db.session.add(payment_method)
        db.session.commit()
        
        flash('Payment method added successfully', 'success')
        return redirect(url_for('admin_payment_methods'))
    
    payment_methods = PaymentMethod.query.all()
    return render_template('admin/payment_methods.html', payment_methods=payment_methods)

@app.route('/admin/payment_method/<int:method_id>/edit', methods=['GET', 'POST'])
@login_required
def admin_payment_method_edit(method_id):
    """Edit a payment method"""
    payment_method = PaymentMethod.query.get_or_404(method_id)
    
    if request.method == 'POST':
        payment_method.name = request.form.get('name')
        payment_method.description = request.form.get('description')
        payment_method.instructions = request.form.get('instructions')
        payment_method.is_active = request.form.get('is_active') == 'on'
        
        db.session.commit()
        
        flash('Способ оплаты успешно обновлен', 'success')
        return redirect(url_for('admin_payment_methods'))
    
    return render_template('admin/payment_method_edit.html', payment_method=payment_method)


@app.route('/admin/payment_method/<int:method_id>/json')
@login_required
def admin_payment_method_json(method_id):
    """Return payment method data as JSON for AJAX requests"""
    payment_method = PaymentMethod.query.get_or_404(method_id)
    
    return jsonify({
        'id': payment_method.id,
        'name': payment_method.name,
        'description': payment_method.description or '',
        'instructions': payment_method.instructions or '',
        'is_active': payment_method.is_active
    })

@app.route('/admin/payment_method/<int:method_id>/delete', methods=['POST'])
@login_required
def admin_payment_method_delete(method_id):
    """Delete a payment method"""
    payment_method = PaymentMethod.query.get_or_404(method_id)
    db.session.delete(payment_method)
    db.session.commit()
    
    flash('Payment method deleted successfully', 'success')
    return redirect(url_for('admin_payment_methods'))

@app.route('/admin/settings', methods=['GET', 'POST'])
@login_required
def admin_settings():
    """Admin settings page"""
    if request.method == 'POST':
        for key in request.form:
            if key.startswith('setting_'):
                setting_key = key[8:]  # Remove 'setting_' prefix
                setting_value = request.form.get(key)
                
                # Get or create setting
                setting = Settings.query.filter_by(key=setting_key).first()
                if setting:
                    setting.value = setting_value
                else:
                    setting = Settings(key=setting_key, value=setting_value)
                    db.session.add(setting)
        
        db.session.commit()
        flash('Settings updated successfully', 'success')
        return redirect(url_for('admin_settings'))
    
    # Get all settings
    settings = {setting.key: setting.value for setting in Settings.query.all()}
    
    return render_template('admin/settings.html', settings=settings)

@app.route('/admin/change_password', methods=['GET', 'POST'])
@login_required
def admin_change_password():
    """Change admin password"""
    if request.method == 'POST':
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        if not check_password_hash(current_user.password_hash, current_password):
            flash('Current password is incorrect', 'danger')
            return redirect(url_for('admin_change_password'))
        
        if new_password != confirm_password:
            flash('New passwords do not match', 'danger')
            return redirect(url_for('admin_change_password'))
        
        current_user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        
        flash('Password changed successfully', 'success')
        return redirect(url_for('admin_dashboard'))
    
    return render_template('admin/change_password.html')


@app.route('/admin/check_bot_token', methods=['POST'])
@login_required
def check_bot_token():
    """Check if the Telegram bot token is valid"""
    token = request.form.get('token')
    
    if not token:
        return jsonify({
            'success': False,
            'error': 'Токен не указан'
        })
    
    try:
        # Делаем запрос к Telegram API для получения информации о боте
        response = requests.get(f'https://api.telegram.org/bot{token}/getMe', timeout=5)
        data = response.json()
        
        if data.get('ok'):
            bot_info = data.get('result', {})
            return jsonify({
                'success': True,
                'bot_name': bot_info.get('first_name', 'Неизвестно'),
                'username': bot_info.get('username', 'Неизвестно')
            })
        else:
            return jsonify({
                'success': False,
                'error': data.get('description', 'Неизвестная ошибка')
            })
    
    except requests.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка соединения: {str(e)}'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {str(e)}'
        })


@app.route('/admin/clear_products_cache', methods=['GET', 'POST'])
@login_required
def admin_clear_products_cache():
    """Очистить кэш продуктов вручную (для админов)"""
    from main import clear_products_cache
    result = clear_products_cache()
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.headers.get('Accept') == 'application/json':
        return jsonify({
            'success': result,
            'message': 'Кэш продуктов успешно очищен' if result else 'Ошибка при очистке кэша продуктов'
        })
    else:
        if result:
            flash('Кэш продуктов успешно очищен', 'success')
        else:
            flash('Ошибка при очистке кэша продуктов', 'danger')
        # Возвращаемся на предыдущую страницу или на страницу продуктов
        return redirect(request.referrer or url_for('admin_products'))


@app.route('/admin/check_xui_connection', methods=['POST'])
@login_required
def check_xui_connection():
    """Check if the X-UI connection is valid"""
    url = request.form.get('url')
    username = request.form.get('username')
    password = request.form.get('password')
    
    if not url or not username or not password:
        return jsonify({
            'success': False,
            'error': 'Все поля должны быть заполнены'
        })
    
    try:
        # Создаем временный клиент для X-UI
        test_client = XUIClient(
            base_url=url,
            username=username,
            password=password
        )
        
        # Пробуем подключиться и получить статистику
        stats = test_client.get_stats()
        inbounds = test_client.get_inbounds()
        
        return jsonify({
            'success': True,
            'stats': stats,
            'inbounds_count': len(inbounds)
        })
    
    except XUIClientError as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка X-UI: {str(e)}'
        })
    except requests.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка соединения: {str(e)}'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка: {str(e)}'
        })
