// URL de la API del Backend (Hugging Face Space de AuraSplit)
const BACKEND_URL = "https://zbrun0-aurasplit.hf.space"; 

// --- Estado Global del Reproductor ---
let audioCtx = null;
let masterCompressor = null;
let tracks = {}; // Contendrá: audio, gainNode, analyser, volume, isMuted, isSoloed, blobUrl, sizeBytes, canvas, ctx, etc.
let isPlaying = false;
let startTime = 0;
let playOffset = 0; // Posición actual de reproducción en segundos
let duration = 0;   // Duración total de la canción en segundos
let zipBlob = null; // Almacenará el blob del archivo ZIP original para descarga total
let animationFrameId = null;
let currentPreviewTrack = null; // ID del canal que se está previsualizando individualmente
let progressInterval = null;
let pollInterval = null;
let eventSource = null;
let selectedFile = null;
let activeView = "mixer";
let waveformsRendered = false;

// Estado Musical (BPM, Fase y Secciones)
let currentBpm = 120.0;
let currentOffsetSec = 0.0;
let tapTimes = [];
let songSections = [];
let activeSectionId = null;

// Configuración de Stems (6 Demucs + Metrónomo + Guías Vocales Cues)
const STEMS_CONFIG = {
    vocals: { name: "voces", icon: "mic" },
    drums: { name: "batería", icon: "album" },
    bass: { name: "bajo", icon: "music_note" },
    guitar: { name: "guitarra", icon: "music_video" },
    piano: { name: "piano", icon: "piano" },
    other: { name: "otros", icon: "tune" },
    metronome: { name: "metrónomo", icon: "schedule" },
    guide: { name: "guías / cues", icon: "record_voice_over" }
};

// SVGs para los iconos
const ICONS_SVG = {
    mic: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`,
    album: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>`,
    music_note: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
    music_video: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 9H8v-2h4v2zm0-4H8V6h4v2zm6 8h-4v-2h4v2zm0-4h-4V8h4v2z"/></svg>`,
    piano: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19.02 3H4.98C3.89 3 3 3.89 3 4.98v14.04C3 20.11 3.89 21 4.98 21h14.04c1.09 0 1.98-.89 1.98-1.98V4.98C21 3.89 20.11 3 19.02 3zM12 5h1.5v7h-1.5V5zm-3 0h1.5v7H9V5zM6 5h1.5v7H6V5zm12 14H6v-5h12v5z"/></svg>`,
    tune: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`,
    schedule: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
    record_voice_over: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><circle cx="9" cy="9" r="4"/><path d="M9 15c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm11.08-4.92c.67 1.18.67 2.66 0 3.84l1.43 1.43c1.37-1.93 1.37-4.77 0-6.7l-1.43 1.43zm-2.83 2.83l1.42 1.42c.62-.97.62-2.29 0-3.26l-1.42 1.42c.16.27.16.55 0 .42z"/></svg>`,
    play_arrow: `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    download: `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`
};

// --- Referencias al DOM ---
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const processing = document.getElementById("processing");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const statusText = document.getElementById("statusText");
const trackList = document.getElementById("trackList");
const resultsSection = document.getElementById("resultsSection");
const resultsList = document.getElementById("resultsList");
const fileMeta = document.getElementById("fileMeta");
const masterPlayBtn = document.getElementById("masterPlayBtn");
const masterRewindBtn = document.getElementById("masterRewindBtn");
const resetMixerBtn = document.getElementById("resetMixerBtn");
const downloadMixBtn = document.getElementById("downloadMixBtn");
const downloadZipBtn = document.getElementById("downloadZipBtn");

const uploadState = document.getElementById("uploadState");
const configState = document.getElementById("configState");
const configFileName = document.getElementById("configFileName");
const startProcessBtn = document.getElementById("startProcessBtn");
const cancelProcessBtn = document.getElementById("cancelProcessBtn");
const mixerSection = document.getElementById("mixerSection");
const newSeparationBtn = document.getElementById("newSeparationBtn");

const controlPanel = document.getElementById("controlPanel");
const masterSeekbar = document.getElementById("masterSeekbar");
const currentTimeDisplay = document.getElementById("currentTimeDisplay");
const totalTimeDisplay = document.getElementById("totalTimeDisplay");
const viewMixerBtn = document.getElementById("viewMixerBtn");
const viewTimelineBtn = document.getElementById("viewTimelineBtn");
const timelineTracksList = document.getElementById("timelineTracksList");
const timelineViewContainer = document.getElementById("timelineViewContainer");
const sectionMarkersBar = document.getElementById("sectionMarkersBar");
const reanalyzeSectionsBtn = document.getElementById("reanalyzeSectionsBtn");

// Controles Musicales
const bpmInput = document.getElementById("bpmInput");
const timeSignatureSelect = document.getElementById("timeSignatureSelect");
const tapTempoBtn = document.getElementById("tapTempoBtn");
const nudgeLeftBtn = document.getElementById("nudgeLeftBtn");
const nudgeRightBtn = document.getElementById("nudgeRightBtn");
const syncCursorBtn = document.getElementById("syncCursorBtn");
const regenerateClickBtn = document.getElementById("regenerateClickBtn");
const guideLangSelect = document.getElementById("guideLangSelect");
const generateGuideBtn = document.getElementById("generateGuideBtn");

// Controles de Configuración Inicial de Subida
const initialBpmInput = document.getElementById("initialBpmInput");
const autoBpmToggleBtn = document.getElementById("autoBpmToggleBtn");
const initialTimeSignatureSelect = document.getElementById("initialTimeSignatureSelect");
const initialPreRollSelect = document.getElementById("initialPreRollSelect");
const autoGenerateGuideCheck = document.getElementById("autoGenerateGuideCheck");
let currentTimeSignature = "4/4";

if (timeSignatureSelect) {
    timeSignatureSelect.addEventListener("change", () => {
        currentTimeSignature = timeSignatureSelect.value || "4/4";
        syncClickAndGuide();
    });
}

if (autoBpmToggleBtn && initialBpmInput) {
    autoBpmToggleBtn.addEventListener("click", () => {
        if (initialBpmInput.value) {
            initialBpmInput.value = "";
            initialBpmInput.placeholder = "Auto-detectar";
            autoBpmToggleBtn.classList.add("text-red-400");
        } else {
            initialBpmInput.value = "120.0";
            autoBpmToggleBtn.classList.remove("text-red-400");
        }
    });
}

// --- Eventos Click y Drag & Drop para Carga ---
window.handleUploadClick = function() {
    fileInput.click();
};

dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    const container = dropzone.firstElementChild;
    if (container) {
        container.classList.add("border-red-500/50", "bg-zinc-900/60");
        container.classList.remove("border-zinc-800", "bg-zinc-900/30");
    }
});

dropzone.addEventListener("dragleave", () => {
    const container = dropzone.firstElementChild;
    if (container) {
        container.classList.remove("border-red-500/50", "bg-zinc-900/60");
        container.classList.add("border-zinc-800", "bg-zinc-900/30");
    }
});

dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const container = dropzone.firstElementChild;
    if (container) {
        container.classList.remove("border-red-500/50", "bg-zinc-900/60");
        container.classList.add("border-zinc-800", "bg-zinc-900/30");
    }
    if (e.dataTransfer.files.length > 0) {
        processSelectedFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        processSelectedFile(e.target.files[0]);
    }
});

// --- Procesar Archivo Seleccionado ---
function processSelectedFile(file) {
    const validTypes = [".mp3", ".wav", ".flac", ".ogg", ".m4a"];
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!file.type.startsWith("audio/") && !validTypes.includes(extension)) {
        alert("Por favor, selecciona un archivo de audio válido (MP3, WAV, FLAC, OGG, M4A).");
        return;
    }
    
    resetAudio();
    selectedFile = file;
    
    if (uploadState && configState && configFileName) {
        uploadState.classList.add("hidden");
        configState.classList.remove("hidden");
        configFileName.textContent = file.name.toUpperCase();
        updateEstimatedTime();
    }
}

function resetToUploadState() {
    selectedFile = null;
    if (uploadState && configState) {
        configState.classList.add("hidden");
        uploadState.classList.remove("hidden");
    }
    if (dropzone) {
        dropzone.classList.remove("hidden");
    }
}

function updateEstimatedTime() {
    const modelSelect = document.getElementById("modelSelect");
    const formatSelect = document.getElementById("formatSelect");
    const estimatedTimeText = document.getElementById("estimatedTimeText");
    if (!modelSelect || !estimatedTimeText) return;
    
    const model = modelSelect.value;
    const format = formatSelect ? formatSelect.value : "mp3";
    
    let timeText = "";
    if (model === "htdemucs") {
        timeText = "~2.5 a 4 minutos";
    } else {
        timeText = "~5 a 8 minutos";
    }
    
    if (format === "wav") {
        timeText += " (Descarga lenta)";
    } else {
        timeText += " (Descarga rápida)";
    }
    
    estimatedTimeText.textContent = timeText;
}

window.updateEstimatedTime = updateEstimatedTime;

// --- Envío del Archivo a la API ---
function uploadAndSeparate(file) {
    dropzone.classList.add("hidden");
    processing.classList.remove("hidden");
    
    fileMeta.textContent = "SUBIENDO: " + file.name.toUpperCase();
    if (trackList) {
        trackList.innerHTML = `
            <div class="col-span-full py-16 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800/40 rounded-2xl bg-zinc-900/10">
                <svg class="w-8 h-8 mb-3 text-red-500 animate-spin fill-current" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p class="text-sm font-semibold text-zinc-400">Subiendo archivo de origen...</p>
                <p class="text-xs text-zinc-600 mt-1" id="mixerStatusDesc">Enviando archivo a la memoria temporal del servidor...</p>
            </div>
        `;
    }
    
    // Capturar configuraciones de BPM, Compás, Pre-roll y Guía definidas por el usuario
    if (initialBpmInput && initialBpmInput.value) {
        const val = parseFloat(initialBpmInput.value);
        if (!isNaN(val) && val >= 40 && val <= 260) {
            userConfiguredBpm = val;
        } else {
            userConfiguredBpm = null;
        }
    } else {
        userConfiguredBpm = null;
    }

    if (initialTimeSignatureSelect) {
        currentTimeSignature = initialTimeSignatureSelect.value || "4/4";
        if (timeSignatureSelect) timeSignatureSelect.value = currentTimeSignature;
    }

    if (initialPreRollSelect) {
        const val = parseInt(initialPreRollSelect.value, 10);
        userConfiguredPreRoll = isNaN(val) ? 1 : val;
    }
    if (autoGenerateGuideCheck) {
        userConfiguredAutoGuide = autoGenerateGuideCheck.checked;
    }

    updateStatus("SUBIENDO AUDIO DE ORIGEN...", "Enviando archivo a la memoria temporal del servidor...", 10);

    const modelSelect = document.getElementById("modelSelect");
    const formatSelect = document.getElementById("formatSelect");
    const selectedModel = modelSelect ? modelSelect.value : "htdemucs_6s";
    const selectedFormat = formatSelect ? formatSelect.value : "mp3";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", selectedModel);
    formData.append("format", selectedFormat);
    formData.append("shifts", "1");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_URL}/separate`, true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 90);
            updateStatus("SUBIENDO AUDIO DE ORIGEN...", `Enviando archivo al backend (${percent}%)`, percent);
            const desc = document.getElementById("mixerStatusDesc");
            if (desc) {
                desc.textContent = `Enviando archivo al backend (${percent}%)`;
            }
        }
    };

    xhr.onload = async function() {
        if (xhr.status === 200) {
            try {
                const data = xhr.response;
                if (data && data.job_id) {
                    updateStatus("EN COLA DE ESPERA...", "Audio subido correctamente. Esperando turno...", 20);
                    listenJobProgress(data.job_id, file);
                } else {
                    showError("Respuesta del servidor inválida.");
                }
            } catch (err) {
                showError("Error al procesar la respuesta de la cola: " + err.message);
            }
        } else {
            showError(`Error del servidor (Código ${xhr.status}). Asegúrate de que el backend esté en línea.`);
        }
    };

    xhr.onerror = function() {
        showError("No se pudo conectar con el backend de FastAPI. Verifica tu conexión a internet.");
    };

    xhr.responseType = "json";
    xhr.send(formData);
}

