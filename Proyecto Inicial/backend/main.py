# main.py - SISTEMA DUAL IPv4/IPv6
import asyncio
import signal
import sys
import logging
from config import (
    setup_logging, check_protocol_support, print_access_info, 
    PROTOCOL, BIND_ADDRESS, FAMILY, IPV4_AVAILABLE, IPV6_AVAILABLE,
    get_local_ip, get_server_urls
)
from udp_server import create_udp_server
from websocket_server import create_websocket_server  
from http_server import create_http_server

# Configurar logging
logger = setup_logging()

class SensorSystemDual:
    """Sistema principal con soporte dual IPv4/IPv6"""
    
    def __init__(self):
        self.udp_server = None
        self.websocket_server = None
        self.http_server = None
        self.running = False
        self.loop = None
        self.protocol = PROTOCOL
        self.local_ip = get_local_ip()
    
    async def start(self):
        """Iniciar todo el sistema con protocolo adaptativo"""
        if self.running:
            logger.warning("Sistema ya está corriendo")
            return False
        
        logger.info(f"INICIANDO Sistema de Monitoreo LDR - {self.protocol}...")
        
        # Verificar soporte del protocolo seleccionado
        if not check_protocol_support():
            logger.error(f"{self.protocol} NO está disponible o configurado correctamente")
            
            if self.protocol == "IPv6" and sys.platform.startswith('win'):
                logger.error("SOLUCION WINDOWS IPv6:")
                logger.error("1. Ejecuta CMD como Administrador")
                logger.error("2. netsh interface ipv6 set global randomizeidentifiers=disabled")
                logger.error("3. netsh interface ipv6 set privacy state=disabled")
                logger.error("4. Reinicia el sistema")
                logger.info("O usa IPv4 que funciona inmediatamente")
            elif self.protocol == "IPv4":
                logger.error("IPv4 no disponible - verifica configuración de red")
            
            # Intentar fallback
            if self.protocol == "IPv6" and IPV4_AVAILABLE:
                logger.info("Intentando fallback a IPv4...")
                self._switch_to_ipv4()
            elif self.protocol == "IPv4" and IPV6_AVAILABLE:
                logger.info("Intentando fallback a IPv6...")
                self._switch_to_ipv6()
            else:
                return False
        
        logger.info(f"{self.protocol} CONFIRMADO y funcional")
        logger.info(f"Protocolo: {self.protocol}")
        logger.info(f"Bind address: {BIND_ADDRESS} (todas las interfaces {self.protocol})")
        logger.info(f"IP local: {self.local_ip}")
        
        try:
            # Configurar loop de eventos
            self.loop = asyncio.get_event_loop()
            
            # Crear servidores con protocolo adaptativo
            self.udp_server = create_udp_server(callback=self._on_data_received)
            self.websocket_server = create_websocket_server()
            self.http_server = create_http_server()
            
            # Iniciar servidor HTTP
            logger.info(f"Iniciando servidor HTTP {self.protocol}...")
            if not self.http_server.start_server():
                raise Exception(f"No se pudo iniciar servidor HTTP {self.protocol}")
            
            # Iniciar servidor WebSocket
            logger.info(f"Iniciando servidor WebSocket {self.protocol}...")
            if not await self.websocket_server.start(self.loop):
                logger.warning(f"WebSocket {self.protocol} falló, continuando sin tiempo real")
            
            # Iniciar servidor UDP
            logger.info(f"Iniciando servidor UDP {self.protocol}...")
            if not self.udp_server.start():
                logger.warning(f"UDP {self.protocol} falló, continuando sin recepción Arduino")
            
            self.running = True
            
            # Mostrar información de acceso
            self._log_system_status()
            print_access_info()
            
            logger.info(f"SISTEMA {self.protocol} INICIADO CORRECTAMENTE")
            return True
            
        except Exception as e:
            logger.error(f"ERROR iniciando sistema {self.protocol}: {e}")
            await self.stop()
            return False
    
    def _switch_to_ipv4(self):
        """Cambiar a IPv4 como fallback"""
        global PROTOCOL, BIND_ADDRESS, FAMILY, LOCALHOST
        import socket
        from config import config
        
        config.PROTOCOL = "IPv4"
        config.BIND_ADDRESS = "0.0.0.0"
        config.FAMILY = socket.AF_INET
        config.LOCALHOST = "127.0.0.1"
        
        self.protocol = "IPv4"
        logger.info("Cambiado a IPv4")
    
    def _switch_to_ipv6(self):
        """Cambiar a IPv6 como fallback"""
        global PROTOCOL, BIND_ADDRESS, FAMILY, LOCALHOST
        import socket
        from config import config
        
        config.PROTOCOL = "IPv6"
        config.BIND_ADDRESS = "::"
        config.FAMILY = socket.AF_INET6
        config.LOCALHOST = "::1"
        
        self.protocol = "IPv6"
        logger.info("Cambiado a IPv6")
    
    async def stop(self):
        """Detener todo el sistema"""
        if not self.running:
            return
        
        logger.info(f"DETENIENDO sistema {self.protocol}...")
        self.running = False
        
        # Detener servidores en orden
        if self.udp_server:
            self.udp_server.stop()
        
        if self.websocket_server:
            await self.websocket_server.stop()
        
        if self.http_server:
            self.http_server.stop_server()
        
        logger.info(f"SISTEMA {self.protocol} DETENIDO")
    
    def _on_data_received(self, ldr_value, client_address):
        """Callback cuando se reciben datos del Arduino"""
        # Formatear dirección según protocolo
        if self.protocol == "IPv6":
            client_display = f"[{client_address}]"
        else:
            client_display = client_address
        
        logger.info(f"Arduino {self.protocol} {client_display}: {ldr_value}")
        
        # Notificar a clientes WebSocket
        if self.websocket_server and self.websocket_server.is_running():
            try:
                # Programar broadcast en el loop de eventos
                asyncio.run_coroutine_threadsafe(
                    self.websocket_server.broadcast_change(ldr_value),
                    self.loop
                )
            except Exception as e:
                logger.error(f"Error enviando broadcast {self.protocol}: {e}")
    
    def _log_system_status(self):
        """Log del estado del sistema"""
        logger.info(f"Estado del Sistema {self.protocol}:")
        logger.info(f"   UDP Server {self.protocol}:       {'OK' if self.udp_server.is_running() else 'ERROR'}")
        logger.info(f"   WebSocket Server {self.protocol}: {'OK' if self.websocket_server.is_running() else 'ERROR'}")
        logger.info(f"   HTTP API Server {self.protocol}:  {'OK' if self.http_server.is_running() else 'ERROR'}")
        logger.info(f"   Clientes conectados: {self.websocket_server.get_connected_count()}")
        
        # URLs del sistema
        urls = get_server_urls()
        logger.info("URLs del sistema:")
        logger.info(f"   API (local):    {urls['localhost']['api']}")
        logger.info(f"   WebSocket (local): {urls['localhost']['websocket']}")
        logger.info(f"   Frontend (local):  {urls['localhost']['frontend']}")
        
        # Endpoints disponibles
        logger.info(f"Endpoints API {self.protocol} disponibles:")
        logger.info("   GET /api/health   - Estado del sistema")
        logger.info("   GET /api/latest   - Última lectura")
        logger.info("   GET /api/history  - Historial (limit=N)")
        logger.info("   GET /api/stats    - Estadísticas")
        logger.info("   GET /api/network  - Info de red")
    
    def get_system_info(self):
        """Obtener información del sistema para debugging"""
        return {
            'protocol': self.protocol,
            'local_ip': self.local_ip,
            'bind_address': BIND_ADDRESS,
            'running': self.running,
            'servers': {
                'udp': self.udp_server.is_running() if self.udp_server else False,
                'websocket': self.websocket_server.is_running() if self.websocket_server else False,
                'http': self.http_server.is_running() if self.http_server else False
            },
            'connected_clients': self.websocket_server.get_connected_count() if self.websocket_server else 0,
            'urls': get_server_urls()
        }

