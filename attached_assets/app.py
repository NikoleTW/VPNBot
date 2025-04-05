"""
Flask application setup with SQLAlchemy and routes
"""
import os
from flask import Flask, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_login import LoginManager, current_user

class Base(DeclarativeBase):
    pass

# Initialize SQLAlchemy with the Base model class
db = SQLAlchemy(model_class=Base)

# Create the Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key")

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///vpn_bot.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with the extension
db.init_app(app)

# Setup login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'admin_login'

@login_manager.user_loader
def load_user(user_id):
    from models import Admin
    return Admin.query.get(int(user_id))

with app.app_context():
    # Import models here to ensure they're registered with SQLAlchemy
    import models
    
    # Create database tables if they don't exist
    db.create_all()
    
    # Ensure default admin exists
    from models import Admin
    from werkzeug.security import generate_password_hash
    
    default_admin = Admin.query.filter_by(username='admin').first()
    if not default_admin:
        default_admin = Admin(
            username='admin',
            password_hash=generate_password_hash(os.environ.get('ADMIN_PASSWORD', 'admin'))
        )
        db.session.add(default_admin)
        db.session.commit()

# Import routes after database initialization
from admin_panel import *

# Define home route
@app.route('/')
def home():
    if current_user.is_authenticated:
        return redirect(url_for('admin_dashboard'))
    return redirect(url_for('admin_login'))