function updateStatus(title, subtitle, percentage) {
    if (statusText) statusText.textContent = title;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressPercent) progressPercent.textContent = `${percentage}%`;
}

function showError(msg) {
    alert(msg);
    processing.classList.add("hidden");
    dropzone.classList.remove("hidden");
    resetAudio();
}

// --- Escucha de Progreso en Tiempo Real (SSE con fallback a Polling) ---
function listenJobProgress(jobId, file) {
    stopProcessingProgress();
    progressBar.classList.add("animate-pulse");

    let isCompleted = false;

    // Intentar conexión Server-Sent Events (SSE)
    try {
        if (window.EventSource) {
            eventSource = new EventSource(`${BACKEND_URL}/events/${jobId}`);
            
            eventSource.onmessage = async (e) => {
                try {
                    const data = JSON.parse(e.data);
                    handleJobProgressUpdate(data, file);
                    if (data.status === "completed" || data.status === "failed") {
                        eventSource.close();
                        eventSource = null;
                    }
                } catch (err) {
                    console.error("Error parseando SSE:", err);
                }
            };

            eventSource.onerror = () => {
                console.warn("SSE desconectado. Pasando a modo polling...");
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }
                if (!isCompleted) {
                    startFallbackPolling(jobId, file);
                }
            };
            return;
        }
    } catch (e) {
        console.warn("No se pudo inicializar EventSource:", e);
    }

    startFallbackPolling(jobId, file);
}

function startFallbackPolling(jobId, file) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/status/${jobId}`);
            if (!res.ok) {
                clearInterval(pollInterval);
                showError("No se pudo obtener el estado del proceso de separación.");
                return;
            }
            const data = await res.json();
            handleJobProgressUpdate(data, file);
        } catch (err) {
            console.error("Error consultando estado:", err);
        }
    }, 3000);
}

async function handleJobProgressUpdate(data, file) {
    if (data.status === "queued") {
        const percent = Math.min(45, 10 + (data.position * 3));
        updateStatus("EN COLA DE ESPERA...", `Turno: Posición ${data.position}. Tiempo est. restante: ~${data.position * 45}s`, percent);
        
        const desc = document.getElementById("mixerStatusDesc");
        if (desc) {
            desc.innerHTML = `
                <p class="text-sm font-semibold text-zinc-400">Tu posición en la cola es: ${data.position}</p>
                <p class="text-xs text-zinc-500 mt-1">Tiempo estimado de espera: ~${data.position * 45} segundos.</p>
            `;
        }
        fileMeta.textContent = `EN COLA (Posición ${data.position}): ` + file.name.toUpperCase();
        
    } else if (data.status === "processing") {
        let percent = 50;
        const step = data.step || "";
        if (step.includes("DECODIFICANDO")) percent = 55;
        else if (step.includes("RESAMPLEANDO")) percent = 60;
        else if (step.includes("INFERENCIA")) percent = 75;
        else if (step.includes("GUARDANDO")) percent = 88;
        else if (step.includes("COMPRIMIENDO")) percent = 95;
        
        updateStatus(data.step, data.description, percent);
        fileMeta.textContent = "PROCESANDO: " + file.name.toUpperCase();
        
        const desc = document.getElementById("mixerStatusDesc");
        if (desc) {
            desc.innerHTML = `
                <p class="text-sm font-semibold text-zinc-400">Separando instrumentos por IA...</p>
                <p class="text-xs text-red-500 font-bold uppercase mt-1 animate-pulse">${data.step}</p>
                <p class="text-xs text-zinc-500 mt-0.5">${data.description}</p>
            `;
        }
        
    } else if (data.status === "completed") {
        stopProcessingProgress();
        updateStatus("DESCARGANDO RESULTADOS...", "Obteniendo pistas decodificadas...", 98);
        
        try {
            const downloadRes = await fetch(`${BACKEND_URL}/download/${data.job_id}`);
            if (!downloadRes.ok) throw new Error("Error en la descarga de los stems.");
            
            zipBlob = await downloadRes.blob();
            await decodeAndSetupMixer(zipBlob);
            
            updateStatus("LISTO", "Separación finalizada.", 100);
            notifyCompletion(file.name);
        } catch (err) {
            showError("Error al descargar o decodificar los stems: " + err.message);
        }
        
    } else if (data.status === "failed") {
        stopProcessingProgress();
        showError("La separación por IA falló: " + data.description);
    }
}

function stopProcessingProgress() {
    if (progressBar) progressBar.classList.remove("animate-pulse");
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

function notifyCompletion(fileName) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("AuraSplit | ¡Listo!", {
            body: `La separación de "${fileName}" ha finalizado con éxito.`,
            icon: "iconlogo.svg"
        });
    }
}

if ("Notification" in window && Notification.permission === "default") {
    document.addEventListener("click", () => {
        Notification.requestPermission();
    }, { once: true });
}

// --- Restablecer Audio y Mezclador ---
function resetAudio() {
    pauseTracks();
    stopProcessingProgress();
    
    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.pause();
            track.audio.src = "";
            track.audio.load();
        }
    }
    
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
        masterCompressor = null;
    }
    tracks = {};
    duration = 0;
    playOffset = 0;
    startTime = 0;
    zipBlob = null;
    currentPreviewTrack = null;
    songSections = [];
    activeSectionId = null;
    
    if (controlPanel) controlPanel.classList.add("hidden");
    if (resultsSection) resultsSection.classList.add("hidden");
    if (resultsList) resultsList.innerHTML = "";
    if (mixerSection) mixerSection.classList.add("hidden");
    if (timelineTracksList) timelineTracksList.innerHTML = "";
    if (sectionMarkersBar) sectionMarkersBar.innerHTML = "";
    
    waveformsRendered = false;
    switchView("mixer");
    resetToUploadState();
    
    if (trackList) {
        trackList.innerHTML = `
            <div class="col-span-full py-16 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800/40 rounded-2xl bg-zinc-900/10">
                <svg class="w-8 h-8 mb-3 text-zinc-600 fill-current" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
                <p class="text-sm font-semibold text-zinc-400">Carga un archivo de audio para activar la consola de mezcla.</p>
                <p class="text-xs text-zinc-600 mt-1">AuraSplit aislará de forma inteligente las voces e instrumentos.</p>
            </div>
        `;
    }
}

// --- Descompresión de Stems e Inicialización del Mezclador ---
async function decodeAndSetupMixer(blob) {
    updateStatus("DECODIFICANDO CANALES...", "Extrayendo y decodificando pistas en la memoria del navegador...", 100);
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    // Limitador / Dynamics Compressor Maestro para prevenir distorsión digital cuando suenan múltiples canales
    masterCompressor = audioCtx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-0.5, audioCtx.currentTime);
    masterCompressor.knee.setValueAtTime(3, audioCtx.currentTime);
    masterCompressor.ratio.setValueAtTime(20, audioCtx.currentTime);
    masterCompressor.attack.setValueAtTime(0.001, audioCtx.currentTime);
    masterCompressor.release.setValueAtTime(0.1, audioCtx.currentTime);
    masterCompressor.connect(audioCtx.destination);

    try {
        const zip = await JSZip.loadAsync(blob);
        tracks = {};
        
        trackList.innerHTML = "";
        resultsList.innerHTML = "";
        duration = 0;

        if (timelineTracksList) timelineTracksList.innerHTML = "";
        
        for (const stemId of Object.keys(STEMS_CONFIG)) {
            if (stemId === "metronome" || stemId === "guide") continue;

            let fileExtension = "mp3";
            let fileInZip = zip.file(`${stemId}.mp3`);
            if (!fileInZip) {
                fileInZip = zip.file(`${stemId}.wav`);
                fileExtension = "wav";
            }

            if (!fileInZip) continue;

            const stemBlob = await fileInZip.async("blob");
            const blobUrl = URL.createObjectURL(stemBlob);
            const sizeBytes = stemBlob.size;

            const audio = new Audio(blobUrl);
            audio.preload = "auto";
            audio.crossOrigin = "anonymous";

            tracks[stemId] = {
                audio: audio,
                gainNode: null,
                analyser: null,
                volume: 0.8,
                isMuted: false,
                isSoloed: false,
                blobUrl: blobUrl,
                sizeBytes: sizeBytes,
                extension: fileExtension
            };

            audio.addEventListener("loadedmetadata", () => {
                if (duration === 0) {
                    duration = audio.duration;
                }
            });

            createTrackUI(stemId);
            createTimelineTrackUI(stemId);
            createResultUI(stemId);
        }

        // --- Detección de BPM, Alineación de Fase y Generación de Metrónomo y Guías ---
        if (tracks.drums || tracks.vocals || tracks.bass || tracks.other) {
            try {
                updateStatus("ANALIZANDO RITMO Y ESTRUCTURA...", "Detectando tempo, solos y secciones musicales...", 99);
                
                // Decodificar los buffers de audio para análisis de energía y ritmo
                const decodedStemBuffers = {};
                for (const stemId of ["drums", "vocals", "bass", "guitar", "other", "piano"]) {
                    if (tracks[stemId] && tracks[stemId].blobUrl) {
                        try {
                            const res = await fetch(tracks[stemId].blobUrl);
                            const arrBuf = await res.arrayBuffer();
                            decodedStemBuffers[stemId] = await audioCtx.decodeAudioData(arrBuf);
                            if (!duration && decodedStemBuffers[stemId].duration) {
                                duration = decodedStemBuffers[stemId].duration;
                            }
                        } catch (errDec) {
                            console.warn(`No se pudo decodificar buffer para stem ${stemId}:`, errDec);
                        }
                    }
                }

                cachedDecodedStemBuffers = decodedStemBuffers;

                // 1. Detección o uso de BPM
                const primaryBuffer = decodedStemBuffers.drums || decodedStemBuffers.bass || decodedStemBuffers.vocals || Object.values(decodedStemBuffers)[0];
                if (primaryBuffer) {
                    duration = primaryBuffer.duration;
                    const beatResult = getBeats(primaryBuffer);
                    if (userConfiguredBpm) {
                        currentBpm = userConfiguredBpm;
                        currentOffsetSec = calculateDownbeatOffset(primaryBuffer, currentBpm);
                    } else {
                        currentBpm = beatResult.bpm || 120.0;
                        currentOffsetSec = beatResult.beats && beatResult.beats.length > 0 ? beatResult.beats[0] : 0.0;
                    }
                } else {
                    currentBpm = userConfiguredBpm || 120.0;
                    currentOffsetSec = 0.0;
                }

                if (bpmInput) {
                    bpmInput.value = currentBpm.toFixed(1);
                }

                // 2. Pre-Roll / Lead-in Real: Adelantar la canción después del conteo de metrónomo y guía
                const beatsPerBar = (currentTimeSignature === "3/4") ? 3 : (currentTimeSignature === "6/8" ? 6 : 4);
                const barDuration = (60 / currentBpm) * beatsPerBar;
                const leadInSec = (userConfiguredPreRoll >= 1) ? (barDuration * userConfiguredPreRoll) : 0;

                if (leadInSec > 0) {
                    for (const stemId of Object.keys(decodedStemBuffers)) {
                        const origBuf = decodedStemBuffers[stemId];
                        const paddedBuf = padAudioBufferWithLeadIn(origBuf, leadInSec);
                        decodedStemBuffers[stemId] = paddedBuf;

                        if (tracks[stemId]) {
                            const paddedWav = bufferToWav(paddedBuf);
                            const paddedUrl = URL.createObjectURL(paddedWav);
                            tracks[stemId].blobUrl = paddedUrl;
                            tracks[stemId].audio.src = paddedUrl;
                            tracks[stemId].audio.load();
                            tracks[stemId].audioBuffer = paddedBuf;
                            tracks[stemId].sizeBytes = paddedWav.size;

                            const dlLink = document.getElementById(`download-${stemId}`);
                            if (dlLink) dlLink.href = paddedUrl;
                        }
                    }
                    duration += leadInSec;
                }

                // 3. Detección Dinámica de Secciones por Análisis de Energía Multi-Stem
                await detectSongSectionsDynamic(currentBpm, currentOffsetSec, duration, decodedStemBuffers, leadInSec);

                // 4. Generar Metrónomo Pro Sincronizado
                await generateMetronomeTrack(currentBpm, currentOffsetSec, duration);

                // 5. Si está habilitado, Generar Pista Guía Vocal con Samples Reales
                if (userConfiguredAutoGuide) {
                    const lang = guideLangSelect ? guideLangSelect.value : "es";
                    await generateGuideTrack(lang, userConfiguredPreRoll, leadInSec);
                }

            } catch (err) {
                console.error("Error en detección de ritmo y secciones:", err);
            }
        }

        setupAudioNodes();
        
        processing.classList.add("hidden");
        if (mixerSection) mixerSection.classList.remove("hidden");
        if (controlPanel) controlPanel.classList.remove("hidden");
        resultsSection.classList.remove("hidden");

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        drawMeters();

    } catch (e) {
        throw new Error("Error al extraer o decodificar el ZIP de audio: " + e.message);
    }
}

// Variables de Configuración de Usuario para la sesión de carga
let userConfiguredBpm = null;
let userConfiguredPreRoll = 1;
let userConfiguredAutoGuide = true;

// Helper para insertar silencio inicial en los stems (Lead-in Pre-roll)
function padAudioBufferWithLeadIn(audioBuffer, leadInSeconds) {
    if (!audioBuffer || leadInSeconds <= 0 || !audioCtx) return audioBuffer;
    const sampleRate = audioBuffer.sampleRate;
    const leadInSamples = Math.floor(leadInSeconds * sampleRate);
    const totalSamples = audioBuffer.length + leadInSamples;
    const numChannels = audioBuffer.numberOfChannels;
    const padded = audioCtx.createBuffer(numChannels, totalSamples, sampleRate);
    
    for (let c = 0; c < numChannels; c++) {
        const origData = audioBuffer.getChannelData(c);
        const paddedData = padded.getChannelData(c);
        paddedData.set(origData, leadInSamples);
    }
    return padded;
}

// Cache en memoria para los samples de audio de la voz guía
const CUE_SAMPLE_CACHE = {};

async function getCueAudioBuffer(sampleKey) {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
    }
    if (CUE_SAMPLE_CACHE[sampleKey]) {
        return CUE_SAMPLE_CACHE[sampleKey];
    }
    try {
        const url = `assets/cues/${sampleKey}.mp3`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Sample "${sampleKey}" no encontrado en ${url}`);
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        CUE_SAMPLE_CACHE[sampleKey] = audioBuf;
        return audioBuf;
    } catch (e) {
        console.warn(`No se pudo cargar cue sample "${sampleKey}":`, e);
        return null;
    }
}

