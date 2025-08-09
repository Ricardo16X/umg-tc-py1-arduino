/**
 * REPORTES LDR - APLICACIÓN PRINCIPAL
 * Sistema de generación de reportes y exportación de datos
 */

import { APP_CONFIG, THEMES_CONFIG, log, formatTimestamp, determineTheme, extractLDRValue } from '../../shared/js/config.js';
import APIService from '../../shared/js/api-service.js';

class ReportsApp {
    constructor() {
        // Servicios principales
        this.apiService = new APIService();
        
        // Estado de la aplicación
        this.isInitialized = false;
        this.systemData = null;
        this.historyData = [];
        this.statsData = {};
        
        // Gráfico y elementos DOM
        this.chart = null;
        this.elements = {};
        this.intervalIds = [];
        
        // Historial de exportaciones
        this.exportHistory = [];
        
        log('INFO', 'REPORTS', '📊 Aplicación de reportes inicializada');
    }
    
    /**
     * Inicializar aplicación completa
     */
    async init() {
        try {
            log('INFO', 'REPORTS', '🚀 Iniciando sistema de reportes...');
            
            this.showLoading(true, 'Inicializando reportes...');
            
            // Inicializar elementos DOM
            this.initElements();
            
            // Configurar eventos
            this.setupEvents();
            
            // Cargar datos iniciales
            await this.loadInitialData();
            
            // Inicializar gráfico
            this.initChart();
            
            // Iniciar servicios periódicos
            this.startPeriodicServices();
            
            this.isInitialized = true;
            this.showLoading(false);
            
            this.showNotification('Reportes cargados correctamente', 'success');
            
            log('INFO', 'REPORTS', '✅ Reportes iniciados exitosamente');
            
        } catch (error) {
            log('ERROR', 'REPORTS', '❌ Error iniciando reportes:', error);
            this.handleInitError(error);
        }
    }
    
