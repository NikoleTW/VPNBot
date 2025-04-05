"""
Configuration settings for the VPN Telegram Bot
"""
import os

# Bot settings
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

# Database settings
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///vpn_bot.db")

# 3x-ui panel settings
XUI_PANEL_URL = os.environ.get("XUI_PANEL_URL", "http://localhost:54321")
XUI_USERNAME = os.environ.get("XUI_USERNAME", "admin")
XUI_PASSWORD = os.environ.get("XUI_PASSWORD", "admin")

# Admin panel settings
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
