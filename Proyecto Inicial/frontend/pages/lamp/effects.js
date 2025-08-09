/**
 * EFECTOS VISUALES - Gestión de efectos ambientales
 * Maneja estrellas, nubes, rayos de sol y otros efectos visuales
 */

import { APP_CONFIG, log, prefersReducedMotion } from '../../shared/js/config.js';

export class EffectsManager {
    constructor() {
        this.containers = this.initContainers();
        this.activeEffects = new Set();
        this.animationFrames = [];
        this.isEnabled = !prefersReducedMotion();
        
        log('INFO', 'EFFECTS', 'Gestor de efectos inicializado');
    }
    
    /**
     * Inicializar contenedores de efectos
     * @returns {Object} Contenedores DOM
     */
    initContainers() {
        return {
            stars: document.getElementById('starsContainer'),
            clouds: document.getElementById('cloudsContainer'),
            sunrays: document.getElementById('sunraysContainer')
        };
    }
    
    /**
     * Limpiar todos los efectos
     */
    clearAllEffects() {
        log('DEBUG', 'EFFECTS', 'Limpiando todos los efectos');
        
        // Cancelar animaciones activas
        this.animationFrames.forEach(frame => cancelAnimationFrame(frame));
        this.animationFrames = [];
        
        // Limpiar contenedores
        Object.values(this.containers).forEach(container => {
            if (container) {
                container.innerHTML = '';
            }
        });
        
        // Limpiar set de efectos activos
        this.activeEffects.clear();
    }
    
    /**
     * Aplicar efectos según el tema
     * @param {string} theme - Tema actual (DARK, MEDIUM, BRIGHT)
     */
    applyThemeEffects(theme) {
        if (!this.isEnabled) {
            log('DEBUG', 'EFFECTS', 'Efectos deshabilitados (reduced motion)');
            return;
        }
        
        log('INFO', 'EFFECTS', `Aplicando efectos para tema: ${theme}`);
        
        // Limpiar efectos anteriores
        this.clearAllEffects();
        
        // Aplicar nuevos efectos según el tema
        switch (theme) {
            case 'DARK':
                this.createStars();
                break;
            case 'MEDIUM':
                this.createClouds();
                break;
            case 'BRIGHT':
                this.createSunRays();
                break;
            default:
                log('WARN', 'EFFECTS', `Tema desconocido: ${theme}`);
        }
    }
    
    /**
     * Crear efecto de estrellas para tema nocturno
     */
    createStars() {
        if (!this.containers.stars) {
            log('WARN', 'EFFECTS', 'Contenedor de estrellas no encontrado');
            return;
        }
        
        const starCount = APP_CONFIG.EFFECTS.STARS_COUNT;
        this.activeEffects.add('stars');
        
        log('DEBUG', 'EFFECTS', `Creando ${starCount} estrellas`);
        
        for (let i = 0; i < starCount; i++) {
            const star = this.createStarElement(i);
            this.containers.stars.appendChild(star);
        }
        
        // Animación de aparición gradual
        this.animateStarsAppearance();
    }
    
    /**
     * Crear elemento de estrella individual
     * @param {number} index - Índice de la estrella
     * @returns {HTMLElement} Elemento estrella
     */
    createStarElement(index) {
        const star = document.createElement('div');
        star.className = 'star';
        
        // Posición aleatoria
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        // Tamaño aleatorio
        const size = 1 + Math.random() * 3;
        
        // Timing de animación aleatorio
        const animationDelay = Math.random() * 3;
        const animationDuration = 2 + Math.random() * 3;
        
        // Aplicar estilos
        Object.assign(star.style, {
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            boxShadow: `0 0 ${size * 2}px rgba(255, 255, 255, 0.8)`,
            animationName: 'starTwinkle',
            animationDuration: `${animationDuration}s`,
            animationDelay: `${animationDelay}s`,
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: 'ease-in-out',
            opacity: '0'
        });
        
        // Agregar CSS de animación si no existe
        this.ensureStarKeyframes();
        
        return star;
    }
    
