// URL de la API del Backend (Hugging Face Space de AuraSplit)
const BACKEND_URL = "https://zbrun0-aurasplit.hf.space"; 

// --- Estado Global del Reproductor ---
let audioCtx = null;
let tracks = {}; // Contendrá: audio, gainNode, analyser, volume, isMuted, isSoloed, blobUrl, sizeBytes
let isPlaying = false;
let startTime = 0;
let playOffset = 0; // Posición actual de reproducción en segundos
let duration = 0;   // Duración total de la canción en segundos
let zipBlob = null; // Almacenará el blob del archivo ZIP original para descarga total
let animationFrameId = null;
let currentPreviewTrack = null; // ID del canal que se está previsualizando individualmente
let progressInterval = null; // Intervalo para animar la barra de progreso mientras la IA procesa
let pollInterval = null; // Intervalo para consultar el estado del trabajo en la cola

// Configuración de los 6 Stems del modelo Demucs 6s
const STEMS_CONFIG = {
    vocals: { name: "voces", icon: "mic" },
    drums: { name: "batería", icon: "album" },
    bass: { name: "bajo", icon: "music_note" },
    guitar: { name: "guitarra", icon: "music_video" },
    piano: { name: "piano", icon: "piano" },
    other: { name: "otros", icon: "tune" }
};

// SVGs para los iconos correspondientes (sin clases de colores para heredar del contenedor)
const ICONS_SVG = {
    mic: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`,
    album: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>`,
    music_note: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`,
    music_video: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 9H8v-2h4v2zm0-4H8V6h4v2zm6 8h-4v-2h4v2zm0-4h-4V8h4v2z"/></svg>`,
    piano: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19.02 3H4.98C3.89 3 3 3.89 3 4.98v14.04C3 20.11 3.89 21 4.98 21h14.04c1.09 0 1.98-.89 1.98-1.98V4.98C21 3.89 20.11 3 19.02 3zM12 5h1.5v7h-1.5V5zm-3 0h1.5v7H9V5zM6 5h1.5v7H6V5zm12 14H6v-5h12v5z"/></svg>`,
    tune: `<svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`,
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
const masterControls = document.getElementById("masterControls");
const masterPlayBtn = document.getElementById("masterPlayBtn");
const masterRewindBtn = document.getElementById("masterRewindBtn");
const resetMixerBtn = document.getElementById("resetMixerBtn");
const downloadMixBtn = document.getElementById("downloadMixBtn");
const downloadZipBtn = document.getElementById("downloadZipBtn");

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
    fileMeta.textContent = file.name.toUpperCase();
    uploadAndSeparate(file);
}

// --- Envío del Archivo a la API ---
function uploadAndSeparate(file) {
    dropzone.classList.add("hidden");
    processing.classList.remove("hidden");
    
    // Indicar en la consola de mezcla que se está subiendo el archivo
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
    
    updateStatus("SUBIENDO AUDIO DE ORIGEN...", "Enviando archivo a la memoria temporal del servidor...", 10);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_URL}/separate`, true);

    // Seguimiento del progreso de subida
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 90);
            updateStatus("SUBIENDO AUDIO DE ORIGEN...", `Enviando archivo a la memoria de FastAPI (${percent}%)`, percent);
            const desc = document.getElementById("mixerStatusDesc");
            if (desc) {
                desc.textContent = `Enviando archivo a la memoria de FastAPI (${percent}%)`;
            }
        }
    };

    xhr.onload = async function() {
        if (xhr.status === 200) {
            try {
                const data = xhr.response; // Ya parseado a JSON gracias a xhr.responseType = "json"
                if (data && data.job_id) {
                    updateStatus("EN COLA DE ESPERA...", "Audio subido correctamente. Esperando turno...", 20);
                    pollJobStatus(data.job_id, file);
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
        showError("No se pudo conectar con el backend de FastAPI. Verifica que el puerto 7860 esté libre y en línea.");
    };

    xhr.responseType = "json";
    xhr.send(formData);
}

function updateStatus(title, subtitle, percentage) {
    statusText.textContent = title;
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}%`;
}

function showError(msg) {
    alert(msg);
    processing.classList.add("hidden");
    dropzone.classList.remove("hidden");
    resetAudio();
}

