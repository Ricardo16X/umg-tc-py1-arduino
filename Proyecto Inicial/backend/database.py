# database.py - Manejo de base de datos SQLite
import sqlite3
import threading
from datetime import datetime
import logging
from config import DATABASE_FILE, MAX_HISTORY_RECORDS

logger = logging.getLogger(__name__)

class SensorDatabase:
    """Manejo de base de datos para lecturas de sensores"""
    
    def __init__(self):
        self.db_file = DATABASE_FILE
        self.lock = threading.Lock()
        self.init_database()
    
    def init_database(self):
        """Inicializar base de datos y crear tablas"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS ldr_readings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        value INTEGER NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        raw_data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Crear índice para mejorar consultas por timestamp
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_timestamp 
                    ON ldr_readings(timestamp)
                ''')
                
                conn.commit()
                logger.info("Base de datos inicializada correctamente")
        except Exception as e:
            logger.error(f"Error inicializando base de datos: {e}")
            raise

    def extract_ldr_value(self, raw_value):
        """Extraer valor numérico del formato LDR=123"""
        try:
            if isinstance(raw_value, str) and 'LDR=' in raw_value:
                return int(raw_value.split('=')[1])
            return int(raw_value)
        except (ValueError, IndexError):
            logger.warning(f"No se pudo extraer valor de: {raw_value}")
            return 0

    def save_reading(self, ldr_value):
        """Guardar lectura en base de datos"""
        try:
            with self.lock:
                value = self.extract_ldr_value(ldr_value)
                
                with sqlite3.connect(self.db_file) as conn:
                    conn.execute(
                        'INSERT INTO ldr_readings (value, raw_data) VALUES (?, ?)',
                        (value, str(ldr_value))
                    )
                    conn.commit()
                
                logger.debug(f"Lectura guardada: {value}")
                
                # Limpiar registros antiguos si superamos el límite
                self._cleanup_old_records()
                
                return True
        except Exception as e:
            logger.error(f"Error guardando lectura: {e}")
            return False

    def get_history(self, limit=50):
        """Obtener historial de lecturas"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.execute('''
                    SELECT value, timestamp, raw_data 
                    FROM ldr_readings 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                
                return [{
                    'value': row[0],
                    'timestamp': row[1],
                    'raw_data': row[2]
                } for row in rows]
        except Exception as e:
            logger.error(f"Error obteniendo historial: {e}")
            return []

    def get_latest_reading(self):
        """Obtener última lectura"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.execute('''
                    SELECT value, timestamp, raw_data 
                    FROM ldr_readings 
                    ORDER BY timestamp DESC 
                    LIMIT 1
                ''')
                
                row = cursor.fetchone()
                
                if row:
                    return {
                        'value': row[0],
                        'timestamp': row[1],
                        'raw_data': row[2]
                    }
                return None
        except Exception as e:
            logger.error(f"Error obteniendo última lectura: {e}")
            return None

    def get_stats(self):
        """Obtener estadísticas básicas"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.execute('''
                    SELECT 
                        COUNT(*) as total,
                        MIN(value) as min_value,
                        MAX(value) as max_value,
                        AVG(value) as avg_value,
                        MIN(timestamp) as first_reading,
                        MAX(timestamp) as last_reading
                    FROM ldr_readings
                ''')
                
                row = cursor.fetchone()
                
                if row and row[0] > 0:
                    return {
                        'total_readings': row[0],
                        'min_value': row[1],
                        'max_value': row[2],
                        'avg_value': round(row[3], 2) if row[3] else 0,
                        'first_reading': row[4],
                        'last_reading': row[5]
                    }
                else:
                    return {
                        'total_readings': 0,
                        'min_value': None,
                        'max_value': None,
                        'avg_value': None,
                        'first_reading': None,
                        'last_reading': None
                    }
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {}

    def _cleanup_old_records(self):
        """Limpiar registros antiguos para mantener el límite"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                # Contar registros totales
                cursor = conn.execute('SELECT COUNT(*) FROM ldr_readings')
                total = cursor.fetchone()[0]
                
                if total > MAX_HISTORY_RECORDS:
                    # Eliminar los más antiguos
                    records_to_delete = total - MAX_HISTORY_RECORDS
                    conn.execute('''
                        DELETE FROM ldr_readings 
                        WHERE id IN (
                            SELECT id FROM ldr_readings 
                            ORDER BY timestamp ASC 
                            LIMIT ?
                        )
                    ''', (records_to_delete,))
                    
                    conn.commit()
                    logger.info(f"Eliminados {records_to_delete} registros antiguos")
                    
        except Exception as e:
            logger.error(f"Error limpiando registros antiguos: {e}")

    def close(self):
        """Cerrar conexión a base de datos"""
        # SQLite se cierra automáticamente con context managers
        logger.info("Base de datos cerrada")

# Instancia global de la base de datos
db = SensorDatabase()