# Instancia global del sistema
system = SensorSystemDual()

async def signal_handler(sig, frame):
    """Manejar señales del sistema (Ctrl+C)"""
    logger.info(f"Señal recibida: {sig}")
    await system.stop()
    sys.exit(0)

def show_startup_banner():
    """Mostrar banner de inicio con información del sistema"""
    logger.info("=" * 70)
    logger.info("SISTEMA DE MONITOREO AMBIENTAL LDR - DUAL PROTOCOL")
    logger.info("Soporte automático para IPv4 e IPv6")
    logger.info("=" * 70)
    logger.info(f"Configuración detectada:")
    logger.info(f"   IPv4 disponible: {'✅ SÍ' if IPV4_AVAILABLE else '❌ NO'}")
    logger.info(f"   IPv6 disponible: {'✅ SÍ' if IPV6_AVAILABLE else '❌ NO'}")
    logger.info(f"   Protocolo seleccionado: {PROTOCOL}")
    logger.info(f"   IP local detectada: {get_local_ip()}")
    logger.info("=" * 70)

def show_access_summary():
    """Mostrar resumen de acceso después del inicio"""
    urls = get_server_urls()
    
    logger.info("🚀 SISTEMA INICIADO - INFORMACIÓN DE ACCESO:")
    logger.info("=" * 50)
    
    if PROTOCOL == "IPv4":
        logger.info("📱 ACCESO DESDE TU DISPOSITIVO ACTUAL:")
        logger.info(f"   Frontend:  {urls['localhost']['frontend']}")
        logger.info(f"   API Test:  {urls['localhost']['api']}/api/health")
        logger.info(f"   WebSocket: {urls['localhost']['websocket']}")
        
        logger.info("\n📡 ACCESO DESDE OTROS DISPOSITIVOS EN LA RED:")
        logger.info(f"   Frontend:  {urls['network']['frontend']}")
        logger.info(f"   API:       {urls['network']['api']}/api/")
        logger.info(f"   WebSocket: {urls['network']['websocket']}")
        
    else:  # IPv6
        logger.info("📱 ACCESO DESDE TU DISPOSITIVO ACTUAL:")
        logger.info(f"   Frontend:  {urls['localhost']['frontend']}")
        logger.info(f"   API Test:  {urls['localhost']['api']}/api/health")
        logger.info(f"   WebSocket: {urls['localhost']['websocket']}")
        
        logger.info("\n🌐 ACCESO IPv6 DESDE OTROS DISPOSITIVOS:")
        logger.info(f"   Frontend:  {urls['network']['frontend']}")
        logger.info(f"   API:       {urls['network']['api']}/api/")
        logger.info(f"   WebSocket: {urls['network']['websocket']}")
    
    logger.info(f"\n🤖 ARDUINO DEBE ENVIAR A:")
    logger.info(f"   IP: {get_local_ip()}")
    logger.info(f"   Puerto: 1234")
    logger.info(f"   Protocolo: UDP {PROTOCOL}")
    
    logger.info("=" * 50)

