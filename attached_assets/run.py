#!/usr/bin/env python
"""
Utility script to launch the application with environment variables from .env
"""
import os
import sys
import subprocess
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

def main():
    """
    Main entry point
    """
    # Load environment variables
    load_env_file()
    
    # Check if Telegram Bot Token is available
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if token:
        logger.info(f"TELEGRAM_BOT_TOKEN loaded: {token[:5]}...{token[-5:] if len(token) > 10 else '***'}")
    else:
        logger.warning("TELEGRAM_BOT_TOKEN not set!")
    
    # Import and run our actual application
    logger.info("Starting application...")
    import main
    from app import app
    
    # Run Flask application
    app.run(host="0.0.0.0", port=5000, debug=True)

if __name__ == "__main__":
    main()