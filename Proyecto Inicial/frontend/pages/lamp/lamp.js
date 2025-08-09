/**
 * COMPONENTE LÁMPARA VIRTUAL
 * Maneja la lámpara visual y cambios de tema según el valor LDR
 */

import { THEMES_CONFIG, APP_CONFIG, determineTheme, log } from '../../shared/js/config.js';
import EffectsManager from './effects.js';

export class LampComponent {
    constructor() {
        this.currentTheme = 'MEDIUM';
        this.currentValue = null;
        this.isTransitioning = false;
        this.elements = this.initElements();
        this.effectsManager = new EffectsManager();
        this.intensityLevel = 0.5; // Nivel de intensidad actual (0-1)
        
        this.init();
        log('INFO', 'LAMP', 'Componente lámpara inicializado');
    }
    
    /**
     * Inicializar elementos DOM
     * @returns {Object} Elementos DOM necesarios
     */
    initElements() {
        const elements = {
            // Elementos principales
            body: document.body,
            lamp: document.getElementById('mainLamp'),
            lampGlow: document.getElementById('lampGlow'),
            
            // Información del sensor
            ldrValue: document.getElementById('ldrValue'),
            mobileValue: document.getElementById('mobileValue'),
            
            // Información del tema
            themeName: document.getElementById('themeName'),
            themeDescription: document.getElementById('themeDescription'),
            mobileTheme: document.getElementById('mobileTheme'),
            
            // Información temporal
            lastUpdate: document.getElementById('lastUpdate'),
            changeCount: document.getElementById('changeCount'),
            connectionTime: document.getElementById('connectionTime'),
            
            // Estado de conexión
            connectionStatus: document.getElementById('connectionStatus'),
            mobileStatus: document.getElementById('mobileStatus'),
            
            // Estadísticas
            minValue: document.getElementById('minValue'),
            maxValue: document.getElementById('maxValue'),
            avgValue: document.getElementById('avgValue'),
            totalReadings: document.getElementById('totalReadings'),
            
            // Progreso diario
            dailyProgress: document.getElementById('dailyProgress'),
            dailyReadings: document.getElementById('dailyReadings')
        };
        
        // Verificar elementos críticos
        const criticalElements = ['body', 'lampGlow', 'ldrValue', 'themeName'];
        const missing = criticalElements.filter(key => !elements[key]);
        
        if (missing.length > 0) {
            log('WARN', 'LAMP', 'Elementos DOM críticos faltantes:', missing);
        }
        
        return elements;
    }
    
    /**
     * Inicialización del componente
     */
    init() {
        // Aplicar tema inicial
        this.changeTheme('MEDIUM');
        
        // Configurar eventos
        this.setupEvents();
        
        // Configurar hover effects
        this.setupHoverEffects();
        
        log('DEBUG', 'LAMP', 'Componente lámpara inicializado');
    }
    
