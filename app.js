// URL de la API del Backend (Cambiar por tu URL de Hugging Face Spaces o servidor VPS)
const BACKEND_URL = "https://zbrun0-aurasplit.hf.space"; 

// --- Estado Global del Reproductor ---
let audioCtx = null;
let tracks = {}; // Contendrá buffer, source, gainNode, analyser, volume, blobUrl, sizeBytes
let isPlaying = false;
let startTime = 0;
let playOffset = 0; // Posición actual de reproducción en segundos
let duration = 0;   // Duración total de la canción en segundos
let zipBlob = null; // Almacenará el blob del archivo ZIP original para descarga total
let animationFrameId = null;
let currentPreviewTrack = null; // ID del canal que se está previsualizando individualmente
let progressInterval = null; // Intervalo para animar la barra de progreso mientras la IA procesa

// Configuración de los 6 Stems del modelo Demucs 6s en Español
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
const resultsList = document.getElementById("resultsList");
const resultsEmpty = document.getElementById("resultsEmpty");
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
        container.classList.add("border-zinc-500", "bg-zinc-800/50");
        container.classList.remove("border-zinc-800", "bg-zinc-900");
    }
});

dropzone.addEventListener("dragleave", () => {
    const container = dropzone.firstElementChild;
    if (container) {
        container.classList.remove("border-zinc-500", "bg-zinc-800/50");
        container.classList.add("border-zinc-800", "bg-zinc-900");
    }
});

dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const container = dropzone.firstElementChild;
    if (container) {
        container.classList.remove("border-zinc-500", "bg-zinc-800/50");
        container.classList.add("border-zinc-800", "bg-zinc-900");
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

    // Una vez que sube completamente el archivo, se inicia la simulación del progreso del procesamiento IA
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

// --- Incremento gradual para que no se quede estancado en 90% mientras la IA procesa ---
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
    progressBar.classList.add("animate-shimmer");
    
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
        secondsElapsed += 5;
        if (currentPercent < 98) {
            currentPercent += 1;
        }
        const msg = getMessage(secondsElapsed);
        updateStatus(msg.title, msg.desc, currentPercent);
    }, 5000); // Actualiza el mensaje y porcentaje cada 5 segundos
}

function stopProcessingProgress() {
    progressBar.classList.remove("animate-shimmer");
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

// --- Limpieza y Restablecimiento ---
function resetAudio() {
    pauseTracks();
    stopProcessingProgress();
    
    // Limpiar elementos de audio para liberar RAM
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
    
    if (resultsEmpty) resultsEmpty.classList.remove("hidden");
    if (resultsList) {
        resultsList.classList.add("opacity-50", "pointer-events-none", "hidden");
        resultsList.innerHTML = "";
    }
    
    if (trackList) {
        trackList.innerHTML = `<p class="text-zinc-500 font-body-sm text-center py-md" id="trackListPlaceholder">Carga un archivo de audio para ver los parámetros.</p>`;
    }
}

// --- Descompresión de Stems e Inicialización del Mezclador ---
async function decodeAndSetupMixer(blob) {
    updateStatus("DECODIFICANDO CANALES SIN PÉRDIDA...", "Extrayendo y decodificando pistas WAV en la memoria del navegador...", 100);
    
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
                console.warn(`Stem ${filename} no encontrado en el ZIP retornado.`);
                continue;
            }

            // En lugar de usar decodeAudioData (que decodifica el audio completo a floats sin comprimir ocupando
            // cientos de megabytes en RAM), extraemos como Blob ligero y cargamos mediante elementos <audio>
            const wavBlob = await fileInZip.async("blob");
            const blobUrl = URL.createObjectURL(wavBlob);
            const sizeBytes = wavBlob.size;

            const audio = new Audio(blobUrl);
            audio.preload = "auto";
            audio.crossOrigin = "anonymous";

            // Guardar datos
            tracks[stemId] = {
                audio: audio,
                gainNode: null,
                analyser: null,
                volume: 0.8,
                blobUrl: blobUrl,
                sizeBytes: sizeBytes
            };

            // Escuchar metadatos de audio para extraer duración de forma síncrona
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
        resultsEmpty.classList.add("hidden");
        resultsList.classList.remove("opacity-50", "pointer-events-none", "hidden");
        masterControls.classList.remove("hidden");

        drawMeters();

    } catch (e) {
        throw new Error("Error al extraer o decodificar el ZIP de audio: " + e.message);
    }
}

// --- Generar UI de Canal (Control Panel) ---
function createTrackUI(id) {
    const config = STEMS_CONFIG[id];
    const displayName = config.name.toUpperCase();

    const trackHtml = `
        <div class="track-item flex flex-col gap-sm" data-track-id="${id}">
            <div class="flex justify-between items-center">
                <label class="font-label-md text-white font-semibold">${displayName}</label>
                <div class="relative inline-block w-10 h-5 transition duration-200 ease-in">
                    <input checked class="toggle-checkbox absolute block w-0 h-0 opacity-0" id="${id}-toggle" type="checkbox"/>
                    <label class="toggle-label block overflow-hidden h-5 rounded-full bg-zinc-800 cursor-pointer transition-colors" for="${id}-toggle">
                        <span class="toggle-dot block w-5 h-5 rounded-full bg-zinc-400 shadow-sm transition-transform"></span>
                    </label>
                </div>
            </div>
            <canvas class="w-full h-[6px] bg-zinc-950/50 rounded border border-zinc-900/50 meter-canvas" id="canvas-${id}"></canvas>
            <input class="w-full" id="fader-${id}" max="100" min="0" type="range" value="80"/>
        </div>
    `;
    trackList.insertAdjacentHTML("beforeend", trackHtml);

    const slider = document.getElementById(`fader-${id}`);
    slider.addEventListener("input", (e) => {
        setTrackVolume(id, parseInt(e.target.value) / 100);
    });

    const toggle = document.getElementById(`${id}-toggle`);
    toggle.addEventListener("change", () => {
        updateTrackGains();
    });
}

