"""
Utilities for VPN configuration generation and management
"""
import json
import base64
import uuid
import re
from datetime import datetime, timedelta

def generate_config(config_type, user_email, server_address, server_port, uuid_str=None):
    """
    Generate a VPN configuration based on the type
    
    Args:
        config_type (str): Type of VPN config (vless, vmess, etc.)
        user_email (str): User identifier/email
        server_address (str): VPN server address
        server_port (int): VPN server port
        uuid_str (str, optional): UUID for the user. If None, one will be generated.
        
    Returns:
        dict: Configuration data as a dictionary
    """
    if uuid_str is None:
        uuid_str = str(uuid.uuid4())
    
    # Default common parameters
    now = datetime.utcnow()
    config = {
        "id": uuid_str,
        "email": user_email,
        "created_at": now.isoformat(),
    }
    
    if config_type.lower() == "vless":
        config.update({
            "type": "vless",
            "flow": "",
            "network": "tcp",
            "tls": False,
            "address": server_address,
            "port": server_port,
            "encryption": "none"
        })
    
    elif config_type.lower() == "vmess":
        config.update({
            "type": "vmess",
            "network": "ws",
            "tls": True,
            "address": server_address,
            "port": server_port,
            "encryption": "auto",
            "alterId": 0,
            "security": "auto"
        })
    
    elif config_type.lower() == "trojan":
        config.update({
            "type": "trojan",
            "password": uuid_str,
            "address": server_address,
            "port": server_port,
            "network": "tcp",
            "tls": True,
            "security": "tls"
        })
    
    else:
        raise ValueError(f"Unsupported VPN configuration type: {config_type}")
    
    return config

def encode_vmess_config(config):
    """
    Encode a VMess configuration to the standard format
    
    Args:
        config (dict): VMess configuration dictionary
        
    Returns:
        str: Base64 encoded VMess configuration string
    """
    vmess_config = {
        "v": "2",
        "ps": config.get("name", "VPN Config"),
        "add": config["address"],
        "port": config["port"],
        "id": config["id"],
        "aid": config.get("alterId", 0),
        "net": config.get("network", "tcp"),
        "type": config.get("type", "none"),
        "host": config.get("host", ""),
        "path": config.get("path", ""),
        "tls": "tls" if config.get("tls", False) else ""
    }
    
    json_config = json.dumps(vmess_config)
    return f"vmess://{base64.b64encode(json_config.encode()).decode()}"

def format_vless_config(config):
    """
    Format a VLESS configuration string
    
    Args:
        config (dict): VLESS configuration dictionary
        
    Returns:
        str: VLESS configuration string in URI format
    """
    user_id = config["id"]
    address = config["address"]
    port = config["port"]
    encryption = config.get("encryption", "none")
    
    security = "tls" if config.get("tls", False) else "none"
    network = config.get("network", "tcp")
    
    params = [f"security={security}", f"type={network}"]
    
    # Add additional parameters based on the configuration
    if "path" in config and config["path"]:
        params.append(f"path={config['path']}")
    
    if "host" in config and config["host"]:
        params.append(f"host={config['host']}")
    
    if "flow" in config and config["flow"]:
        params.append(f"flow={config['flow']}")
    
    params_str = "&".join(params)
    
    return f"vless://{user_id}@{address}:{port}?{params_str}#{config.get('name', 'VPN Config')}"

def format_trojan_config(config):
    """
    Format a Trojan configuration string
    
    Args:
        config (dict): Trojan configuration dictionary
        
    Returns:
        str: Trojan configuration string in URI format
    """
    password = config.get("password", config["id"])
    address = config["address"]
    port = config["port"]
    
    params = []
    
    if "sni" in config and config["sni"]:
        params.append(f"sni={config['sni']}")
    
    if "alpn" in config and config["alpn"]:
        params.append(f"alpn={config['alpn']}")
    
    params_str = "&".join(params)
    params_part = f"?{params_str}" if params_str else ""
    
    return f"trojan://{password}@{address}:{port}{params_part}#{config.get('name', 'VPN Config')}"