    /**
     * Configurar eventos del componente
     */
    setupEvents() {
        // Hover en la lámpara
        if (this.elements.lamp) {
            this.elements.lamp.addEventListener('mouseenter', () => {
                this.onLampHover(true);
            });
            
            this.elements.lamp.addEventListener('mouseleave', () => {
                this.onLampHover(false);
            });
            
            // Click en la lámpara para efecto especial
            this.elements.lamp.addEventListener('click', () => {
                this.triggerSpecialEffect();
            });
        }
        
        // Eventos de visibilidad de página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.effectsManager.pauseEffects();
            } else {
                this.effectsManager.resumeEffects();
            }
        });
    }
    
    /**
     * Configurar efectos hover
     */
    setupHoverEffects() {
        if (!this.elements.lamp) return;
        
        // CSS para efectos hover se maneja en lamp.css
        // Aquí solo agregamos lógica adicional si es necesaria
    }
    
    /**
     * Actualizar lámpara con nuevo valor LDR
     * @param {number} ldrValue - Valor del sensor LDR
     * @param {string} timestamp - Timestamp de la lectura
     */
    updateLamp(ldrValue, timestamp = null) {
        this.currentValue = ldrValue;
        
        // Determinar nuevo tema
        const newTheme = determineTheme(ldrValue);
        
        log('DEBUG', 'LAMP', `Actualizando lámpara: LDR=${ldrValue}, Tema=${newTheme}`);
        
        // Actualizar valores en UI
        this.updateDisplayValues(ldrValue, timestamp);
        
        // Cambiar tema si es necesario
        if (newTheme !== this.currentTheme) {
            this.changeTheme(newTheme);
        }
        
        // Actualizar intensidad de luz
        this.updateLightIntensity(ldrValue, newTheme);
        
        // Actualizar navegación si existe la función global
        if (typeof updateNavTheme === 'function') {
            updateNavTheme(newTheme.toLowerCase());
        }
    }
    
    /**
     * Actualizar valores mostrados en la interfaz
     * @param {number} ldrValue - Valor LDR
     * @param {string} timestamp - Timestamp
     */
    updateDisplayValues(ldrValue, timestamp) {
        // Valor principal
        if (this.elements.ldrValue) {
            this.elements.ldrValue.textContent = ldrValue;
            this.animateValueChange(this.elements.ldrValue);
        }
        
        // Valor móvil
        if (this.elements.mobileValue) {
            this.elements.mobileValue.textContent = ldrValue;
        }
        
        // Timestamp
        if (timestamp && this.elements.lastUpdate) {
            const time = new Date(timestamp).toLocaleTimeString('es-ES');
            this.elements.lastUpdate.textContent = time;
        }
    }
    
    /**
     * Animar cambio de valor
     * @param {HTMLElement} element - Elemento a animar
     */
    animateValueChange(element) {
        if (!element) return;
        
        element.classList.add('value-changed');
        
        setTimeout(() => {
            element.classList.remove('value-changed');
        }, 600);
    }
    
    /**
     * Cambiar tema de la lámpara
     * @param {string} newTheme - Nuevo tema (DARK, MEDIUM, BRIGHT)
     */
    changeTheme(newTheme) {
        if (this.isTransitioning) {
            log('WARN', 'LAMP', 'Transición en progreso, ignorando cambio');
            return;
        }
        
        const oldTheme = this.currentTheme;
        const themeConfig = THEMES_CONFIG[newTheme];
        
        if (!themeConfig) {
            log('ERROR', 'LAMP', `Tema inválido: ${newTheme}`);
            return;
        }
        
        log('INFO', 'LAMP', `Cambiando tema: ${oldTheme} → ${newTheme}`);
        
        this.isTransitioning = true;
        
        // Aplicar clase de tema al body
        if (this.elements.body) {
            // Remover todas las clases de tema
            Object.values(THEMES_CONFIG).forEach(theme => {
                this.elements.body.classList.remove(theme.className);
            });
            
            // Agregar nueva clase de tema
            this.elements.body.classList.add(themeConfig.className);
        }
        
        // Actualizar información del tema
        this.updateThemeInfo(newTheme, themeConfig);
        
        // Aplicar efectos ambientales con transición
        if (oldTheme !== newTheme) {
            this.effectsManager.createThemeTransition(oldTheme, newTheme);
        } else {
            this.effectsManager.applyThemeEffects(newTheme);
        }
        
        // Actualizar tema actual
        this.currentTheme = newTheme;
        
        // Liberar flag de transición
        setTimeout(() => {
            this.isTransitioning = false;
            log('DEBUG', 'LAMP', 'Transición de tema completada');
        }, APP_CONFIG.EFFECTS.TRANSITION_DURATION);
    }
    
    /**
     * Actualizar información del tema en la UI
     * @param {string} themeName - Nombre del tema
     * @param {Object} themeConfig - Configuración del tema
     */
    updateThemeInfo(themeName, themeConfig) {
        // Nombre del tema
        if (this.elements.themeName) {
            this.elements.themeName.textContent = themeConfig.name;
            this.animateThemeChange(this.elements.themeName);
        }
        
        // Descripción del tema
        if (this.elements.themeDescription) {
            this.elements.themeDescription.textContent = themeConfig.description;
        }
        
        // Tema móvil
        if (this.elements.mobileTheme) {
            this.elements.mobileTheme.innerHTML = `<i class="bi ${themeConfig.icon}"></i>`;
        }
    }
    
    /**
     * Animar cambio de tema
     * @param {HTMLElement} element - Elemento a animar
     */
    animateThemeChange(element) {
        if (!element) return;
        
        element.classList.add('theme-changed');
        
        setTimeout(() => {
            element.classList.remove('theme-changed');
        }, 1000);
    }
    
    /**
     * Actualizar intensidad de luz según valor LDR
     * @param {number} ldrValue - Valor LDR
     * @param {string} theme - Tema actual
     */
    updateLightIntensity(ldrValue, theme) {
        if (!this.elements.lampGlow) return;
        
        const themeConfig = THEMES_CONFIG[theme];
        const { min, max } = themeConfig.range;
        
        // Calcular intensidad relativa (0-1)
        this.intensityLevel = Math.max(0, Math.min(1, (ldrValue - min) / (max - min)));
        
        // Aplicar intensidad según el tema
        switch (theme) {
            case 'DARK':
                this.applyDarkIntensity(this.intensityLevel);
                break;
            case 'MEDIUM':
                this.applyMediumIntensity(this.intensityLevel);
                break;
            case 'BRIGHT':
                this.applyBrightIntensity(this.intensityLevel);
                break;
        }
        
        log('DEBUG', 'LAMP', `Intensidad aplicada: ${this.intensityLevel.toFixed(2)} (${theme})`);
    }
    
    /**
     * Aplicar intensidad para tema oscuro
     * @param {number} intensity - Intensidad (0-1)
     */
    applyDarkIntensity(intensity) {
        if (!this.elements.lampGlow) return;
        
        const baseOpacity = 0.3;
        const maxOpacity = 0.7;
        const baseScale = 0.5;
        const maxScale = 0.8;
        
        const opacity = baseOpacity + (intensity * (maxOpacity - baseOpacity));
        const scale = baseScale + (intensity * (maxScale - baseScale));
        
        this.elements.lampGlow.style.opacity = opacity;
        this.elements.lampGlow.style.transform = `translateX(-50%) scale(${scale})`;
    }
    
    /**
     * Aplicar intensidad para tema medio
     * @param {number} intensity - Intensidad (0-1)
     */
    applyMediumIntensity(intensity) {
        if (!this.elements.lampGlow) return;
        
        const baseOpacity = 0.5;
        const maxOpacity = 0.9;
        const baseScale = 0.7;
        const maxScale = 1.1;
        
        const opacity = baseOpacity + (intensity * (maxOpacity - baseOpacity));
        const scale = baseScale + (intensity * (maxScale - baseScale));
        
        this.elements.lampGlow.style.opacity = opacity;
        this.elements.lampGlow.style.transform = `translateX(-50%) scale(${scale})`;
    }
    
    /**
     * Aplicar intensidad para tema brillante
     * @param {number} intensity - Intensidad (0-1)
     */
    applyBrightIntensity(intensity) {
        if (!this.elements.lampGlow) return;
        
        const baseOpacity = 0.8;
        const maxOpacity = 1.0;
        const baseScale = 1.0;
        const maxScale = 1.3;
        
        const opacity = baseOpacity + (intensity * (maxOpacity - baseOpacity));
        const scale = baseScale + (intensity * (maxScale - baseScale));
        
        this.elements.lampGlow.style.opacity = opacity;
        this.elements.lampGlow.style.transform = `translateX(-50%) scale(${scale})`;
        
        // Activar pulso en intensidad alta
        if (intensity > 0.8) {
            this.elements.lampGlow.style.animation = 'brightPulse 3s ease-in-out infinite';
        } else {
            this.elements.lampGlow.style.animation = 'none';
        }
    }
    
    /**
     * Manejar hover en la lámpara
     * @param {boolean} isHovering - Si está haciendo hover
     */
    onLampHover(isHovering) {
        if (!this.elements.lampGlow) return;
        
        if (isHovering) {
            // Aumentar ligeramente el brillo en hover
            const currentTransform = this.elements.lampGlow.style.transform;
            const scaleMatch = currentTransform.match(/scale\(([\d.]+)\)/);
            const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
            
            this.elements.lampGlow.style.transform = currentTransform.replace(
                /scale\([\d.]+\)/, 
                `scale(${currentScale * 1.1})`
            );
        } else {
            // Restaurar intensidad normal
            this.updateLightIntensity(this.currentValue || 500, this.currentTheme);
        }
    }
    
    /**
     * Activar efecto especial al hacer click
     */
    triggerSpecialEffect() {
        log('DEBUG', 'LAMP', 'Efecto especial activado');
        
        // Crear partículas del color del tema actual
        const themeConfig = THEMES_CONFIG[this.currentTheme];
        const color = themeConfig.colors.accent;
        
        this.effectsManager.createFloatingParticles(color, 25);
        
        // Pulso especial en la lámpara
        if (this.elements.lampGlow) {
            this.elements.lampGlow.style.animation = 'specialPulse 1s ease-out';
            
            setTimeout(() => {
                this.elements.lampGlow.style.animation = 
                    this.currentTheme === 'BRIGHT' && this.intensityLevel > 0.8 ? 
                    'brightPulse 3s ease-in-out infinite' : 'none';
            }, 1000);
        }
        
        // Agregar keyframes para el pulso especial si no existen
        this.ensureSpecialEffectKeyframes();
    }
    
    /**
     * Asegurar que existan las keyframes para efectos especiales
     */
    ensureSpecialEffectKeyframes() {
        if (!document.getElementById('special-effect-keyframes')) {
            const style = document.createElement('style');
            style.id = 'special-effect-keyframes';
            style.textContent = `
                @keyframes specialPulse {
                    0% { transform: translateX(-50%) scale(1); filter: brightness(1); }
                    50% { transform: translateX(-50%) scale(1.3); filter: brightness(1.5); }
                    100% { transform: translateX(-50%) scale(1); filter: brightness(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Actualizar estadísticas mostradas
     * @param {Object} stats - Objeto con estadísticas
     */
    updateStats(stats) {
        const updates = {
            minValue: stats.minValue ?? '--',
            maxValue: stats.maxValue ?? '--',
            avgValue: stats.avgValue ?? '--',
            totalReadings: stats.totalReadings ?? '--'
        };
        
        Object.entries(updates).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].textContent = value;
            }
        });
        
        // Actualizar progreso diario si hay datos
        this.updateDailyProgress(stats);
        
        log('DEBUG', 'LAMP', 'Estadísticas actualizadas');
    }
    
    /**
     * Actualizar progreso diario
     * @param {Object} stats - Estadísticas
     */
    updateDailyProgress(stats) {
        if (!this.elements.dailyProgress || !this.elements.dailyReadings) return;
        
        const totalReadings = stats.totalReadings || 0;
        const dailyTarget = 1000; // Meta diaria de lecturas
        
        // Simular lecturas del día (en un sistema real vendría del backend)
        const dailyReadings = Math.min(totalReadings, dailyTarget);
        const progressPercent = Math.min((dailyReadings / dailyTarget) * 100, 100);
        
        this.elements.dailyProgress.style.width = `${progressPercent}%`;
        this.elements.dailyProgress.setAttribute('aria-valuenow', progressPercent);
        this.elements.dailyReadings.textContent = dailyReadings;
    }
    
    /**
     * Actualizar estado de conexión
     * @param {boolean} connected - Estado de conexión
     * @param {string} message - Mensaje de estado
     */
    updateConnectionStatus(connected, message = '') {
        const statusText = connected ? 
            '🟢 Sistema Conectado' : 
            (message || '🔴 Sistema Desconectado');
        
        // Estado principal
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.innerHTML = `
                <i class="bi ${connected ? 'bi-wifi' : 'bi-wifi-off'}"></i>
                ${statusText}
            `;
            this.elements.connectionStatus.className = `status ${connected ? 'status--connected' : 'status--disconnected'}`;
        }
        
        // Estado móvil
        if (this.elements.mobileStatus) {
            this.elements.mobileStatus.innerHTML = `
                <i class="bi ${connected ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
            `;
        }
        
        // Efecto visual según el estado
        if (connected) {
            this.effectsManager.createConnectionSuccessEffect();
        } else {
            this.effectsManager.createConnectionErrorEffect();
        }
        
        log('DEBUG', 'LAMP', `Estado de conexión actualizado: ${connected}`);
    }
    
    /**
     * Actualizar contador de cambios
     * @param {number} count - Número de cambios
     */
    updateChangeCount(count) {
        if (this.elements.changeCount) {
            this.elements.changeCount.textContent = count;
        }
    }
    
    /**
     * Actualizar tiempo de conexión
     * @param {Date} connectionTime - Tiempo de conexión
     */
    updateConnectionTime(connectionTime) {
        if (this.elements.connectionTime && connectionTime) {
            const time = connectionTime.toLocaleTimeString('es-ES');
            this.elements.connectionTime.textContent = time;
        }
    }
    
    /**
     * Mostrar overlay de carga
     * @param {boolean} show - Si mostrar el overlay
     * @param {string} message - Mensaje de carga
     */
    showLoading(show, message = 'Cargando...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = overlay?.querySelector('.loading-text');
        
        if (!overlay) return;
        
        if (show) {
            if (loadingText) {
                loadingText.textContent = message;
            }
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
    
    /**
     * Forzar tema específico (para testing)
     * @param {string} theme - Tema a aplicar
     */
    forceTheme(theme) {
        if (THEMES_CONFIG[theme]) {
            log('INFO', 'LAMP', `Forzando tema: ${theme}`);
            this.changeTheme(theme);
            
            // Simular valor LDR para el tema
            const themeConfig = THEMES_CONFIG[theme];
            const mockValue = Math.floor((themeConfig.range.min + themeConfig.range.max) / 2);
            this.updateDisplayValues(mockValue);
        } else {
            log('ERROR', 'LAMP', `Tema inválido para forzar: ${theme}`);
        }
    }
    
    /**
     * Simular datos para testing
     * @param {number} ldrValue - Valor LDR a simular
     */
    simulateData(ldrValue) {
        log('INFO', 'LAMP', `Simulando datos: LDR=${ldrValue}`);
        
        this.updateLamp(ldrValue, new Date().toISOString());
        
        // Simular estadísticas
        this.updateStats({
            minValue: Math.max(0, ldrValue - 100),
            maxValue: Math.min(1023, ldrValue + 100),
            avgValue: ldrValue,
            totalReadings: 42
        });
    }
    
    /**
     * Obtener estado actual del componente
     * @returns {Object} Estado actual
     */
    getStatus() {
        return {
            currentTheme: this.currentTheme,
            currentValue: this.currentValue,
            intensityLevel: this.intensityLevel,
            isTransitioning: this.isTransitioning,
            effectsStatus: this.effectsManager.getStatus()
        };
    }
    
    /**
     * Reiniciar componente
     */
    reset() {
        log('INFO', 'LAMP', 'Reiniciando componente lámpara');
        
        // Resetear valores
        this.currentValue = null;
        this.intensityLevel = 0.5;
        this.isTransitioning = false;
        
        // Limpiar efectos
        this.effectsManager.clearAllEffects();
        
        // Aplicar tema por defecto
        this.changeTheme('MEDIUM');
        
        // Resetear elementos visuales
        if (this.elements.ldrValue) {
            this.elements.ldrValue.textContent = '---';
        }
        
        if (this.elements.mobileValue) {
            this.elements.mobileValue.textContent = '---';
        }
        
        if (this.elements.lastUpdate) {
            this.elements.lastUpdate.textContent = '--:--:--';
        }
        
        if (this.elements.changeCount) {
            this.elements.changeCount.textContent = '0';
        }
        
        // Resetear estadísticas
        ['minValue', 'maxValue', 'avgValue', 'totalReadings'].forEach(key => {
            if (this.elements[key]) {
                this.elements[key].textContent = '--';
            }
        });
        
        this.updateConnectionStatus(false, 'Sistema reiniciado');
    }
    
    /**
     * Habilitar/deshabilitar efectos
     * @param {boolean} enabled - Estado de los efectos
     */
    setEffectsEnabled(enabled) {
        this.effectsManager.setEnabled(enabled);
        log('INFO', 'LAMP', `Efectos ${enabled ? 'habilitados' : 'deshabilitados'}`);
    }
    
    /**
     * Destruir componente
     */
    destroy() {
        log('INFO', 'LAMP', 'Destruyendo componente lámpara');
        
        // Limpiar efectos
        this.effectsManager.destroy();
        
        // Remover event listeners
        if (this.elements.lamp) {
            this.elements.lamp.removeEventListener('mouseenter', this.onLampHover);
            this.elements.lamp.removeEventListener('mouseleave', this.onLampHover);
            this.elements.lamp.removeEventListener('click', this.triggerSpecialEffect);
        }
        
        // Limpiar referencias
        this.elements = {};
        this.effectsManager = null;
        
        // Remover estilos especiales
        const specialStyles = document.getElementById('special-effect-keyframes');
        if (specialStyles) {
            specialStyles.remove();
        }
    }
}

// Exportar clase por defecto
export default LampComponent;