// Cálculo del downbeat offset (primer pulso) con correlación de envolvente de transitorios de alta precisión
function calculateDownbeatOffset(audioBuffer, bpm) {
    if (!audioBuffer) return 0.0;
    const T = 60 / bpm;
    const sampleRate = audioBuffer.sampleRate;
    const data = audioBuffer.getChannelData(0);
    
    const maxSec = Math.min(12.0, audioBuffer.duration);
    const maxSamples = Math.floor(maxSec * sampleRate);
    const hop = Math.floor(sampleRate * 0.005); // Resolución de 5ms
    const numHops = Math.floor(maxSamples / hop);
    const envelope = new Float32Array(numHops);

    for (let h = 0; h < numHops; h++) {
        let sumSq = 0;
        const start = h * hop;
        const end = Math.min(start + hop, maxSamples);
        for (let i = start; i < end; i++) {
            const val = data[i];
            sumSq += val * val;
        }
        envelope[h] = Math.sqrt(sumSq / Math.max(1, end - start));
    }

    const onsets = new Float32Array(numHops);
    for (let h = 1; h < numHops; h++) {
        onsets[h] = Math.max(0, envelope[h] - envelope[h - 1]);
    }

    const steps = 120;
    let bestPhi = 0;
    let maxCorrelation = -1;

    for (let s = 0; s < steps; s++) {
        const phi = (s / steps) * T;
        let score = 0;
        let count = 0;
        for (let t = phi; t < maxSec; t += T) {
            const h = Math.floor((t * sampleRate) / hop);
            if (h >= 0 && h < numHops) {
                let localMax = 0;
                for (let dh = -2; dh <= 2; dh++) {
                    if (h + dh >= 0 && h + dh < numHops) {
                        localMax = Math.max(localMax, onsets[h + dh]);
                    }
                }
                score += localMax;
                count++;
            }
        }
        if (count > 0) score /= count;
        if (score > maxCorrelation) {
            maxCorrelation = score;
            bestPhi = phi;
        }
    }

    return bestPhi;
}

// --- Generar Pista de Metrónomo Pro Sincronizado según Métrica (4/4, 3/4, 6/8) ---
async function generateMetronomeTrack(bpm, offsetSec, totalDuration) {
    if (!audioCtx) return;
    
    const sampleRate = audioCtx.sampleRate || 44100;
    const interval = 60 / bpm;
    
    const beatTimes = [];
    let t = offsetSec;
    while (t - interval >= 0) {
        t -= interval;
    }
    while (t < totalDuration) {
        if (t >= 0) beatTimes.push(t);
        t += interval;
    }

    const metronomeBuffer = createAccentedMetronomeBuffer(beatTimes, totalDuration, sampleRate, currentTimeSignature);
    const wavBlob = bufferToWav(metronomeBuffer);
    const blobUrl = URL.createObjectURL(wavBlob);

    if (tracks.metronome) {
        tracks.metronome.audio.src = blobUrl;
        tracks.metronome.audio.load();
        tracks.metronome.blobUrl = blobUrl;
        tracks.metronome.sizeBytes = wavBlob.size;
        tracks.metronome.bpm = bpm;
        tracks.metronome.volume = 0.70;
        tracks.metronome.audioBuffer = metronomeBuffer;
        
        const dlLink = document.getElementById("download-metronome");
        if (dlLink) dlLink.href = blobUrl;
    } else {
        const audio = new Audio(blobUrl);
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";

        tracks.metronome = {
            audio: audio,
            gainNode: null,
            analyser: null,
            volume: 0.70,
            isMuted: false,
            isSoloed: false,
            blobUrl: blobUrl,
            sizeBytes: wavBlob.size,
            bpm: bpm,
            audioBuffer: metronomeBuffer,
            extension: "wav"
        };

        createTrackUI("metronome");
        createTimelineTrackUI("metronome");
        createResultUI("metronome");
    }

    setupSingleTrackAudioNode("metronome");
    updateTrackGains();
    updateTrackDisplayName("metronome", `METRÓNOMO (${bpm.toFixed(1)} BPM - ${currentTimeSignature})`);

    const fader = document.getElementById("fader-metronome");
    if (fader) fader.value = 70;
    const faderTl = document.getElementById("fader-timeline-metronome");
    if (faderTl) faderTl.value = 70;

    if (activeView === "timeline" && typeof renderAllWaveforms === "function") {
        renderAllWaveforms();
    }
}