// --- Consultar el estado del proceso en la cola (Polling) ---
function pollJobStatus(jobId, file) {
    if (pollInterval) clearInterval(pollInterval);
    
    // Iniciar clase de animación de carga en barra de progreso
    progressBar.classList.add("animate-pulse");

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/status/${jobId}`);
            if (res.status !== 200) {
                clearInterval(pollInterval);
                showError("No se pudo obtener el estado del proceso de separación.");
                return;
            }
            
            const data = await res.json();
            
            if (data.status === "queued") {
                const percent = Math.min(45, 10 + (data.position * 3));
                updateStatus("EN COLA DE ESPERA...", `Turno: Posición ${data.position}. Tiempo est. restante: ~${data.position * 45}s`, percent);
                
                const desc = document.getElementById("mixerStatusDesc");
                if (desc) {
                    desc.innerHTML = `
                        <p class="text-sm font-semibold text-zinc-400">Tu posición en la cola es: ${data.position}</p>
                        <p class="text-xs text-zinc-500 mt-1">Tiempo estimado de espera: ~${data.position * 45} segundos. El procesamiento completo puede tardar varios minutos.</p>
                    `;
                }
                fileMeta.textContent = `EN COLA (Posición ${data.position}): ` + file.name.toUpperCase();
                
            } else if (data.status === "processing") {
                let percent = 50;
                if (data.step.includes("DECODIFICANDO")) percent = 55;
                else if (data.step.includes("RESAMPLEANDO")) percent = 60;
                else if (data.step.includes("INFERENCIA")) percent = 75;
                else if (data.step.includes("RECONSTRUYENDO")) percent = 85;
                else if (data.step.includes("COMPRIMIENDO")) percent = 95;
                
                updateStatus(data.step, data.description, percent);
                fileMeta.textContent = "PROCESANDO: " + file.name.toUpperCase();
                
                const desc = document.getElementById("mixerStatusDesc");
                if (desc) {
                    desc.innerHTML = `
                        <p class="text-sm font-semibold text-zinc-400">Separando instrumentos por IA...</p>
                        <p class="text-xs text-red-500 font-bold uppercase mt-1 animate-pulse">${data.step}</p>
                        <p class="text-xs text-zinc-500 mt-0.5">${data.description}</p>
                        <p class="text-[10px] text-zinc-600 mt-2 italic">▲ Nota: La separación por IA procesa modelos neuronales profundos y puede tardar varios minutos.</p>
                    `;
                }
                
            } else if (data.status === "completed") {
                clearInterval(pollInterval);
                progressBar.classList.remove("animate-pulse");
                
                updateStatus("DESCARGANDO RESULTADOS...", "Obteniendo los canales de audio comprimidos desde el servidor...", 98);
                
                const desc = document.getElementById("mixerStatusDesc");
                if (desc) {
                    desc.textContent = "Descargando stems decodificados en el navegador...";
                }
                
                try {
                    const downloadRes = await fetch(`${BACKEND_URL}/download/${jobId}`);
                    if (!downloadRes.ok) throw new Error("Error en la descarga de los stems.");
                    
                    zipBlob = await downloadRes.blob();
                    await decodeAndSetupMixer(zipBlob);
                    
                    updateStatus("LISTO", "Separación finalizada.", 100);
                } catch (err) {
                    showError("Error al descargar o decodificar los stems: " + err.message);
                }
                
            } else if (data.status === "failed") {
                clearInterval(pollInterval);
                progressBar.classList.remove("animate-pulse");
                showError("La separación por IA falló: " + data.description);
            }
            
        } catch (err) {
            console.error("Error consultando estado en cola:", err);
        }
    }, 3000);
}

// --- Parar animación y consulta de carga ---
function stopProcessingProgress() {
    progressBar.classList.remove("animate-pulse");
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
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
    }
    tracks = {};
    duration = 0;
    playOffset = 0;
    startTime = 0;
    zipBlob = null;
    currentPreviewTrack = null;
    
    if (masterControls) masterControls.classList.add("hidden");
    
    if (resultsSection) resultsSection.classList.add("hidden");
    if (resultsList) resultsList.innerHTML = "";
    
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
    updateStatus("DECODIFICANDO CANALES...", "Extrayendo y decodificando pistas WAV en la memoria del navegador...", 100);
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    try {
        const zip = await JSZip.loadAsync(blob);
        tracks = {};
        
        trackList.innerHTML = "";
        resultsList.innerHTML = "";
        duration = 0;

        for (const stemId of Object.keys(STEMS_CONFIG)) {
            const filename = `${stemId}.wav`;
            const fileInZip = zip.file(filename);

            if (!fileInZip) {
                console.warn(`Stem ${filename} no encontrado en el ZIP.`);
                continue;
            }

            const wavBlob = await fileInZip.async("blob");
            const blobUrl = URL.createObjectURL(wavBlob);
            const sizeBytes = wavBlob.size;

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
                sizeBytes: sizeBytes
            };

            audio.addEventListener("loadedmetadata", () => {
                if (duration === 0) {
                    duration = audio.duration;
                }
            });

            createTrackUI(stemId);
            createResultUI(stemId);
        }

        setupAudioNodes();
        
        processing.classList.add("hidden");
        dropzone.classList.remove("hidden");
        resultsSection.classList.remove("hidden");
        masterControls.classList.remove("hidden");

        // Activar la animación de vúmetros
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        drawMeters();

    } catch (e) {
        throw new Error("Error al extraer o decodificar el ZIP de audio: " + e.message);
    }
}

// --- Generar UI de Canal (Vertical Console Strip) ---
function createTrackUI(id) {
    const config = STEMS_CONFIG[id];
    const displayName = config.name.toUpperCase();

    const trackHtml = `
        <div class="channel-strip channel-${id} bg-zinc-900/35 border border-zinc-800/80 rounded-2xl p-4 flex flex-col items-center gap-4 w-full text-center relative hover:border-red-500/40 hover:bg-zinc-900/60 transition-all duration-300 shadow-xl" data-track-id="${id}">
            <!-- Header -->
            <div class="flex flex-col items-center gap-1 group-hover:text-red-500 transition-colors">
                <div class="text-2xl text-zinc-400 flex items-center justify-center">${ICONS_SVG[config.icon]}</div>
                <span class="text-[10px] font-black uppercase tracking-widest text-zinc-300">${displayName}</span>
            </div>
            
            <!-- Meter and Fader Row -->
            <div class="flex items-center justify-center gap-6 h-56 relative w-full my-2">
                <!-- Vertical LED VU Meter -->
                <div class="w-3.5 h-44 bg-zinc-950 rounded-full overflow-hidden relative border border-zinc-800/50 flex flex-col justify-end">
                    <canvas class="w-full h-full meter-canvas" id="canvas-${id}" width="14" height="176"></canvas>
                </div>
                
                <!-- Vertical Fader Container -->
                <div class="fader-container">
                    <input class="fader-slider" id="fader-${id}" max="100" min="0" type="range" value="80"/>
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
    slider.addEventListener("input", (e) => {
        setTrackVolume(id, parseInt(e.target.value) / 100);
    });

    const muteBtn = document.getElementById(`mute-${id}`);
    muteBtn.addEventListener("click", () => {
        toggleMute(id);
    });

    const soloBtn = document.getElementById(`solo-${id}`);
    soloBtn.addEventListener("click", () => {
        toggleSolo(id);
    });
}

