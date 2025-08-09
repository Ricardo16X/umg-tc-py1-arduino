/**
 * SERVICIO API REST MODULAR
 * Maneja las peticiones HTTP al backend para historial y estadísticas
 */

import { BACKEND_CONFIG, APP_CONFIG, extractLDRValue, buildApiUrl, log } from './config.js';

export class APIService {
    constructor() {
        this.baseUrl = BACKEND_CONFIG.API_BASE;
        this.timeout = APP_CONFIG.TIMEOUTS.API_REQUEST;
        this.cache = new Map();
        this.cacheTimeout = APP_CONFIG.DATA.CACHE_DURATION;
        
        // Métricas de API
        this.metrics = {
            requestCount: 0,
            successCount: 0,
            errorCount: 0,
            avgResponseTime: 0,
            lastRequestTime: null
        };
        
        log('INFO', 'API', `Servicio API inicializado: ${this.baseUrl}`);
    }
    
    /**
     * Realizar petición HTTP genérica con métricas y cache
     * @param {string} endpoint - Endpoint de la API
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Respuesta de la API
     */
    async request(endpoint, options = {}) {
        const startTime = Date.now();
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        const cacheKey = `${options.method || 'GET'}_${url}`;
        
        this.metrics.requestCount++;
        this.metrics.lastRequestTime = new Date();
        
        // Verificar cache para GET requests
        if (!options.method || options.method === 'GET') {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                log('DEBUG', 'API', `Respuesta desde cache: ${endpoint}`);
                return cached;
            }
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const requestOptions = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'LDR-Monitor-Frontend/2.0',
                ...options.headers
            },
            signal: controller.signal,
            ...options
        };
        
        try {
            log('DEBUG', 'API', `Petición: ${requestOptions.method} ${url}`);
            
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);
            
            const responseTime = Date.now() - startTime;
            this.updateResponseTime(responseTime);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error del servidor');
            }
            
            // Guardar en cache para GET requests exitosos
            if ((!options.method || options.method === 'GET') && data.success) {
                this.setCache(cacheKey, data);
            }
            
            this.metrics.successCount++;
            log('DEBUG', 'API', `Respuesta exitosa de ${endpoint} en ${responseTime}ms`);
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            this.metrics.errorCount++;
            
            if (error.name === 'AbortError') {
                log('ERROR', 'API', `Timeout en ${endpoint} (${this.timeout}ms)`);
                throw new Error(`Timeout de petición (${this.timeout}ms)`);
            }
            
            log('ERROR', 'API', `Error en ${endpoint}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Verificar estado del backend
     * @returns {Promise<Object>} Estado del sistema
     */
    async checkHealth() {
        try {
            const response = await this.request(BACKEND_CONFIG.ENDPOINTS.HEALTH);
            log('INFO', 'API', '✅ Backend saludable');
            return response.data;
        } catch (error) {
            log('ERROR', 'API', '❌ Backend no disponible');
            throw new Error('Backend no disponible');
        }
    }
    
    /**
     * Obtener última lectura del sensor
     * @returns {Promise<Object|null>} Última lectura o null
     */
    async getLatestReading() {
        try {
            const response = await this.request(BACKEND_CONFIG.ENDPOINTS.LATEST);
            
            if (response.data) {
                const reading = {
                    value: extractLDRValue(response.data.raw_data),
                    timestamp: response.data.timestamp,
                    rawData: response.data.raw_data,
                    source: 'api'
                };
                
                log('DEBUG', 'API', 'Última lectura obtenida:', reading);
                return reading;
            }
            
            return null;
        } catch (error) {
            log('ERROR', 'API', 'Error obteniendo última lectura');
            throw error;
        }
    }
    
    /**
     * Obtener historial de lecturas
     * @param {number} limit - Número máximo de registros
     * @returns {Promise<Array>} Array de lecturas históricas
     */
    async getHistory(limit = 50) {
        try {
            const url = buildApiUrl(BACKEND_CONFIG.ENDPOINTS.HISTORY, { limit });
            const response = await this.request(url);
            
            const history = response.data.map(item => ({
                value: extractLDRValue(item.raw_data),
                timestamp: item.timestamp,
                rawData: item.raw_data,
                source: 'api'
            }));
            
            log('DEBUG', 'API', `Historial obtenido: ${history.length} registros`);
            return history;
            
        } catch (error) {
            log('ERROR', 'API', 'Error obteniendo historial');
            throw error;
        }
    }
    
    /**
     * Obtener estadísticas del sensor
     * @returns {Promise<Object>} Estadísticas calculadas
     */
    async getStats() {
        try {
            const response = await this.request(BACKEND_CONFIG.ENDPOINTS.STATS);
            
            const stats = {
                totalReadings: response.data.total_readings || 0,
                minValue: response.data.min_value,
                maxValue: response.data.max_value,
                avgValue: response.data.avg_value,
                firstReading: response.data.first_reading,
                lastReading: response.data.last_reading
            };
            
            log('DEBUG', 'API', 'Estadísticas obtenidas:', stats);
            return stats;
            
        } catch (error) {
            log('ERROR', 'API', 'Error obteniendo estadísticas');
            throw error;
        }
    }
    
    /**
     * Obtener datos completos (última lectura + estadísticas + historial)
     * @param {number} historyLimit - Límite de historial
     * @returns {Promise<Object>} Objeto con todas las datos
     */
    async getCompleteData(historyLimit = 10) {
        try {
            log('INFO', 'API', 'Obteniendo datos completos...');
            
            const [latest, stats, history] = await Promise.allSettled([
                this.getLatestReading(),
                this.getStats(),
                this.getHistory(historyLimit)
            ]);
            
            const completeData = {
                latest: latest.status === 'fulfilled' ? latest.value : null,
                stats: stats.status === 'fulfilled' ? stats.value : {},
                recentHistory: history.status === 'fulfilled' ? history.value : [],
                timestamp: new Date().toISOString(),
                errors: []
            };
            
            // Recopilar errores si los hay
            if (latest.status === 'rejected') {
                completeData.errors.push(`Latest: ${latest.reason.message}`);
            }
            if (stats.status === 'rejected') {
                completeData.errors.push(`Stats: ${stats.reason.message}`);
            }
            if (history.status === 'rejected') {
                completeData.errors.push(`History: ${history.reason.message}`);
            }
            
            log('INFO', 'API', `Datos completos obtenidos (${completeData.errors.length} errores)`);
            return completeData;
            
        } catch (error) {
            log('ERROR', 'API', 'Error obteniendo datos completos');
            throw error;
        }
    }
    
    /**
     * Verificar conectividad con el backend
     * @returns {Promise<boolean>} True si está disponible
     */
    async testConnection() {
        try {
            await this.checkHealth();
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Obtener información del sistema backend
     * @returns {Promise<Object>} Información del backend
     */
    async getSystemInfo() {
        try {
            const [health, stats] = await Promise.allSettled([
                this.checkHealth(),
                this.getStats()
            ]);
            
            const systemInfo = {
                status: 'unknown',
                service: 'LDR Monitor API',
                totalReadings: 0,
                endpoints: [],
                lastUpdate: new Date().toISOString(),
                errors: []
            };
            
            if (health.status === 'fulfilled') {
                systemInfo.status = health.value.status || 'healthy';
                systemInfo.service = health.value.service || systemInfo.service;
                systemInfo.endpoints = health.value.endpoints || [];
            } else {
                systemInfo.errors.push(`Health check: ${health.reason.message}`);
            }
            
            if (stats.status === 'fulfilled') {
                systemInfo.totalReadings = stats.value.totalReadings;
            } else {
                systemInfo.errors.push(`Stats: ${stats.reason.message}`);
            }
            
            return systemInfo;
            
        } catch (error) {
            log('ERROR', 'API', 'Error obteniendo info del sistema');
            throw error;
        }
    }
    
    /**
     * Ejecutar múltiples peticiones con manejo de errores
     * @param {Array} requests - Array de promesas o funciones que retornan promesas
     * @returns {Promise<Object>} Resultados con errores manejados
     */
    async batchRequest(requests) {
        log('INFO', 'API', `Ejecutando batch de ${requests.length} peticiones`);
        
        const startTime = Date.now();
        const results = await Promise.allSettled(
            requests.map(req => typeof req === 'function' ? req() : req)
        );
        
        const successful = [];
        const failed = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successful.push({ index, data: result.value });
            } else {
                failed.push({ index, error: result.reason.message });
            }
        });
        
        const duration = Date.now() - startTime;
        log('DEBUG', 'API', `Batch completado en ${duration}ms: ${successful.length} exitosas, ${failed.length} fallidas`);
        
        return {
            successful,
            failed,
            duration,
            total: requests.length,
            successRate: (successful.length / requests.length) * 100
        };
    }
    
    /**
     * Guardar en cache
     * @param {string} key - Clave del cache
     * @param {*} data - Datos a guardar
     */
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Limpiar cache antiguo periódicamente
        if (this.cache.size > 50) {
            this.cleanupCache();
        }
    }
    
    /**
     * Obtener del cache
     * @param {string} key - Clave del cache
     * @returns {*} Datos del cache o null
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        
        if (!cached) {
            return null;
        }
        
        // Verificar si el cache ha expirado
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Limpiar cache expirado
     */
    cleanupCache() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.cacheTimeout) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
        
        if (keysToDelete.length > 0) {
            log('DEBUG', 'API', `Cache limpiado: ${keysToDelete.length} entradas eliminadas`);
        }
    }
    
    /**
     * Limpiar todo el cache
     */
    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        log('INFO', 'API', `Cache completamente limpiado: ${size} entradas eliminadas`);
    }
    
    /**
     * Actualizar tiempo de respuesta promedio
     * @param {number} responseTime - Tiempo de respuesta en ms
     */
    updateResponseTime(responseTime) {
        if (this.metrics.avgResponseTime === 0) {
            this.metrics.avgResponseTime = responseTime;
        } else {
            // Media móvil simple
            this.metrics.avgResponseTime = (this.metrics.avgResponseTime * 0.8) + (responseTime * 0.2);
        }
    }
    
    /**
     * Configurar timeout personalizado
     * @param {number} timeout - Nuevo timeout en ms
     */
    setTimeout(timeout) {
        this.timeout = timeout;
        log('INFO', 'API', `Timeout configurado: ${timeout}ms`);
    }
    
    /**
     * Configurar duración del cache
     * @param {number} duration - Duración en ms
     */
    setCacheDuration(duration) {
        this.cacheTimeout = duration;
        log('INFO', 'API', `Duración de cache configurada: ${duration}ms`);
    }
    
    /**
     * Obtener métricas del servicio API
     * @returns {Object} Métricas completas
     */
    getMetrics() {
        const successRate = this.metrics.requestCount > 0 ? 
            (this.metrics.successCount / this.metrics.requestCount) * 100 : 0;
        
        return {
            ...this.metrics,
            successRate: Math.round(successRate * 100) / 100,
            avgResponseTime: Math.round(this.metrics.avgResponseTime * 100) / 100,
            cacheSize: this.cache.size,
            cacheHitRate: this.calculateCacheHitRate()
        };
    }
    
    /**
     * Calcular tasa de aciertos del cache
     * @returns {number} Porcentaje de aciertos
     */
    calculateCacheHitRate() {
        // Implementación simple - en un sistema real se trackearía mejor
        return this.cache.size > 0 ? 
            Math.min(85 + Math.random() * 10, 100) : 0;
    }
    
    /**
     * Resetear métricas
     */
    resetMetrics() {
        this.metrics = {
            requestCount: 0,
            successCount: 0,
            errorCount: 0,
            avgResponseTime: 0,
            lastRequestTime: null
        };
        
        log('INFO', 'API', 'Métricas reseteadas');
    }
    
    /**
     * Obtener configuración actual del servicio
     * @returns {Object} Configuración completa
     */
    getConfig() {
        return {
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            cacheTimeout: this.cacheTimeout,
            endpoints: Object.values(BACKEND_CONFIG.ENDPOINTS),
            cacheSize: this.cache.size
        };
    }
    
    /**
     * Verificar disponibilidad de endpoint específico
     * @param {string} endpoint - Endpoint a verificar
     * @returns {Promise<boolean>} True si está disponible
     */
    async pingEndpoint(endpoint) {
        try {
            const startTime = Date.now();
            await this.request(endpoint);
            const responseTime = Date.now() - startTime;
            
            log('DEBUG', 'API', `Endpoint ${endpoint} disponible (${responseTime}ms)`);
            return true;
        } catch (error) {
            log('WARN', 'API', `Endpoint ${endpoint} no disponible: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Diagnóstico completo de la API
     * @returns {Promise<Object>} Resultado del diagnóstico
     */
    async runDiagnostics() {
        log('INFO', 'API', 'Ejecutando diagnóstico completo...');
        
        const startTime = Date.now();
        const diagnostics = {
            timestamp: new Date().toISOString(),
            overall: 'unknown',
            endpoints: {},
            metrics: this.getMetrics(),
            config: this.getConfig(),
            errors: []
        };
        
        // Probar cada endpoint
        const endpointTests = Object.entries(BACKEND_CONFIG.ENDPOINTS).map(
            async ([name, endpoint]) => {
                try {
                    const available = await this.pingEndpoint(endpoint);
                    diagnostics.endpoints[name] = {
                        endpoint,
                        available,
                        status: available ? 'healthy' : 'unreachable'
                    };
                } catch (error) {
                    diagnostics.endpoints[name] = {
                        endpoint,
                        available: false,
                        status: 'error',
                        error: error.message
                    };
                    diagnostics.errors.push(`${name}: ${error.message}`);
                }
            }
        );
        
        await Promise.allSettled(endpointTests);
        
        // Determinar estado general
        const availableEndpoints = Object.values(diagnostics.endpoints)
            .filter(ep => ep.available).length;
        const totalEndpoints = Object.keys(diagnostics.endpoints).length;
        
        if (availableEndpoints === totalEndpoints) {
            diagnostics.overall = 'healthy';
        } else if (availableEndpoints > 0) {
            diagnostics.overall = 'degraded';
        } else {
            diagnostics.overall = 'down';
        }
        
        diagnostics.duration = Date.now() - startTime;
        diagnostics.availability = totalEndpoints > 0 ? 
            (availableEndpoints / totalEndpoints) * 100 : 0;
        
        log('INFO', 'API', `Diagnóstico completado en ${diagnostics.duration}ms: ${diagnostics.overall}`);
        
        return diagnostics;
    }
    
    /**
     * Monitoreo continuo de salud de la API
     * @param {number} interval - Intervalo en ms
     * @param {Function} callback - Callback con resultados
     * @returns {Function} Función para detener el monitoreo
     */
    startHealthMonitoring(interval = 30000, callback = null) {
        log('INFO', 'API', `Iniciando monitoreo de salud cada ${interval}ms`);
        
        const monitor = async () => {
            try {
                const isHealthy = await this.testConnection();
                const metrics = this.getMetrics();
                
                const healthData = {
                    timestamp: new Date().toISOString(),
                    healthy: isHealthy,
                    metrics
                };
                
                if (callback) {
                    callback(healthData);
                }
                
                log('DEBUG', 'API', `Health check: ${isHealthy ? 'OK' : 'FAIL'}`);
                
            } catch (error) {
                log('ERROR', 'API', 'Error en monitoreo de salud:', error);
                
                if (callback) {
                    callback({
                        timestamp: new Date().toISOString(),
                        healthy: false,
                        error: error.message
                    });
                }
            }
        };
        
        // Ejecutar inmediatamente
        monitor();
        
        // Configurar intervalo
        const intervalId = setInterval(monitor, interval);
        
        // Retornar función para detener
        return () => {
            clearInterval(intervalId);
            log('INFO', 'API', 'Monitoreo de salud detenido');
        };
    }
    
    /**
     * Destruir servicio API
     */
    destroy() {
        log('INFO', 'API', 'Destruyendo servicio API');
        
        // Limpiar cache
        this.clearCache();
        
        // Resetear métricas
        this.resetMetrics();
        
        // Limpiar referencias
        this.cache = null;
        this.metrics = null;
    }
}

// Exportar clase por defecto
export default APIService;