// Sintetizador de Click Pro con acentos según métrica
function createAccentedMetronomeBuffer(beatTimes, duration, sampleRate, timeSig = "4/4") {
    const numSamples = Math.floor(duration * sampleRate);
    const metronomeBuffer = audioCtx.createBuffer(2, numSamples, sampleRate);
    
    const left = metronomeBuffer.getChannelData(0);
    const right = metronomeBuffer.getChannelData(1);
    
    const clickDuration = 0.035; // 35ms
    const clickSamples = Math.floor(clickDuration * sampleRate);

    const downbeatSignal = new Float32Array(clickSamples);
    const midbeatSignal = new Float32Array(clickSamples);
    const offbeatSignal = new Float32Array(clickSamples);

    for (let i = 0; i < clickSamples; i++) {
        const t = i / sampleRate;
        const envDown = Math.exp(-t * 150);
        const envOff = Math.exp(-t * 120);
        downbeatSignal[i] = Math.sin(2 * Math.PI * 1350 * t) * envDown * 0.90;
        midbeatSignal[i] = Math.sin(2 * Math.PI * 1050 * t) * envOff * 0.70;
        offbeatSignal[i] = Math.sin(2 * Math.PI * 850 * t) * envOff * 0.55;
    }

    for (let b = 0; b < beatTimes.length; b++) {
        const time = beatTimes[b];
        const startSample = Math.floor(time * sampleRate);
        if (startSample >= numSamples) continue;

        let sig = offbeatSignal;
        if (timeSig === "3/4") {
            if (b % 3 === 0) sig = downbeatSignal;
        } else if (timeSig === "6/8") {
            if (b % 6 === 0) sig = downbeatSignal;
            else if (b % 6 === 3) sig = midbeatSignal;
        } else {
            if (b % 4 === 0) sig = downbeatSignal;
        }

        for (let i = 0; i < clickSamples; i++) {
            const idx = startSample + i;
            if (idx < numSamples) {
                left[idx] += sig[i];
                right[idx] += sig[i];
            }
        }
    }

    return metronomeBuffer;
}

// --- Cálculo de Energía RMS por Compás ---
function calculateStemRmsPerBar(stemAudioBuffer, bpm, offsetSec, totalBars, barDuration) {
    if (!stemAudioBuffer) return new Float32Array(totalBars);
    const sampleRate = stemAudioBuffer.sampleRate;
    const channelData = stemAudioBuffer.getChannelData(0);
    const rmsValues = new Float32Array(totalBars);
    const barSamples = Math.floor(barDuration * sampleRate);

    for (let b = 0; b < totalBars; b++) {
        const startSample = Math.floor((offsetSec + b * barDuration) * sampleRate);
        const endSample = Math.min(channelData.length, startSample + barSamples);
        if (startSample >= channelData.length) break;

        let sumSq = 0;
        let count = 0;
        for (let i = startSample; i < endSample; i += 4) {
            const val = channelData[i];
            sumSq += val * val;
            count++;
        }
        rmsValues[b] = count > 0 ? Math.sqrt(sumSq / count) : 0;
    }
    return rmsValues;
}

// --- Detección Dinámica de Secciones con Granularidad Musical Exacta ---
async function detectSongSectionsDynamic(bpm, offsetSec, totalDuration, stemBuffers = {}, leadInSec = 0) {
    if (!totalDuration || totalDuration <= 0) return;

    const beatsPerBar = (currentTimeSignature === "3/4") ? 3 : (currentTimeSignature === "6/8" ? 6 : 4);
    const barDuration = (60 / bpm) * beatsPerBar;
    
    // Inicio efectivo de la música (después del lead-in)
    const effectiveStartSec = leadInSec > 0 ? leadInSec : offsetSec;
    const musicDuration = totalDuration - effectiveStartSec;
    const totalBars = Math.floor(musicDuration / barDuration);
    if (totalBars <= 0) return;

    songSections = [];

    // Calcular RMS compás a compás (resolución de 1 compás)
    const vocalRms = calculateStemRmsPerBar(stemBuffers.vocals, bpm, effectiveStartSec, totalBars, barDuration);
    const drumRms = calculateStemRmsPerBar(stemBuffers.drums, bpm, effectiveStartSec, totalBars, barDuration);
    const bassRms = calculateStemRmsPerBar(stemBuffers.bass, bpm, effectiveStartSec, totalBars, barDuration);
    const otherRms = calculateStemRmsPerBar(stemBuffers.other, bpm, effectiveStartSec, totalBars, barDuration);
    const guitarRms = calculateStemRmsPerBar(stemBuffers.guitar, bpm, effectiveStartSec, totalBars, barDuration);

    const maxVocal = Math.max(0.001, ...vocalRms);
    const maxDrum = Math.max(0.001, ...drumRms);
    const maxBass = Math.max(0.001, ...bassRms);
    const maxOther = Math.max(0.001, ...otherRms);
    const maxGuitar = Math.max(0.001, ...guitarRms);

    const vocalSilenceThresh = maxVocal * 0.18;
    const vocalChorusThresh = maxVocal * 0.52;
    const drumActiveThresh = maxDrum * 0.22;
    const guitarSoloThresh = maxGuitar * 0.45;
    const otherSoloThresh = maxOther * 0.45;

    // Primer pase: etiquetar compás a compás
    const barTypes = [];
    for (let b = 0; b < totalBars; b++) {
        const v = vocalRms[b];
        const d = drumRms[b];
        const b_rms = bassRms[b];
        const g = guitarRms[b];
        const o = otherRms[b];

        if (b < 8 && v < vocalSilenceThresh) {
            barTypes.push({ type: "INTRO", cueKey: "intro", color: "#3b82f6" });
        } else if (b >= totalBars - 6 && (v < vocalSilenceThresh || d < drumActiveThresh)) {
            barTypes.push({ type: "FINAL", cueKey: "final", color: "#06b6d4" });
        } else if (v < vocalSilenceThresh) {
            // Instrumental o Solo
            if (g > guitarSoloThresh) {
                barTypes.push({ type: "SOLO DE GUITARRA", cueKey: "guitarra", color: "#ec4899" });
            } else if (o > otherSoloThresh && d > drumActiveThresh) {
                barTypes.push({ type: "SOLO", cueKey: "solo", color: "#ec4899" });
            } else if (b_rms > maxBass * 0.5 && o < otherSoloThresh * 0.5) {
                barTypes.push({ type: "SOLO DE BAJO", cueKey: "bass", color: "#f43f5e" });
            } else {
                barTypes.push({ type: "INSTRUMENTAL", cueKey: "instrumental", color: "#8b5cf6" });
            }
        } else {
            // Secciones con Voz
            if (v >= vocalChorusThresh && d >= drumActiveThresh) {
                barTypes.push({ type: "CORO", cueKey: "coro", color: "#ef4444" });
            } else if (b > totalBars * 0.55 && b < totalBars * 0.85 && v > vocalSilenceThresh && d < drumActiveThresh) {
                barTypes.push({ type: "PUENTE", cueKey: "puente", color: "#a855f7" });
            } else {
                barTypes.push({ type: "VERSO", cueKey: "verso", color: "#10b981" });
            }
        }
    }

    // Detectar Pre-Coros (2 a 4 compases de subida antes de un Coro)
    for (let b = 2; b < totalBars; b++) {
        if (barTypes[b].type === "CORO") {
            const preLen = Math.min(4, b);
            let isPrevVerse = false;
            for (let k = b - preLen; k < b; k++) {
                if (barTypes[k].type === "VERSO") isPrevVerse = true;
            }
            if (isPrevVerse) {
                const preCoroStart = Math.max(0, b - 4);
                for (let k = preCoroStart; k < b; k++) {
                    if (barTypes[k].type === "VERSO") {
                        barTypes[k] = { type: "PRE-CORO", cueKey: "precoro", color: "#f59e0b" };
                    }
                }
            }
        }
    }

    // Agrupar compases contiguos en bloques limpios de al menos 4 compases
    const rawSegments = [];
    let curSeg = { ...barTypes[0], startBar: 0, endBar: 1 };

    for (let b = 1; b < totalBars; b++) {
        if (barTypes[b].type === curSeg.type) {
            curSeg.endBar = b + 1;
        } else {
            rawSegments.push(curSeg);
            curSeg = { ...barTypes[b], startBar: b, endBar: b + 1 };
        }
    }
    rawSegments.push(curSeg);

    // Suavizar fragmentos aislados menores a 2 compases
    const merged = [];
    for (let i = 0; i < rawSegments.length; i++) {
        const seg = rawSegments[i];
        const len = seg.endBar - seg.startBar;
        if (len < 2 && merged.length > 0 && i < rawSegments.length - 1) {
            merged[merged.length - 1].endBar = seg.endBar;
        } else if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
            merged[merged.length - 1].endBar = seg.endBar;
        } else {
            merged.push({ ...seg });
        }
    }

    // Crear las secciones con marcas exactas de tiempo
    for (let i = 0; i < merged.length; i++) {
        const m = merged[i];
        const startTime = effectiveStartSec + (m.startBar * barDuration);
        const endTime = Math.min(totalDuration, effectiveStartSec + (m.endBar * barDuration));

        songSections.push({
            id: `sec-${i}`,
            name: m.type,
            cueKey: m.cueKey,
            color: m.color,
            startTime: startTime,
            endTime: endTime,
            startBar: m.startBar,
            endBar: m.endBar
        });
    }

    renderSectionMarkers();
}

// Fallback de estructura para recalcular si el usuario cambia el BPM manualmente
function detectSongSections(bpm, offsetSec, totalDuration) {
    if (!duration || duration <= 0) return;
    detectSongSectionsDynamic(bpm, offsetSec, totalDuration, cachedDecodedStemBuffers);
}

