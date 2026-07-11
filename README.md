# AuraSplit | Separador de Voces y Pistas de Audio con Inteligencia Artificial

AuraSplit es una herramienta web de código abierto diseñada para músicos, productores y creadores de contenido que necesitan **separar voces e instrumentos de cualquier canción** con precisión de estudio. La aplicación web interactiva se comunica de forma fluida con un backend de procesamiento de IA que ejecuta el modelo de última generación **Demucs v4**.

La plataforma permite subir archivos de música y dividirlos en hasta 6 pistas individuales o *stems* (Voces, Batería, Bajo, Guitarra, Piano y Otros), ofreciendo una consola de mezcla digital (DAW) y visualización de forma de onda (waveform) en tiempo real directamente en el navegador.

---

## 🚀 Características Clave

* **Separación de Audio Precisa:** Utiliza el modelo neuronal **Demucs v4** de Meta Research en el backend.
* **Consola de Mezclador Multipista (DAW):**
  * Controladores de volumen individuales (Faders) para cada stem separado.
  * Botones de **Silencio (Mute)** y **Solo** por canal.
  * Medidores visuales de volumen (VU Meters) con análisis de frecuencias en tiempo real.
* **Línea de Tiempo DAW Horizontal:** Vista de formas de onda (waveforms) reales alineadas, con sincronización de reproducción y seek (salto temporal).
* **Formatos de Alta Calidad:** Soporte para descargas inmediatas en MP3 a 320 kbps y WAV a 16-bit PCM (Calidad de Estudio).
* **Descarga Unificada en ZIP:** Compresión en memoria mediante la librería JSZip para descargar todos los stems con un solo clic.
* **Diseño Premium:** Interfaz oscura (dark mode) con acentos de brillo de neón rojo, transiciones fluidas y adaptabilidad responsiva (móvil, tablet, escritorio).

---

## 🛠️ Tecnologías Utilizadas

* **Front-End:**
  * **HTML5 Semántico:** Estructura web limpia y optimizada para SEO.
  * **CSS3 Nivel Profesional:** Variables de diseño personalizadas y efectos de iluminación ambiental.
  * **Tailwind CSS:** Diseño responsivo modular y ágil.
  * **JavaScript ES6 (Vanilla JS):** Gestión de flujos asíncronos y llamadas de red.
  * **Web Audio API:** Procesamiento y enrutamiento en tiempo real de nodos de volumen, ganancia y analizadores visuales.
  * **JSZip Library:** Generación y empaquetamiento del archivo ZIP final del lado del cliente.
* **Servicios de Terceros:**
  * **Vercel Web Analytics & Insights:** Para la analítica de rendimiento del sitio en vivo.
* **Backend de IA:**
  * Servidor basado en **FastAPI** alojado de forma gratuita en **Hugging Face Spaces** ([https://zbrun0-aurasplit.hf.space](https://zbrun0-aurasplit.hf.space)).

---

## 📂 Estructura del Repositorio

El repositorio está organizado de forma limpia y directa:

```text
├── index.html          # Interfaz principal estructurada y optimizada para SEO/GEO
├── style.css           # Estilos personalizados y efectos de brillo neón
├── app.js              # Lógica de interfaz, Web Audio API y comunicación con el backend
├── robots.txt          # Configuración de rastreo para buscadores tradicionales e IA
├── sitemap.xml         # Declaración oficial de las URLs públicas
├── vercel.json         # Configuración del despliegue del hosting en Vercel
├── LICENSE             # Licencia de código abierto (MIT)
└── README.md           # Documentación técnica del proyecto
```

---

## ⚙️ Configuración y Despliegue Local

Al ser un proyecto Front-End desarrollado con Vanilla JS y maquetación estática, el despliegue es sumamente sencillo.

### Prerrequisitos
* Tener instalado [Node.js](https://nodejs.org/) (opcional, para usar servidores locales como `live-server` o `vite`).

### Pasos
1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/zbrun0/AuraSplit.git
   cd AuraSplit
   ```
2. **Ejecutar un servidor local:**
   Si tienes Python instalado:
   ```bash
   python -m http.server 8000
   ```
   O si prefieres utilizar `npx` (Node.js):
   ```bash
   npx live-server
   ```
3. Abre tu navegador en [http://localhost:8000](http://localhost:8000).

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](file:///home/zbrun0/Proyectos/AuraSplit/LICENSE) para obtener más detalles.

---

## 👤 Información del Desarrollador y Contacto

Si tienes preguntas, sugerencias o deseas colaborar en el desarrollo de AuraSplit, puedes ponerte en contacto:

* **Nombre:** Bruno Herrera
* **Institución:** Cibertec (Lima, Perú)
* **GitHub:** [zbrun0](https://github.com/zbrun0)
* **Correo Electrónico:** [i202609598@cibertec.edu.pe](mailto:i202609598@cibertec.edu.pe)
