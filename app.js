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

// Configuración de los 6 Stems del modelo Demucs 6s
const STEMS_CONFIG = {
    vocals: { name: "voces", icon: "mic" },
    drums: { name: "batería", icon: "album" },
    bass: { name: "bajo", icon: "music_note" },
    guitar: { name: "guitarra", icon: "music_video" },
    piano: { name: "piano", icon: "piano" },
    other: { name: "otros", icon: "tune" }
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
const resetMixerBtn = document.getElementById("resetMixerBtn");
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
        }
    };

    // Al finalizar la subida, iniciamos la simulación del progreso del procesamiento IA
    xhr.upload.onload = () => {
        startProcessingProgress();
    };

    xhr.onload = async function() {
        stopProcessingProgress();
        if (xhr.status === 200) {
            updateStatus("DECODIFICANDO CANALES...", "Extrayendo y decodificando pistas WAV en la memoria del navegador...", 99);
            progressBar.style.width = "99%";
            progressPercent.textContent = "Procesando...";

            try {
                zipBlob = xhr.response;
                await decodeAndSetupMixer(zipBlob);
            } catch (err) {
                showError("Error al decodificar la separación: " + err.message);
            }
        } else {
            showError(`Error del servidor (Código ${xhr.status}). Asegúrate de que el backend esté en línea.`);
        }
    };

    xhr.onerror = function() {
        stopProcessingProgress();
        showError("No se pudo conectar con el backend de FastAPI. Verifica que el puerto 7860 esté libre y en línea.");
    };

    xhr.responseType = "blob";
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

// --- Incremento gradual simulado para la IA en CPU ---
function startProcessingProgress() {
    let currentPercent = 90;
    let secondsElapsed = 0;
    
    const messages = [
        { time: 0, title: "DECODIFICANDO AUDIO...", desc: "Leyendo y decodificando archivo de entrada..." },
        { time: 5, title: "RESAMPLEANDO SEÑAL...", desc: "Ajustando frecuencia de muestreo a 44100Hz..." },
        { time: 10, title: "INICIANDO INFERENCIA DE IA...", desc: "Cargando modelo HTDemucs v4 (6 Stems) en CPU..." },
        { time: 20, title: "AISLANDO VOCES...", desc: "Aislando frecuencias vocales..." },
        { time: 40, title: "AISLANDO BATERÍA Y BAJO...", desc: "Aislando sección rítmica y percusión..." },
        { time: 60, title: "AISLANDO GUITARRA Y PIANO...", desc: "Extrayendo instrumentos melódicos..." },
        { time: 80, title: "RECONSTRUYENDO STEMS...", desc: "Ensamblando los 6 canales en alta calidad..." },
        { time: 100, title: "GENERANDO COMPRESIÓN ZIP...", desc: "Empaquetando pistas resultantes en un archivo ZIP..." }
    ];

    function getMessage(secs) {
        let matched = messages[0];
        for (const msg of messages) {
            if (secs >= msg.time) {
                matched = msg;
            }
        }
        return matched;
    }

    const currentMsg = getMessage(secondsElapsed);
    updateStatus(currentMsg.title, currentMsg.desc, currentPercent);
    progressBar.classList.add("animate-pulse");
    
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
        secondsElapsed += 5;
        if (currentPercent < 98) {
            currentPercent += 1;
        }
        const msg = getMessage(secondsElapsed);
        updateStatus(msg.title, msg.desc, currentPercent);
    }, 5000);
}

// --- Parar animación de carga ---
function stopProcessingProgress() {
    progressBar.classList.remove("animate-pulse");
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
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
                <span class="material-symbols-outlined text-3xl mb-3 text-zinc-600" data-icon="tune">tune</span>
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
            <div class="flex flex-col items-center gap-1">
                <span class="material-symbols-outlined text-2xl" data-icon="${config.icon}">${config.icon}</span>
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
                <span class="material-symbols-outlined text-red-500 text-lg" data-icon="${config.icon}">${config.icon}</span>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-white uppercase">${config.name} (${id}.wav)</span>
                    <span class="text-[10px] text-zinc-500 font-mono">${sizeMB} MB</span>
                </div>
            </div>
            <div class="flex gap-2 w-full sm:w-auto">
                <button id="preview-${id}" class="flex-1 sm:flex-none px-4 py-1.5 border border-zinc-800 hover:border-red-500/40 hover:text-red-400 transition-all duration-300 text-xs font-bold uppercase rounded-lg text-zinc-300 flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">play_arrow</span> Escuchar
                </button>
                <a id="download-${id}" href="${tracks[id].blobUrl}" download="${id}.wav" class="flex-1 sm:flex-none px-4 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <span class="material-symbols-outlined text-sm">download</span> Descargar
                </a>
            </div>
        </div>
    `;
    resultsList.insertAdjacentHTML("beforeend", resultHtml);

    const previewBtn = document.getElementById(`preview-${id}`);
    previewBtn.addEventListener("click", () => {
        togglePreviewTrack(id);
    });
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
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">pause</span> Detener`;
            btn.classList.add("border-red-500", "text-red-500", "bg-red-950/20");
            btn.classList.remove("border-zinc-800", "text-zinc-300");
        } else {
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">play_arrow</span> Escuchar`;
            btn.classList.remove("border-red-500", "text-red-500", "bg-red-950/20");
            btn.classList.add("border-zinc-800", "text-zinc-300");
        }
    }

    updateMasterPlayBtn();
}

function updateMasterPlayBtn() {
    if (isPlaying && !currentPreviewTrack) {
        masterPlayBtn.innerHTML = `<span class="material-symbols-outlined text-sm">pause</span> PAUSAR`;
        masterPlayBtn.classList.add("bg-zinc-800");
    } else {
        masterPlayBtn.innerHTML = `<span class="material-symbols-outlined text-sm">play_arrow</span> REPRODUCIR`;
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