function renderSectionMarkers() {
    if (!sectionMarkersBar) return;
    sectionMarkersBar.innerHTML = "";

    songSections.forEach((sec, idx) => {
        const startFormatted = formatTime(sec.startTime);
        const badge = document.createElement("button");
        badge.type = "button";
        badge.id = `marker-${sec.id}`;
        badge.className = "section-badge px-3 py-1 rounded-xl text-[10px] font-mono font-black uppercase tracking-wider text-white border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 flex items-center gap-1.5 shadow-md cursor-pointer";
        badge.style.borderLeft = `3px solid ${sec.color}`;
        badge.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${sec.color};"></span>
            <span>${sec.name}</span>
            <span class="text-zinc-500 font-normal">(${startFormatted})</span>
        `;

        badge.addEventListener("click", () => {
            seekToTime(sec.startTime);
        });

        sectionMarkersBar.appendChild(badge);
    });
}

function updateActiveSectionBadge(currentTime) {
    if (!songSections || songSections.length === 0) return;

    let currentSec = null;
    for (const sec of songSections) {
        if (currentTime >= sec.startTime && currentTime < sec.endTime) {
            currentSec = sec;
            break;
        }
    }

    if (currentSec && currentSec.id !== activeSectionId) {
        activeSectionId = currentSec.id;
        document.querySelectorAll(".section-badge").forEach(b => {
            b.classList.remove("active-section", "bg-zinc-800");
        });
        const activeBadge = document.getElementById(`marker-${currentSec.id}`);
        if (activeBadge) {
            activeBadge.classList.add("active-section", "bg-zinc-800");
        }
    }
}

// --- Generador de Guías Vocales con Banco de Samples de Estudio Sincronizado 1 Compás Antes ---
async function generateGuideTrack(lang = "es", preRollBars = 1, leadInSec = 0) {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
    }

    if (!songSections || songSections.length === 0) {
        detectSongSections(currentBpm, currentOffsetSec, duration);
    }

    const origBtnText = generateGuideBtn ? generateGuideBtn.innerHTML : "";
    if (generateGuideBtn) {
        generateGuideBtn.disabled = true;
        generateGuideBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 animate-spin fill-current" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            SINTETIZANDO GUÍA CON SAMPLES...
        `;
    }

    try {
        const sampleRate = audioCtx.sampleRate || 44100;
        const totalSamples = Math.floor(duration * sampleRate);
        const guideBuffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
        const left = guideBuffer.getChannelData(0);
        const right = guideBuffer.getChannelData(1);

        const beatInterval = 60 / currentBpm;
        const beatsPerBar = (currentTimeSignature === "3/4") ? 3 : (currentTimeSignature === "6/8" ? 6 : 4);
        const barDuration = beatInterval * beatsPerBar;

        // Pre-cargar conteos "1", "2", "3", "4"
        const countSamples = [
            null,
            await getCueAudioBuffer("1"),
            await getCueAudioBuffer("2"),
            await getCueAudioBuffer("3"),
            await getCueAudioBuffer("4")
        ];

        // 1. Conteo Inicial en el Pre-Roll (de 0:00 a leadInSec):
        if (leadInSec > 0 || preRollBars >= 1) {
            const introCue = await getCueAudioBuffer("intro");
            if (introCue) {
                insertAudioBufferToChannel(left, right, introCue, 0);
            }
            if (beatsPerBar === 4) {
                for (let b = 2; b <= 4; b++) {
                    const countTime = (b - 1) * beatInterval;
                    if (countTime < duration && countSamples[b]) {
                        insertAudioBufferToChannel(left, right, countSamples[b], Math.floor(countTime * sampleRate));
                    }
                }
            } else if (beatsPerBar === 3) {
                for (let b = 2; b <= 3; b++) {
                    const countTime = (b - 1) * beatInterval;
                    if (countTime < duration && countSamples[b]) {
                        insertAudioBufferToChannel(left, right, countSamples[b], Math.floor(countTime * sampleRate));
                    }
                }
            }
        }

        // 2. Insertar avisos vocales 1 compás antes de cada sección subsiguiente
        for (let s = 0; s < songSections.length; s++) {
            const sec = songSections[s];
            if (s === 0 && (leadInSec > 0 || sec.startBar === 0)) {
                // La Intro ya fue cantada en el conteo previo inicial
                continue;
            }

            const sectionTargetTime = sec.startTime;
            const preMeasureTime = sectionTargetTime - barDuration;

            let sampleCue = await getCueAudioBuffer(sec.cueKey || "verso");
            if (!sampleCue) sampleCue = await getCueAudioBuffer("verso");

            if (preMeasureTime >= 0) {
                if (beatsPerBar === 4) {
                    // 4/4: Beat 1 = Sección, Beat 2 = Silencio (respiración), Beat 3 = "3", Beat 4 = "4"
                    if (sampleCue) {
                        insertAudioBufferToChannel(left, right, sampleCue, Math.floor(preMeasureTime * sampleRate));
                    }
                    if (countSamples[3]) {
                        insertAudioBufferToChannel(left, right, countSamples[3], Math.floor((preMeasureTime + 2 * beatInterval) * sampleRate));
                    }
                    if (countSamples[4]) {
                        insertAudioBufferToChannel(left, right, countSamples[4], Math.floor((preMeasureTime + 3 * beatInterval) * sampleRate));
                    }
                } else if (beatsPerBar === 3) {
                    // 3/4: Beat 1 = Sección, Beat 2 = "2", Beat 3 = "3"
                    if (sampleCue) {
                        insertAudioBufferToChannel(left, right, sampleCue, Math.floor(preMeasureTime * sampleRate));
                    }
                    if (countSamples[2]) {
                        insertAudioBufferToChannel(left, right, countSamples[2], Math.floor((preMeasureTime + 1 * beatInterval) * sampleRate));
                    }
                    if (countSamples[3]) {
                        insertAudioBufferToChannel(left, right, countSamples[3], Math.floor((preMeasureTime + 2 * beatInterval) * sampleRate));
                    }
                } else {
                    // 6/8: Beat 1 = Sección, Beat 4 = "4"
                    if (sampleCue) {
                        insertAudioBufferToChannel(left, right, sampleCue, Math.floor(preMeasureTime * sampleRate));
                    }
                    if (countSamples[4]) {
                        insertAudioBufferToChannel(left, right, countSamples[4], Math.floor((preMeasureTime + 3 * beatInterval) * sampleRate));
                    }
                }
            }
        }

        const wavBlob = bufferToWav(guideBuffer);
        const blobUrl = URL.createObjectURL(wavBlob);

        if (tracks.guide) {
            tracks.guide.audio.src = blobUrl;
            tracks.guide.audio.load();
            tracks.guide.blobUrl = blobUrl;
            tracks.guide.sizeBytes = wavBlob.size;
            tracks.guide.volume = 0.85;
            tracks.guide.audioBuffer = guideBuffer;

            const dlLink = document.getElementById("download-guide");
            if (dlLink) dlLink.href = blobUrl;
        } else {
            const audio = new Audio(blobUrl);
            audio.preload = "auto";
            audio.crossOrigin = "anonymous";

            tracks.guide = {
                audio: audio,
                gainNode: null,
                analyser: null,
                volume: 0.85,
                isMuted: false,
                isSoloed: false,
                blobUrl: blobUrl,
                sizeBytes: wavBlob.size,
                audioBuffer: guideBuffer,
                extension: "wav"
            };

            createTrackUI("guide");
            createTimelineTrackUI("guide");
            createResultUI("guide");
        }

        setupSingleTrackAudioNode("guide");
        updateTrackGains();

        if (activeView === "timeline" && typeof renderAllWaveforms === "function") {
            renderAllWaveforms();
        }

    } catch (err) {
        console.error("Error al sintetizar pista guía con samples:", err);
    } finally {
        if (generateGuideBtn) {
            generateGuideBtn.disabled = false;
            generateGuideBtn.innerHTML = origBtnText;
        }
    }
}

function insertAudioBufferToChannel(leftTarget, rightTarget, sourceBuffer, startSample) {
    const srcLeft = sourceBuffer.getChannelData(0);
    const srcRight = (sourceBuffer.numberOfChannels > 1) ? sourceBuffer.getChannelData(1) : srcLeft;
    const len = srcLeft.length;

    for (let i = 0; i < len; i++) {
        const idx = startSample + i;
        if (idx < leftTarget.length) {
            leftTarget[idx] += srcLeft[i] * 0.9;
            rightTarget[idx] += srcRight[i] * 0.9;
        }
    }
}

function insertAudioClip(left, right, clip, startSample) {
    for (let i = 0; i < clip.length; i++) {
        const idx = startSample + i;
        if (idx < left.length) {
            left[idx] += clip[i];
            right[idx] += clip[i];
        }
    }
}

function updateTrackDisplayName(id, name) {
    const trackElem = document.querySelector(`.channel-${id} span.font-black`);
    if (trackElem) trackElem.textContent = name;
}

// --- Generar UI de Canal (Vertical Console Strip) ---
function createTrackUI(id) {
    const config = STEMS_CONFIG[id] || { name: id, icon: "tune" };
    let displayName = config.name.toUpperCase();
    
    if (id === "metronome" && tracks.metronome && tracks.metronome.bpm) {
        displayName += ` (${tracks.metronome.bpm.toFixed(1)} BPM)`;
    }

    const trackHtml = `
        <div class="channel-strip channel-${id} bg-zinc-900/35 border border-zinc-800/80 rounded-2xl p-4 flex flex-col items-center gap-4 w-full text-center relative hover:border-red-500/40 hover:bg-zinc-900/60 transition-all duration-300 shadow-xl" data-track-id="${id}">
            <!-- Header -->
            <div class="flex flex-col items-center gap-1 group-hover:text-red-500 transition-colors">
                <div class="text-2xl text-zinc-400 flex items-center justify-center">${ICONS_SVG[config.icon] || ICONS_SVG.tune}</div>
                <span class="text-[10px] font-black uppercase tracking-widest text-zinc-300 truncate w-full">${displayName}</span>
            </div>
            
            <!-- Meter and Fader Row -->
            <div class="flex items-center justify-center gap-6 h-56 relative w-full my-2">
                <!-- Vertical LED VU Meter -->
                <div class="w-3.5 h-44 bg-zinc-950 rounded-full overflow-hidden relative border border-zinc-800/50 flex flex-col justify-end">
                    <canvas class="w-full h-full meter-canvas" id="canvas-${id}" width="14" height="176"></canvas>
                </div>
                
                <!-- Vertical Fader Container -->
                <div class="fader-container">
                    <input class="fader-slider" id="fader-${id}" max="100" min="0" type="range" value="${(tracks[id] ? tracks[id].volume : 0.8) * 100}"/>
                </div>
            </div>
            
            <!-- Controls (Mute / Solo) -->
            <div class="flex gap-2 w-full mt-2">
                <button id="mute-${id}" class="flex-1 py-2 px-1 bg-zinc-950 border border-zinc-800 text-[10px] font-black tracking-widest text-zinc-400 hover:text-white rounded-lg hover:border-red-500/30 transition-all duration-200">MUTE</button>
                <button id="solo-${id}" class="flex-1 py-2 px-1 bg-zinc-950 border border-zinc-800 text-[10px] font-black tracking-widest text-zinc-400 hover:text-white rounded-lg hover:border-yellow-500/30 transition-all duration-200">SOLO</button>
            </div>
        </div>
    `;
    trackList.insertAdjacentHTML("beforeend", trackHtml);

    const slider = document.getElementById(`fader-${id}`);
    if (slider) {
        slider.addEventListener("input", (e) => {
            setTrackVolume(id, parseInt(e.target.value) / 100);
        });
    }

    const muteBtn = document.getElementById(`mute-${id}`);
    if (muteBtn) {
        muteBtn.addEventListener("click", () => {
            toggleMute(id);
        });
    }

    const soloBtn = document.getElementById(`solo-${id}`);
    if (soloBtn) {
        soloBtn.addEventListener("click", () => {
            toggleSolo(id);
        });
    }
}

// --- Generar UI de Resultados (Export Panel List) ---
function createResultUI(id) {
    const config = STEMS_CONFIG[id] || { name: id, icon: "tune" };
    const sizeBytes = tracks[id] ? tracks[id].sizeBytes : 0;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const resultName = config.name;
    const ext = (tracks[id] && tracks[id].extension) || "mp3";

    const resultHtml = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 py-3 hover:bg-zinc-900/40 transition-colors gap-3" data-track-id="${id}">
            <div class="flex items-center gap-3">
                <div class="text-red-500 text-lg flex items-center justify-center">${ICONS_SVG[config.icon] || ICONS_SVG.tune}</div>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-white uppercase">${resultName} (${id}.${ext})</span>
                    <span class="text-[10px] text-zinc-500 font-mono">${sizeMB} MB</span>
                </div>
            </div>
            <div class="flex gap-2 w-full sm:w-auto">
                <a id="download-${id}" href="${tracks[id] ? tracks[id].blobUrl : '#'}" download="${id}.${ext}" class="flex-1 sm:flex-none px-4 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    ${ICONS_SVG.download} Descargar
                </a>
            </div>
        </div>
    `;
    resultsList.insertAdjacentHTML("beforeend", resultHtml);
}

// --- Configurar Nodos de Audio en Web Audio API ---
function setupAudioNodes() {
    for (const [id, track] of Object.entries(tracks)) {
        setupSingleTrackAudioNode(id);
    }
}

function setupSingleTrackAudioNode(id) {
    const track = tracks[id];
    if (!track || !audioCtx) return;

    if (!track.gainNode) {
        track.gainNode = audioCtx.createGain();
        track.analyser = audioCtx.createAnalyser();
        track.analyser.fftSize = 64; 
        
        track.gainNode.gain.setValueAtTime(track.volume, audioCtx.currentTime);
        
        const sourceNode = audioCtx.createMediaElementSource(track.audio);
        sourceNode.connect(track.gainNode);
        track.gainNode.connect(track.analyser);
        
        // Conectar a través del compresor limitador maestro
        if (masterCompressor) {
            track.analyser.connect(masterCompressor);
        } else {
            track.analyser.connect(audioCtx.destination);
        }
    }

    const canvas = document.getElementById(`canvas-${id}`);
    if (canvas) {
        track.canvas = canvas;
        track.ctx = canvas.getContext("2d");
        const bufferLength = track.analyser.frequencyBinCount;
        track.dataArray = new Uint8Array(bufferLength);
        
        const height = canvas.height;
        const gradient = track.ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "#ef4444");
        gradient.addColorStop(0.5, "#dc2626");
        gradient.addColorStop(0.8, "#f87171");
        gradient.addColorStop(0.95, "#ffffff");
        track.gradient = gradient;
    }
}

// --- Actualizar Volumen ---
function setTrackVolume(id, volume) {
    if (tracks[id]) {
        tracks[id].volume = volume;
        updateTrackGains();
        
        const mixerSlider = document.getElementById(`fader-${id}`);
        const timelineSlider = document.getElementById(`fader-timeline-${id}`);
        const pctVal = Math.round(volume * 100);
        if (mixerSlider && mixerSlider.value != pctVal) mixerSlider.value = pctVal;
        if (timelineSlider && timelineSlider.value != pctVal) timelineSlider.value = pctVal;
    }
}

// --- Lógica de Fader, Mute y Solo ---
function toggleMute(id) {
    if (!tracks[id]) return;
    tracks[id].isMuted = !tracks[id].isMuted;
    
    const muteBtn = document.getElementById(`mute-${id}`);
    const muteTimelineBtn = document.getElementById(`mute-timeline-${id}`);
    
    const setMuteStyle = (btn) => {
        if (!btn) return;
        if (tracks[id].isMuted) {
            btn.classList.add("bg-red-600", "text-white", "border-red-500");
            btn.classList.remove("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        } else {
            btn.classList.remove("bg-red-600", "text-white", "border-red-500");
            btn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        }
    };
    setMuteStyle(muteBtn);
    setMuteStyle(muteTimelineBtn);
    
    updateTrackGains();
}

function toggleSolo(id) {
    if (!tracks[id]) return;
    tracks[id].isSoloed = !tracks[id].isSoloed;
    
    const soloBtn = document.getElementById(`solo-${id}`);
    const soloTimelineBtn = document.getElementById(`solo-timeline-${id}`);
    
    const setSoloStyle = (btn) => {
        if (!btn) return;
        if (tracks[id].isSoloed) {
            btn.classList.add("bg-yellow-600", "text-white", "border-yellow-500");
            btn.classList.remove("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        } else {
            btn.classList.remove("bg-yellow-600", "text-white", "border-yellow-500");
            btn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        }
    };
    setSoloStyle(soloBtn);
    setSoloStyle(soloTimelineBtn);
    
    updateTrackGains();
}

// --- Calcular Ganancias en base a Fader + Mute + Solo ---
function updateTrackGains() {
    if (!audioCtx) return;
    const anySoloed = Object.values(tracks).some(t => t.isSoloed);

    for (const [id, track] of Object.entries(tracks)) {
        if (!track.gainNode) continue;
        let targetGain = 0;

        if (currentPreviewTrack) {
            targetGain = (id === currentPreviewTrack) ? track.volume : 0;
        } else {
            if (track.isMuted) {
                targetGain = 0;
            } else if (anySoloed) {
                targetGain = track.isSoloed ? track.volume : 0;
            } else {
                targetGain = track.volume;
            }
        }
        track.gainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.02);
    }
}

// --- Control de Reproducción Sincronizada ---
function playTracks() {
    if (isPlaying) return;

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.currentTime = playOffset;
        }
    }

    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.play().catch(e => console.error("Error al reproducir stem:", e));
        }
    }

    isPlaying = true;
    updateTrackGains();
    updateMasterPlayBtn();

    const firstTrack = Object.keys(tracks)[0];
    if (tracks[firstTrack] && tracks[firstTrack].audio) {
        tracks[firstTrack].audio.onended = () => {
            const currentPos = tracks[firstTrack].audio.currentTime;
            if (currentPos >= duration - 0.5) {
                pauseTracks(true);
            }
        };
    }
}

function pauseTracks(resetToZero = false) {
    if (!isPlaying) {
        if (resetToZero) {
            playOffset = 0;
            for (const track of Object.values(tracks)) {
                if (track.audio) track.audio.currentTime = 0;
            }
        }
        return;
    }

    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.pause();
        }
    }

    const firstTrack = Object.keys(tracks)[0];
    if (resetToZero) {
        playOffset = 0;
        for (const track of Object.values(tracks)) {
            if (track.audio) track.audio.currentTime = 0;
        }
    } else if (tracks[firstTrack] && tracks[firstTrack].audio) {
        playOffset = tracks[firstTrack].audio.currentTime;
        if (playOffset > duration) playOffset = duration;
    }

    isPlaying = false;
    currentPreviewTrack = null;
    updateMasterPlayBtn();
}

function seekToTime(newTime) {
    if (!duration) return;
    newTime = Math.max(0, Math.min(duration, newTime));
    playOffset = newTime;

    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.currentTime = newTime;
        }
    }

    if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(newTime);
    if (masterSeekbar) masterSeekbar.value = (newTime / duration) * 100;
}

function updateMasterPlayBtn() {
    if (isPlaying && !currentPreviewTrack) {
        masterPlayBtn.innerHTML = `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> PAUSAR`;
        masterPlayBtn.classList.add("bg-zinc-800");
        masterPlayBtn.classList.remove("bg-red-600");
    } else {
        masterPlayBtn.innerHTML = `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> REPRODUCIR`;
        masterPlayBtn.classList.add("bg-red-600");
        masterPlayBtn.classList.remove("bg-zinc-800");
    }
}

// --- Controles de Mezclador Maestro ---
masterPlayBtn.addEventListener("click", () => {
    if (isPlaying) {
        if (currentPreviewTrack !== null) {
            currentPreviewTrack = null;
            updateTrackGains();
        } else {
            pauseTracks();
        }
    } else {
        currentPreviewTrack = null;
        playTracks();
    }
});

resetMixerBtn.addEventListener("click", () => {
    for (const id of Object.keys(tracks)) {
        const defaultVol = (id === "metronome") ? 0.0 : 0.8;
        setTrackVolume(id, defaultVol);
        
        tracks[id].isMuted = false;
        tracks[id].isSoloed = false;

        const muteBtn = document.getElementById(`mute-${id}`);
        if (muteBtn) {
            muteBtn.classList.remove("bg-red-600", "text-white", "border-red-500");
            muteBtn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        }

        const soloBtn = document.getElementById(`solo-${id}`);
        if (soloBtn) {
            soloBtn.classList.remove("bg-yellow-600", "text-white", "border-yellow-500");
            soloBtn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        }

        const muteTimelineBtn = document.getElementById(`mute-timeline-${id}`);
        if (muteTimelineBtn) {
            muteTimelineBtn.classList.remove("bg-red-600", "text-white", "border-red-500");
            muteTimelineBtn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        }

        const soloTimelineBtn = document.getElementById(`solo-timeline-${id}`);
        if (soloTimelineBtn) {
            soloTimelineBtn.classList.remove("bg-yellow-600", "text-white", "border-yellow-500");
            soloTimelineBtn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
        }
    }
    updateTrackGains();
});

downloadZipBtn.addEventListener("click", async () => {
    if (!zipBlob) return;
    const nameWithoutExt = (fileMeta.textContent || "AuraSplit").replace(/^.*\:\s*/, "").replace(/\.[^/.]+$/, "").trim();
    
    // Si existen pistas de metrónomo o voz guía generadas, empaquetarlas en el ZIP
    let finalZipBlob = zipBlob;
    if ((tracks.metronome && tracks.metronome.blobUrl) || (tracks.guide && tracks.guide.blobUrl)) {
        try {
            const zip = await JSZip.loadAsync(zipBlob);
            if (tracks.metronome && tracks.metronome.blobUrl) {
                const metRes = await fetch(tracks.metronome.blobUrl);
                const metBlob = await metRes.blob();
                zip.file("metronomo.wav", metBlob);
            }
            if (tracks.guide && tracks.guide.blobUrl) {
                const guideRes = await fetch(tracks.guide.blobUrl);
                const guideBlob = await guideRes.blob();
                zip.file("guia.wav", guideBlob);
            }
            finalZipBlob = await zip.generateAsync({ type: "blob" });
        } catch (errZip) {
            console.warn("Error agregando metrónomo/guía al ZIP:", errZip);
        }
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(finalZipBlob);
    link.download = `separated_${nameWithoutExt}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Renderizado del Espectro (Vúmetros en Tiempo Real) ---
function drawMeters() {
    if (!isPlaying) {
        for (const id of Object.keys(tracks)) {
            clearMeter(id);
        }
        animationFrameId = requestAnimationFrame(drawMeters);
        return;
    }

    const firstTrack = Object.keys(tracks)[0];
    if (firstTrack && tracks[firstTrack].audio) {
        const currentPos = tracks[firstTrack].audio.currentTime;
        playOffset = currentPos;
        
        if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(currentPos);
        if (totalTimeDisplay && duration) totalTimeDisplay.textContent = formatTime(duration);
        if (masterSeekbar && duration) masterSeekbar.value = (currentPos / duration) * 100;

        // Actualizar badge de sección activa en la línea de tiempo
        updateActiveSectionBadge(currentPos);

        if (currentPos >= duration - 0.05 && duration > 0) {
            pauseTracks();
            playOffset = 0;
            for (const t of Object.values(tracks)) {
                if (t.audio) t.audio.currentTime = 0;
            }
            updateMasterPlayBtn();
        }
    }

    for (const [id, track] of Object.entries(tracks)) {
        const canvas = track.canvas;
        const ctx = track.ctx;
        if (canvas && ctx && track.analyser) {
            const analyser = track.analyser;
            const dataArray = track.dataArray;
            analyser.getByteFrequencyData(dataArray);

            const width = canvas.width;
            const height = canvas.height;
            
            ctx.clearRect(0, 0, width, height);

            let sum = 0;
            const bufferLength = dataArray.length;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const fillPercent = Math.min(1.0, (average / 200) * 1.25); 

            ctx.fillStyle = "#09090b";
            ctx.fillRect(0, 0, width, height);

            if (fillPercent > 0) {
                const gain = track.gainNode ? track.gainNode.gain.value : 1.0;
                const fillHeight = height * fillPercent * Math.min(gain, 1.2);
                ctx.fillStyle = track.gradient;
                ctx.fillRect(0, height - fillHeight, width, fillHeight);
            }

            ctx.strokeStyle = "#121214"; 
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let y = 0; y < height; y += 4) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
        }

        // Dibujar aguja de reproducción (playhead) en la línea de tiempo
        const timelineCanvas = document.getElementById(`canvas-timeline-${id}`);
        if (timelineCanvas && timelineCanvas.waveformImage) {
            const tCtx = timelineCanvas.getContext("2d");
            const w = timelineCanvas.width;
            const h = timelineCanvas.height;
            
            tCtx.putImageData(timelineCanvas.waveformImage, 0, 0);
            
            const playPercent = playOffset / duration;
            const cursorX = w * playPercent;
            
            tCtx.strokeStyle = "#ffffff";
            tCtx.lineWidth = 1.5;
            tCtx.shadowColor = "#ef4444";
            tCtx.shadowBlur = 4;
            tCtx.beginPath();
            tCtx.moveTo(cursorX, 0);
            tCtx.lineTo(cursorX, h);
            tCtx.stroke();
            tCtx.shadowBlur = 0;
        }
    }

    animationFrameId = requestAnimationFrame(drawMeters);
}

function clearMeter(id) {
    const track = tracks[id];
    if (!track) return;
    const canvas = track.canvas;
    const ctx = track.ctx;
    if (canvas && ctx) {
        const width = canvas.width;
        const height = canvas.height;
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = "#121214";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let y = 0; y < height; y += 4) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
    }

    const timelineCanvas = document.getElementById(`canvas-timeline-${id}`);
    if (timelineCanvas && timelineCanvas.waveformImage) {
        const tCtx = timelineCanvas.getContext("2d");
        tCtx.putImageData(timelineCanvas.waveformImage, 0, 0);
    }
}