    /**
     * Inicializar referencias a elementos DOM
     */
    initElements() {
        this.elements = {
            // Botones principales
            refreshDataBtn: document.getElementById('refreshDataBtn'),
            generateAllBtn: document.getElementById('generateAllBtn'),
            printSummaryBtn: document.getElementById('printSummaryBtn'),
            
            // Estado del sistema
            systemStatus: document.getElementById('systemStatus'),
            systemUptime: document.getElementById('systemUptime'),
            totalRecords: document.getElementById('totalRecords'),
            dataRange: document.getElementById('dataRange'),
            lastUpdate: document.getElementById('lastUpdate'),
            globalAverage: document.getElementById('globalAverage'),
            
            // Métricas del resumen
            summaryTotal: document.getElementById('summaryTotal'),
            summaryMin: document.getElementById('summaryMin'),
            summaryMax: document.getElementById('summaryMax'),
            summaryAvg: document.getElementById('summaryAvg'),
            
            // Distribución por ambientes
            darkPercentage: document.getElementById('darkPercentage'),
            darkProgressBar: document.getElementById('darkProgressBar'),
            darkCount: document.getElementById('darkCount'),
            mediumPercentage: document.getElementById('mediumPercentage'),
            mediumProgressBar: document.getElementById('mediumProgressBar'),
            mediumCount: document.getElementById('mediumCount'),
            brightPercentage: document.getElementById('brightPercentage'),
            brightProgressBar: document.getElementById('brightProgressBar'),
            brightCount: document.getElementById('brightCount'),
            
            // Gráfico
            summaryChart: document.getElementById('summaryChart'),
            
            // Botones de exportación
            exportPdfBtn: document.getElementById('exportPdfBtn'),
            exportExcelBtn: document.getElementById('exportExcelBtn'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),
            exportJsonBtn: document.getElementById('exportJsonBtn'),
            
            // Configuración
            recordsLimit: document.getElementById('recordsLimit'),
            includeChart: document.getElementById('includeChart'),
            includeStats: document.getElementById('includeStats'),
            includeRawData: document.getElementById('includeRawData'),
            
            // Vista previa y historial
            exportHistory: document.getElementById('exportHistory'),
            dataPreviewBody: document.getElementById('dataPreviewBody'),
            previewInfo: document.getElementById('previewInfo'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            
            // Overlays
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            notificationToast: document.getElementById('notificationToast'),
            toastMessage: document.getElementById('toastMessage')
        };
        
        log('DEBUG', 'REPORTS', 'Elementos DOM inicializados');
    }
    
    /**
     * Configurar eventos de la aplicación
     */
    setupEvents() {
        // Botones principales
        if (this.elements.refreshDataBtn) {
            this.elements.refreshDataBtn.addEventListener('click', () => this.refreshData());
        }
        
        if (this.elements.generateAllBtn) {
            this.elements.generateAllBtn.addEventListener('click', () => this.generateAllReports());
        }
        
        if (this.elements.printSummaryBtn) {
            this.elements.printSummaryBtn.addEventListener('click', () => this.printSummary());
        }
        
        // Botones de exportación
        if (this.elements.exportPdfBtn) {
            this.elements.exportPdfBtn.addEventListener('click', () => this.exportPdf());
        }
        
        if (this.elements.exportExcelBtn) {
            this.elements.exportExcelBtn.addEventListener('click', () => this.exportExcel());
        }
        
        if (this.elements.exportCsvBtn) {
            this.elements.exportCsvBtn.addEventListener('click', () => this.exportCsv());
        }
        
        if (this.elements.exportJsonBtn) {
            this.elements.exportJsonBtn.addEventListener('click', () => this.exportJson());
        }
        
        if (this.elements.loadMoreBtn) {
            this.elements.loadMoreBtn.addEventListener('click', () => this.loadMoreData());
        }
        
        log('DEBUG', 'REPORTS', 'Eventos configurados');
    }
    
    /**
     * Cargar datos iniciales
     */
    async loadInitialData() {
        try {
            log('INFO', 'REPORTS', 'Cargando datos iniciales...');
            
            this.showLoading(true, 'Cargando datos del sistema...');
            
            // Verificar API
            const apiAvailable = await this.apiService.testConnection();
            
            if (apiAvailable) {
                // Cargar datos completos
                const completeData = await this.apiService.getCompleteData(100);
                
                // Procesar datos
                this.systemData = completeData;
                this.historyData = completeData.recentHistory || [];
                this.statsData = completeData.stats || {};
                
                // Actualizar UI
                this.updateSystemStatus();
                this.updateSummaryMetrics();
                this.updateEnvironmentDistribution();
                this.updateDataPreview();
                
                log('INFO', 'REPORTS', `Datos cargados: ${this.historyData.length} registros`);
                
            } else {
                throw new Error('API no disponible');
            }
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error cargando datos iniciales:', error);
            this.updateSystemStatus(false);
            this.showNotification('Error cargando datos del sistema', 'warning');
        }
    }
    
    /**
     * Actualizar estado del sistema
     * @param {boolean} connected - Estado de conexión
     */
    updateSystemStatus(connected = true) {
        if (this.elements.systemStatus) {
            this.elements.systemStatus.textContent = connected ? 'Operativo' : 'Sin conexión';
        }
        
        if (this.elements.totalRecords) {
            this.elements.totalRecords.textContent = this.statsData.totalReadings || 0;
        }
        
        if (this.elements.globalAverage) {
            this.elements.globalAverage.textContent = this.statsData.avgValue || '--';
        }
        
        if (this.elements.lastUpdate) {
            this.elements.lastUpdate.textContent = formatTimestamp(new Date().toISOString());
        }
        
        if (this.elements.dataRange && this.statsData.firstReading) {
            const start = new Date(this.statsData.firstReading).toLocaleDateString();
            const end = new Date().toLocaleDateString();
            this.elements.dataRange.textContent = `${start} - ${end}`;
        }
    }
    
    /**
     * Actualizar métricas del resumen
     */
    updateSummaryMetrics() {
        if (this.elements.summaryTotal) {
            this.elements.summaryTotal.textContent = this.statsData.totalReadings || 0;
        }
        
        if (this.elements.summaryMin) {
            this.elements.summaryMin.textContent = this.statsData.minValue || '--';
        }
        
        if (this.elements.summaryMax) {
            this.elements.summaryMax.textContent = this.statsData.maxValue || '--';
        }
        
        if (this.elements.summaryAvg) {
            this.elements.summaryAvg.textContent = this.statsData.avgValue || '--';
        }
    }
    
    /**
     * Actualizar distribución por ambientes
     */
    updateEnvironmentDistribution() {
        if (this.historyData.length === 0) return;
        
        // Calcular distribución
        const distribution = { dark: 0, medium: 0, bright: 0 };
        
        this.historyData.forEach(reading => {
            const value = extractLDRValue(reading.value || reading.raw_data);
            const theme = determineTheme(value).toLowerCase();
            distribution[theme]++;
        });
        
        const total = this.historyData.length;
        
        // Actualizar porcentajes y barras
        Object.entries(distribution).forEach(([theme, count]) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            
            const percentageElement = this.elements[`${theme}Percentage`];
            const progressBar = this.elements[`${theme}ProgressBar`];
            const countElement = this.elements[`${theme}Count`];
            
            if (percentageElement) {
                percentageElement.textContent = `${percentage}%`;
            }
            
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }
            
            if (countElement) {
                countElement.textContent = `${count} lecturas`;
            }
        });
    }
    
    /**
     * Inicializar gráfico de resumen
     */
    initChart() {
        if (!this.elements.summaryChart) {
            log('WARN', 'REPORTS', 'Canvas del gráfico no encontrado');
            return;
        }
        
        const ctx = this.elements.summaryChart.getContext('2d');
        
        // Preparar datos para el gráfico (últimos 30 puntos)
        const chartData = this.historyData.slice(-30);
        const labels = chartData.map((_, index) => index + 1);
        const values = chartData.map(reading => extractLDRValue(reading.value || reading.raw_data));
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Valores LDR',
                    data: values,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tendencia de Datos (Últimas 30 Lecturas)'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Secuencia de Lecturas'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Valor LDR'
                        },
                        min: 0,
                        max: 1023
                    }
                }
            }
        });
        
        log('DEBUG', 'REPORTS', 'Gráfico de resumen inicializado');
    }
    
    /**
     * Actualizar vista previa de datos
     */
    updateDataPreview() {
        if (!this.elements.dataPreviewBody) return;
        
        const previewData = this.historyData.slice(-20).reverse();
        
        if (previewData.length === 0) {
            this.elements.dataPreviewBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-inbox"></i>
                        No hay datos disponibles
                    </td>
                </tr>
            `;
            return;
        }
        
        const rows = previewData.map((reading, index) => {
            const value = extractLDRValue(reading.value || reading.raw_data);
            const theme = determineTheme(value);
            const themeConfig = THEMES_CONFIG[theme];
            const timestamp = formatTimestamp(reading.timestamp);
            
            return `
                <tr>
                    <td class="record-number">${previewData.length - index}</td>
                    <td class="ldr-value">${value}</td>
                    <td>
                        <span class="environment-badge environment-badge--${theme.toLowerCase()}">
                            ${themeConfig.name}
                        </span>
                    </td>
                    <td class="timestamp">${timestamp}</td>
                    <td class="raw-data">${reading.raw_data || reading.value}</td>
                    <td class="action-buttons">
                        <button class="btn btn-outline-primary btn-sm" onclick="window.reportsApp.viewRecord(${index})">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        this.elements.dataPreviewBody.innerHTML = rows;
        
        if (this.elements.previewInfo) {
            this.elements.previewInfo.textContent = `Mostrando últimos ${previewData.length} registros`;
        }
    }
    
    /**
     * Refrescar datos
     */
    async refreshData() {
        try {
            log('INFO', 'REPORTS', 'Refrescando datos...');
            
            this.showNotification('Actualizando datos...', 'info');
            
            await this.loadInitialData();
            
            // Actualizar gráfico si existe
            if (this.chart) {
                this.chart.destroy();
                this.initChart();
            }
            
            this.showNotification('Datos actualizados correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error refrescando datos:', error);
            this.showNotification('Error actualizando datos', 'error');
        }
    }
    
    /**
     * Exportar a PDF
     */
    async exportPdf() {
        try {
            this.showLoading(true, 'Generando reporte PDF...');
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Título del reporte
            doc.setFontSize(20);
            doc.text('Reporte LDR - Sistema de Monitoreo', 20, 30);
            
            // Información del sistema
            doc.setFontSize(12);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 50);
            doc.text(`Total de lecturas: ${this.statsData.totalReadings || 0}`, 20, 60);
            doc.text(`Promedio general: ${this.statsData.avgValue || '--'}`, 20, 70);
            doc.text(`Valor mínimo: ${this.statsData.minValue || '--'}`, 20, 80);
            doc.text(`Valor máximo: ${this.statsData.maxValue || '--'}`, 20, 90);
            
            // Agregar gráfico si está habilitado
            if (this.elements.includeChart?.checked && this.chart) {
                const chartImage = this.chart.toBase64Image();
                doc.addImage(chartImage, 'PNG', 20, 110, 160, 80);
            }
            
            // Guardar archivo
            const filename = `reporte_ldr_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            
            this.addToExportHistory('PDF', filename, 'Reporte completo');
            this.showNotification('Reporte PDF generado correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error generando PDF:', error);
            this.showNotification('Error generando reporte PDF', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Exportar a Excel
     */
    async exportExcel() {
        try {
            this.showLoading(true, 'Generando archivo Excel...');
            
            const wb = XLSX.utils.book_new();
            
            // Hoja de datos principales
            const mainData = this.historyData.map(reading => ({
                'Número': reading.id || '',
                'Valor LDR': extractLDRValue(reading.value || reading.raw_data),
                'Ambiente': determineTheme(extractLDRValue(reading.value || reading.raw_data)),
                'Timestamp': reading.timestamp,
                'Datos Brutos': reading.raw_data || reading.value
            }));
            
            const ws1 = XLSX.utils.json_to_sheet(mainData);
            XLSX.utils.book_append_sheet(wb, ws1, 'Datos Principales');
            
            // Hoja de estadísticas
            const statsData = [
                ['Métrica', 'Valor'],
                ['Total de Lecturas', this.statsData.totalReadings || 0],
                ['Valor Mínimo', this.statsData.minValue || 0],
                ['Valor Máximo', this.statsData.maxValue || 0],
                ['Promedio', this.statsData.avgValue || 0],
                ['Primera Lectura', this.statsData.firstReading || ''],
                ['Última Lectura', this.statsData.lastReading || '']
            ];
            
            const ws2 = XLSX.utils.aoa_to_sheet(statsData);
            XLSX.utils.book_append_sheet(wb, ws2, 'Estadísticas');
            
            // Guardar archivo
            const filename = `datos_ldr_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, filename);
            
            this.addToExportHistory('Excel', filename, 'Datos completos');
            this.showNotification('Archivo Excel generado correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error generando Excel:', error);
            this.showNotification('Error generando archivo Excel', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Exportar a CSV
     */
    async exportCsv() {
        try {
            this.showLoading(true, 'Generando archivo CSV...');
            
            const headers = ['Numero', 'Valor_LDR', 'Ambiente', 'Timestamp', 'Datos_Brutos'];
            const rows = this.historyData.map(reading => [
                reading.id || '',
                extractLDRValue(reading.value || reading.raw_data),
                determineTheme(extractLDRValue(reading.value || reading.raw_data)),
                reading.timestamp,
                reading.raw_data || reading.value
            ]);
            
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');
            
            // Descargar archivo
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const filename = `datos_ldr_${new Date().toISOString().slice(0, 10)}.csv`;
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.addToExportHistory('CSV', filename, 'Datos para análisis');
            this.showNotification('Archivo CSV generado correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error generando CSV:', error);
            this.showNotification('Error generando archivo CSV', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Exportar a JSON
     */
    async exportJson() {
        try {
            this.showLoading(true, 'Generando archivo JSON...');
            
            const jsonData = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    totalRecords: this.historyData.length,
                    stats: this.statsData
                },
                data: this.historyData.map(reading => ({
                    value: extractLDRValue(reading.value || reading.raw_data),
                    environment: determineTheme(extractLDRValue(reading.value || reading.raw_data)),
                    timestamp: reading.timestamp,
                    rawData: reading.raw_data || reading.value
                }))
            };
            
            const jsonContent = JSON.stringify(jsonData, null, 2);
            
            // Descargar archivo
            const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const filename = `datos_ldr_${new Date().toISOString().slice(0, 10)}.json`;
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.addToExportHistory('JSON', filename, 'Para integración API');
            this.showNotification('Archivo JSON generado correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error generando JSON:', error);
            this.showNotification('Error generando archivo JSON', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Generar todos los reportes
     */
    async generateAllReports() {
        try {
            this.showNotification('Generando todos los formatos...', 'info');
            
            await this.exportPdf();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await this.exportExcel();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await this.exportCsv();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await this.exportJson();
            
            this.showNotification('Todos los reportes generados correctamente', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error generando todos los reportes:', error);
            this.showNotification('Error generando reportes', 'error');
        }
    }
    
    /**
     * Agregar al historial de exportaciones
     * @param {string} type - Tipo de archivo
     * @param {string} filename - Nombre del archivo
     * @param {string} description - Descripción
     */
    addToExportHistory(type, filename, description) {
        const export_item = {
            type,
            filename,
            description,
            timestamp: new Date().toISOString(),
            size: 'N/A'
        };
        
        this.exportHistory.unshift(export_item);
        
        // Mantener solo los últimos 10
        if (this.exportHistory.length > 10) {
            this.exportHistory = this.exportHistory.slice(0, 10);
        }
        
        this.updateExportHistory();
    }
    
    /**
     * Actualizar historial de exportaciones
     */
    updateExportHistory() {
        if (!this.elements.exportHistory) return;
        
        if (this.exportHistory.length === 0) {
            this.elements.exportHistory.innerHTML = `
                <div class="history-item text-center text-muted py-3">
                    <i class="bi bi-inbox"></i>
                    <div>No hay exportaciones recientes</div>
                </div>
            `;
            return;
        }
        
        const historyHtml = this.exportHistory.map(item => `
            <div class="history-item new-export">
                <div class="history-info">
                    <div class="history-title">${item.filename}</div>
                    <div class="history-details">${item.description} - ${formatTimestamp(item.timestamp)}</div>
                </div>
                <div class="history-size">${item.type}</div>
            </div>
        `).join('');
        
        this.elements.exportHistory.innerHTML = historyHtml;
    }
    
    /**
     * Imprimir resumen
     */
    printSummary() {
        window.print();
    }
    
    /**
     * Cargar más datos
     */
    async loadMoreData() {
        try {
            this.showNotification('Cargando más datos...', 'info');
            
            const moreData = await this.apiService.getHistory(50);
            this.historyData = [...this.historyData, ...moreData];
            
            this.updateDataPreview();
            this.updateEnvironmentDistribution();
            
            this.showNotification('Más datos cargados', 'success');
            
        } catch (error) {
            log('ERROR', 'REPORTS', 'Error cargando más datos:', error);
            this.showNotification('Error cargando datos adicionales', 'error');
        }
    }
    
    /**
     * Iniciar servicios periódicos
     */
    startPeriodicServices() {
        // Actualizar datos cada 30 segundos
        const dataUpdate = setInterval(async () => {
            try {
                const stats = await this.apiService.getStats();
                this.statsData = stats;
                this.updateSystemStatus();
                this.updateSummaryMetrics();
            } catch (error) {
                log('DEBUG', 'REPORTS', 'Error en actualización periódica');
            }
        }, 30000);
        
        this.intervalIds.push(dataUpdate);
        
        log('DEBUG', 'REPORTS', 'Servicios periódicos iniciados');
    }
    
    /**
     * Mostrar overlay de carga
     * @param {boolean} show - Si mostrar el overlay
     * @param {string} message - Mensaje de carga
     */
    showLoading(show, message = 'Procesando...') {
        if (!this.elements.loadingOverlay) return;
        
        if (show) {
            if (this.elements.loadingText) {
                this.elements.loadingText.textContent = message;
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
        
        log('DEBUG', 'REPORTS', `Notificación: ${type} - ${message}`);
    }
    
    /**
     * Manejar errores de inicialización
     * @param {Error} error - Error
     */
    handleInitError(error) {
        log('ERROR', 'REPORTS', 'Error crítico de inicialización:', error);
        
        this.showLoading(false);
        this.showNotification('Error iniciando reportes', 'error');
        this.updateSystemStatus(false);
    }
    
    /**
     * Ver registro específico
     * @param {number} index - Índice del registro
     */
    viewRecord(index) {
        const record = this.historyData[index];
        if (record) {
            const value = extractLDRValue(record.value || record.raw_data);
            const theme = determineTheme(value);
            const themeConfig = THEMES_CONFIG[theme];
            
            alert(`Registro detallado:

Valor LDR: ${value}
Ambiente: ${themeConfig.name}
Fecha: ${record.timestamp}
Datos en bruto: ${record.raw_data || record.value}`);
        }
    }
    
    /**
     * Obtener estado de la aplicación
     * @returns {Object} Estado completo
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            totalRecords: this.historyData.length,
            stats: this.statsData,
            exportHistory: this.exportHistory.length,
            chartActive: !!this.chart,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Limpiar recursos
     */
    cleanup() {
        log('INFO', 'REPORTS', 'Limpiando recursos');
        
        // Detener intervalos
        this.intervalIds.forEach(id => clearInterval(id));
        this.intervalIds = [];
        
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
        log('INFO', 'REPORTS', 'Destruyendo aplicación de reportes');
        
        this.cleanup();
        this.apiService.destroy();
        
        // Limpiar referencias
        this.elements = {};
        this.historyData = [];
        this.apiService = null;
    }
}

// =======================================
// INICIALIZACIÓN GLOBAL
// =======================================

let reportsApp = null;

/**
 * Inicializar aplicación cuando el DOM esté listo
 */
async function initReportsApp() {
    log('INFO', 'GLOBAL', '📊 Iniciando aplicación de reportes');
    
    try {
        reportsApp = new ReportsApp();
        await reportsApp.init();
        
        // Hacer disponible globalmente
        window.reportsApp = reportsApp;
        
        log('INFO', 'GLOBAL', '✅ Reportes iniciados correctamente');
        
    } catch (error) {
        log('ERROR', 'GLOBAL', '❌ Error crítico iniciando reportes:', error);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportsApp);
} else {
    initReportsApp();
}

// Exportar para uso en módulos
export default ReportsApp;

// Log de carga del script
log('INFO', 'GLOBAL', '📜 Script de reportes cargado');