def format_config_for_user(vpn_config):
    """
    Format a VPN configuration for user display/export
    
    Args:
        vpn_config: VPNConfig model instance
        
    Returns:
        str: Formatted configuration string suitable for client import
    """
    config_data = json.loads(vpn_config.config_data)
    
    # Add the name if not present
    if "name" not in config_data:
        config_data["name"] = vpn_config.name
    
    # Format based on the config type
    if vpn_config.config_type.lower() == "vmess":
        return encode_vmess_config(config_data)
    elif vpn_config.config_type.lower() == "vless":
        return format_vless_config(config_data)
    elif vpn_config.config_type.lower() == "trojan":
        return format_trojan_config(config_data)
    else:
        return json.dumps(config_data, indent=2)

def parse_imported_config(config_str):
    """
    Parse an imported VPN configuration string
    
    Args:
        config_str (str): VPN configuration string to parse
        
    Returns:
        tuple: (config_type, config_data)
    """
    config_str = config_str.strip()
    
    # Check for VMess
    if config_str.startswith("vmess://"):
        encoded_part = config_str[8:]  # Remove "vmess://"
        try:
            decoded = base64.b64decode(encoded_part).decode()
            config_data = json.loads(decoded)
            return "vmess", {
                "type": "vmess",
                "id": config_data.get("id"),
                "address": config_data.get("add"),
                "port": int(config_data.get("port", 443)),
                "network": config_data.get("net", "tcp"),
                "tls": config_data.get("tls") == "tls",
                "path": config_data.get("path", ""),
                "host": config_data.get("host", ""),
                "alterId": int(config_data.get("aid", 0)),
                "name": config_data.get("ps", "Imported VMess")
            }
        except:
            raise ValueError("Invalid VMess configuration format")
    
    # Check for VLESS
    elif config_str.startswith("vless://"):
        vless_pattern = r"vless://([a-f0-9-]+)@([^:]+):(\d+)\?(.*?)(?:#(.*?))?$"
        match = re.match(vless_pattern, config_str)
        
        if not match:
            raise ValueError("Invalid VLESS configuration format")
        
        user_id, address, port, params_str, name = match.groups()
        name = name or "Imported VLESS"
        
        params = {}
        for param in params_str.split("&"):
            if "=" in param:
                key, value = param.split("=", 1)
                params[key] = value
        
        return "vless", {
            "type": "vless",
            "id": user_id,
            "address": address,
            "port": int(port),
            "encryption": "none",
            "tls": params.get("security") == "tls",
            "network": params.get("type", "tcp"),
            "path": params.get("path", ""),
            "host": params.get("host", ""),
            "flow": params.get("flow", ""),
            "name": name
        }
    
    # Check for Trojan
    elif config_str.startswith("trojan://"):
        trojan_pattern = r"trojan://([^@]+)@([^:]+):(\d+)(?:\?(.*?))?(?:#(.*?))?$"
        match = re.match(trojan_pattern, config_str)
        
        if not match:
            raise ValueError("Invalid Trojan configuration format")
        
        password, address, port, params_str, name = match.groups()
        name = name or "Imported Trojan"
        
        params = {}
        if params_str:
            for param in params_str.split("&"):
                if "=" in param:
                    key, value = param.split("=", 1)
                    params[key] = value
        
        return "trojan", {
            "type": "trojan",
            "password": password,
            "id": password,  # For compatibility
            "address": address,
            "port": int(port),
            "tls": True,  # Trojan always uses TLS
            "sni": params.get("sni", ""),
            "alpn": params.get("alpn", ""),
            "name": name
        }
    
    else:
        # Try to parse as JSON
        try:
            config_data = json.loads(config_str)
            if "type" in config_data:
                return config_data["type"], config_data
        except:
            pass
        
        raise ValueError("Unsupported or invalid configuration format")
