/**
 * COORDINADOR PÁGINA LÁMPARA
 * Orquesta todos los componentes de la página principal de la lámpara
 */

import { APP_CONFIG, log, formatTimestamp } from '../../shared/js/config.js';
import WebSocketService from '../../shared/js/websocket-service.js';
import APIService from '../../shared/js/api-service.js';
import LampComponent from './lamp.js';

class LampPageApp {
    constructor() {
        // Servicios principales
        this.websocketService = new WebSocketService();
        this.apiService = new APIService();
        this.lampComponent = new LampComponent();
        
        // Estado de la aplicación
        this.isInitialized = false;
        this.isConnected = false;
        this.changeCount = 0;
        this.connectionStartTime = null;
        this.lastValue = null;
        
        // Intervalos y timers
        this.statsUpdateInterval = null;
        this.healthCheckInterval = null;
        
        log('INFO', 'LAMP_PAGE', '🚀 Inicializando aplicación de página lámpara');
    }
    
    /**
     * Inicializar aplicación completa
     */
    async init() {
        try {
            log('INFO', 'LAMP_PAGE', 'Inicializando componentes...');
            
            // Mostrar loading
            this.lampComponent.showLoading(true, 'Inicializando sistema...');
            
            // Configurar callbacks de servicios
            this.setupServiceCallbacks();
            
            // Intentar cargar datos iniciales desde API
            await this.loadInitialData();
            
            // Conectar WebSocket para tiempo real
            await this.connectWebSocket();
            
            // Iniciar servicios periódicos
            this.startPeriodicServices();
            
            // Configurar eventos globales
            this.setupGlobalEvents();
            
            // Marcar como inicializado
            this.isInitialized = true;
            
            // Ocultar loading
            this.lampComponent.showLoading(false);
            
            log('INFO', 'LAMP_PAGE', '✅ Aplicación inicializada correctamente');
            
            // Notificar éxito
            this.showNotification('Sistema iniciado correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'LAMP_PAGE', '❌ Error inicializando aplicación:', error);
            this.handleInitError(error);
        }
    }
    
    /**
     * Configurar callbacks de los servicios
     */
    setupServiceCallbacks() {
        // Callbacks WebSocket
        this.websocketService.on('onData', (data) => {
            this.handleRealtimeData(data);
        });
        
        this.websocketService.on('onConnected', (info) => {
            this.handleWebSocketConnected(info);
        });
        
        this.websocketService.on('onDisconnected', (info) => {
            this.handleWebSocketDisconnected(info);
        });
        
        this.websocketService.on('onError', (error) => {
            this.handleWebSocketError(error);
        });
        
        this.websocketService.on('onReconnecting', (info) => {
            this.handleWebSocketReconnecting(info);
        });
    }
    
    /**
     * Cargar datos iniciales desde la API
     */
    async loadInitialData() {
        try {
            log('INFO', 'LAMP_PAGE', 'Cargando datos iniciales...');
            
            this.lampComponent.showLoading(true, 'Conectando con servidor...');
            
            // Verificar disponibilidad de la API
            const apiAvailable = await this.apiService.testConnection();
            
            if (!apiAvailable) {
                throw new Error('API no disponible');
            }
            
            // Cargar datos completos
            const completeData = await this.apiService.getCompleteData(5);
            
            // Aplicar datos a la lámpara
            if (completeData.latest) {
                this.lampComponent.updateLamp(
                    completeData.latest.value,
                    completeData.latest.timestamp
                );
                this.lastValue = completeData.latest.value;
            }
            
            // Aplicar estadísticas
            if (completeData.stats) {
                this.lampComponent.updateStats(completeData.stats);
            }
            
            // Mostrar errores si los hay
            if (completeData.errors.length > 0) {
                log('WARN', 'LAMP_PAGE', 'Errores cargando datos:', completeData.errors);
            }
            
            log('INFO', 'LAMP_PAGE', 'Datos iniciales cargados');
            
        } catch (error) {
            log('ERROR', 'LAMP_PAGE', 'Error cargando datos iniciales:', error);
            
            // Mostrar mensaje de error pero continuar
            this.lampComponent.updateConnectionStatus(false, 'API no disponible');
            this.showNotification('Error conectando con servidor', 'warning');
        }
    }
    
    /**
     * Conectar WebSocket para datos en tiempo real
     */
    async connectWebSocket() {
        try {
            log('INFO', 'LAMP_PAGE', 'Conectando WebSocket...');
            
            this.lampComponent.showLoading(true, 'Estableciendo conexión en tiempo real...');
            
            const connected = await this.websocketService.connect();
            
            if (!connected) {
                throw new Error('No se pudo conectar WebSocket');
            }
            
        } catch (error) {
            log('ERROR', 'LAMP_PAGE', 'Error conectando WebSocket:', error);
            
            // Mostrar error pero continuar en modo API-only
            this.lampComponent.updateConnectionStatus(false, 'Modo solo API');
            this.showNotification('Funcionando sin tiempo real', 'info');
        }
    }
    
    /**
     * Manejar datos en tiempo real
     * @param {Object} data - Datos recibidos
     */
    handleRealtimeData(data) {
        log('DEBUG', 'LAMP_PAGE', `Datos en tiempo real: LDR=${data.value}`);
        
        // Actualizar lámpara
        this.lampComponent.updateLamp(data.value, data.timestamp);
        
        // Incrementar contador si hay cambio
        if (this.lastValue !== null && this.lastValue !== data.value) {
            this.changeCount++;
            this.lampComponent.updateChangeCount(this.changeCount);
        }
        
        this.lastValue = data.value;
        
        // Actualizar navegación si está disponible
        if (typeof updateNavConnectionStatus === 'function') {
            updateNavConnectionStatus(true);
        }
    }
    
    /**
     * Manejar conexión WebSocket exitosa
     * @param {Object} info - Información de conexión
     */
    handleWebSocketConnected(info) {
        log('INFO', 'LAMP_PAGE', '🔌 WebSocket conectado');
        
        this.isConnected = true;
        this.connectionStartTime = info.connectionTime;
        
        // Actualizar UI
        this.lampComponent.updateConnectionStatus(true);
        this.lampComponent.updateConnectionTime(this.connectionStartTime);
        
        // Actualizar navegación
        if (typeof updateNavConnectionStatus === 'function') {
            updateNavConnectionStatus(true);
        }
        
        this.showNotification('Conexión en tiempo real establecida', 'success');
    }
    
    /**
     * Manejar desconexión WebSocket
     * @param {Object} info - Información de desconexión
     */
    handleWebSocketDisconnected(info) {
        log('WARN', 'LAMP_PAGE', '🔌 WebSocket desconectado');
        
        this.isConnected = false;
        
        // Actualizar UI
        this.lampComponent.updateConnectionStatus(false, 'Reconectando...');
        
        // Actualizar navegación
        if (typeof updateNavConnectionStatus === 'function') {
            updateNavConnectionStatus(false, 'Reconectando...');
        }
        
        // Solo mostrar notificación si no fue una desconexión limpia
        if (!info.wasClean) {
            this.showNotification('Conexión perdida, reintentando...', 'warning');
        }
    }
    
    /**
     * Manejar errores WebSocket
     * @param {Object} error - Error
     */
    handleWebSocketError(error) {
        log('ERROR', 'LAMP_PAGE', 'Error WebSocket:', error);
        
        // Solo mostrar notificación para errores críticos
        if (error.type === 'max_reconnects_reached') {
            this.lampComponent.updateConnectionStatus(false, 'Error de conexión');
            this.showNotification('No se pudo establecer conexión en tiempo real', 'error');
        }
    }
    
    /**
     * Manejar intentos de reconexión
     * @param {Object} info - Información de reconexión
     */
    handleWebSocketReconnecting(info) {
        log('INFO', 'LAMP_PAGE', `Reintentando conexión ${info.attempt}/${info.maxAttempts}`);
        
        this.lampComponent.updateConnectionStatus(
            false, 
            `Reintentando (${info.attempt}/${info.maxAttempts})`
        );
        
        // Actualizar navegación
        if (typeof updateNavConnectionStatus === 'function') {
            updateNavConnectionStatus(false, 'Reconectando...');
        }
    }
    
    /**
     * Iniciar servicios periódicos
     */
    startPeriodicServices() {
        // Actualizar estadísticas periódicamente
        this.statsUpdateInterval = setInterval(async () => {
            try {
                const stats = await this.apiService.getStats();
                this.lampComponent.updateStats(stats);
            } catch (error) {
                log('DEBUG', 'LAMP_PAGE', 'Error actualizando estadísticas periódicas');
            }
        }, APP_CONFIG.TIMEOUTS.STATS_UPDATE);
        
        // Health check de API cuando WebSocket no está disponible
        this.healthCheckInterval = setInterval(async () => {
            if (!this.isConnected) {
                try {
                    const latest = await this.apiService.getLatestReading();
                    if (latest && latest.value !== this.lastValue) {
                        this.handleRealtimeData(latest);
                    }
                } catch (error) {
                    log('DEBUG', 'LAMP_PAGE', 'Health check API falló');
                }
            }
        }, APP_CONFIG.TIMEOUTS.HEALTH_CHECK);
        
        log('DEBUG', 'LAMP_PAGE', 'Servicios periódicos iniciados');
    }
    
    /**
     * Configurar eventos globales
     */
    setupGlobalEvents() {
        // Visibilidad de página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseServices();
            } else {
                this.resumeServices();
            }
        });
        
        // Eventos de red (si están disponibles)
        if ('navigator' in window && 'onLine' in navigator) {
            window.addEventListener('online', () => {
                log('INFO', 'LAMP_PAGE', 'Red disponible');
                this.resumeServices();
            });
            
            window.addEventListener('offline', () => {
                log('WARN', 'LAMP_PAGE', 'Red no disponible');
                this.pauseServices();
            });
        }
        
        // Antes de cerrar página
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    /**
     * Pausar servicios (cuando página no visible o sin red)
     */
    pauseServices() {
        log('INFO', 'LAMP_PAGE', 'Pausando servicios');
        
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    /**
     * Reanudar servicios
     */
    resumeServices() {
        log('INFO', 'LAMP_PAGE', 'Reanudando servicios');
        
        if (!this.statsUpdateInterval) {
            this.startPeriodicServices();
        }
        
        // Intentar reconectar WebSocket si está desconectado
        if (!this.isConnected) {
            this.websocketService.forceReconnect();
        }
    }
    
    /**
     * Mostrar notificación
     * @param {string} message - Mensaje
     * @param {string} type - Tipo (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        // Usar función global de navegación si está disponible
        if (typeof showNavNotification === 'function') {
            showNavNotification(message, type);
        } else {
            // Fallback a console
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    /**
     * Manejar errores de inicialización
     * @param {Error} error - Error de inicialización
     */
    handleInitError(error) {
        log('ERROR', 'LAMP_PAGE', 'Error crítico de inicialización:', error);
        
        // Mostrar error en lámpara
        this.lampComponent.updateConnectionStatus(false, 'Error de inicialización');
        this.lampComponent.showLoading(false);
        
        // Mostrar notificación
        this.showNotification('Error iniciando sistema', 'error');
        
        // Intentar recuperación después de un tiempo
        setTimeout(() => {
            log('INFO', 'LAMP_PAGE', 'Intentando recuperación...');
            this.init();
        }, 10000);
    }
    
    /**
     * Forzar reconexión manual
     */
    async forceReconnect() {
        log('INFO', 'LAMP_PAGE', 'Forzando reconexión manual');
        
        this.showNotification('Reconectando...', 'info');
        
        try {
            // Reconectar WebSocket
            await this.websocketService.forceReconnect();
            
            // Recargar datos desde API
            await this.loadInitialData();
            
            this.showNotification('Reconexión exitosa', 'success');
            
        } catch (error) {
            log('ERROR', 'LAMP_PAGE', 'Error en reconexión manual:', error);
            this.showNotification('Error en reconexión', 'error');
        }
    }
    
    /**
     * Obtener estado completo de la aplicación
     * @returns {Object} Estado de la aplicación
     */
    getAppState() {
        return {
            isInitialized: this.isInitialized,
            isConnected: this.isConnected,
            changeCount: this.changeCount,
            connectionStartTime: this.connectionStartTime,
            lastValue: this.lastValue,
            
            // Estados de servicios
            websocket: this.websocketService.getConnectionInfo(),
            api: this.apiService.getMetrics(),
            lamp: this.lampComponent.getStatus(),
            
            // Información del sistema
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            online: navigator.onLine
        };
    }
    
    /**
     * Reiniciar aplicación completa
     */
    async restart() {
        log('INFO', 'LAMP_PAGE', 'Reiniciando aplicación completa');
        
        this.showNotification('Reiniciando sistema...', 'info');
        
        // Limpiar estado actual
        this.cleanup();
        
        // Reiniciar componentes
        this.lampComponent.reset();
        
        // Reinicializar
        await this.init();
    }
    
    /**
     * Limpiar recursos antes de cerrar
     */
    cleanup() {
        log('INFO', 'LAMP_PAGE', 'Limpiando recursos');
        
        // Pausar servicios
        this.pauseServices();
        
        // Desconectar servicios
        this.websocketService.disconnect();
        
        // Limpiar intervalos adicionales
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
    
    /**
     * Destruir aplicación
     */
    destroy() {
        log('INFO', 'LAMP_PAGE', 'Destruyendo aplicación');
        
        // Limpiar recursos
        this.cleanup();
        
        // Destruir componentes
        this.lampComponent.destroy();
        this.websocketService.destroy();
        this.apiService.destroy();
        
        // Limpiar referencias
        this.websocketService = null;
        this.apiService = null;
        this.lampComponent = null;
    }
}

// =======================================
// INICIALIZACIÓN GLOBAL
// =======================================

let lampApp = null;

/**
 * Inicializar aplicación cuando el DOM esté listo
 */
async function initLampPage() {
    log('INFO', 'GLOBAL', '🌟 Iniciando página de la lámpara');
    
    try {
        lampApp = new LampPageApp();
        await lampApp.init();
        
        // Hacer disponible globalmente para debugging
        window.lampApp = lampApp;
        window.lampComponent = lampApp.lampComponent;
        window.effectsManager = lampApp.lampComponent.effectsManager;
        
        log('INFO', 'GLOBAL', '✅ Página de la lámpara iniciada correctamente');
        
    } catch (error) {
        log('ERROR', 'GLOBAL', '❌ Error crítico iniciando página:', error);
    }
}

/**
 * Funciones globales para controles
 */
window.LampPageControls = {
    // Estado y diagnóstico
    getStatus: () => lampApp?.getAppState(),
    getMetrics: () => ({
        websocket: lampApp?.websocketService?.getMetrics(),
        api: lampApp?.apiService?.getMetrics(),
        lamp: lampApp?.lampComponent?.getStatus()
    }),
    
    // Control de conexión
    forceReconnect: () => lampApp?.forceReconnect(),
    testAPI: () => lampApp?.apiService?.testConnection(),
    runDiagnostics: () => lampApp?.apiService?.runDiagnostics(),
    
    // Control de lámpara
    forceTheme: (theme) => lampApp?.lampComponent?.forceTheme(theme),
    simulateData: (value) => lampApp?.lampComponent?.simulateData(value),
    triggerEffect: () => lampApp?.lampComponent?.triggerSpecialEffect(),
    
    // Control de efectos
    setEffects: (enabled) => lampApp?.lampComponent?.setEffectsEnabled(enabled),
    
    // Control general
    restart: () => lampApp?.restart(),
    cleanup: () => lampApp?.cleanup()
};

// =======================================
// INICIALIZACIÓN
// =======================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLampPage);
} else {
    // DOM ya está listo
    initLampPage();
}

// Exportar para uso en módulos
export default LampPageApp;

// Log de carga del script
log('INFO', 'GLOBAL', '📜 Script coordinador de página lámpara cargado');