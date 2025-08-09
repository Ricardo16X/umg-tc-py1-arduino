# udp_server.py - IPv6 PURO
import socket
import threading
import logging
from config import FAMILY, UDP_PORT, IPv6_BIND_ALL
from database import db

logger = logging.getLogger(__name__)

class UDPServer:
    """Servidor UDP IPv6 puro"""
    
    def __init__(self, data_callback=None):
        self.port = UDP_PORT
        self.address = IPv6_BIND_ALL  # "::" para IPv6
        self.running = False
        self.sock = None
        self.thread = None
        self.data_callback = data_callback
        self.last_value = None
    
    def start(self):
        """Iniciar el servidor UDP IPv6"""
        if self.running:
            logger.warning("Servidor UDP ya está corriendo")
            return False
        
        try:
            # Crear socket IPv6
            from config import FAMILY
            self.sock = socket.socket(FAMILY, socket.SOCK_DGRAM)
            #self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Bind en IPv6
            self.sock.bind((self.address, self.port))
            self.sock.settimeout(1.0)
            
            self.running = True
            
            # Iniciar hilo del servidor
            self.thread = threading.Thread(target=self._listen, daemon=True)
            self.thread.start()
            
            logger.info(f"Servidor UDP IPv6 iniciado en [{self.address}]:{self.port}")
            return True
            
        except Exception as e:
            logger.error(f"Error iniciando servidor UDP IPv6: {e}")
            logger.error("Verifica que IPv6 esté habilitado en tu sistema")
            self.running = False
            return False
    
    def _listen(self):
        """Bucle principal del servidor UDP IPv6"""
        logger.info("Escuchando mensajes UDP IPv6 del Arduino...")
        
        while self.running:
            try:
                data, addr = self.sock.recvfrom(1024)
                
                if data:
                    ldr_value = data.decode().strip()
                    client_ipv6 = addr[0]
                    
                    logger.debug(f"Datos IPv6 recibidos de [{client_ipv6}]: {ldr_value}")
                    self._process_data(ldr_value, client_ipv6)
                    
            except socket.timeout:
                continue
            except socket.error as e:
                if self.running:
                    logger.error(f"Error en socket UDP IPv6: {e}")
            except Exception as e:
                if self.running:
                    logger.error(f"Error procesando datos UDP IPv6: {e}")
    
    def _process_data(self, ldr_value, client_ipv6):
        """Procesar datos recibidos del Arduino IPv6"""
        try:
            if ldr_value != self.last_value:
                logger.info(f"Arduino IPv6 [{client_ipv6}]: {self.last_value} → {ldr_value}")
                
                success = db.save_reading(ldr_value)
                
                if success:
                    self.last_value = ldr_value
                    
                    if self.data_callback:
                        try:
                            self.data_callback(ldr_value, client_ipv6)
                        except Exception as e:
                            logger.error(f"Error en callback: {e}")
                else:
                    logger.error("No se pudo guardar en base de datos")
            else:
                logger.debug(f"Sin cambios IPv6: {ldr_value}")
                
        except Exception as e:
            logger.error(f"Error procesando datos IPv6: {e}")
    
    def stop(self):
        """Detener el servidor UDP IPv6"""
        if not self.running:
            return
        
        logger.info("Deteniendo servidor UDP IPv6...")
        self.running = False
        
        if self.thread:
            self.thread.join(timeout=2.0)
        
        if self.sock:
            self.sock.close()
        
        logger.info("Servidor UDP IPv6 detenido")
    
    def get_last_value(self):
        return self.last_value
    
    def is_running(self):
        return self.running

def create_udp_server(callback=None):
    return UDPServer(data_callback=callback)