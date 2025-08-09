/**
 * CONFIGURACIÓN FRONTEND - VERSIÓN SIMPLIFICADA
 * Sin detección automática - Direct localhost
 */

// =======================================
// CONFIGURACIÓN SIMPLE Y FUNCIONAL
// =======================================
// config.js - VERSIÓN MEJORADA
/*
function getBackendConfig() {
    // Detectar si estamos en modo desarrollo local o externo
    const isLocalDevelopment = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname === '::1';
    
    if (isLocalDevelopment) {
        // Modo desarrollo local
        return {
            API_BASE: 'http://localhost:8080',
            WEBSOCKET_URL: 'ws://localhost:8765'
        };
    } else {
        // Modo externo IPv6
        return {
            API_BASE: 'http://[2803:d100:e580:1222:a0c8:a5f4:f585:1f90]:8080',
            WEBSOCKET_URL: 'ws://[2803:d100:e580:1222:a0c8:a5f4:f585:1f90]:8765'
        };
    }
}
*/
// Configuración del backend (simplificada)
export const BACKEND_CONFIG = {
    API_BASE: 'http://[2803:d100:e580:1222:a0c8:a5f4:f585:1f90]:8080',
    WEBSOCKET_URL: 'ws://[2803:d100:e580:1222:a0c8:a5f4:f585:1f90]:8765',
    ENDPOINTS: {
        HEALTH: '/api/health',
        LATEST: '/api/latest', 
        HISTORY: '/api/history',
        STATS: '/api/stats',
        NETWORK: '/api/network'
    }
};

// Configuración de la aplicación
export const APP_CONFIG = {
    NAME: 'Lámpara Virtual LDR',
    VERSION: '2.0',
    
    TIMEOUTS: {
        API_REQUEST: 5000,
        WS_CONNECTION: 10000,
        HEALTH_CHECK: 30000,
        STATS_UPDATE: 10000,
        RECONNECT_DELAY: 3000
    },
    
    RECONNECTION: {
        MAX_ATTEMPTS: 10,
        BACKOFF_FACTOR: 1.5,
        MAX_DELAY: 30000
    },
    
    DATA: {
        MAX_HISTORY_DISPLAY: 50,
        CACHE_DURATION: 300000
    },
    
    EFFECTS: {
        TRANSITION_DURATION: 1500,
        ANIMATION_DURATION: 500
    }
};

// Configuración de temas
export const THEMES_CONFIG = {
    DARK: {
        name: '🌙 NOCTURNO',
        range: { min: 0, max: 199 },
        className: 'theme-dark'
    },
    MEDIUM: {
        name: '🌅 ATARDECER', 
        range: { min: 200, max: 599 },
        className: 'theme-medium'
    },
    BRIGHT: {
        name: '☀️ BRILLANTE',
        range: { min: 600, max: 1023 },
        className: 'theme-bright'
    }
};

// Configuración de logging
export const LOG_CONFIG = {
    LEVEL: 'INFO',
    ENABLED: true,
    
    LEVELS: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
    COLORS: { DEBUG: '#6c757d', INFO: '#17a2b8', WARN: '#ffc107', ERROR: '#dc3545' }
};

// =======================================
// UTILIDADES ESENCIALES
// =======================================

/**
 * Detectar dispositivo móvil
 */
export function isMobile() {
    return window.innerWidth <= 768;
}

/**
 * Detectar si las animaciones están reducidas
 */
export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Obtener duración de animación
 */
export function getAnimationDuration(speed = 'base') {
    if (prefersReducedMotion()) return 0;
    
    switch (speed) {
        case 'fast': return 150;
        case 'slow': return 600;
        default: return 300;
    }
}

/**
 * Formatear fecha completa
 */
export function formatFullDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Obtener configuración completa
 */
export function getFullConfig() {
    return {
        backend: BACKEND_CONFIG,
        app: APP_CONFIG,
        themes: THEMES_CONFIG,
        log: LOG_CONFIG
    };
}

/**
 * Determinar tema basado en valor LDR
 */
export function determineTheme(ldrValue) {
    for (const [key, theme] of Object.entries(THEMES_CONFIG)) {
        if (ldrValue >= theme.range.min && ldrValue <= theme.range.max) {
            return key;
        }
    }
    return 'MEDIUM';
}

/**
 * Extraer valor LDR del raw data
 */
export function extractLDRValue(rawData) {
    if (typeof rawData === 'number') return rawData;
    if (typeof rawData === 'string' && rawData.includes('LDR=')) {
        const match = rawData.match(/LDR=(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }
    return parseInt(rawData) || 0;
}

/**
 * Formatear timestamp
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Construir URL de API
 */
export function buildApiUrl(endpoint, params = {}) {
    let url = BACKEND_CONFIG.API_BASE + endpoint;
    
    const queryParams = new URLSearchParams(params);
    if (queryParams.toString()) {
        url += '?' + queryParams.toString();
    }
    
    return url;
}

/**
 * Sistema de logging
 */
export function log(level, module, message, data = null) {
    if (!LOG_CONFIG.ENABLED) return;
    
    const levelNum = LOG_CONFIG.LEVELS[level] || 0;
    const configLevelNum = LOG_CONFIG.LEVELS[LOG_CONFIG.LEVEL] || 0;
    
    if (levelNum < configLevelNum) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `🏠 [${timestamp}] ${module}:`;
    const color = LOG_CONFIG.COLORS[level] || LOG_CONFIG.COLORS.INFO;
    
    const logMethod = level === 'ERROR' ? console.error : 
                     level === 'WARN' ? console.warn :
                     level === 'DEBUG' ? console.debug : console.info;
    
    if (data) {
        logMethod(`%c${prefix}`, `color: ${color}`, message, data);
    } else {
        logMethod(`%c${prefix}`, `color: ${color}`, message);
    }
}

// =======================================
// HACER DISPONIBLE GLOBALMENTE
// =======================================
window.CONFIG = {
    BACKEND: BACKEND_CONFIG,
    APP: APP_CONFIG,
    THEMES: THEMES_CONFIG
};

window.isMobile = isMobile;
window.prefersReducedMotion = prefersReducedMotion;
window.getAnimationDuration = getAnimationDuration;

// =======================================
// EXPORTACIÓN POR DEFECTO
// =======================================
export default {
    BACKEND: BACKEND_CONFIG,
    APP: APP_CONFIG,
    THEMES: THEMES_CONFIG,
    LOG: LOG_CONFIG,
    
    // Utilidades
    determineTheme,
    extractLDRValue,
    formatTimestamp,
    formatFullDate,
    buildApiUrl,
    log,
    isMobile,
    prefersReducedMotion,
    getAnimationDuration,
    getFullConfig
};

// =======================================
// LOG DE INICIALIZACIÓN
// =======================================
log('INFO', 'CONFIG', 'Configuración simplificada cargada');
log('DEBUG', 'CONFIG', 'Backend configurado:', {
    api: BACKEND_CONFIG.API_BASE,
    websocket: BACKEND_CONFIG.WEBSOCKET_URL
});

console.log(`
🌐 CONFIGURACIÓN SIMPLIFICADA:
============================
📱 API:      ${BACKEND_CONFIG.API_BASE}/api/health
📱 WebSocket: ${BACKEND_CONFIG.WEBSOCKET_URL}
🎯 Estado: Configuración lista
`);