// --- Evento de Descarga de Mezcla Personalizada ---
downloadMixBtn.addEventListener("click", async () => {
    if (!tracks || Object.keys(tracks).length === 0) return;
    
    const originalText = downloadMixBtn.innerHTML;
    downloadMixBtn.disabled = true;
    downloadMixBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin fill-current" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle; margin-right:6px;">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> MEZCLANDO...
    `;
    
    try {
        const anySoloed = Object.values(tracks).some(t => t.isSoloed);
        const tracksToMix = [];
        
        for (const [id, track] of Object.entries(tracks)) {
            let volume = 0;
            if (currentPreviewTrack) {
                volume = (id === currentPreviewTrack) ? track.volume : 0;
            } else {
                if (track.isMuted) {
                    volume = 0;
                } else if (anySoloed) {
                    volume = track.isSoloed ? track.volume : 0;
                } else {
                    volume = track.volume;
                }
            }
            if (volume > 0) {
                tracksToMix.push({ id, track, volume });
            }
        }
        
        if (tracksToMix.length === 0) {
            alert("No hay ningún canal activo para mezclar.");
            downloadMixBtn.disabled = false;
            downloadMixBtn.innerHTML = originalText;
            return;
        }
        
        const sampleRate = audioCtx.sampleRate || 44100;
        const length = Math.ceil(duration * sampleRate);
        const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
        
        const decodePromises = tracksToMix.map(async ({ id, track, volume }) => {
            const response = await fetch(track.blobUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            
            const gainNode = offlineCtx.createGain();
            gainNode.gain.setValueAtTime(volume, 0);
            
            source.connect(gainNode);
            gainNode.connect(offlineCtx.destination);
            source.start(0);
        });
        
        await Promise.all(decodePromises);
        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = bufferToWav(renderedBuffer);
        
        const nameWithoutExt = fileMeta.textContent.replace(/\.[^/.]+$/, "");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(wavBlob);
        link.download = `mezcla_${nameWithoutExt}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (err) {
        console.error("Error al exportar la mezcla:", err);
        alert("Error al generar la descarga de la mezcla: " + err.message);
    } finally {
        downloadMixBtn.disabled = false;
        downloadMixBtn.innerHTML = originalText;
    }
});