    /**
     * Asegurar que las keyframes de estrellas existan
     */
    ensureStarKeyframes() {
        if (!document.getElementById('star-keyframes')) {
            const style = document.createElement('style');
            style.id = 'star-keyframes';
            style.textContent = `
                @keyframes starTwinkle {
                    0% { opacity: 0.3; transform: scale(1); }
                    100% { opacity: 1; transform: scale(1.5); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Animar aparición gradual de estrellas
     */
    animateStarsAppearance() {
        const stars = this.containers.stars.querySelectorAll('.star');
        
        stars.forEach((star, index) => {
            setTimeout(() => {
                star.style.opacity = '1';
            }, index * 50);
        });
    }
    
    /**
     * Crear efecto de nubes para tema medio
     */
    createClouds() {
        if (!this.containers.clouds) {
            log('WARN', 'EFFECTS', 'Contenedor de nubes no encontrado');
            return;
        }
        
        const cloudCount = APP_CONFIG.EFFECTS.CLOUDS_COUNT;
        this.activeEffects.add('clouds');
        
        log('DEBUG', 'EFFECTS', `Creando ${cloudCount} nubes`);
        
        for (let i = 0; i < cloudCount; i++) {
            const cloud = this.createCloudElement(i);
            this.containers.clouds.appendChild(cloud);
        }
        
        this.ensureCloudKeyframes();
    }
    
    /**
     * Crear elemento de nube individual
     * @param {number} index - Índice de la nube
     * @returns {HTMLElement} Elemento nube
     */
    createCloudElement(index) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        
        // Tamaño aleatorio
        const baseSize = 60 + Math.random() * 40;
        const width = baseSize;
        const height = baseSize * 0.6;
        
        // Posición y timing
        const y = 20 + Math.random() * 30;
        const animationDuration = 15 + Math.random() * 10;
        const animationDelay = index * 3;
        
        // Aplicar estilos
        Object.assign(cloud.style, {
            position: 'absolute',
            left: '-100px',
            top: `${y}%`,
            width: `${width}px`,
            height: `${height}px`,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '50px',
            animationName: 'cloudFloat',
            animationDuration: `${animationDuration}s`,
            animationDelay: `${animationDelay}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear'
        });
        
        // Agregar formas adicionales para hacer la nube más realista
        this.addCloudShapes(cloud);
        
