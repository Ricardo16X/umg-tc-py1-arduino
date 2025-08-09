# websocket_server.py - IPv6 PURO
import asyncio
import websockets
import json
import socket
import logging
from datetime import datetime
from config import WEBSOCKET_PORT, IPv6_BIND_ALL, WS_PING_INTERVAL, MAX_CONNECTED_CLIENTS

logger = logging.getLogger(__name__)

class WebSocketServer:
    """Servidor WebSocket IPv6 puro"""
    
    def __init__(self):
        self.port = WEBSOCKET_PORT
        self.address = IPv6_BIND_ALL  # "::" para IPv6
        self.connected_clients = set()
        self.server = None
        self.running = False
        self.loop = None
    
    async def start(self, loop=None):
        """Iniciar el servidor WebSocket IPv6"""
        if self.running:
            logger.warning("Servidor WebSocket ya está corriendo")
            return False
        
        try:
            self.loop = loop or asyncio.get_event_loop()
            
            # Iniciar servidor WebSocket IPv6
            from config import FAMILY
            self.server = await websockets.serve(
                self.handle_client,
                self.address,  # "::" para IPv6
                self.port,
                family=FAMILY,
                #family=socket.AF_INET,  # IPv6 puro
                ping_interval=WS_PING_INTERVAL,
                ping_timeout=WS_PING_INTERVAL * 2
            )
            
            self.running = True
            logger.info(f"Servidor WebSocket IPv6 iniciado en [{self.address}]:{self.port}")
            return True
            
        except Exception as e:
            logger.error(f"Error iniciando servidor WebSocket IPv6: {e}")
            logger.error("Verifica que IPv6 esté habilitado en tu sistema")
            self.running = False
            return False
    
    async def handle_client(self, websocket):
        """Manejar conexión de cliente WebSocket IPv6"""
        if len(self.connected_clients) >= MAX_CONNECTED_CLIENTS:
            logger.warning("Máximo de clientes conectados alcanzado")
            await websocket.close(code=1013, reason="Server overloaded")
            return
        
        await self.register_client(websocket)
        
        try:
            async for message in websocket:
                await self.process_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.debug("Cliente IPv6 desconectado normalmente")
        except Exception as e:
            logger.error(f"Error manejando cliente IPv6: {e}")
        finally:
            await self.unregister_client(websocket)
    
    async def register_client(self, websocket):
        """Registrar nuevo cliente IPv6"""
        self.connected_clients.add(websocket)
        client_ipv6 = f"[{websocket.remote_address[0]}]:{websocket.remote_address[1]}"
        logger.info(f"Cliente IPv6 conectado desde {client_ipv6}. Total: {len(self.connected_clients)}")
        
        # Enviar último valor conocido
        try:
            from database import db
            latest = db.get_latest_reading()
            if latest:
                await self.send_to_client(websocket, latest['raw_data'])
        except Exception as e:
            logger.error(f"Error enviando último valor: {e}")
    
    async def unregister_client(self, websocket):
        """Desregistrar cliente IPv6"""
        self.connected_clients.discard(websocket)
        logger.info(f"Cliente IPv6 desconectado. Total: {len(self.connected_clients)}")
    
    async def process_client_message(self, websocket, message):
        """Procesar mensaje del cliente IPv6"""
        try:
            data = json.loads(message)
            
            if data.get("type") == "ping":
                await websocket.send(json.dumps({"type": "pong"}))
                logger.debug("Pong enviado a cliente IPv6")
            else:
                logger.debug(f"Mensaje IPv6 no reconocido: {data}")
                
        except json.JSONDecodeError:
            logger.warning(f"Mensaje JSON inválido desde IPv6: {message}")
        except Exception as e:
            logger.error(f"Error procesando mensaje IPv6: {e}")
    
    async def send_to_client(self, websocket, ldr_value):
        """Enviar datos a un cliente IPv6"""
        try:
            message = {
                "type": "ldr_update",
                "value": ldr_value,
                "timestamp": datetime.now().isoformat(),
                "raw_data": ldr_value,
                "transport": "ipv6"
            }
            
            await websocket.send(json.dumps(message))
            logger.debug(f"Datos enviados a cliente IPv6: {ldr_value}")
            
        except websockets.exceptions.ConnectionClosed:
            await self.unregister_client(websocket)
        except Exception as e:
            logger.error(f"Error enviando a cliente IPv6: {e}")
    
    async def broadcast_change(self, ldr_value):
        """Broadcast a todos los clientes IPv6"""
        if not self.connected_clients:
            logger.debug("No hay clientes IPv6 conectados")
            return
        
        logger.info(f"Broadcasting IPv6 a {len(self.connected_clients)} cliente(s): {ldr_value}")
        
        tasks = []
        for websocket in self.connected_clients.copy():
            tasks.append(self.send_to_client(websocket, ldr_value))
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error en broadcast IPv6 cliente {i}: {result}")
    
    async def stop(self):
        """Detener el servidor WebSocket IPv6"""
        if not self.running:
            return
        
        logger.info("Deteniendo servidor WebSocket IPv6...")
        self.running = False
        
        if self.connected_clients:
            await asyncio.gather(
                *[client.close() for client in self.connected_clients.copy()],
                return_exceptions=True
            )
        
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        
        logger.info("Servidor WebSocket IPv6 detenido")
    
    def get_connected_count(self):
        return len(self.connected_clients)
    
    def is_running(self):
        return self.running

def create_websocket_server():
    return WebSocketServer()