async def main():
    """Función principal del sistema dual"""
    
    # Mostrar banner de inicio
    show_startup_banner()
    
    # Configurar manejo de señales (solo en Unix)
    if sys.platform != 'win32':
        for sig in [signal.SIGINT, signal.SIGTERM]:
            signal.signal(sig, lambda s, f: asyncio.create_task(signal_handler(s, f)))
    
    try:
        # Iniciar sistema
        if await system.start():
            
            # Mostrar información de acceso
            show_access_summary()
            
            # Mantener corriendo hasta señal de parada
            logger.info(f"Sistema {PROTOCOL} corriendo...")
            logger.info("Presiona Ctrl+C para detener")
            
            # Loop principal
            while system.running:
                await asyncio.sleep(1)
                
        else:
            logger.error("No se pudo iniciar el sistema")
            logger.error("Posibles soluciones:")
            
            if not IPV4_AVAILABLE and not IPV6_AVAILABLE:
                logger.error("- Verifica tu conexión de red")
                logger.error("- Revisa configuración de firewall")
            elif PROTOCOL == "IPv6":
                logger.error("- Usa IPv4 (funciona con redes móviles)")
                logger.error("- Configura IPv6 en Windows si es necesario")
            
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Interrupción recibida por usuario")
    except Exception as e:
        logger.error(f"Error fatal: {e}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        await system.stop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 ¡Hasta luego!")
    except Exception as e:
        print(f"💥 Error fatal: {e}")
        sys.exit(1)