// --- Generar UI de Resultados (Export Panel List) ---
function createResultUI(id) {
    const config = STEMS_CONFIG[id];
    const sizeMB = (tracks[id].sizeBytes / (1024 * 1024)).toFixed(1);

    const resultHtml = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 py-3 hover:bg-zinc-900/40 transition-colors gap-3" data-track-id="${id}">
            <div class="flex items-center gap-3">
                <div class="text-red-500 text-lg flex items-center justify-center">${ICONS_SVG[config.icon]}</div>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-white uppercase">${config.name} (${id}.wav)</span>
                    <span class="text-[10px] text-zinc-500 font-mono">${sizeMB} MB</span>
                </div>
            </div>
            <div class="flex gap-2 w-full sm:w-auto">
                <a id="download-${id}" href="${tracks[id].blobUrl}" download="${id}.wav" class="flex-1 sm:flex-none px-4 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5">
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
        track.gainNode = audioCtx.createGain();
        track.analyser = audioCtx.createAnalyser();
        track.analyser.fftSize = 64; 
        
        track.gainNode.gain.setValueAtTime(track.volume, audioCtx.currentTime);
        
        const sourceNode = audioCtx.createMediaElementSource(track.audio);
        sourceNode.connect(track.gainNode);
        track.gainNode.connect(track.analyser);
        track.analyser.connect(audioCtx.destination);
    }
}

// --- Actualizar Volumen ---
function setTrackVolume(id, volume) {
    if (tracks[id]) {
        tracks[id].volume = volume;
        updateTrackGains();
    }
}

// --- Lógica del Fader, Mute y Solo ---
function toggleMute(id) {
    if (!tracks[id]) return;
    tracks[id].isMuted = !tracks[id].isMuted;
    
    const muteBtn = document.getElementById(`mute-${id}`);
    if (tracks[id].isMuted) {
        muteBtn.classList.add("bg-red-600", "text-white", "border-red-500");
        muteBtn.classList.remove("bg-zinc-950", "text-zinc-400", "border-zinc-800");
    } else {
        muteBtn.classList.remove("bg-red-600", "text-white", "border-red-500");
        muteBtn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
    }
    
    updateTrackGains();
}

