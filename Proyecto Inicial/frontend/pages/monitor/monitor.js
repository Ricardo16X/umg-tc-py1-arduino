/**
 * MONITOR LDR - APLICACIÓN PRINCIPAL
 * Sistema de monitoreo en tiempo real con historial compartido
 */

import { APP_CONFIG, THEMES_CONFIG, log, formatTimestamp, determineTheme, extractLDRValue } from '../../shared/js/config.js';
import WebSocketService from '../../shared/js/websocket-service.js';
import APIService from '../../shared/js/api-service.js';

class MonitorApp {
    constructor() {
        // Servicios principales
        this.websocketService = new WebSocketService();
        this.apiService = new APIService();
        
        // Estado de la aplicación
        this.isInitialized = false;
        this.isConnected = false;
        this.isPaused = false;
        this.sessionStartTime = null;
        this.connectionTime = null;
        
        // Datos del historial compartido
        this.sharedHistory = [];
        this.maxHistoryPoints = 100;
        this.currentStats = {
            current: null,
            min: null,
            max: null,
            avg: 0,
            total: 0
        };
        
        // Contadores y métricas
        this.totalReadings = 0;
        this.connectedDevices = 1;
        this.readingRate = 0;
        this.lastReadingTime = null;
        
        // Distribución por temas
        this.themeDistribution = {
            dark: 0,
            medium: 0,
            bright: 0
        };
        
        // Gráfico y elementos DOM
        this.chart = null;
        this.elements = {};
        this.intervalIds = [];
        
        log('INFO', 'MONITOR', '📊 Monitor App inicializado');
    }
    
    /**
     * Inicializar aplicación completa
     */
    async init() {
        try {
            log('INFO', 'MONITOR', '🚀 Iniciando sistema de monitor...');
            
            this.showLoading(true, 'Inicializando monitor...');
            
            // Inicializar elementos DOM
            this.initElements();
            
            // Configurar eventos
            this.setupEvents();
            
            // Inicializar gráfico
            this.initChart();
            
            // Configurar servicios
            this.setupServices();
            
            // Cargar datos iniciales
            await this.loadInitialData();
            
            // Conectar WebSocket
            await this.connectWebSocket();
            
            // Iniciar servicios periódicos
            this.startPeriodicServices();
            
            this.isInitialized = true;
            this.showLoading(false);
            
            this.showNotification('Monitor iniciado correctamente', 'success');
            
            log('INFO', 'MONITOR', '✅ Monitor iniciado exitosamente');
            
        } catch (error) {
            log('ERROR', 'MONITOR', '❌ Error iniciando monitor:', error);
            this.handleInitError(error);
        }
    }
    
    /**
     * Inicializar referencias a elementos DOM
     */
    initElements() {
        this.elements = {
            // Header y controles
            pauseBtn: document.getElementById('pauseBtn'),
            clearBtn: document.getElementById('clearBtn'),
            reconnectBtn: document.getElementById('reconnectBtn'),
            exportBtn: document.getElementById('exportBtn'),
            
            // Panel de sesión
            connectionStatus: document.getElementById('connectionStatus'),
            connectionIcon: document.getElementById('connectionIcon'),
            protocolInfo: document.getElementById('protocolInfo'),
            sessionTime: document.getElementById('sessionTime'),
            startTime: document.getElementById('startTime'),
            connectedDevices: document.getElementById('connectedDevices'),
            totalReadings: document.getElementById('totalReadings'),
            readingRate: document.getElementById('readingRate'),
            
            // Gráfico
            currentValue: document.getElementById('currentValue'),
            chartCanvas: document.getElementById('mainChart'),
            
            // Estadísticas
            statCurrent: document.getElementById('statCurrent'),
            statMin: document.getElementById('statMin'),
            statMax: document.getElementById('statMax'),
            statAvg: document.getElementById('statAvg'),
            
            // Distribución por temas
            darkPercent: document.getElementById('darkPercent'),
            darkCount: document.getElementById('darkCount'),
            mediumPercent: document.getElementById('mediumPercent'),
            mediumCount: document.getElementById('mediumCount'),
            brightPercent: document.getElementById('brightPercent'),
            brightCount: document.getElementById('brightCount'),
            
            // Información del sistema
            systemProtocol: document.getElementById('systemProtocol'),
            lastReading: document.getElementById('lastReading'),
            readingSpeed: document.getElementById('readingSpeed'),
            systemLatency: document.getElementById('systemLatency'),
            
            // Estados de servicios
            wsStatus: document.getElementById('wsStatus'),
            apiStatus: document.getElementById('apiStatus'),
            arduinoStatus: document.getElementById('arduinoStatus'),
            
            // Tabla de datos
            dataCount: document.getElementById('dataCount'),
            dataTableBody: document.getElementById('dataTableBody'),
            
            // Overlays
            loadingOverlay: document.getElementById('loadingOverlay'),
            notificationToast: document.getElementById('notificationToast'),
            toastMessage: document.getElementById('toastMessage')
        };
        
        // Verificar elementos críticos
        const criticalElements = ['chartCanvas', 'connectionStatus', 'totalReadings'];
        const missing = criticalElements.filter(key => !this.elements[key]);
        
        if (missing.length > 0) {
            log('WARN', 'MONITOR', 'Elementos DOM críticos faltantes:', missing);
        }
        
        log('DEBUG', 'MONITOR', 'Elementos DOM inicializados');
    }
    