        return cloud;
    }
    
    /**
     * Agregar formas adicionales a la nube
     * @param {HTMLElement} cloud - Elemento nube
     */
    addCloudShapes(cloud) {
        const shapes = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < shapes; i++) {
            const shape = document.createElement('div');
            const size = 20 + Math.random() * 30;
            const x = Math.random() * 60;
            const y = Math.random() * 40;
            
            Object.assign(shape.style, {
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%'
            });
            
            cloud.appendChild(shape);
        }
    }
    
    /**
     * Asegurar que las keyframes de nubes existan
     */
    ensureCloudKeyframes() {
        if (!document.getElementById('cloud-keyframes')) {
            const style = document.createElement('style');
            style.id = 'cloud-keyframes';
            style.textContent = `
                @keyframes cloudFloat {
                    0% { transform: translateX(-100px); }
                    100% { transform: translateX(calc(100vw + 100px)); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Crear efecto de rayos de sol para tema brillante
     */
    createSunRays() {
        if (!this.containers.sunrays) {
            log('WARN', 'EFFECTS', 'Contenedor de rayos no encontrado');
            return;
        }
        
        const rayCount = APP_CONFIG.EFFECTS.SUN_RAYS_COUNT;
        this.activeEffects.add('sunrays');
        
        log('DEBUG', 'EFFECTS', `Creando ${rayCount} rayos de sol`);
        
        // Crear contenedor central para los rayos
        const rayContainer = document.createElement('div');
        Object.assign(rayContainer.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '0',
            height: '0'
        });
        
        for (let i = 0; i < rayCount; i++) {
            const ray = this.createSunRayElement(i, rayCount);
            rayContainer.appendChild(ray);
        }
        
        this.containers.sunrays.appendChild(rayContainer);
        this.ensureSunRayKeyframes();
    }
    
    /**
     * Crear elemento de rayo de sol individual
     * @param {number} index - Índice del rayo
     * @param {number} total - Total de rayos
     * @returns {HTMLElement} Elemento rayo
     */
    createSunRayElement(index, total) {
        const ray = document.createElement('div');
        ray.className = 'sun-ray';
        
        // Calcular rotación
        const rotation = (index * 360) / total;
        const animationDelay = index * 0.1;
        
        // Aplicar estilos
        Object.assign(ray.style, {
            position: 'absolute',
            width: '4px',
            height: '120px',
            background: 'linear-gradient(to bottom, rgba(255, 255, 200, 0.8), transparent)',
            transformOrigin: 'center bottom',
            transform: `rotate(${rotation}deg)`,
            animationName: 'sunRayRotate',
            animationDuration: '10s',
            animationDelay: `${animationDelay}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear'
        });
        
        return ray;
    }
    
    /**
     * Asegurar que las keyframes de rayos de sol existan
     */
    ensureSunRayKeyframes() {
        if (!document.getElementById('sunray-keyframes')) {
            const style = document.createElement('style');
            style.id = 'sunray-keyframes';
            style.textContent = `
                @keyframes sunRayRotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Crear efecto de partículas flotantes
     * @param {string} color - Color de las partículas
     * @param {number} count - Número de partículas
     */
    createFloatingParticles(color = '#ffffff', count = 20) {
        if (!this.isEnabled) return;
        
        const container = document.createElement('div');
        container.className = 'floating-particles';
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '2'
        });
        
        for (let i = 0; i < count; i++) {
            const particle = this.createParticleElement(color);
            container.appendChild(particle);
        }
        
        document.body.appendChild(container);
        
        // Auto-remove después de 10 segundos
        setTimeout(() => {
            if (container.parentNode) {
                container.remove();
            }
        }, 10000);
    }
    
    /**
     * Crear elemento de partícula individual
     * @param {string} color - Color de la partícula
     * @returns {HTMLElement} Elemento partícula
     */
    createParticleElement(color) {
        const particle = document.createElement('div');
        
        const size = 2 + Math.random() * 4;
        const x = Math.random() * 100;
        const y = 100 + Math.random() * 20;
        const duration = 3 + Math.random() * 4;
        const delay = Math.random() * 2;
        
        Object.assign(particle.style, {
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            borderRadius: '50%',
            opacity: '0.7',
            animation: `particleFloat ${duration}s ${delay}s ease-out forwards`
        });
        
        this.ensureParticleKeyframes();
        
        return particle;
    }
    
    /**
     * Asegurar que las keyframes de partículas existan
     */
    ensureParticleKeyframes() {
        if (!document.getElementById('particle-keyframes')) {
            const style = document.createElement('style');
            style.id = 'particle-keyframes';
            style.textContent = `
                @keyframes particleFloat {
                    0% { 
                        transform: translateY(0px) rotate(0deg); 
                        opacity: 0.7; 
                    }
                    100% { 
                        transform: translateY(-100vh) rotate(360deg); 
                        opacity: 0; 
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Crear efecto de transición entre temas
     * @param {string} fromTheme - Tema anterior
     * @param {string} toTheme - Tema nuevo
     */
    createThemeTransition(fromTheme, toTheme) {
        if (!this.isEnabled) {
            this.applyThemeEffects(toTheme);
            return;
        }
        
        log('INFO', 'EFFECTS', `Transición de tema: ${fromTheme} → ${toTheme}`);
        
        // Crear overlay de transición
        const overlay = document.createElement('div');
        overlay.className = 'theme-transition-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: this.getTransitionGradient(fromTheme, toTheme),
            opacity: '0',
            pointerEvents: 'none',
            zIndex: '1000',
            transition: 'opacity 0.8s ease-in-out'
        });
        
        document.body.appendChild(overlay);
        
        // Animación de transición
        requestAnimationFrame(() => {
            overlay.style.opacity = '0.3';
            
            setTimeout(() => {
                this.applyThemeEffects(toTheme);
                overlay.style.opacity = '0';
                
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.remove();
                    }
                }, 800);
            }, 400);
        });
    }
    
    /**
     * Obtener gradiente de transición entre temas
     * @param {string} fromTheme - Tema anterior
     * @param {string} toTheme - Tema nuevo
     * @returns {string} CSS gradient
     */
    getTransitionGradient(fromTheme, toTheme) {
        const gradients = {
            'DARK-MEDIUM': 'radial-gradient(circle, rgba(255,100,50,0.3) 0%, rgba(10,10,46,0.3) 100%)',
            'MEDIUM-BRIGHT': 'radial-gradient(circle, rgba(255,255,200,0.3) 0%, rgba(255,127,80,0.3) 100%)',
            'BRIGHT-DARK': 'radial-gradient(circle, rgba(10,10,46,0.3) 0%, rgba(255,255,200,0.3) 100%)',
            'DARK-BRIGHT': 'radial-gradient(circle, rgba(255,255,200,0.3) 0%, rgba(10,10,46,0.3) 100%)',
            'MEDIUM-DARK': 'radial-gradient(circle, rgba(10,10,46,0.3) 0%, rgba(255,100,50,0.3) 100%)',
            'BRIGHT-MEDIUM': 'radial-gradient(circle, rgba(255,127,80,0.3) 0%, rgba(255,255,200,0.3) 100%)'
        };
        
        return gradients[`${fromTheme}-${toTheme}`] || 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 100%)';
    }
    
    /**
     * Crear efecto de conexión exitosa
     */
    createConnectionSuccessEffect() {
        if (!this.isEnabled) return;
        
        const colors = ['#27ae60', '#2ecc71', '#00d2d3'];
        this.createFloatingParticles(colors[Math.floor(Math.random() * colors.length)], 15);
        
        log('DEBUG', 'EFFECTS', 'Efecto de conexión exitosa creado');
    }
    
    /**
     * Crear efecto de error de conexión
     */
    createConnectionErrorEffect() {
        if (!this.isEnabled) return;
        
        const colors = ['#e74c3c', '#c0392b', '#ff6b6b'];
        this.createFloatingParticles(colors[Math.floor(Math.random() * colors.length)], 10);
        
        log('DEBUG', 'EFFECTS', 'Efecto de error de conexión creado');
    }
    
    /**
     * Pausar todos los efectos
     */
    pauseEffects() {
        log('INFO', 'EFFECTS', 'Pausando efectos');
        
        document.querySelectorAll('.star, .cloud, .sun-ray').forEach(element => {
            element.style.animationPlayState = 'paused';
        });
    }
    
    /**
     * Reanudar todos los efectos
     */
    resumeEffects() {
        log('INFO', 'EFFECTS', 'Reanudando efectos');
        
        document.querySelectorAll('.star, .cloud, .sun-ray').forEach(element => {
            element.style.animationPlayState = 'running';
        });
    }
    
    /**
     * Habilitar/deshabilitar efectos
     * @param {boolean} enabled - Estado de los efectos
     */
    setEnabled(enabled) {
        this.isEnabled = enabled && !prefersReducedMotion();
        
        if (!this.isEnabled) {
            this.clearAllEffects();
        }
        
        log('INFO', 'EFFECTS', `Efectos ${this.isEnabled ? 'habilitados' : 'deshabilitados'}`);
    }
    
    /**
     * Obtener información de efectos activos
     * @returns {Object} Estado de los efectos
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            activeEffects: Array.from(this.activeEffects),
            reducedMotion: prefersReducedMotion(),
            animationFrames: this.animationFrames.length
        };
    }
    
    /**
     * Destruir gestor de efectos
     */
    destroy() {
        log('INFO', 'EFFECTS', 'Destruyendo gestor de efectos');
        
        this.clearAllEffects();
        
        // Remover estilos de keyframes
        ['star-keyframes', 'cloud-keyframes', 'sunray-keyframes', 'particle-keyframes'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });
        
        // Limpiar referencias
        this.containers = {};
        this.activeEffects.clear();
        this.animationFrames = [];
    }
}

// Exportar clase por defecto
export default EffectsManager;