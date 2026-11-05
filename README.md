# Advanced IP Scanner (Web Edition) 🚀

Un clon web moderno, rápido y completo de **Advanced IP Scanner**, desarrollado con **React 19 + Vite** en el frontend y un backend de alto rendimiento en **Node.js nativo**.

---

## 🌟 Características Principales

- **Detección Automática de Interfaces y Subredes**:
  - Detección de la IP local y máscara de red (ej. `192.168.1.0/24`).
  - Botón **"IP"** con menú desplegable para autocompletar el rango de red de cualquier tarjeta física (Ethernet/Wi-Fi).
  - Soporta múltiples formatos de rango:
    - Notación clásica: `192.168.1.1-254` o `192.168.1.1-192.168.1.254`
    - Formato CIDR: `192.168.1.0/24`, `10.0.0.0/24`, etc.
    - Direcciones separadas por comas o espacios: `192.168.1.1-10, 192.168.1.50`
- **Escáner Concurrente Ultrarrápido en Tiempo Real**:
  - Pool de trabajadores asíncronos configurables (desde 4 hasta 128 hilos simultáneos).
  - Transmisión de resultados en vivo mediante **Server-Sent Events (SSE)** sin necesidad de recargar la página.
  - Barra de progreso interactiva con porcentaje, host en comprobación actual, contador de activos y temporizador.
- **Resolución Avanzada de Dispositivos**:
  - **Sonda Híbrida ICMP / TCP**: Detecta equipos incluso si tienen el ping ICMP bloqueado por cortafuegos.
  - **Extracción de Direcciones MAC**: Consulta dinámica de la caché ARP del sistema operativo.
  - **Identificación de Fabricante (OUI Vendor)**: Base de datos integrada con miles de prefijos IEEE (Apple, Raspberry Pi, Cisco, Intel, TP-Link, Samsung, Xiaomi, Espressif / ESP32, Dell, HP, Ubiquiti, Synology, etc.).
  - **Resolución de Nombres NetBIOS (UDP 137)**: Obtiene el nombre NetBIOS y grupo de trabajo de equipos Windows y servidores Samba.
  - **DNS Reverso**: Resolución inversa de nombres de host locales.
  - **Escaneo de Puertos y Servicios**: Comprobación rápida de puertos comunes (HTTP 80, HTTPS 443, SSH 22, SMB 445, RDP 3389, FTP 21, DNS 53, etc.) con enlaces directos para abrirlos en el navegador.
- **Herramientas de Red y Diagnóstico**:
  - **Wake-On-LAN (WOL)**: Envío de paquetes mágicos (Magic Packet UDP) para encender dispositivos apagados.
  - **Diagnóstico de Ping en Vivo**: Prueba continua de latencia con registro en tiempo real.
  - **Escaneo Profundo de Puertos**: Comprobación ampliada de 22+ puertos clave para cualquier host específico.
  - **Enlaces de Conexión Rápida**: Accesos directos para HTTP, HTTPS, SSH, FTP y RDP.
- **Gestión y Organización**:
  - **Pestaña de Favoritos**: Guarda dispositivos frecuentes con persistencia en `localStorage`.
  - **Comentarios y Notas Editables**: Asigna alias o notas personalizadas a cada host.
  - **Exportación de Datos**: Exporta los resultados a formato **CSV**, **JSON** o **Texto plano (.txt)**.
  - **Filtro y Búsqueda en Vivo**: Búsqueda instantánea por IP, hostname, MAC, fabricante o puerto.
  - **Modo Oscuro / Claro**: Interfaz visual optimizada con selector de tema.

---

## 🛠️ ¿Por qué Node.js para el Backend?

**Node.js es ideal para este proyecto** y no se requiere ningún otro lenguaje (como C, Go o Python) debido a las siguientes razones técnicas:
1. **E/S Asíncrona sin Bloqueo**: Permite abrir cientos de sockets de prueba (`node:net` y `node:dgram`) simultáneamente con mínimo consumo de memoria y CPU.
2. **Sin dependencias pesadas**: El backend utiliza los módulos nativos de Node.js (`node:http`, `node:net`, `node:dgram`, `node:os`, `node:dns`, `node:child_process`), garantizando máxima portabilidad y velocidad.
3. **Integración fluida con React**: Comparte el mismo ecosistema JavaScript/TypeScript y se comunica con el cliente a través de Server-Sent Events (SSE) y REST.

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Iniciar el Servidor Backend (Node.js)

En una terminal, dentro del directorio del proyecto:

```bash
npm run server
```

El servidor backend iniciará en `http://localhost:3001` con recarga automática `--watch`.

### 2. Iniciar el Cliente Frontend (React + Vite)

En otra terminal:

```bash
npm run dev
```

Abre tu navegador en `http://localhost:5173`. Vite reenviará automáticamente todas las peticiones a `/api` hacia el backend en el puerto 3001.

---

## 📦 Ejecución en Producción (Todo en 1 puerto)

Para compilar el frontend y servirlo directamente desde el backend:

```bash
npm run build
npm start
```

Luego abre directamente: `http://localhost:3001`.

---

## ⚙️ Configuración del Escaneo

Desde el botón de engranaje (**Configuración**) en la barra de herramientas puedes ajustar:
- **Hilos concurrentes**: de 4 a 128 hilos (por defecto 32).
- **Timeout por host**: de 200ms a 2500ms (por defecto 700ms).
- **Lista de puertos a comprobar**: activa o desactiva puertos existentes o añade nuevos puertos personalizados.
# ipscan