// Codificación AudioBuffer a WAV PCM 16 bits
function bufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length),
        view = new DataView(bufferArr),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // longitud chunk (16)
    setUint16(1);                                  // formato PCM (1)
    setUint16(numOfChan);                          // número de canales
    setUint32(buffer.sampleRate);                  // frecuencia muestreo
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2);                      // block align
    setUint16(16);                                 // bits por muestra (16)

    setUint32(0x61746164);                         // "data" chunk
    setUint32(length - pos - 4);                   // longitud datos

    for(i=0; i<buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while(pos < length) {
        for(i=0; i<numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([bufferArr], {type: "audio/wav"});

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

// --- Evento de Retroceso Maestro ---
masterRewindBtn.addEventListener("click", () => {
    seekToTime(0);
});

// Prevenir salida accidental
window.addEventListener("beforeunload", (e) => {
    const isProcessing = processing && !processing.classList.contains("hidden");
    const hasLoadedFiles = zipBlob !== null || Object.keys(tracks).length > 0;
    
    if (isProcessing || hasLoadedFiles) {
        e.preventDefault();
        e.returnValue = "Si cierras o recargas la página, se perderá tu mezcla actual y el progreso.";
        return e.returnValue;
    }
});

// --- Algoritmo de Detección de Transitorios de Batería ---
function getBeats(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const data = audioBuffer.getChannelData(0);
    const hopSize = 1024;
    const numFrames = Math.floor(data.length / hopSize);
    const energy = new Float32Array(numFrames);
    
    for (let f = 0; f < numFrames; f++) {
        let sum = 0;
        const start = f * hopSize;
        const end = Math.min(start + hopSize, data.length);
        const length = end - start;
        if (length <= 0) continue;
        for (let i = start; i < end; i++) {
            sum += data[i] * data[i];
        }
        energy[f] = Math.sqrt(sum / length);
    }
    
    const flux = new Float32Array(numFrames);
    for (let f = 1; f < numFrames; f++) {
        flux[f] = Math.max(0, energy[f] - energy[f-1]);
    }
    
    const rawBeats = [];
    const minDistanceSec = 0.22;
    const windowSize = 15;
    
    for (let f = 2; f < numFrames - 2; f++) {
        if (flux[f] < flux[f-1] || flux[f] < flux[f-2] || flux[f] < flux[f+1] || flux[f] < flux[f+2]) {
            continue;
        }
        
        let localSum = 0;
        let count = 0;
        for (let d = -windowSize; d <= windowSize; d++) {
            const idx = f + d;
            if (idx >= 0 && idx < numFrames) {
                localSum += flux[idx];
                count++;
            }
        }
        const localMean = localSum / count;
        const threshold = localMean * 1.45 + 0.002;
        
        if (flux[f] > threshold) {
            const time = (f * hopSize) / sampleRate;
            if (rawBeats.length === 0 || (time - rawBeats[rawBeats.length - 1]) >= minDistanceSec) {
                rawBeats.push(time);
            }
        }
    }
    
    if (rawBeats.length < 5) {
        return { beats: rawBeats, bpm: 120 };
    }
    
    const T_estimated = estimateBeatInterval(rawBeats);
    const estimatedBpm = Math.round((60 / T_estimated) * 10) / 10;
    
    return { beats: rawBeats, bpm: estimatedBpm };
}

function estimateBeatInterval(rawBeats) {
    const diffs = [];
    for (let i = 1; i < rawBeats.length; i++) {
        const d = rawBeats[i] - rawBeats[i - 1];
        if (d > 0.15 && d < 2.0) diffs.push(d);
        if (i > 1) {
            const d2 = rawBeats[i] - rawBeats[i - 2];
            if (d2 > 0.15 && d2 < 2.0) diffs.push(d2);
        }
    }
    if (diffs.length === 0) return 0.5;
    
    let bestInterval = 0.5;
    let maxScore = -1;
    
    for (let bpm = 60; bpm <= 200; bpm += 1) {
        const T = 60 / bpm;
        let score = 0;
        for (const d of diffs) {
            const ratio = d / T;
            const roundRatio = Math.round(ratio);
            if (roundRatio >= 1 && roundRatio <= 4) {
                const error = Math.abs(ratio - roundRatio);
                if (error < 0.15) {
                    score += (1 - error / 0.15) / roundRatio;
                }
            }
        }
        const bpmBias = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.6, 2));
        const finalScore = score * bpmBias;
        
        if (finalScore > maxScore) {
            maxScore = finalScore;
            bestInterval = T;
        }
    }
    return bestInterval;
}

let cachedDecodedStemBuffers = {};

// Helper para sincronizar click, secciones y guía vocal al ajustar controles
function syncClickAndGuide() {
    const beatsPerBar = (currentTimeSignature === "3/4") ? 3 : (currentTimeSignature === "6/8" ? 6 : 4);
    const barDuration = (60 / currentBpm) * beatsPerBar;
    const leadInSec = (userConfiguredPreRoll >= 1) ? (barDuration * userConfiguredPreRoll) : 0;

    generateMetronomeTrack(currentBpm, currentOffsetSec, duration);
    detectSongSectionsDynamic(currentBpm, currentOffsetSec, duration, cachedDecodedStemBuffers, leadInSec);
    if (tracks.guide) {
        const lang = guideLangSelect ? guideLangSelect.value : "es";
        generateGuideTrack(lang, userConfiguredPreRoll, leadInSec);
    }
}

// --- Listeners de Controles Musicales (BPM, Tap Tempo, Offset, Guías) ---
if (bpmInput) {
    bpmInput.addEventListener("change", () => {
        const val = parseFloat(bpmInput.value);
        if (!isNaN(val) && val >= 40 && val <= 260) {
            currentBpm = val;
            syncClickAndGuide();
        }
    });
}

if (tapTempoBtn) {
    tapTempoBtn.addEventListener("click", () => {
        const now = performance.now();
        tapTimes.push(now);
        if (tapTimes.length > 5) tapTimes.shift();

        if (tapTimes.length >= 2) {
            let diffs = [];
            for (let i = 1; i < tapTimes.length; i++) {
                const d = (tapTimes[i] - tapTimes[i - 1]) / 1000;
                if (d < 2.0 && d > 0.2) diffs.push(d);
            }
            if (diffs.length > 0) {
                const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
                const calcBpm = Math.round((60 / avgDiff) * 10) / 10;
                currentBpm = Math.max(40, Math.min(260, calcBpm));
                if (bpmInput) bpmInput.value = currentBpm.toFixed(1);
                syncClickAndGuide();
            }
        }
    });
}

if (nudgeLeftBtn) {
    nudgeLeftBtn.addEventListener("click", () => {
        currentOffsetSec = Math.max(0, currentOffsetSec - 0.010);
        syncClickAndGuide();
    });
}

if (nudgeRightBtn) {
    nudgeRightBtn.addEventListener("click", () => {
        currentOffsetSec += 0.010;
        syncClickAndGuide();
    });
}

if (syncCursorBtn) {
    syncCursorBtn.addEventListener("click", () => {
        const beatInterval = 60 / currentBpm;
        currentOffsetSec = playOffset % beatInterval;
        syncClickAndGuide();
    });
}

if (regenerateClickBtn) {
    regenerateClickBtn.addEventListener("click", () => {
        syncClickAndGuide();
    });
}

if (reanalyzeSectionsBtn) {
    reanalyzeSectionsBtn.addEventListener("click", () => {
        detectSongSections(currentBpm, currentOffsetSec, duration);
        if (tracks.guide) {
            const lang = guideLangSelect ? guideLangSelect.value : "es";
            generateGuideTrack(lang, userConfiguredPreRoll);
        }
    });
}

if (generateGuideBtn) {
    generateGuideBtn.addEventListener("click", () => {
        const lang = guideLangSelect ? guideLangSelect.value : "es";
        generateGuideTrack(lang, userConfiguredPreRoll);
    });
}

// Botones de Inicio / Cancelación
if (startProcessBtn) {
    startProcessBtn.addEventListener("click", () => {
        if (selectedFile) uploadAndSeparate(selectedFile);
    });
}

if (cancelProcessBtn) {
    cancelProcessBtn.addEventListener("click", () => {
        resetToUploadState();
    });
}

if (newSeparationBtn) {
    newSeparationBtn.addEventListener("click", () => {
        resetAudio();
    });
}

// --- Soporte de Línea de Tiempo y Audio Waveform (DAW) ---
function formatTime(secs) {
    if (isNaN(secs) || secs === Infinity) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createTimelineTrackUI(id) {
    const config = STEMS_CONFIG[id] || { name: id, icon: "tune" };
    let displayName = config.name.toUpperCase();
    
    if (id === "metronome" && tracks.metronome && tracks.metronome.bpm) {
        displayName += ` (${tracks.metronome.bpm.toFixed(1)} BPM)`;
    }

    const timelineHtml = `
        <div class="flex flex-col md:flex-row items-stretch md:items-center bg-zinc-900/35 border border-zinc-800/80 rounded-2xl p-4 gap-4 w-full shadow-lg hover:border-red-500/35 transition-all duration-300" data-track-id="${id}">
            <!-- 1. Track Info -->
            <div class="flex items-center gap-3 w-full md:w-44 shrink-0">
                <div class="text-red-500 text-xl flex items-center justify-center">${ICONS_SVG[config.icon] || ICONS_SVG.tune}</div>
                <span class="text-[10px] font-black uppercase tracking-widest text-zinc-300 truncate">${displayName}</span>
            </div>

            <!-- 2. Controls -->
            <div class="flex items-center gap-4 w-full md:w-60 shrink-0">
                <div class="flex gap-1">
                    <button id="mute-timeline-${id}" class="py-1.5 px-3 bg-zinc-950 border border-zinc-800 text-[9px] font-black tracking-widest text-zinc-400 hover:text-white rounded-lg transition-all">MUTE</button>
                    <button id="solo-timeline-${id}" class="py-1.5 px-3 bg-zinc-950 border border-zinc-800 text-[9px] font-black tracking-widest text-zinc-400 hover:text-white rounded-lg transition-all">SOLO</button>
                </div>
                <div class="flex-1 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-zinc-500 fill-current" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                    <input class="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer outline-none accent-red-500" id="fader-timeline-${id}" max="100" min="0" type="range" value="${(tracks[id] ? tracks[id].volume : 0.8) * 100}"/>
                </div>
            </div>

            <!-- 3. Waveform Timeline Canvas -->
            <div class="flex-1 bg-zinc-950/80 rounded-xl border border-zinc-900/60 h-16 relative overflow-hidden flex items-center">
                <canvas class="w-full h-full block" id="canvas-timeline-${id}" height="64" style="height: 64px; width: 100%;"></canvas>
            </div>
        </div>
    `;
    
    timelineTracksList.insertAdjacentHTML("beforeend", timelineHtml);

    const slider = document.getElementById(`fader-timeline-${id}`);
    if (slider) {
        slider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value) / 100;
            setTrackVolume(id, val);
        });
    }

    const muteBtn = document.getElementById(`mute-timeline-${id}`);
    if (muteBtn) {
        muteBtn.addEventListener("click", () => {
            toggleMute(id);
        });
    }

    const soloBtn = document.getElementById(`solo-timeline-${id}`);
    if (soloBtn) {
        soloBtn.addEventListener("click", () => {
            toggleSolo(id);
        });
    }

    const canvas = document.getElementById(`canvas-timeline-${id}`);
    if (canvas) {
        canvas.addEventListener("click", (e) => {
            if (!duration) return;
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = clickX / rect.width;
            seekToTime(clickPercent * duration);
        });
    }
}

