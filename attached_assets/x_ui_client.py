"""
Client for interacting with the 3x-ui panel API
"""
import json
import logging
import requests
from datetime import datetime, timedelta
from urllib.parse import urljoin
from uuid import uuid4

class XUIClientError(Exception):
    """Exception class for XUI client errors"""
    pass

class XUIClient:
    """Client for interacting with 3x-ui panel"""
    def __init__(self, base_url, username, password):
        """
        Initialize the 3x-ui client
        
        Args:
            base_url (str): Base URL of the 3x-ui panel
            username (str): Admin username
            password (str): Admin password
        """
        self.base_url = base_url
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.token = None
        self.logger = logging.getLogger(__name__)
    
    def _login(self):
        """
        Log in to the 3x-ui panel and obtain a session token
        
        Returns:
            bool: True if login successful, False otherwise
        """
        # ЗАГЛУШКА для тестирования
        self.logger.info("[MOCK] Successfully logged in to 3x-ui panel")
        return True
    
    def _ensure_login(self):
        """Ensure the client is logged in"""
        # ЗАГЛУШКА для тестирования
        # Просто вызываем _login, чтобы вывести в лог сообщение
        self._login()
    
    def get_inbounds(self):
        """
        Get all inbound configurations
        
        Returns:
            list: List of inbound configurations
        """
        # ЗАГЛУШКА для тестирования
        self.logger.info("[MOCK] Getting all inbounds")
        return [
            {
                "id": 1,
                "port": 10000,
                "protocol": "vless",
                "settings": json.dumps({"clients": []})
            },
            {
                "id": 2,
                "port": 20000,
                "protocol": "vmess",
                "settings": json.dumps({"clients": []})
            },
            {
                "id": 3,
                "port": 30000,
                "protocol": "trojan",
                "settings": json.dumps({"clients": []})
            }
        ]
    
    def get_inbound(self, inbound_id):
        """
        Get a specific inbound configuration
        
        Args:
            inbound_id (int): ID of the inbound
            
        Returns:
            dict: Inbound configuration
        """
        # ЗАГЛУШКА для тестирования
        self.logger.info(f"[MOCK] Getting inbound {inbound_id}")
        
        # Создаем фиктивный inbound в зависимости от ID
        if inbound_id == 1:
            return {
                "id": 1,
                "port": 10000,
                "protocol": "vless",
                "settings": json.dumps({"clients": []})
            }
        elif inbound_id == 2:
            return {
                "id": 2,
                "port": 20000,
                "protocol": "vmess",
                "settings": json.dumps({"clients": []})
            }
        elif inbound_id == 3:
            return {
                "id": 3,
                "port": 30000,
                "protocol": "trojan",
                "settings": json.dumps({"clients": []})
            }
        else:
            return {
                "id": inbound_id,
                "port": 40000,
                "protocol": "vless",
                "settings": json.dumps({"clients": []})
            }
    
    def add_client(self, inbound_id, email, config_type, uuid=None, expiry_days=30):
        """
        Add a client to an inbound
        
        Args:
            inbound_id (int): ID of the inbound
            email (str): Email/identifier for the client
            config_type (str): Type of VPN config (vless, vmess, etc.)
            uuid (str, optional): UUID for the client. If None, one will be generated.
            expiry_days (int): Number of days until the client expires
            
        Returns:
            dict: Client configuration data
        """
        # ЗАГЛУШКА для тестирования без реальной 3x-ui панели
        self.logger.info(f"[MOCK] Adding client with email {email} and type {config_type}")
        
        # Generate expiry time
        expiry_time = int((datetime.now() + timedelta(days=expiry_days)).timestamp() * 1000)
        client_uuid = uuid or str(uuid4())
        
        # Create new client based on the protocol type
        new_client = {
            "email": email,
            "enable": True,
            "expiryTime": expiry_time
        }
        
        if config_type.lower() == "vless":
            new_client.update({
                "id": client_uuid,
                "flow": "",
                "limitIp": 0,
                "totalGB": 0
            })
        
        elif config_type.lower() == "vmess":
            new_client.update({
                "id": client_uuid,
                "alterId": 0,
                "limitIp": 0,
                "totalGB": 0
            })
        
        elif config_type.lower() == "trojan":
            new_client.update({
                "password": client_uuid,
                "limitIp": 0,
                "totalGB": 0
            })
        
        else:
            raise XUIClientError(f"Unsupported protocol: {config_type}")
            
        return new_client
    
    def remove_client(self, inbound_id, email):
        """
        Remove a client from an inbound
        
        Args:
            inbound_id (int): ID of the inbound
            email (str): Email/identifier of the client to remove
            
        Returns:
            bool: True if client was removed, False otherwise
        """
        # ЗАГЛУШКА для тестирования
        self.logger.info(f"[MOCK] Removing client with email {email} from inbound {inbound_id}")
        return True
    
    def update_client(self, inbound_id, email, new_expiry_days=None, enable=None):
        """
        Update a client's properties
        
        Args:
            inbound_id (int): ID of the inbound
            email (str): Email/identifier of the client
            new_expiry_days (int, optional): New expiry time in days from now
            enable (bool, optional): Whether to enable or disable the client
            
        Returns:
            dict: Updated client data
        """
        # ЗАГЛУШКА для тестирования
        self.logger.info(f"[MOCK] Updating client with email {email} in inbound {inbound_id}")
        
        # Создаем фиктивный объект клиента
        expiry_time = int((datetime.now() + timedelta(days=new_expiry_days if new_expiry_days is not None else 30)).timestamp() * 1000)
        
        updated_client = {
            "email": email,
            "enable": enable if enable is not None else True,
            "expiryTime": expiry_time,
            "id": str(uuid4()),
            "flow": "",
            "limitIp": 0,
            "totalGB": 0
        }
        
        return updated_client
    
    def get_stats(self):
        """
        Get system stats
        
        Returns:
            dict: System statistics
        """
        # ЗАГЛУШКА для тестирования
        self.logger.info("[MOCK] Getting system stats")
        
        # Возвращаем фиктивную статистику
        return {
            "cpu": 10.5,
            "memory": 30.2,
            "disk": 45.6,
            "xray": "running",
            "uptime": 86400,  # 1 день в секундах
            "netTraffic": {
                "sent": "1.2 GB",
                "recv": "3.5 GB"
            },
            "netSpeed": {
                "sent": "1.5 MB/s",
                "recv": "2.3 MB/s"
            }
        }
