# config.py - VERSIÓN DEMO CON SWITCH MANUAL
import logging
import sys
import os
import socket

# =======================================
# SWITCH MANUAL PARA DEMO
# =======================================

# 🚀 CAMBIAR ESTA VARIABLE PARA DEMO:
# True  = Forzar IPv6 (para demostración)
# False = Usar IPv4 (para desarrollo con red móvil)
FORCE_IPV6_DEMO = True  # 👈 CAMBIAR A True PARA DEMO IPv6

print(f"🔧 MODO DEMO: {'IPv6 FORZADO' if FORCE_IPV6_DEMO else 'IPv4 PREFERIDO'}")

# =======================================
# DETECCIÓN AUTOMÁTICA DE CONECTIVIDAD
# =======================================

def detect_connectivity():
    """Detectar qué protocolos están disponibles"""
    ipv4_available = False
    ipv6_available = False
    
    # Probar IPv4
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind(('127.0.0.1', 0))
        sock.close()
        ipv4_available = True
    except:
        pass
    
    # Probar IPv6
    try:
        sock = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        sock.bind(('::1', 0))
        sock.close()
        ipv6_available = True
    except:
        pass
    
    return ipv4_available, ipv6_available

# Detectar conectividad al cargar el módulo
IPV4_AVAILABLE, IPV6_AVAILABLE = detect_connectivity()

# =======================================
# CONFIGURACIÓN DE RED ADAPTATIVA
# =======================================

# Puertos (iguales para ambos protocolos)
UDP_PORT = 1234       
WEBSOCKET_PORT = 8765 
HTTP_PORT = 8080      

# Configuración base según modo demo
if FORCE_IPV6_DEMO and IPV6_AVAILABLE:
    # 🎯 MODO DEMO IPv6
    PROTOCOL = "IPv6"
    BIND_ADDRESS = "::"
    LOCALHOST = "::1"
    FAMILY = socket.AF_INET6
    YOUR_GLOBAL_IP = "2803:d100:e580:1222:a0c8:a5f4:f585:1f90"
    print("📡 CONFIGURADO PARA DEMO IPv6")
    
elif IPV4_AVAILABLE:
    # 🔧 MODO DESARROLLO IPv4
    PROTOCOL = "IPv4"
    BIND_ADDRESS = "0.0.0.0"
    LOCALHOST = "127.0.0.1"
    FAMILY = socket.AF_INET
    YOUR_GLOBAL_IP = "192.168.120.161"
    print("📱 CONFIGURADO PARA DESARROLLO IPv4")
    
elif IPV6_AVAILABLE:
    # 🆘 FALLBACK IPv6
    PROTOCOL = "IPv6"
    BIND_ADDRESS = "::"
    LOCALHOST = "::1"
    FAMILY = socket.AF_INET6
    YOUR_GLOBAL_IP = "2803:d100:e580:1222:a0c8:a5f4:f585:1f90"
    print("🆘 FALLBACK A IPv6")
    
else:
    raise Exception("No hay conectividad IPv4 ni IPv6 disponible")

# =======================================
# INFORMACIÓN DE DEMO
# =======================================

def print_demo_info():
    """Mostrar información específica para demo"""
    logger = logging.getLogger(__name__)
    
    logger.info("🎭 INFORMACIÓN PARA DEMOSTRACIÓN:")
    logger.info("=" * 60)
    
    if PROTOCOL == "IPv6":
        logger.info("📡 MODO: DEMOSTRACIÓN IPv6")
        logger.info("🎯 PARA CAMBIAR A IPv4:")
        logger.info("   1. config.py → FORCE_IPV6_DEMO = False")
        logger.info("   2. Reiniciar backend y simulador")
        
        logger.info("🌐 URLs DEMO IPv6:")
        logger.info(f"   Frontend: http://[::1]:3000")
        logger.info(f"   API:      http://[::1]:{HTTP_PORT}/api/health")
        logger.info(f"   Backend:  [{YOUR_GLOBAL_IP}]:{UDP_PORT}")
        
    else:
        logger.info("📱 MODO: DESARROLLO IPv4")  
        logger.info("🎯 PARA DEMO IPv6:")
        logger.info("   1. Conectarse a red WiFi con IPv6")
        logger.info("   2. config.py → FORCE_IPV6_DEMO = True")
        logger.info("   3. Reiniciar backend y simulador")
        
        local_ip = get_local_ip()
        logger.info("🌐 URLs DESARROLLO IPv4:")
        logger.info(f"   Frontend: http://localhost:3000")
        logger.info(f"   API:      http://localhost:{HTTP_PORT}/api/health")
        logger.info(f"   Backend:  {local_ip}:{UDP_PORT}")
    
    logger.info("=" * 60)

# =======================================
# RESTO DE LA CONFIGURACIÓN (igual que antes)
# =======================================

# Compatibilidad con código existente
if PROTOCOL == "IPv4":
    IPv6_BIND_ALL = "0.0.0.0"
    IPv6_LOCALHOST = "127.0.0.1"
    IPv6_ARDUINO = YOUR_GLOBAL_IP
else:
    IPv6_BIND_ALL = "::" # BIND_ADDRESS if PROTOCOL == "IPv6" else "::"
    IPv6_LOCALHOST = LOCALHOST if PROTOCOL == "IPv6" else "::1"  
    IPv6_ARDUINO = YOUR_GLOBAL_IP

IPv4_BIND_ALL = BIND_ADDRESS if PROTOCOL == "IPv4" else "0.0.0.0"
IPv4_LOCALHOST = LOCALHOST if PROTOCOL == "IPv4" else "127.0.0.1"