// --- Generar UI de Resultados (Result Panel) ---
function createResultUI(id) {
    const config = STEMS_CONFIG[id];
    const sizeMB = (tracks[id].sizeBytes / (1024 * 1024)).toFixed(1);

    const resultHtml = `
        <div class="flex items-center justify-between p-md border border-zinc-800 hover:bg-zinc-800/30 transition-colors" data-track-id="${id}">
            <div class="flex items-center gap-md">
                <span class="material-symbols-outlined text-zinc-500" data-icon="${config.icon}">${config.icon}</span>
                <span class="font-body-md text-white">${id}.wav</span>
                <span class="text-zinc-500 font-mono-sm">${sizeMB} MB</span>
            </div>
            <div class="flex gap-sm">
                <button id="preview-${id}" class="px-md py-xs border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-colors font-label-md text-white flex items-center gap-xs">
                    <span class="material-symbols-outlined text-sm">play_arrow</span> VISTA PREVIA
                </button>
                <a id="download-${id}" href="${tracks[id].blobUrl}" download="${id}.wav" class="px-md py-xs bg-white text-black font-label-md hover:opacity-90 transition-opacity flex items-center gap-xs">
                    <span class="material-symbols-outlined text-sm">download</span> DESCARGAR
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
        
        // Conectar el elemento HTML5 Audio a la red de nodos
        const sourceNode = audioCtx.createMediaElementSource(track.audio);
        sourceNode.connect(track.gainNode);
        track.gainNode.connect(track.analyser);
        track.analyser.connect(audioCtx.destination);
    }
}

// --- Actualizar Volumen de una Pista ---
function setTrackVolume(id, volume) {
    if (tracks[id]) {
        tracks[id].volume = volume;
        updateTrackGains();
    }
}

// --- Actualizar ganancias (Faders / Mutes / Preview) ---
function updateTrackGains() {
    if (!audioCtx) return;

    for (const [id, track] of Object.entries(tracks)) {
        if (!track.gainNode) continue;

        let targetGain = 0;

        if (currentPreviewTrack) {
            // Modo Preview: Sólo suena el track previsualizado
            targetGain = (id === currentPreviewTrack) ? track.volume : 0;
        } else {
            // Modo Mezclador General: Suena si el interruptor está activado
            const toggle = document.getElementById(`${id}-toggle`);
            const isMuted = toggle ? !toggle.checked : false;
            targetGain = isMuted ? 0 : track.volume;
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

    // Sincronizar playheads antes de iniciar
    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.currentTime = playOffset;
        }
    }

    // Iniciar reproducción síncrona
    for (const track of Object.values(tracks)) {
        if (track.audio) {
            track.audio.play().catch(e => console.error("Error al reproducir stem:", e));
        }
    }

    isPlaying = true;
    updateTrackGains();
    updatePreviewButtons();

    // Monitorear finalización natural de la canción en la primera pista disponible
    const firstTrack = Object.keys(tracks)[0];
    if (tracks[firstTrack] && tracks[firstTrack].audio) {
        tracks[firstTrack].audio.onended = () => {
            const currentPos = tracks[firstTrack].audio.currentTime;
            if (currentPos >= duration - 0.5) {
                pauseTracks(true); // Reiniciar a 0
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

    // Pausar todos los stems
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

// --- Alternar Preview Individual ---
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
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">pause</span> PAUSAR`;
            btn.classList.add("bg-zinc-800", "text-white");
            btn.classList.remove("border-zinc-800");
        } else {
            btn.innerHTML = `<span class="material-symbols-outlined text-sm">play_arrow</span> VISTA PREVIA`;
            btn.classList.remove("bg-zinc-800", "text-white");
            btn.classList.add("border-zinc-800");
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

        const toggle = document.getElementById(`${id}-toggle`);
        if (toggle) toggle.checked = true;
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

// --- Renderizado del Espectro (Vúmetros en Tiempo Real) ---
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
        const fillPercent = average / 255;

        // Fondo transparente para el vúmetro
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(0, 0, width, height);

        // Barra de nivel activa
        ctx.fillStyle = "#FAFAFA";
        const gain = track.gainNode.gain.value;
        ctx.fillRect(0, 0, width * fillPercent * gain * 1.5, height);
    }

    animationFrameId = requestAnimationFrame(drawMeters);
}

function clearMeter(id) {
    const canvas = document.getElementById(`canvas-${id}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- Efecto Hover Visual de las Tarjetas ---
document.querySelectorAll('.bg-zinc-900').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#3F3F46';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#27272A';
    });
});
