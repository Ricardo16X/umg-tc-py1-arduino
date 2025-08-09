# http_server.py - IPv6 PURO
import socket
import threading
import json
import urllib.parse
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from config import FAMILY, HTTP_PORT, IPv6_BIND_ALL, HTTP_TIMEOUT
from database import db

logger = logging.getLogger(__name__)

class APIRequestHandler(BaseHTTPRequestHandler):
    """Handler para peticiones HTTP IPv6"""
    
    def log_message(self, format, *args):
        """Override para usar nuestro logger"""
        logger.debug(f"[{self.address_string()}] - {format % args}")
    
    def do_OPTIONS(self):
        """Manejar peticiones OPTIONS para CORS"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Manejar peticiones GET IPv6"""
        try:
            # Log de acceso IPv6
            client_ipv6 = self.client_address[0]
            logger.info(f"API request desde IPv6: [{client_ipv6}]")
            
            # Parsear ruta y parámetros
            parsed_url = urllib.parse.urlparse(self.path)
            path = parsed_url.path
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            # Routing de endpoints
            if path == '/api/history':
                self._handle_history(query_params)
            elif path == '/api/stats':
                self._handle_stats()
            elif path == '/api/latest':
                self._handle_latest()
            elif path == '/api/health':
                self._handle_health()
            elif path == '/api/network':
                self._handle_network_info()
            else:
                self._send_error(404, "Endpoint no encontrado")
                
        except Exception as e:
            logger.error(f"Error en petición GET IPv6: {e}")
            self._send_error(500, "Error interno del servidor")
    
    def _handle_network_info(self):
        """Endpoint: GET /api/network - Info de red IPv6"""
        try:
            from config import get_ipv6_addresses, IPv6_ARDUINO
            
            network_info = {
                "protocol": "IPv6",
                "client_ipv6": self.client_address[0],
                "server_bind": IPv6_BIND_ALL,
                "arduino_target": IPv6_ARDUINO,
                "available_addresses": get_ipv6_addresses(),
                "urls": {
                    "localhost": f"http://[::1]:{HTTP_PORT}",
                    "websocket_localhost": f"ws://[::1]:8765",
                    "arduino_address": f"[{IPv6_ARDUINO}]"
                }
            }
            
            response = {
                "success": True,
                "data": network_info
            }
            
            self._send_json_response(response)
            
        except Exception as e:
            logger.error(f"Error en /api/network: {e}")
            self._send_error(500, str(e))
    
    def _handle_history(self, query_params):
        """Endpoint: GET /api/history?limit=N"""
        try:
            limit = int(query_params.get('limit', [50])[0])
            
            if limit < 1 or limit > 1000:
                self._send_error(400, "Límite debe estar entre 1 y 1000")
                return
            
            history = db.get_history(limit)
            
            response = {
                "success": True,
                "data": history,
                "count": len(history),
                "limit": limit,
                "protocol": "IPv6"
            }
            
            self._send_json_response(response)
            
        except ValueError:
            self._send_error(400, "Parámetro 'limit' debe ser un número")
        except Exception as e:
            logger.error(f"Error en /api/history: {e}")
            self._send_error(500, str(e))
    
    def _handle_stats(self):
        """Endpoint: GET /api/stats"""
        try:
            stats = db.get_stats()
            
            response = {
                "success": True,
                "data": stats,
                "protocol": "IPv6"
            }
            
            self._send_json_response(response)
            
        except Exception as e:
            logger.error(f"Error en /api/stats: {e}")
            self._send_error(500, str(e))
    
    def _handle_latest(self):
        """Endpoint: GET /api/latest"""
        try:
            latest = db.get_latest_reading()
            
            response = {
                "success": True,
                "data": latest,
                "protocol": "IPv6"
            }
            
            self._send_json_response(response)
            
        except Exception as e:
            logger.error(f"Error en /api/latest: {e}")
            self._send_error(500, str(e))
    
    def _handle_health(self):
        """Endpoint: GET /api/health"""
        try:
            stats = db.get_stats()
            
            response = {
                "success": True,
                "status": "healthy",
                "service": "LDR Monitor API IPv6",
                "protocol": "IPv6",
                "total_readings": stats.get('total_readings', 0),
                "client_ipv6": self.client_address[0],
                "endpoints": [
                    "/api/history",
                    "/api/stats", 
                    "/api/latest",
                    "/api/health",
                    "/api/network"
                ]
            }
            
            self._send_json_response(response)
            
        except Exception as e:
            logger.error(f"Error en /api/health: {e}")
            self._send_error(500, str(e))
    
    def _send_json_response(self, data, status_code=200):
        """Enviar respuesta JSON IPv6"""
        try:
            response_json = json.dumps(data, indent=2)
            
            self.send_response(status_code)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(response_json.encode('utf-8'))))
            self.end_headers()
            
            self.wfile.write(response_json.encode('utf-8'))
            
        except Exception as e:
            logger.error(f"Error enviando respuesta JSON IPv6: {e}")
            self._send_error(500, "Error generando respuesta")
    
    def _send_error(self, status_code, message):
        """Enviar respuesta de error IPv6"""
        try:
            error_response = {
                "success": False,
                "error": message,
                "status_code": status_code,
                "protocol": "IPv6"
            }
            
            response_json = json.dumps(error_response)
            
            self.send_response(status_code)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(response_json.encode('utf-8'))))
            self.end_headers()
            
            self.wfile.write(response_json.encode('utf-8'))
            
        except Exception as e:
            logger.error(f"Error enviando error IPv6: {e}")
    
    def _set_cors_headers(self):
        """Establecer headers CORS para IPv6"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')

class HTTPServerIPv6(threading.Thread):
    """Servidor HTTP IPv6 puro"""
    
    def __init__(self):
        super().__init__(daemon=True)
        self.port = HTTP_PORT
        self.address = IPv6_BIND_ALL  # "::" para IPv6
        self.running = False
        self.httpd = None
    
    def start_server(self):
        """Iniciar el servidor HTTP IPv6"""
        if self.running:
            logger.warning("Servidor HTTP IPv6 ya está corriendo")
            return False
        
        try:
            logger.info(f"Iniciando servidor HTTP IPv6 en [{self.address}]:{self.port}")
            
            # Crear servidor HTTP IPv6
            self.httpd = HTTPServer((self.address, self.port), APIRequestHandler, bind_and_activate=False)
            
            # Configurar socket IPv6 explícitamente
            from config import FAMILY
            self.httpd.socket = socket.socket(FAMILY, socket.SOCK_STREAM)
            #self.httpd.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.httpd.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Bind y listen
            self.httpd.socket.bind((self.address, self.port))
            self.httpd.socket.listen(5)
            
            # Asignar socket configurado
            self.httpd.server_bind = lambda: None
            self.httpd.server_activate = lambda: None
            
            self.running = True
            self.start()  # Iniciar hilo
            
            logger.info(f"Servidor HTTP IPv6 iniciado exitosamente")
            logger.info(f"Accesible en: http://[::1]:{self.port}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error iniciando servidor HTTP IPv6: {e}")
            logger.error("Verifica que IPv6 esté habilitado en tu sistema")
            self.running = False
            return False
    
    def stop_server(self):
        """Detener el servidor HTTP IPv6"""
        if not self.running:
            return
        
        logger.info("Deteniendo servidor HTTP IPv6...")
        self.running = False
        
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        
        self.join(timeout=2.0)
        logger.info("Servidor HTTP IPv6 detenido")
    
    def run(self):
        """Bucle principal del servidor HTTP IPv6"""
        logger.info("Servidor HTTP IPv6 corriendo y aceptando conexiones...")
        
        try:
            while self.running:
                self.httpd.handle_request()
        except Exception as e:
            if self.running:
                logger.error(f"Error en servidor HTTP IPv6: {e}")
        finally:
            logger.info("Hilo del servidor HTTP IPv6 terminado")
    
    def is_running(self):
        return self.running

def create_http_server():
    """Crear y retornar instancia del servidor HTTP IPv6"""
    return HTTPServerIPv6()