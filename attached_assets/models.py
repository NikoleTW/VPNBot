"""
Database models for the VPN Telegram Bot application
"""
from datetime import datetime
from app import db
from flask_login import UserMixin

class Admin(UserMixin, db.Model):
    """Admin user model for web panel access"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    
    def __repr__(self):
        return f'<Admin {self.username}>'

class TelegramUser(db.Model):
    """Model representing a Telegram user"""
    id = db.Column(db.Integer, primary_key=True)
    telegram_id = db.Column(db.BigInteger, unique=True, nullable=False)
    username = db.Column(db.String(64))
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_blocked = db.Column(db.Boolean, default=False)
    
    # Relationships
    vpn_configs = db.relationship('VPNConfig', backref='owner', lazy=True)
    orders = db.relationship('Order', backref='user', lazy=True)
    
    def __repr__(self):
        return f'<TelegramUser {self.telegram_id}>'

class VPNConfig(db.Model):
    """VPN configuration associated with a user"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('telegram_user.id'), nullable=False)
    config_type = db.Column(db.String(20), nullable=False)  # e.g., 'vless', 'vmess', etc.
    x_ui_client_id = db.Column(db.Integer)  # Client ID in 3x-ui panel
    name = db.Column(db.String(100), nullable=False)
    config_data = db.Column(db.Text, nullable=False)  # Full configuration data
    valid_until = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<VPNConfig {self.id} ({self.config_type})>'
    
    @property
    def is_expired(self):
        return datetime.utcnow() > self.valid_until

class Product(db.Model):
    """VPN subscription product options"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    duration_days = db.Column(db.Integer, nullable=False)  # Subscription duration in days
    config_type = db.Column(db.String(20), nullable=False)  # VPN protocol type
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    orders = db.relationship('Order', backref='product', lazy=True)
    
    def __repr__(self):
        return f'<Product {self.name} ({self.price})>'

class Order(db.Model):
    """User orders/purchases"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('telegram_user.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    config_id = db.Column(db.Integer, db.ForeignKey('vpn_config.id'), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, completed, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    paid_at = db.Column(db.DateTime)
    
    # Reference to created VPN config
    vpn_config = db.relationship('VPNConfig', backref='order', lazy=True, foreign_keys=[config_id])
    
    def __repr__(self):
        return f'<Order {self.id} ({self.status})>'

class PaymentMethod(db.Model):
    """Available payment methods"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    
    def __repr__(self):
        return f'<PaymentMethod {self.name}>'

class Settings(db.Model):
    """Global application settings"""
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    
    def __repr__(self):
        return f'<Settings {self.key}>'