function switchView(viewName) {
    activeView = viewName;
    if (viewName === "mixer") {
        if (trackList) trackList.classList.remove("hidden");
        if (timelineViewContainer) timelineViewContainer.classList.add("hidden");
        
        if (viewMixerBtn) {
            viewMixerBtn.classList.add("bg-zinc-900", "border-zinc-800", "text-white");
            viewMixerBtn.classList.remove("text-zinc-500");
        }
        if (viewTimelineBtn) {
            viewTimelineBtn.classList.remove("bg-zinc-900", "border-zinc-800", "text-white");
            viewTimelineBtn.classList.add("text-zinc-500");
        }
    } else {
        if (trackList) trackList.classList.add("hidden");
        if (timelineViewContainer) timelineViewContainer.classList.remove("hidden");
        
        if (viewTimelineBtn) {
            viewTimelineBtn.classList.add("bg-zinc-900", "border-zinc-800", "text-white");
            viewTimelineBtn.classList.remove("text-zinc-500");
        }
        if (viewMixerBtn) {
            viewMixerBtn.classList.remove("bg-zinc-900", "border-zinc-800", "text-white");
            viewMixerBtn.classList.add("text-zinc-500");
        }
        
        if (!waveformsRendered) {
            renderAllWaveforms();
        }
    }
}

async function renderAllWaveforms() {
    waveformsRendered = true;
    for (const [id, track] of Object.entries(tracks)) {
        const canvas = document.getElementById(`canvas-timeline-${id}`);
        if (!canvas) continue;
        
        const ctx = canvas.getContext("2d");
        const w = canvas.width = canvas.parentElement.clientWidth || 600;
        const h = canvas.height = 64;
        
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, w, h);
        ctx.font = "10px monospace";
        ctx.fillStyle = "#ef4444";
        ctx.fillText("DECODIFICANDO ONDA...", 20, 36);
        
        await drawWaveformFromBlob(id, track.blobUrl, canvas, ctx);
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

async function drawWaveformFromBlob(id, blobUrl, canvas, ctx) {
    const track = tracks[id];
    if (!track) return;

    if (track.audioBuffer) {
        drawWaveformFromBuffer(track.audioBuffer, canvas, ctx);
        return;
    }

    try {
        const res = await fetch(blobUrl);
        const arrayBuffer = await res.arrayBuffer();
        
        const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const tempCtx = new OfflineContextClass(1, 1, 44100);
        const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
        
        track.audioBuffer = audioBuffer;
        drawWaveformFromBuffer(audioBuffer, canvas, ctx);
    } catch (err) {
        console.error("Error al renderizar forma de onda:", err);
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#52525b";
        ctx.fillText("FORMA DE ONDA NO DISPONIBLE", 20, 36);
    }
}

function drawWaveformFromBuffer(audioBuffer, canvas, ctx) {
    const w = canvas.width;
    const h = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / w);
    const amp = h / 2;
    
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    ctx.lineTo(w, h/2);
    ctx.stroke();
    
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    const maxSamplesPerPixel = 100;
    const stride = Math.max(1, Math.floor(step / maxSamplesPerPixel));
    
    for (let i = 0; i < w; i++) {
        let min = 1.0;
        let max = -1.0;
        const start = i * step;
        const end = Math.min(start + step, data.length);
        
        for (let j = start; j < end; j += stride) {
            const val = data[j];
            if (val < min) min = val;
            if (val > max) max = val;
        }
        
        if (min === 1.0 && max === -1.0) {
            min = 0;
            max = 0;
        }
        
        ctx.moveTo(i, amp + min * amp * 0.85);
        ctx.lineTo(i, amp + max * amp * 0.85);
    }
    ctx.stroke();
    canvas.waveformImage = ctx.getImageData(0, 0, w, h);
}

// Bind seekbar input
if (masterSeekbar) {
    masterSeekbar.addEventListener("input", (e) => {
        if (!duration) return;
        const targetPercent = parseFloat(e.target.value) / 100;
        seekToTime(targetPercent * duration);
    });
}

// Bind View toggles
if (viewMixerBtn) {
    viewMixerBtn.addEventListener("click", () => {
        switchView("mixer");
    });
}

if (viewTimelineBtn) {
    viewTimelineBtn.addEventListener("click", () => {
        switchView("timeline");
    });
}

// --- Atajos de Teclado Profesionales para Músicos ---
window.addEventListener("keydown", (e) => {
    // Si el usuario está escribiendo en un input, ignorar atajos
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") {
        return;
    }

    if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) pauseTracks();
        else playTracks();
    } else if (e.code === "KeyR" || e.code === "Numpad0" || e.code === "Home") {
        e.preventDefault();
        seekToTime(0);
    } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekToTime(playOffset - 5);
    } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekToTime(playOffset + 5);
    }
});