function toggleSolo(id) {
    if (!tracks[id]) return;
    tracks[id].isSoloed = !tracks[id].isSoloed;
    
    const soloBtn = document.getElementById(`solo-${id}`);
    if (tracks[id].isSoloed) {
        soloBtn.classList.add("bg-yellow-600", "text-white", "border-yellow-500");
        soloBtn.classList.remove("bg-zinc-950", "text-zinc-400", "border-zinc-800");
    } else {
        soloBtn.classList.remove("bg-yellow-600", "text-white", "border-yellow-500");
        soloBtn.classList.add("bg-zinc-950", "text-zinc-400", "border-zinc-800");
    }
    
    updateTrackGains();
}

// --- Calcular Ganancias en base a Fader + Mute + Solo ---
function updateTrackGains() {
    if (!audioCtx) return;

    // Verificar si hay algún track en modo SOLO
    const anySoloed = Object.values(tracks).some(t => t.isSoloed);

    for (const [id, track] of Object.entries(tracks)) {
        if (!track.gainNode) continue;

        let targetGain = 0;

        if (currentPreviewTrack) {
            // Modo Vista Previa: solo se reproduce el canal seleccionado
            targetGain = (id === currentPreviewTrack) ? track.volume : 0;
        } else {
            // Modo Mezclador General
            if (track.isMuted) {
                targetGain = 0; // Si está silenciado, volumen 0
            } else if (anySoloed) {
                targetGain = track.isSoloed ? track.volume : 0; // Si hay solos, solo suena si es soloed
            } else {
                targetGain = track.volume; // Modo normal
            }
        }

        track.gainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.02);
    }
}

