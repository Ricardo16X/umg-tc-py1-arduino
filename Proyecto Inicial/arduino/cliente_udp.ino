#include <EtherSia.h>

/** Interfaz W5100 Ethernet */
EtherSia_W5100 ether(10);

/** Socket UDP para enviar */
UDPSocket udp(ether);

/** Dirección IPv6 de tu PC */
const char* destIPv6 = "2803:d100:e580:1222:a0c8:a5f4:f585:1f90";
const uint16_t destPort = 1234;

/** MAC Address local del Arduino (puedes cambiarla si usas otra) */
MACAddress macAddress("76:73:19:ba:b8:19");

// Variables para control de cambios
int lastSentValue = -1;  // Último valor enviado (-1 indica que no se ha enviado nada)
const int THRESHOLD = 5; // Umbral de cambio mínimo
unsigned long lastSendTime = 0;
const unsigned long MIN_SEND_INTERVAL = 100; // Mínimo intervalo entre envíos (ms)

void setup() {
  Serial.begin(115200);
  Serial.println("Iniciando...");

  if (!ether.begin(macAddress)) {
    Serial.println("Error al iniciar Ethernet");
    return;
  }

  Serial.print("IPv6 asignada al Arduino: ");
  ether.globalAddress().println();
  Serial.println("Sistema iniciado - Enviando solo cambios significativos");
}

void loop() {
  ether.receivePacket();

  int ldr = analogRead(A0);
  unsigned long currentTime = millis();
  
  // Verifica si debe enviar el dato
  if (shouldSendData(ldr, currentTime)) {
    char buffer[32];
    snprintf(buffer, sizeof(buffer), "LDR=%d", ldr);

    // Establece el destino y envía
    if (udp.setRemoteAddress(destIPv6, destPort)) {
      udp.send((const uint8_t*)buffer, strlen(buffer));
      
      // Actualiza las variables de control
      lastSentValue = ldr;
      lastSendTime = currentTime;
      
      Serial.print("Enviado: ");
      Serial.print(buffer);
      Serial.print(" (cambio: ");
      Serial.print(abs(ldr - (lastSentValue == -1 ? ldr : lastSentValue)));
      Serial.println(")");
    } else {
      Serial.println("Error al establecer la dirección remota");
    }
  } else {
    // Opcional: mostrar lecturas que no se envían (para debug)
    static unsigned long lastDebugTime = 0;
    if (currentTime - lastDebugTime > 2000) { // Debug cada 2 segundos
      Serial.print("LDR actual: ");
      Serial.print(ldr);
      Serial.print(" (último enviado: ");
      Serial.print(lastSentValue == -1 ? "ninguno" : String(lastSentValue));
      Serial.println(")");
      lastDebugTime = currentTime;
    }
  }

  delay(100); // Reducido el delay para mayor responsividad
}

/**
 * Determina si se debe enviar el dato actual
 * @param currentValue: valor actual del LDR
 * @param currentTime: tiempo actual en milisegundos
 * @return true si se debe enviar, false en caso contrario
 */
bool shouldSendData(int currentValue, unsigned long currentTime) {
  // Primera lectura - siempre enviar
  if (lastSentValue == -1) {
    return true;
  }
  
  // Verificar que haya pasado el tiempo mínimo entre envíos
  if (currentTime - lastSendTime < MIN_SEND_INTERVAL) {
    return false;
  }
  
  // Calcular la diferencia absoluta
  int difference = abs(currentValue - lastSentValue);
  
  // Enviar solo si el cambio es mayor o igual al umbral
  return (difference >= THRESHOLD);
}

/**
 * Función opcional para cambiar el umbral dinámicamente
 * Puedes llamarla desde el loop si recibes comandos por Serial
 */
void setThreshold(int newThreshold) {
  if (newThreshold > 0) {
    const_cast<int&>(THRESHOLD) = newThreshold;
    Serial.print("Nuevo umbral establecido: ");
    Serial.println(THRESHOLD);
  }
}