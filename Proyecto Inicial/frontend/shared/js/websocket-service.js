/**
 * SERVICIO WEBSOCKET MODULAR
 * Maneja la conexión WebSocket para datos en tiempo real
 */

import { BACKEND_CONFIG, APP_CONFIG, extractLDRValue, log } from './config.js';

export class WebSocketService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = APP_CONFIG.RECONNECTION.MAX_ATTEMPTS;
        this.reconnectDelay = APP_CONFIG.RECONNECTION.BACKOFF_FACTOR;
        this.connectionStartTime = null;
        this.pingInterval = null;
        this.reconnectTimeout = null;
        
        // Callbacks para eventos
        this.callbacks = {
            onData: [],
            onConnected: [],
            onDisconnected: [],
            onError: [],
            onReconnecting: []
        };
        
        // Métricas de conexión
        this.metrics = {
            messagesReceived: 0,
            lastMessageTime: null,
            totalReconnects: 0,
            avgLatency: 0
        };
        
        log('INFO', 'WEBSOCKET', 'Servicio WebSocket inicializado');
    }
    
    /**
     * Conectar al servidor WebSocket
     * @returns {Promise<boolean>} True si la conexión es exitosa
     */
    async connect() {
        if (this.isConnected) {
            log('WARN', 'WEBSOCKET', 'Ya está conectado');
            return true;
        }
        
        const wsUrl = BACKEND_CONFIG.WEBSOCKET_URL;
        log('INFO', 'WEBSOCKET', `Conectando a: ${wsUrl}`);
        
        // Notificar intento de conexión
        this.triggerCallbacks('onReconnecting', { attempt: this.reconnectAttempts + 1 });
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
            
            // Promise que se resuelve cuando la conexión se establece o falla
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout de conexión WebSocket'));
                }, APP_CONFIG.TIMEOUTS.WS_CONNECTION);
                
                const onOpen = () => {
                    clearTimeout(timeout);
                    this.ws.removeEventListener('error', onError);
                    resolve(true);
                };
                
                const onError = (error) => {
                    clearTimeout(timeout);
                    this.ws.removeEventListener('open', onOpen);
                    reject(error);
                };
                
                this.ws.addEventListener('open', onOpen, { once: true });
                this.ws.addEventListener('error', onError, { once: true });
            });
            
        } catch (error) {
            log('ERROR', 'WEBSOCKET', 'Error creando WebSocket:', error);
            this.triggerCallbacks('onError', error);
            return false;
        }
    }
    
    /**
     * Configurar event handlers del WebSocket
     */
    setupEventHandlers() {
        this.ws.addEventListener('open', this.handleOpen.bind(this));
        this.ws.addEventListener('message', this.handleMessage.bind(this));
        this.ws.addEventListener('close', this.handleClose.bind(this));
        this.ws.addEventListener('error', this.handleError.bind(this));
    }
    
    /**
     * Manejar apertura de conexión
     */
    handleOpen() {
        log('INFO', 'WEBSOCKET', '✅ Conectado al servidor');
        
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionStartTime = new Date();
        
        // Iniciar ping periódico
        this.startPingInterval();
        
        // Notificar conexión exitosa
        this.triggerCallbacks('onConnected', {
            connectionTime: this.connectionStartTime,
            url: BACKEND_CONFIG.WEBSOCKET_URL
        });
    }
    
    /**
     * Manejar mensajes recibidos
     * @param {MessageEvent} event - Evento del mensaje
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.updateMetrics();
            
            log('DEBUG', 'WEBSOCKET', 'Mensaje recibido:', data);
            
            switch (data.type) {
                case 'ldr_update':
                    this.handleLDRUpdate(data);
                    break;
                    
                case 'pong':
                    this.handlePong(data);
                    break;
                    
                case 'system_status':
                    this.handleSystemStatus(data);
                    break;
                    
                default:
                    log('WARN', 'WEBSOCKET', 'Tipo de mensaje desconocido:', data.type);
            }
            
        } catch (error) {
            log('ERROR', 'WEBSOCKET', 'Error parseando mensaje:', error);
            this.triggerCallbacks('onError', error);
        }
    }
    
    /**
     * Manejar actualización de LDR
     * @param {Object} data - Datos del LDR
     */
    handleLDRUpdate(data) {
        const processedData = {
            value: extractLDRValue(data.value),
            timestamp: data.timestamp,
            rawData: data.raw_data || data.value,
            source: 'websocket'
        };
        
        log('DEBUG', 'WEBSOCKET', `LDR actualizado: ${processedData.value}`);
        
        // Notificar a los callbacks
        this.triggerCallbacks('onData', processedData);
    }
    
    /**
     * Manejar respuesta pong
     * @param {Object} data - Datos del pong
     */
    handlePong(data) {
        log('DEBUG', 'WEBSOCKET', 'Pong recibido');
        
        // Calcular latencia si hay timestamp
        if (data.timestamp) {
            const latency = Date.now() - data.timestamp;
            this.updateLatency(latency);
        }
    }
    
    /**
     * Manejar estado del sistema
     * @param {Object} data - Estado del sistema
     */
    handleSystemStatus(data) {
        log('INFO', 'WEBSOCKET', 'Estado del sistema recibido:', data);
        
        // Notificar estado del sistema
        this.triggerCallbacks('onData', {
            type: 'system_status',
            ...data
        });
    }
    
    /**
     * Manejar cierre de conexión
     * @param {CloseEvent} event - Evento de cierre
     */
    handleClose(event) {
        log('INFO', 'WEBSOCKET', `🔌 Conexión cerrada: ${event.code} - ${event.reason}`);
        
        this.isConnected = false;
        this.stopPingInterval();
        
        // Notificar desconexión
        this.triggerCallbacks('onDisconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });
        
        // Intentar reconexión automática si no fue limpia
        if (!event.wasClean && event.code !== 1000) {
            this.attemptReconnect();
        }
    }
    
    /**
     * Manejar errores
     * @param {Event} event - Evento de error
     */
    handleError(event) {
        log('ERROR', 'WEBSOCKET', '❌ Error WebSocket:', event);
        
        this.triggerCallbacks('onError', {
            type: 'websocket_error',
            event: event
        });
    }
    
    /**
     * Intentar reconexión automática
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log('ERROR', 'WEBSOCKET', '🚫 Máximo de intentos de reconexión alcanzado');
            this.triggerCallbacks('onError', {
                type: 'max_reconnects_reached',
                attempts: this.reconnectAttempts
            });
            return;
        }
        
        this.reconnectAttempts++;
        this.metrics.totalReconnects++;
        
        // Calcular delay con backoff exponencial
        const delay = Math.min(
            APP_CONFIG.RECONNECTION.RECONNECT_DELAY * Math.pow(APP_CONFIG.RECONNECTION.BACKOFF_FACTOR, this.reconnectAttempts - 1),
            APP_CONFIG.RECONNECTION.MAX_DELAY
        );
        
        log('INFO', 'WEBSOCKET', `🔄 Reintentando conexión en ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        // Notificar intento de reconexión
        this.triggerCallbacks('onReconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay: delay
        });
        
        this.reconnectTimeout = setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                log('WARN', 'WEBSOCKET', 'Fallo en reconexión:', error.message);
            }
        }, delay);
    }
    
    /**
     * Iniciar intervalo de ping
     */
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                this.sendPing();
            }
        }, APP_CONFIG.TIMEOUTS.WS_PING_INTERVAL);
        
        log('DEBUG', 'WEBSOCKET', 'Intervalo de ping iniciado');
    }
    
    /**
     * Detener intervalo de ping
     */
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            log('DEBUG', 'WEBSOCKET', 'Intervalo de ping detenido');
        }
    }
    
    /**
     * Enviar ping al servidor
     */
    sendPing() {
        try {
            const pingMessage = {
                type: 'ping',
                timestamp: Date.now()
            };
            
            this.ws.send(JSON.stringify(pingMessage));
            log('DEBUG', 'WEBSOCKET', 'Ping enviado');
            
        } catch (error) {
            log('ERROR', 'WEBSOCKET', 'Error enviando ping:', error);
        }
    }
    
    /**
     * Enviar mensaje al servidor
     * @param {Object} message - Mensaje a enviar
     * @returns {boolean} True si se envió correctamente
     */
    send(message) {
        if (!this.isConnected || this.ws.readyState !== WebSocket.OPEN) {
            log('WARN', 'WEBSOCKET', 'No se puede enviar mensaje: conexión no disponible');
            return false;
        }
        
        try {
            this.ws.send(JSON.stringify(message));
            log('DEBUG', 'WEBSOCKET', 'Mensaje enviado:', message);
            return true;
        } catch (error) {
            log('ERROR', 'WEBSOCKET', 'Error enviando mensaje:', error);
            return false;
        }
    }
    
    /**
     * Desconectar WebSocket
     * @param {number} code - Código de cierre
     * @param {string} reason - Razón del cierre
     */
    disconnect(code = 1000, reason = 'Desconexión manual') {
        if (this.ws && this.isConnected) {
            log('INFO', 'WEBSOCKET', 'Desconectando...');
            
            this.stopPingInterval();
            
            // Cancelar reconexión pendiente
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            
            this.ws.close(code, reason);
        }
    }
    
    /**
     * Forzar reconexión manual
     */
    async forceReconnect() {
        log('INFO', 'WEBSOCKET', 'Forzando reconexión manual');
        
        if (this.isConnected) {
            this.disconnect(1000, 'Reconexión manual');
            
            // Esperar a que se cierre la conexión
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Resetear intentos de reconexión
        this.reconnectAttempts = 0;
        
        return this.connect();
    }
    
    /**
     * Actualizar métricas de conexión
     */
    updateMetrics() {
        this.metrics.messagesReceived++;
        this.metrics.lastMessageTime = new Date();
    }
    
    /**
     * Actualizar latencia promedio
     * @param {number} latency - Latencia en ms
     */
    updateLatency(latency) {
        if (this.metrics.avgLatency === 0) {
            this.metrics.avgLatency = latency;
        } else {
            // Media móvil simple
            this.metrics.avgLatency = (this.metrics.avgLatency * 0.8) + (latency * 0.2);
        }
    }
    
    /**
     * Registrar callback para eventos
     * @param {string} event - Tipo de evento
     * @param {Function} callback - Función callback
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        } else {
            log('WARN', 'WEBSOCKET', `Evento desconocido: ${event}`);
        }
    }
    
    /**
     * Remover callback de evento
     * @param {string} event - Tipo de evento
     * @param {Function} callback - Función callback
     */
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }
    
    /**
     * Disparar callbacks de un evento
     * @param {string} event - Tipo de evento
     * @param {*} data - Datos del evento
     */
    triggerCallbacks(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    log('ERROR', 'WEBSOCKET', `Error en callback ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Verificar estado de conexión
     * @returns {boolean} True si está conectado
     */
    isWebSocketConnected() {
        return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    /**
     * Obtener información de conexión
     * @returns {Object} Información completa del estado
     */
    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            connectionStartTime: this.connectionStartTime,
            wsUrl: BACKEND_CONFIG.WEBSOCKET_URL,
            readyState: this.ws ? this.ws.readyState : null,
            metrics: { ...this.metrics },
            callbacks: Object.keys(this.callbacks).reduce((acc, key) => {
                acc[key] = this.callbacks[key].length;
                return acc;
            }, {})
        };
    }
    
    /**
     * Obtener métricas de rendimiento
     * @returns {Object} Métricas del WebSocket
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime.getTime() : 0,
            reconnectAttempts: this.reconnectAttempts,
            isConnected: this.isConnected
        };
    }
    
    /**
     * Resetear métricas
     */
    resetMetrics() {
        this.metrics = {
            messagesReceived: 0,
            lastMessageTime: null,
            totalReconnects: 0,
            avgLatency: 0
        };
        
        log('INFO', 'WEBSOCKET', 'Métricas reseteadas');
    }
    
    /**
     * Destruir servicio WebSocket
     */
    destroy() {
        log('INFO', 'WEBSOCKET', 'Destruyendo servicio WebSocket');
        
        // Desconectar
        this.disconnect(1000, 'Servicio destruido');
        
        // Limpiar timers
        this.stopPingInterval();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        
        // Limpiar callbacks
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = [];
        });
        
        // Limpiar referencias
        this.ws = null;
        this.callbacks = {};
        this.metrics = {};
    }
}

// Exportar clase por defecto
export default WebSocketService;