// --- Control de Reproducción Sincronizada ---
function playTracks() {
    if (isPlaying) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Sincronizar playheads
    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.currentTime = playOffset;
        }
    }

    // Iniciar reproducción
    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.play().catch(e => console.error("Error al reproducir stem:", e));
        }
    }

    isPlaying = true;
    updateTrackGains();
    updatePreviewButtons();

    // Evento de fin natural de reproducción
    const firstTrack = Object.keys(tracks)[0];
    if (tracks[firstTrack] && tracks[firstTrack].audio) {
        tracks[firstTrack].audio.onended = () => {
            const currentPos = tracks[firstTrack].audio.currentTime;
            if (currentPos >= duration - 0.5) {
                pauseTracks(true); // Reiniciar al inicio
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
            updatePreviewButtons();
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
    updatePreviewButtons();
}

// --- Alternar Vista Previa de una Pista ---
function togglePreviewTrack(id) {
    if (isPlaying && currentPreviewTrack === id) {
        pauseTracks();
        return;
    }

    if (isPlaying) {
        currentPreviewTrack = id;
        updateTrackGains();
        updatePreviewButtons();
    } else {
        currentPreviewTrack = id;
        playTracks();
    }
}

function updatePreviewButtons() {
    for (const id of Object.keys(tracks)) {
        const btn = document.getElementById(`preview-${id}`);
        if (!btn) continue;
        
        if (isPlaying && currentPreviewTrack === id) {
            btn.innerHTML = `${ICONS_SVG.pause} Detener`;
            btn.classList.add("border-red-500", "text-red-500", "bg-red-950/20");
            btn.classList.remove("border-zinc-800", "text-zinc-300");
        } else {
            btn.innerHTML = `${ICONS_SVG.play_arrow} Escuchar`;
            btn.classList.remove("border-red-500", "text-red-500", "bg-red-950/20");
            btn.classList.add("border-zinc-800", "text-zinc-300");
        }
    }

    updateMasterPlayBtn();
}

function updateMasterPlayBtn() {
    if (isPlaying && !currentPreviewTrack) {
        masterPlayBtn.innerHTML = `${ICONS_SVG.pause} PAUSAR`;
        masterPlayBtn.classList.add("bg-zinc-800");
    } else {
        masterPlayBtn.innerHTML = `${ICONS_SVG.play_arrow} REPRODUCIR`;
        masterPlayBtn.classList.remove("bg-zinc-800");
    }
}

// --- Controles de Mezclador Maestro ---
masterPlayBtn.addEventListener("click", () => {
    if (isPlaying) {
        if (currentPreviewTrack !== null) {
            currentPreviewTrack = null;
            updateTrackGains();
            updatePreviewButtons();
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
        setTrackVolume(id, 0.8);
        const fader = document.getElementById(`fader-${id}`);
        if (fader) fader.value = 80;

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
    }
    updateTrackGains();
});

downloadZipBtn.addEventListener("click", () => {
    if (!zipBlob) return;
    const nameWithoutExt = fileMeta.textContent.replace(/\.[^/.]+$/, "");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = `separated_${nameWithoutExt}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Renderizado del Espectro (Vúmetros Segmentados en Tiempo Real) ---
function drawMeters() {
    if (!isPlaying) {
        for (const id of Object.keys(tracks)) {
            clearMeter(id);
        }
        animationFrameId = requestAnimationFrame(drawMeters);
        return;
    }

    for (const [id, track] of Object.entries(tracks)) {
        const canvas = document.getElementById(`canvas-${id}`);
        if (!canvas) continue;

        const ctx = canvas.getContext("2d");
        const analyser = track.analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Calibración de sensibilidad
        const fillPercent = Math.min(1.0, (average / 200) * 1.25); 

        // Dibujar fondo de vúmetro
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, width, height);

        if (fillPercent > 0) {
            const gain = track.gainNode ? track.gainNode.gain.value : 1.0;
            const fillHeight = height * fillPercent * Math.min(gain, 1.2);

            // Gradiente para LED
            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, "#ef4444");     // Rojo en la base
            gradient.addColorStop(0.5, "#dc2626");   // Rojo oscuro
            gradient.addColorStop(0.8, "#f87171");   // Rojo brillante / Neón
            gradient.addColorStop(0.95, "#ffffff");  // Blanco en el pico (saturación)

            ctx.fillStyle = gradient;
            ctx.fillRect(0, height - fillHeight, width, fillHeight);
        }

        // Divisiones de los segmentos LED
        ctx.strokeStyle = "#121214"; 
        ctx.lineWidth = 1.5;
        for (let y = 0; y < height; y += 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    animationFrameId = requestAnimationFrame(drawMeters);
}

function clearMeter(id) {
    const canvas = document.getElementById(`canvas-${id}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);
    
    // Dibujar divisiones inactivas
    ctx.strokeStyle = "#121214";
    ctx.lineWidth = 1.5;
    for (let y = 0; y < height; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
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
        const targetDuration = duration;
        const length = Math.ceil(targetDuration * sampleRate);
        
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

// Función para codificar un AudioBuffer a WAV PCM 16 bits
function bufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length),
        view = new DataView(bufferArr),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // Escribir cabecera WAV
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // longitud del chunk (16)
    setUint16(1);                                  // formato PCM (1)
    setUint16(numOfChan);                          // número de canales
    setUint32(buffer.sampleRate);                  // frecuencia de muestreo
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate (muestreo * block align)
    setUint16(numOfChan * 2);                      // block align (canales * bits/muestra / 8)
    setUint16(16);                                 // bits por muestra (16 bits)

    setUint32(0x61746164);                         // "data" chunk
    setUint32(length - pos - 4);                   // longitud de los datos

    for(i=0; i<buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while(pos < length) {
        for(i=0; i<numOfChan; i++) {             // Intercalar canales
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // limitar
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // escalar a entero de 16 bits firmado
            view.setInt16(pos, sample, true);          // escribir muestra de 16 bits (little endian)
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

// --- Evento de Retroceso de Audio (Master Rewind) ---
masterRewindBtn.addEventListener("click", () => {
    if (!tracks || Object.keys(tracks).length === 0) return;
    
    playOffset = 0;
    const isPlayingCurrent = isPlaying;
    
    // Si estaba reproduciendo, detenemos temporalmente para sincronizar
    if (isPlayingCurrent) {
        pauseTracks();
    }
    
    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.currentTime = 0;
        }
    }
    
    playOffset = 0;
    
    // Si estaba reproduciendo, reanudamos desde 0
    if (isPlayingCurrent) {
        playTracks();
    } else {
        updatePreviewButtons();
    }
});

// --- Prevenir salida accidental o recarga de página ---
window.addEventListener("beforeunload", (e) => {
    const isProcessing = processing && !processing.classList.contains("hidden");
    const hasLoadedFiles = zipBlob !== null || Object.keys(tracks).length > 0;
    
    if (isProcessing || hasLoadedFiles) {
        e.preventDefault();
        e.returnValue = "Si cierras o recargas la página, se perderá tu mezcla actual y el progreso.";
        return e.returnValue;
    }
});