    /**
     * Configurar eventos de la aplicación
     */
    setupEvents() {
        // Botones de control
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
        }
        
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearData());
        }
        
        if (this.elements.reconnectBtn) {
            this.elements.reconnectBtn.addEventListener('click', () => this.forceReconnect());
        }
        
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.exportData());
        }
        
        // Eventos de visibilidad
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseUpdates();
            } else {
                this.resumeUpdates();
            }
        });
        
        // Eventos de ventana
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        log('DEBUG', 'MONITOR', 'Eventos configurados');
    }
    
    /**
     * Inicializar gráfico con Chart.js
     */
    initChart() {
        if (!this.elements.chartCanvas) {
            log('ERROR', 'MONITOR', 'Canvas del gráfico no encontrado');
            return;
        }
        
        const ctx = this.elements.chartCanvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Valor LDR',
                    data: [],
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#007bff',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300,
                    easing: 'easeInOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#007bff',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                return `Lectura #${context[0].label}`;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const theme = determineTheme(value);
                                const themeConfig = THEMES_CONFIG[theme];
                                return [
                                    `Valor LDR: ${value}`,
                                    `Ambiente: ${themeConfig.name}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Número de Lectura',
                            color: '#6c757d',
                            font: {
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6c757d'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Valor LDR (0-1023)',
                            color: '#6c757d',
                            font: {
                                weight: 'bold'
                            }
                        },
                        min: 0,
                        max: 1023,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6c757d',
                            callback: function(value) {
                                return value;
                            }
                        }
                    }
                }
            }
        });
        
        // Agregar líneas de referencia para zonas de tema
        this.addThemeZonesToChart();
        
        log('DEBUG', 'MONITOR', 'Gráfico inicializado');
    }
    
    /**
     * Agregar líneas de referencia para zonas de tema
     */
    addThemeZonesToChart() {
        if (!this.chart) return;
        
        // Agregar anotaciones para las zonas de tema
        this.chart.options.plugins.annotation = {
            annotations: {
                darkZone: {
                    type: 'box',
                    yMin: 0,
                    yMax: 199,
                    backgroundColor: 'rgba(44, 62, 80, 0.1)',
                    borderColor: 'rgba(44, 62, 80, 0.3)',
                    borderWidth: 1
                },
                mediumZone: {
                    type: 'box',
                    yMin: 200,
                    yMax: 599,
                    backgroundColor: 'rgba(230, 126, 34, 0.1)',
                    borderColor: 'rgba(230, 126, 34, 0.3)',
                    borderWidth: 1
                },
                brightZone: {
                    type: 'box',
                    yMin: 600,
                    yMax: 1023,
                    backgroundColor: 'rgba(241, 196, 15, 0.1)',
                    borderColor: 'rgba(241, 196, 15, 0.3)',
                    borderWidth: 1
                }
            }
        };
    }
    
    /**
     * Configurar servicios WebSocket y API
     */
    setupServices() {
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
        
        log('DEBUG', 'MONITOR', 'Servicios configurados');
    }
    
    /**
     * Cargar datos iniciales desde API
     */
    async loadInitialData() {
        try {
            log('INFO', 'MONITOR', 'Cargando datos iniciales...');
            
            // Solo mostrar loading en inicialización, no en reconexiones
            if (!this.isInitialized) {
                this.showLoading(true, 'Cargando historial...');
            }
            
            // Verificar API
            const apiAvailable = await this.apiService.testConnection();
            this.updateServiceStatus('api', apiAvailable ? 'connected' : 'disconnected');
            
            if (apiAvailable) {
                // Cargar datos completos
                const completeData = await this.apiService.getCompleteData(this.maxHistoryPoints);
                
                // Procesar historial
                if (completeData.recentHistory && completeData.recentHistory.length > 0) {
                    this.loadSharedHistory(completeData.recentHistory);
                }
                
                // Procesar estadísticas
                if (completeData.stats) {
                    this.updateStats(completeData.stats);
                }
                
                // Mostrar errores si los hay
                if (completeData.errors.length > 0) {
                    log('WARN', 'MONITOR', 'Errores cargando datos:', completeData.errors);
                }
            }
            
            // Solo ocultar loading en inicialización
            if (!this.isInitialized) {
                this.showLoading(false);
            }
            
        } catch (error) {
            log('ERROR', 'MONITOR', 'Error cargando datos iniciales:', error);
            this.updateServiceStatus('api', 'disconnected');
            
            // Solo ocultar loading en inicialización
            if (!this.isInitialized) {
                this.showLoading(false);
            }
        }
    }
    
    /**
     * Cargar historial compartido desde el servidor
     * @param {Array} history - Array de lecturas históricas
     */
    loadSharedHistory(history) {
        log('INFO', 'MONITOR', `Cargando ${history.length} puntos del historial compartido`);
        
        // Limpiar historial actual
        this.sharedHistory = [];
        
        // Procesar cada punto histórico
        history.reverse().forEach((reading, index) => {
            const ldrValue = extractLDRValue(reading.value || reading.raw_data);
            const timestamp = reading.timestamp;
            
            this.addToSharedHistory(ldrValue, timestamp, false); // false = no actualizar gráfico aún
        });
        
        // Actualizar gráfico una sola vez con todos los datos
        this.updateChart();
        
        // Actualizar tabla
        this.updateDataTable();
        
        // Actualizar estadísticas
        this.calculateAndUpdateStats();
        
        log('INFO', 'MONITOR', 'Historial compartido cargado');
    }
    
    /**
     * Conectar WebSocket
     */
    async connectWebSocket() {
        try {
            log('INFO', 'MONITOR', 'Conectando WebSocket...');
            
            this.showLoading(true, 'Conectando tiempo real...');
            this.updateServiceStatus('websocket', 'connecting');
            
            const connected = await this.websocketService.connect();
            
            if (connected) {
                log('INFO', 'MONITOR', '✅ WebSocket conectado');
            } else {
                throw new Error('No se pudo conectar WebSocket');
            }
            
        } catch (error) {
            log('ERROR', 'MONITOR', 'Error conectando WebSocket:', error);
            this.updateServiceStatus('websocket', 'disconnected');
            this.showNotification('Error en conexión tiempo real', 'warning');
        }
    }
    
    /**
     * Manejar datos en tiempo real
     * @param {Object} data - Datos recibidos por WebSocket
     */
    handleRealtimeData(data) {
        if (this.isPaused) {
            log('DEBUG', 'MONITOR', 'Datos pausados, ignorando actualización');
            return;
        }
        
        const ldrValue = extractLDRValue(data.value);
        const timestamp = data.timestamp || new Date().toISOString();
        
        log('DEBUG', 'MONITOR', `Datos en tiempo real: LDR=${ldrValue}`);
        
        // Agregar al historial compartido
        this.addToSharedHistory(ldrValue, timestamp);
        
        // Actualizar métricas
        this.updateMetrics(ldrValue);
        
        // Actualizar servicios relacionados
        this.updateServiceStatus('arduino', 'connected');
        this.lastReadingTime = new Date();
        
        // Actualizar información de tiempo real
        this.updateCurrentValue(ldrValue);
        this.updateLastReading(timestamp);
    }
    
    /**
     * Agregar punto al historial compartido
     * @param {number} ldrValue - Valor LDR
     * @param {string} timestamp - Timestamp
     * @param {boolean} updateChart - Si actualizar el gráfico
     */
    addToSharedHistory(ldrValue, timestamp, updateChart = true) {
        const readingNumber = this.sharedHistory.length + 1;
        const theme = determineTheme(ldrValue);
        
        const dataPoint = {
            number: readingNumber,
            value: ldrValue,
            timestamp: timestamp,
            theme: theme,
            delta: this.sharedHistory.length > 0 ? 
                ldrValue - this.sharedHistory[this.sharedHistory.length - 1].value : 0
        };
        
        // Agregar al historial
        this.sharedHistory.push(dataPoint);
        
        // Mantener límite de puntos
        if (this.sharedHistory.length > this.maxHistoryPoints) {
            this.sharedHistory.shift();
            // Renumerar puntos
            this.sharedHistory.forEach((point, index) => {
                point.number = index + 1;
            });
        }
        
        // Actualizar contadores
        this.totalReadings++;
        this.themeDistribution[theme.toLowerCase()]++;
        
        if (updateChart) {
            // Actualizar gráfico
            this.updateChart();
            
            // Actualizar tabla
            this.updateDataTable();
            
            // Actualizar estadísticas
            this.calculateAndUpdateStats();
            
            // Actualizar distribución por temas
            this.updateThemeDistribution();
        }
    }
    
    /**
     * Actualizar gráfico con datos actuales
     */
    updateChart() {
        if (!this.chart || this.sharedHistory.length === 0) return;
        
        const labels = this.sharedHistory.map(point => point.number);
        const data = this.sharedHistory.map(point => point.value);
        
        // Actualizar datos del gráfico
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        
        // Cambiar color según el último valor
        if (data.length > 0) {
            const lastValue = data[data.length - 1];
            const theme = determineTheme(lastValue);
            const color = this.getThemeColor(theme);
            
            this.chart.data.datasets[0].borderColor = color;
            this.chart.data.datasets[0].backgroundColor = color + '20';
            this.chart.data.datasets[0].pointBackgroundColor = color;
        }
        
        // Actualizar gráfico
        this.chart.update('none'); // Sin animación para mejor rendimiento
        
        log('DEBUG', 'MONITOR', `Gráfico actualizado con ${data.length} puntos`);
    }
    
    /**
     * Obtener color del tema
     * @param {string} theme - Tema actual
     * @returns {string} Color hex
     */
    getThemeColor(theme) {
        const colors = {
            'DARK': '#2c3e50',
            'MEDIUM': '#e67e22', 
            'BRIGHT': '#f1c40f'
        };
        
        return colors[theme] || '#007bff';
    }
    
    /**
     * Actualizar tabla de datos
     */
    updateDataTable() {
        if (!this.elements.dataTableBody) return;
        
        // Obtener últimas 20 lecturas
        const recentData = this.sharedHistory.slice(-20).reverse();
        
        const rows = recentData.map(point => {
            const themeConfig = THEMES_CONFIG[point.theme];
            const deltaClass = point.delta > 0 ? 'delta-positive' : 
                             point.delta < 0 ? 'delta-negative' : 'delta-zero';
            const deltaSymbol = point.delta > 0 ? '+' : '';
            
            return `
                <tr class="new-data">
                    <td class="reading-number">${point.number}</td>
                    <td class="ldr-value">${point.value}</td>
                    <td>
                        <span class="theme-badge theme-badge--${point.theme.toLowerCase()}">
                            ${themeConfig.name}
                        </span>
                    </td>
                    <td class="timestamp">${formatTimestamp(point.timestamp)}</td>
                    <td class="delta-value ${deltaClass}">${deltaSymbol}${point.delta}</td>
                </tr>
            `;
        }).join('');
        
        this.elements.dataTableBody.innerHTML = rows;
        
        // Actualizar contador
        if (this.elements.dataCount) {
            this.elements.dataCount.textContent = recentData.length;
        }
        
        // Highlight del último dato
        setTimeout(() => {
            const firstRow = this.elements.dataTableBody.querySelector('tr');
            if (firstRow) {
                firstRow.classList.add('data-highlight');
                setTimeout(() => {
                    firstRow.classList.remove('data-highlight');
                }, 1000);
            }
        }, 100);
    }
    
    /**
     * Calcular y actualizar estadísticas
     */
    calculateAndUpdateStats() {
        if (this.sharedHistory.length === 0) return;
        
        const values = this.sharedHistory.map(point => point.value);
        
        this.currentStats = {
            current: values[values.length - 1],
            min: Math.min(...values),
            max: Math.max(...values),
            avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            total: values.length
        };
        
        // Actualizar elementos DOM
        if (this.elements.statCurrent) {
            this.elements.statCurrent.textContent = this.currentStats.current;
            this.elements.statCurrent.classList.add('value-updated');
            setTimeout(() => {
                this.elements.statCurrent.classList.remove('value-updated');
            }, 600);
        }
        
        if (this.elements.statMin) {
            this.elements.statMin.textContent = this.currentStats.min;
        }
        
        if (this.elements.statMax) {
            this.elements.statMax.textContent = this.currentStats.max;
        }
        
        if (this.elements.statAvg) {
            this.elements.statAvg.textContent = this.currentStats.avg;
        }
        
        if (this.elements.totalReadings) {
            this.elements.totalReadings.textContent = this.totalReadings;
        }
    }
    
    /**
     * Actualizar distribución por temas
     */
    updateThemeDistribution() {
        const total = this.totalReadings;
        if (total === 0) return;
        
        const darkPercent = (this.themeDistribution.dark / total) * 100;
        const mediumPercent = (this.themeDistribution.medium / total) * 100;
        const brightPercent = (this.themeDistribution.bright / total) * 100;
        
        // Actualizar barras de progreso
        if (this.elements.darkPercent) {
            this.elements.darkPercent.style.width = `${darkPercent}%`;
        }
        if (this.elements.darkCount) {
            this.elements.darkCount.textContent = this.themeDistribution.dark;
        }
        
        if (this.elements.mediumPercent) {
            this.elements.mediumPercent.style.width = `${mediumPercent}%`;
        }
        if (this.elements.mediumCount) {
            this.elements.mediumCount.textContent = this.themeDistribution.medium;
        }
        
        if (this.elements.brightPercent) {
            this.elements.brightPercent.style.width = `${brightPercent}%`;
        }
        if (this.elements.brightCount) {
            this.elements.brightCount.textContent = this.themeDistribution.bright;
        }
    }
    
    /**
     * Actualizar métricas de rendimiento
     * @param {number} ldrValue - Último valor LDR
     */
    updateMetrics(ldrValue) {
        const now = new Date();
        
        // Calcular velocidad de lecturas
        if (this.lastReadingTime) {
            const timeDiff = now - this.lastReadingTime;
            const currentRate = 60000 / timeDiff; // lecturas por minuto
            
            // Media móvil simple
            this.readingRate = this.readingRate === 0 ? 
                currentRate : (this.readingRate * 0.8) + (currentRate * 0.2);
            
            if (this.elements.readingRate) {
                this.elements.readingRate.textContent = `${Math.round(this.readingRate)}/min`;
            }
            
            if (this.elements.readingSpeed) {
                this.elements.readingSpeed.textContent = `${Math.round(this.readingRate)} datos/min`;
            }
        }
    }
    
    /**
     * Actualizar valor actual mostrado
     * @param {number} ldrValue - Valor LDR actual
     */
    updateCurrentValue(ldrValue) {
        if (this.elements.currentValue) {
            this.elements.currentValue.innerHTML = `
                <i class="bi bi-speedometer2"></i>
                Valor: ${ldrValue}
            `;
        }
    }
    
    /**
     * Actualizar timestamp de última lectura
     * @param {string} timestamp - Timestamp
     */
    updateLastReading(timestamp) {
        if (this.elements.lastReading) {
            this.elements.lastReading.textContent = formatTimestamp(timestamp);
        }
    }

    /**
     * Actualizar estadísticas mostradas
     * @param {Object} stats - Objeto con estadísticas
     */
    updateStats(stats) {
        const updates = {
            minValue: stats.min_value ?? '--',
            maxValue: stats.max_value ?? '--',
            avgValue: stats.avg_value ?? '--',
            totalReadings: stats.total_readings ?? '--'
        };
        
        Object.entries(updates).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].textContent = value;
            }
        });
        
        log('DEBUG', 'MONITOR', 'Estadísticas actualizadas');
    }
    
    /**
     * Manejar conexión WebSocket exitosa
     * @param {Object} info - Información de conexión
     */
    handleWebSocketConnected(info) {
        log('INFO', 'MONITOR', '🔌 WebSocket conectado al monitor');
        
        this.isConnected = true;
        this.connectionTime = info.connectionTime;
        
        // Actualizar UI
        this.updateConnectionStatus(true);
        this.updateServiceStatus('websocket', 'connected');
        
        // Solicitar historial si está vacío
        if (this.sharedHistory.length === 0) {
            this.requestSharedHistory();
        }
        
        this.showNotification('Conexión en tiempo real establecida', 'success');
    }
    
    /**
     * Manejar desconexión WebSocket
     * @param {Object} info - Información de desconexión
     */
    handleWebSocketDisconnected(info) {
        log('WARN', 'MONITOR', '🔌 WebSocket desconectado del monitor');
        
        this.isConnected = false;
        
        // Actualizar UI
        this.updateConnectionStatus(false, 'Reconectando...');
        this.updateServiceStatus('websocket', 'disconnected');
        this.updateServiceStatus('arduino', 'disconnected');
        
        if (!info.wasClean) {
            this.showNotification('Conexión perdida, reintentando...', 'warning');
        }
    }
    
    /**
     * Manejar errores WebSocket
     * @param {Object} error - Error
     */
    handleWebSocketError(error) {
        log('ERROR', 'MONITOR', 'Error WebSocket en monitor:', error);
        
        this.updateServiceStatus('websocket', 'disconnected');
        
        if (error.type === 'max_reconnects_reached') {
            this.showNotification('No se pudo establecer conexión en tiempo real', 'error');
        }
    }
    
    /**
     * Solicitar historial compartido al servidor
     */
    requestSharedHistory() {
        if (this.websocketService.isWebSocketConnected()) {
            const request = {
                type: 'request_shared_history',
                maxPoints: this.maxHistoryPoints
            };
            
            this.websocketService.send(request);
            log('DEBUG', 'MONITOR', 'Historial compartido solicitado');
        }
    }
    
    /**
     * Actualizar estado de conexión general
     * @param {boolean} connected - Estado de conexión
     * @param {string} message - Mensaje adicional
     */
    updateConnectionStatus(connected, message = '') {
        const status = connected ? 'Conectado' : (message || 'Desconectado');
        const icon = connected ? 'bi-wifi' : 'bi-wifi-off';
        const className = connected ? 'connected' : 'disconnected';
        
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = status;
            this.elements.connectionStatus.className = `session-card__value ${className}`;
        }
        
        if (this.elements.connectionIcon) {
            this.elements.connectionIcon.className = `bi ${icon}`;
        }
        
        if (this.elements.protocolInfo) {
            // const protocol = 'IPv4/IPv6 (auto)'; // Se detecta automáticamente
            this.elements.protocolInfo.textContent = connected ? 'IPv4/IPv6 (auto)' : message;
        }
        
        if (this.elements.systemProtocol) {
            this.elements.systemProtocol.textContent = connected ? 'IPv4/IPv6 (auto)' : 'Desconectado';
        }
    }
    
    /**
     * Actualizar estado de servicios individuales
     * @param {string} service - Nombre del servicio
     * @param {string} status - Estado (connected, disconnected, connecting)
     */
    updateServiceStatus(service, status) {
        const elementMap = {
            'websocket': 'wsStatus',
            'api': 'apiStatus',
            'arduino': 'arduinoStatus'
        };
        
        const elementId = elementMap[service];
        if (!elementId || !this.elements[elementId]) return;
        
        const statusConfig = {
            'connected': { text: 'Conectado', icon: 'bi-check-circle-fill', class: 'service-status--connected' },
            'disconnected': { text: 'Desconectado', icon: 'bi-x-circle-fill', class: 'service-status--disconnected' },
            'connecting': { text: 'Conectando', icon: 'bi-arrow-clockwise', class: 'service-status--unknown' }
        };
        
        const config = statusConfig[status] || statusConfig['disconnected'];
        
        this.elements[elementId].innerHTML = `
            <i class="bi ${config.icon}"></i>
            ${config.text}
        `;
        this.elements[elementId].className = `service-status ${config.class}`;
    }
    
    /**
     * Iniciar servicios periódicos
     */
    startPeriodicServices() {
        // Actualizar tiempo de sesión cada segundo
        const sessionTimer = setInterval(() => {
            this.updateSessionTime();
        }, 1000);
        
        // Verificar estado de servicios cada 30 segundos
        const healthCheck = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000);
        
        // Actualizar métricas cada 5 segundos
        const metricsUpdate = setInterval(() => {
            this.updateSystemMetrics();
        }, 5000);
        
        this.intervalIds.push(sessionTimer, healthCheck, metricsUpdate);
        
        log('DEBUG', 'MONITOR', 'Servicios periódicos iniciados');
    }
    
    /**
     * Actualizar tiempo de sesión
     */
    updateSessionTime() {
        if (!this.sessionStartTime) {
            this.sessionStartTime = new Date();
            
            if (this.elements.startTime) {
                this.elements.startTime.textContent = `Desde ${formatTimestamp(this.sessionStartTime.toISOString())}`;
            }
        }
        
        const elapsed = new Date() - this.sessionStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        if (this.elements.sessionTime) {
            this.elements.sessionTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    /**
     * Realizar verificación de salud de servicios
     */
    async performHealthCheck() {
        try {
            // Verificar API
            const apiHealthy = await this.apiService.testConnection();
            this.updateServiceStatus('api', apiHealthy ? 'connected' : 'disconnected');
            
            // Verificar WebSocket
            const wsHealthy = this.websocketService.isWebSocketConnected();
            if (!wsHealthy && this.isConnected) {
                this.updateServiceStatus('websocket', 'disconnected');
                this.isConnected = false;
            }
            
            // Verificar Arduino (basado en última lectura)
            if (this.lastReadingTime) {
                const timeSinceLastReading = new Date() - this.lastReadingTime;
                const arduinoHealthy = timeSinceLastReading < 60000; // 1 minuto
                this.updateServiceStatus('arduino', arduinoHealthy ? 'connected' : 'disconnected');
            }
            
        } catch (error) {
            log('ERROR', 'MONITOR', 'Error en health check:', error);
        }
    }
    
    /**
     * Actualizar métricas del sistema
     */
    updateSystemMetrics() {
        // Actualizar latencia WebSocket si está disponible
        if (this.websocketService && this.elements.systemLatency) {
            const metrics = this.websocketService.getMetrics();
            const latency = metrics.avgLatency || 0;
            this.elements.systemLatency.textContent = `${Math.round(latency)} ms`;
        }
        
        // Simular número de dispositivos conectados (en implementación real vendría del servidor)
        if (this.elements.connectedDevices) {
            const deviceCount = this.isConnected ? 1 + Math.floor(Math.random() * 3) : 1;
            this.elements.connectedDevices.textContent = deviceCount;
        }
    }
    
    /**
     * Pausar/reanudar actualizaciones
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (this.elements.pauseBtn) {
            const icon = this.isPaused ? 'bi-play-fill' : 'bi-pause-fill';
            const text = this.isPaused ? 'Reanudar' : 'Pausar';
            
            this.elements.pauseBtn.innerHTML = `<i class="bi ${icon}"></i> ${text}`;
        }
        
        const message = this.isPaused ? 'Actualizaciones pausadas' : 'Actualizaciones reanudadas';
        this.showNotification(message, 'info');
        
        log('INFO', 'MONITOR', `Actualizaciones ${this.isPaused ? 'pausadas' : 'reanudadas'}`);
    }
    
    /**
     * Limpiar datos del monitor
     */
    clearData() {
        if (confirm('¿Estás seguro de que quieres limpiar todos los datos del monitor?')) {
            // Limpiar historial
            this.sharedHistory = [];
            this.totalReadings = 0;
            this.themeDistribution = { dark: 0, medium: 0, bright: 0 };
            
            // Limpiar gráfico
            if (this.chart) {
                this.chart.data.labels = [];
                this.chart.data.datasets[0].data = [];
                this.chart.update();
            }
            
            // Limpiar tabla
            if (this.elements.dataTableBody) {
                this.elements.dataTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted py-4">
                            <i class="bi bi-inbox"></i>
                            Datos limpiados - esperando nuevas lecturas...
                        </td>
                    </tr>
                `;
            }
            
            // Resetear estadísticas
            this.currentStats = { current: null, min: null, max: null, avg: 0, total: 0 };
            ['statCurrent', 'statMin', 'statMax', 'statAvg', 'totalReadings'].forEach(key => {
                if (this.elements[key]) {
                    this.elements[key].textContent = '---';
                }
            });
            
            // Resetear distribución
            this.updateThemeDistribution();
            
            this.showNotification('Datos limpiados correctamente', 'success');
            log('INFO', 'MONITOR', 'Datos del monitor limpiados');
        }
    }
    
    /**
     * Forzar reconexión
     */
    async forceReconnect() {
        log('INFO', 'MONITOR', 'Forzando reconexión...');
        
        // NO mostrar loading que se queda pegado
        this.showNotification('Reconectando servicios...', 'info');
        
        try {
            // Limpiar estados
            this.isConnected = false;
            this.updateConnectionStatus(false, 'Reconectando...');
            
            // Reconectar WebSocket sin loading
            if (this.websocketService) {
                await this.websocketService.forceReconnect();
            }
            
            // Pequeña pausa
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Recargar datos sin loading
            try {
                await this.loadInitialData();
            } catch (error) {
                log('WARN', 'MONITOR', 'Error recargando datos, continuando...');
            }
            
            this.showNotification('Reconexión completada', 'success');
            
        } catch (error) {
            log('ERROR', 'MONITOR', 'Error en reconexión:', error);
            this.showNotification('Error en reconexión - Recargando página...', 'warning');
            
            // Si falla todo, recargar página después de 2 segundos
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        }
    }
    
    /**
     * Exportar datos a CSV
     */
    exportData() {
        if (this.sharedHistory.length === 0) {
            this.showNotification('No hay datos para exportar', 'warning');
            return;
        }
        
        try {
            // Crear CSV
            const headers = ['Numero', 'Valor_LDR', 'Ambiente', 'Timestamp', 'Delta'];
            const rows = this.sharedHistory.map(point => [
                point.number,
                point.value,
                point.theme,
                point.timestamp,
                point.delta
            ]);
            
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');
            
            // Descargar archivo
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `monitor_ldr_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Datos exportados correctamente', 'success');
            log('INFO', 'MONITOR', 'Datos exportados a CSV');
            
        } catch (error) {
            log('ERROR', 'MONITOR', 'Error exportando datos:', error);
            this.showNotification('Error exportando datos', 'error');
        }
    }
    
    /**
     * Pausar actualizaciones (página no visible)
     */
    pauseUpdates() {
        log('DEBUG', 'MONITOR', 'Pausando actualizaciones (página no visible)');
        // Las actualizaciones siguen llegando pero se procesan menos frecuentemente
    }
    
    /**
     * Reanudar actualizaciones (página visible)
     */
    resumeUpdates() {
        log('DEBUG', 'MONITOR', 'Reanudando actualizaciones (página visible)');
        
        // Reconectar si es necesario
        if (!this.isConnected) {
            this.websocketService.forceReconnect();
        }
    }
    
    /**
     * Mostrar overlay de carga
     * @param {boolean} show - Si mostrar el overlay
     * @param {string} message - Mensaje de carga
     */
    showLoading(show, message = 'Cargando...') {
        if (!this.elements.loadingOverlay) return;
        
        if (show) {
            const loadingText = this.elements.loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            this.elements.loadingOverlay.classList.remove('hidden');
        } else {
            this.elements.loadingOverlay.classList.add('hidden');
        }
    }
    
    /**
     * Mostrar notificación toast
     * @param {string} message - Mensaje
     * @param {string} type - Tipo (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        if (!this.elements.notificationToast || !this.elements.toastMessage) return;
        
        // Configurar mensaje
        this.elements.toastMessage.textContent = message;
        
        // Configurar icono según tipo
        const iconMap = {
            'success': 'bi-check-circle-fill text-success',
            'error': 'bi-x-circle-fill text-danger',
            'warning': 'bi-exclamation-triangle-fill text-warning',
            'info': 'bi-info-circle-fill text-primary'
        };
        
        const iconElement = this.elements.notificationToast.querySelector('.toast-header i');
        if (iconElement) {
            iconElement.className = `bi ${iconMap[type] || iconMap['info']} me-2`;
        }
        
        // Mostrar toast
        const toast = new bootstrap.Toast(this.elements.notificationToast);
        toast.show();
        
        log('DEBUG', 'MONITOR', `Notificación mostrada: ${type} - ${message}`);
    }
    
    /**
     * Manejar errores de inicialización
     * @param {Error} error - Error de inicialización
     */
    handleInitError(error) {
        log('ERROR', 'MONITOR', 'Error crítico de inicialización:', error);
        
        this.showLoading(false);
        this.showNotification('Error iniciando monitor', 'error');
        
        // Intentar recuperación después de un tiempo
        setTimeout(() => {
            log('INFO', 'MONITOR', 'Intentando recuperación...');
            this.init();
        }, 10000);
    }
    
    /**
     * Obtener estado completo del monitor
     * @returns {Object} Estado completo
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isConnected: this.isConnected,
            isPaused: this.isPaused,
            sessionStartTime: this.sessionStartTime,
            connectionTime: this.connectionTime,
            
            // Datos
            sharedHistory: this.sharedHistory.length,
            totalReadings: this.totalReadings,
            currentStats: this.currentStats,
            themeDistribution: this.themeDistribution,
            
            // Métricas
            readingRate: this.readingRate,
            lastReadingTime: this.lastReadingTime,
            
            // Servicios
            websocket: this.websocketService.getConnectionInfo(),
            api: this.apiService.getMetrics(),
            
            // Sistema
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Limpiar recursos
     */
    cleanup() {
        log('INFO', 'MONITOR', 'Limpiando recursos del monitor');
        
        // Detener intervalos
        this.intervalIds.forEach(id => clearInterval(id));
        this.intervalIds = [];
        
        // Desconectar servicios
        this.websocketService.disconnect();
        
        // Destruir gráfico
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
    
    /**
     * Destruir aplicación
     */
    destroy() {
        log('INFO', 'MONITOR', 'Destruyendo aplicación del monitor');
        
        // Limpiar recursos
        this.cleanup();
        
        // Destruir servicios
        this.websocketService.destroy();
        this.apiService.destroy();
        
        // Limpiar referencias
        this.elements = {};
        this.sharedHistory = [];
        this.websocketService = null;
        this.apiService = null;
    }
}

// =======================================
// INICIALIZACIÓN GLOBAL
// =======================================

let monitorApp = null;

/**
 * Inicializar aplicación cuando el DOM esté listo
 */
async function initMonitorApp() {
    log('INFO', 'GLOBAL', '📊 Iniciando aplicación del monitor');
    
    try {
        monitorApp = new MonitorApp();
        await monitorApp.init();
        
        // Hacer disponible globalmente para debugging
        window.monitorApp = monitorApp;
        
        log('INFO', 'GLOBAL', '✅ Monitor iniciado correctamente');
        
    } catch (error) {
        log('ERROR', 'GLOBAL', '❌ Error crítico iniciando monitor:', error);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMonitorApp);
} else {
    // DOM ya está listo
    initMonitorApp();
}

// Exportar para uso en módulos
export default MonitorApp;

// Log de carga del script
log('INFO', 'GLOBAL', '📜 Script principal del monitor cargado');

// Funciones globales para botones
window.forceReconnectMonitor = () => window.monitorApp?.forceReconnect();