DATABASE_FILE = "sensor_data.db"
LOG_LEVEL = logging.INFO
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LDR_THRESHOLD = 5           
MIN_SEND_INTERVAL = 100     
MAX_HISTORY_RECORDS = 1000  
WS_PING_INTERVAL = 30       
MAX_CONNECTED_CLIENTS = 50  
HTTP_TIMEOUT = 5            

def setup_logging():
    """Configurar logging con información de demo"""
    formatter = logging.Formatter(LOG_FORMAT)
    
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    file_handler = logging.FileHandler('sensor_system.log', encoding='utf-8')
    file_handler.setFormatter(formatter)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(LOG_LEVEL)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    
    logger = logging.getLogger(__name__)
    
    # Log de configuración detectada
    logger.info(f"🔧 Modo: {'DEMO IPv6' if FORCE_IPV6_DEMO else 'DESARROLLO IPv4'}")
    logger.info(f"Protocolo activo: {PROTOCOL}")
    logger.info(f"IPv4 disponible: {'✅' if IPV4_AVAILABLE else '❌'}")
    logger.info(f"IPv6 disponible: {'✅' if IPV6_AVAILABLE else '❌'}")
    
    # Mostrar información específica para demo
    print_demo_info()
    
    return logger

def get_local_ip():
    """Obtener IP local del sistema"""
    try:
        if PROTOCOL == "IPv4":
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect(("8.8.8.8", 80))
            local_ip = sock.getsockname()[0]
            sock.close()
            return local_ip
        else:
            return YOUR_GLOBAL_IP
    except:
        return LOCALHOST

def print_access_info():
    """Mostrar información de acceso para demo"""
    logger = logging.getLogger(__name__)
    local_ip = get_local_ip()
    
    logger.info("=" * 70)
    logger.info(f"INFORMACION DE ACCESO - {PROTOCOL}")
    logger.info("=" * 70)
    
    if PROTOCOL == "IPv4":
        logger.info("📱 ACCESO DESARROLLO IPv4:")
        logger.info(f"   Frontend: http://localhost:3000")
        logger.info(f"   API Test: http://localhost:{HTTP_PORT}/api/health")
        logger.info(f"   Simulador: {local_ip}:{UDP_PORT}")
        
    else:
        logger.info("🎭 ACCESO DEMO IPv6:")
        logger.info(f"   Frontend: http://[::1]:3000")
        logger.info(f"   API Test: http://[::1]:{HTTP_PORT}/api/health")
        logger.info(f"   Simulador: [{YOUR_GLOBAL_IP}]:{UDP_PORT}")
    
    logger.info("=" * 70)

def check_protocol_support():
    """Verificar si el protocolo seleccionado funciona"""
    try:
        if PROTOCOL == "IPv4":
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((LOCALHOST, 0))
            port = sock.getsockname()[1]
            sock.close()
        else:
            sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((LOCALHOST, 0))
            port = sock.getsockname()[1]
            sock.close()
        
        logger = logging.getLogger(__name__)
        logger.info(f"{PROTOCOL} funcional - puerto de prueba: {port}")
        return True
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"{PROTOCOL} no funcional: {e}")
        return False

# Funciones de compatibilidad IPv6
def check_ipv6_support():
    return IPV6_AVAILABLE and check_protocol_support() if PROTOCOL == "IPv6" else IPV6_AVAILABLE

def configure_ipv6_windows():
    if not sys.platform.startswith('win'):
        return True
    
    logger = logging.getLogger(__name__)
    
    try:
        import subprocess
        result = subprocess.run(['netsh', 'interface', 'ipv6', 'show', 'global'], 
                              capture_output=True, text=True)
        
        if 'disabled' in result.stdout.lower():
            logger.warning("IPv6 está deshabilitado en Windows")
            logger.info("Para habilitar IPv6, ejecuta como administrador:")
            logger.info("netsh interface ipv6 set global randomizeidentifiers=disabled")
            logger.info("netsh interface ipv6 set privacy state=disabled")
            return False
        
        logger.info("IPv6 configurado en Windows")
        return True
        
    except Exception as e:
        logger.warning(f"No se pudo verificar configuración IPv6: {e}")
        return False

def print_ipv6_access_info():
    print_access_info()

def create_socket(socket_type=socket.SOCK_DGRAM):
    return socket.socket(FAMILY, socket_type)

def get_server_urls():
    local_ip = get_local_ip()
    
    if PROTOCOL == "IPv4":
        return {
            'localhost': {
                'api': f"http://localhost:{HTTP_PORT}",
                'websocket': f"ws://localhost:{WEBSOCKET_PORT}",
                'frontend': f"http://localhost:3000"
            },
            'network': {
                'api': f"http://{local_ip}:{HTTP_PORT}",
                'websocket': f"ws://{local_ip}:{WEBSOCKET_PORT}",
                'frontend': f"http://{local_ip}:3000"
            }
        }
    else:
        return {
            'localhost': {
                'api': f"http://[::1]:{HTTP_PORT}",
                'websocket': f"ws://[::1]:{WEBSOCKET_PORT}",
                'frontend': f"http://[::1]:3000"
            },
            'network': {
                'api': f"http://[{local_ip}]:{HTTP_PORT}",
                'websocket': f"ws://[{local_ip}]:{WEBSOCKET_PORT}",
                'frontend': f"http://[{local_ip}]:3000"
            }
        }

def get_simulator_target():
    if PROTOCOL == "IPv4":
        return get_local_ip()
    else:
        return YOUR_GLOBAL_IP