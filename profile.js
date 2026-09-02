// Configuración de Supabase Auth & Database
const SUPABASE_URL = "https://axyvfsgepyswfffmmtuq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5_r0HfMfD2KyoccFHHInfA_FHrxsCJP";
const BACKEND_URL = "https://zbrun0-aurasplit.hf.space";
const LEMON_SQUEEZY_CHECKOUT_URL = "https://aurasplit.lemonsqueezy.com/checkout/buy/6a491040-07c2-4a3f-bb22-c8b4bb7e4011";
const GOOGLE_CLIENT_ID = "325105260753-98kcps42emo3cs1l0uej4pn4537fm6f5.apps.googleusercontent.com";

let supabaseClient = null;
let currentUser = null;
let userProfile = null;
let cachedRepertoire = [];
let isAuthRegisterMode = false;

// Inicializar cliente de Supabase
try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn("Error al inicializar cliente Supabase en perfil:", e);
}

// Helpers de Estado
function isUserPro() {
    if (!userProfile) return false;
    if (userProfile.is_pro === true) return true;
    if (userProfile.subscription_status === "active" || userProfile.subscription_status === "trialing") {
        if (userProfile.trial_end) {
            const trialEnd = new Date(userProfile.trial_end);
            return trialEnd > new Date();
        }
        return true;
    }
    return false;
}

// Cargar datos de la tabla profiles
async function loadUserProfile(userId) {
    if (!supabaseClient || !userId) return;
    try {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (!error && data) {
            userProfile = data;
        } else {
            userProfile = { id: userId, is_pro: false, subscription_status: "none" };
        }
    } catch (e) {
        console.warn("Error consultando tabla profiles:", e);
        userProfile = { id: userId, is_pro: false, subscription_status: "none" };
    }
}

// Actualizar la interfaz de usuario completa
function updateProfileUI() {
    const loadingView = document.getElementById("loadingView");
    const unauthView = document.getElementById("unauthView");
    const authView = document.getElementById("authView");
    const headerSignOutBtn = document.getElementById("headerSignOutBtn");

    if (loadingView) loadingView.classList.add("hidden");

    if (!currentUser) {
        if (unauthView) unauthView.classList.remove("hidden");
        if (authView) authView.classList.add("hidden");
        if (headerSignOutBtn) headerSignOutBtn.classList.add("hidden");
        initGoogleIdentityServices();
        return;
    }

    if (unauthView) unauthView.classList.add("hidden");
    if (authView) authView.classList.remove("hidden");
    if (headerSignOutBtn) headerSignOutBtn.classList.remove("hidden");

    const name = userProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Creador";
    const email = currentUser.email || "Sin correo";
    const isPro = isUserPro();
    const subStatus = userProfile?.subscription_status || "none";

    // Hero Profile Card
    const avatar = document.getElementById("profileAvatar");
    const fullNameLabel = document.getElementById("profileFullName");
    const emailLabel = document.getElementById("profileEmail");
    const planBadge = document.getElementById("profilePlanBadge");
    const providerBadge = document.getElementById("profileProviderBadge");
    const memberSinceLabel = document.getElementById("profileMemberSince");
    const editFullNameInput = document.getElementById("editFullNameInput");

    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    if (fullNameLabel) fullNameLabel.textContent = name;
    if (emailLabel) emailLabel.textContent = email;
    if (editFullNameInput) editFullNameInput.value = name;

    if (currentUser.created_at && memberSinceLabel) {
        const d = new Date(currentUser.created_at);
        memberSinceLabel.textContent = `Miembro desde ${d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    }

    const provider = currentUser.app_metadata?.provider || "email";
    if (providerBadge) {
        providerBadge.innerHTML = `<i class="fa-solid fa-shield-check text-emerald-400"></i> ${provider.toUpperCase()}`;
    }

    // Bento Cards
    const bentoEngineName = document.getElementById("bentoEngineName");
    const bentoEngineDesc = document.getElementById("bentoEngineDesc");
    const bentoStemsCapacity = document.getElementById("bentoStemsCapacity");

    // Subscription Section Details
    const subscriptionStatusPill = document.getElementById("subscriptionStatusPill");
    const subPlanTitle = document.getElementById("subPlanTitle");
    const subRenewalInfo = document.getElementById("subRenewalInfo");
    const subStatusNote = document.getElementById("subStatusNote");
    const subUpgradeBtn = document.getElementById("subUpgradeBtn");
    const subCancelBtn = document.getElementById("subCancelBtn");

    if (isPro) {
        if (subStatus === "trialing") {
            if (planBadge) {
                planBadge.className = "px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-full font-mono text-xs font-extrabold flex items-center gap-1.5 shadow-sm";
                planBadge.innerHTML = `<i class="fa-solid fa-crown text-amber-400 text-xs"></i> TRIAL 5 DÍAS PRO`;
            }
            if (subscriptionStatusPill) {
                subscriptionStatusPill.className = "text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30";
                subscriptionStatusPill.textContent = "Prueba Activa";
            }
            if (subPlanTitle) subPlanTitle.textContent = "AuraSplit PRO (Prueba 5 Días)";
            if (subRenewalInfo) {
                const dateStr = userProfile?.trial_end ? new Date(userProfile.trial_end).toLocaleDateString() : "en 5 días";
                subRenewalInfo.textContent = `Periodo de prueba válido hasta el ${dateStr}`;
            }
        } else {
            if (planBadge) {
                planBadge.className = "px-3 py-1 bg-red-600/20 border border-red-500/40 text-red-400 rounded-full font-mono text-xs font-extrabold flex items-center gap-1.5 shadow-sm";
                planBadge.innerHTML = `<i class="fa-solid fa-crown text-amber-400 text-xs"></i> PRO VIP`;
            }
            if (subscriptionStatusPill) {
                subscriptionStatusPill.className = "text-xs font-mono font-bold px-3 py-1 rounded-full bg-red-600/20 text-red-400 border border-red-500/30";
                subscriptionStatusPill.textContent = "Suscripción Activa";
            }
            if (subPlanTitle) subPlanTitle.textContent = "AuraSplit PRO VIP";
            if (subRenewalInfo) subRenewalInfo.textContent = "Renovación automática mensual activa ($6.99 USD)";
        }

        if (bentoEngineName) bentoEngineName.textContent = "GPU Serverless HD";
        if (bentoEngineDesc) bentoEngineDesc.textContent = "Máxima velocidad y 6 stems independientes";
        if (bentoStemsCapacity) bentoStemsCapacity.textContent = "6 Stems + Cues";

        if (subUpgradeBtn) subUpgradeBtn.classList.add("hidden");
        if (subCancelBtn) subCancelBtn.classList.remove("hidden");
        if (subStatusNote) subStatusNote.textContent = "Disfrutas de todas las ventajas PRO ilimitadas.";
    } else {
        if (planBadge) {
            planBadge.className = "px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full font-mono text-xs font-extrabold flex items-center gap-1.5 shadow-sm";
            planBadge.innerHTML = `<i class="fa-solid fa-user text-zinc-400 text-xs"></i> Plan Básico`;
        }
        if (subscriptionStatusPill) {
            subscriptionStatusPill.className = "text-xs font-mono font-bold px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700";
            subscriptionStatusPill.textContent = subStatus === "cancelled" ? "Suscripción Cancelada" : "Plan Gratuito";
        }
        if (subPlanTitle) subPlanTitle.textContent = "AuraSplit Básico (Gratis)";
        if (subRenewalInfo) subRenewalInfo.textContent = "Acceso estándar sin costo. Desbloquea 6 stems y GPU con PRO.";

        if (bentoEngineName) bentoEngineName.textContent = "Demucs v4";
        if (bentoEngineDesc) bentoEngineDesc.textContent = "Separación de audio estándar en CPU";
        if (bentoStemsCapacity) bentoStemsCapacity.textContent = "4 Stems";

        if (subUpgradeBtn) subUpgradeBtn.classList.remove("hidden");
        if (subCancelBtn) subCancelBtn.classList.add("hidden");
        if (subStatusNote) subStatusNote.textContent = "Prueba de 5 días sin costo. Cancela cuando desees.";
    }

    // Cargar repertorio de canciones
    loadUserRepertoire();
}

// Cargar repertorio de canciones desde el backend
async function loadUserRepertoire() {
    const listEl = document.getElementById("repertoireList");
    const countEl = document.getElementById("bentoRepertoireCount");
    if (!listEl) return;

    if (!currentUser) {
        listEl.innerHTML = `
            <div class="text-center py-10 text-zinc-500 font-mono text-xs">
                Inicia sesión para ver tus canciones guardadas.
            </div>
        `;
        return;
    }

    if (!isUserPro()) {
        listEl.innerHTML = `
            <div class="bg-zinc-900/60 border border-amber-500/20 rounded-2xl p-8 text-center space-y-4">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
                    <i class="fa-solid fa-cloud text-xl"></i>
                </div>
                <div class="max-w-md mx-auto">
                    <h3 class="text-white font-display font-bold text-base">Almacenamiento Cloud Exclusivo PRO</h3>
                    <p class="text-zinc-400 text-xs font-mono mt-1 leading-relaxed">
                        Tu repertorio en la nube te permite guardar mezclas separadas, tempos, compases y guías de ensayo para cargarlas al instante desde cualquier lugar.
                    </p>
                </div>
                <button onclick="handleProCheckout()" class="px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-xl text-xs font-mono transition-all shadow-md shadow-red-600/20 cursor-pointer">
                    <i class="fa-solid fa-crown mr-1.5 text-amber-300"></i> DESBLOQUEAR BÓVEDA CON PRO
                </button>
            </div>
        `;
        if (countEl) countEl.textContent = "0";
        return;
    }

    listEl.innerHTML = `
        <div class="text-center py-12 text-zinc-500 font-mono text-xs flex flex-col items-center gap-3">
            <div class="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
            Cargando tus canciones del repertorio...
        </div>
    `;

    try {
        const res = await fetch(`${BACKEND_URL}/vault/list?user_id=${encodeURIComponent(currentUser.id)}`);
        if (!res.ok) throw new Error("No se pudo conectar con el servidor.");
        const data = await res.json();
        cachedRepertoire = data.projects || [];

        if (countEl) countEl.textContent = `${cachedRepertoire.length}`;

        const searchInput = document.getElementById("repertoireSearchInput");
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        renderRepertoireCards(query);
    } catch (err) {
        listEl.innerHTML = `
            <div class="text-center py-8 text-red-400 font-mono text-xs bg-red-950/20 border border-red-900/30 rounded-2xl p-4">
                Error al cargar el repertorio: ${err.message}
            </div>
        `;
    }
}

function renderRepertoireCards(query = "") {
    const listEl = document.getElementById("repertoireList");
    if (!listEl) return;

    let filtered = cachedRepertoire;
    if (query) {
        filtered = cachedRepertoire.filter(p => p.name.toLowerCase().includes(query));
    }

    if (filtered.length === 0) {
        if (cachedRepertoire.length === 0) {
            listEl.innerHTML = `
                <div class="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-10 text-center space-y-2">
                    <i class="fa-solid fa-folder-open text-3xl text-zinc-700 block mb-2"></i>
                    <p class="text-zinc-300 font-bold text-sm">Tu repertorio está vacío</p>
                    <p class="text-zinc-500 text-xs font-mono max-w-sm mx-auto">Separa canciones en el estudio y guárdalas para acceder a ellas aquí.</p>
                    <div class="pt-3">
                        <a href="/" class="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-md shadow-red-600/20">
                            <i class="fa-solid fa-plus text-xs"></i> IR AL SEPARADOR
                        </a>
                    </div>
                </div>
            `;
        } else {
            listEl.innerHTML = `
                <div class="text-center py-8 text-zinc-500 font-mono text-xs">
                    No se encontraron canciones que coincidan con "${query}".
                </div>
            `;
        }
        return;
    }

    let html = "";
    filtered.forEach(proj => {
        const meta = proj.metadata || {};
        const bpm = meta.bpm ? `${parseFloat(meta.bpm).toFixed(1)} BPM` : "-- BPM";
        const compas = meta.timeSignature || "4/4";
        const pitch = meta.pitchShift ? (meta.pitchShift > 0 ? `+${meta.pitchShift} st` : `${meta.pitchShift} st`) : "0 st";
        const dateStr = proj.created_time ? new Date(proj.created_time).toLocaleDateString() : "";
        
        let displayName = proj.name;
        if (displayName.includes(" - ")) {
            displayName = displayName.split(" - ").slice(1).join(" - ");
        }

        html += `
            <div class="bg-zinc-900/60 border border-zinc-800/80 hover:border-red-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                <div class="flex items-center gap-3.5">
                    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-red-500 flex-shrink-0">
                        <i class="fa-solid fa-music text-base"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-white uppercase tracking-wider">${displayName}</h4>
                        <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400">
                            <span class="text-zinc-500"><i class="fa-regular fa-calendar mr-1"></i>${dateStr}</span>
                            <span class="text-zinc-600">•</span>
                            <span class="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-amber-400 font-bold">${bpm}</span>
                            <span class="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-cyan-400 font-bold">${compas}</span>
                            <span class="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-emerald-400 font-bold">${pitch}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-end sm:self-center">
                    <a href="/?vault_id=${proj.folder_id}" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-sm flex items-center gap-1.5" title="Abrir en el mezclador del separador">
                        <i class="fa-solid fa-play text-[10px]"></i> Abrir en Estudio
                    </a>
                    <button onclick="deleteProjectFromVault('${proj.folder_id}')" class="p-2 text-zinc-500 hover:text-red-400 bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 hover:border-red-600/30 rounded-xl text-xs transition-colors cursor-pointer" title="Eliminar de repertorio">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

// Eliminar proyecto del repertorio
async function deleteProjectFromVault(folderId) {
    if (!confirm("¿Seguro que deseas eliminar esta canción de tu repertorio?")) return;
    try {
        const res = await fetch(`${BACKEND_URL}/vault/project/${folderId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al eliminar la canción.");
        loadUserRepertoire();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}

// Iniciar Checkout de Lemon Squeezy
function handleProCheckout() {
    if (!currentUser) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }

    let checkoutUrl = LEMON_SQUEEZY_CHECKOUT_URL;
    const checkoutParams = new URLSearchParams();
    if (currentUser.email) {
        checkoutParams.append("checkout[email]", currentUser.email);
    }
    const name = userProfile?.full_name || currentUser.user_metadata?.full_name || "";
    if (name) {
        checkoutParams.append("checkout[name]", name);
    }
    checkoutParams.append("checkout[custom][user_id]", currentUser.id);

    const separator = checkoutUrl.includes("?") ? "&" : "?";
    checkoutUrl = `${checkoutUrl}${separator}${checkoutParams.toString()}`;

    if (window.LemonSqueezy && window.LemonSqueezy.Url) {
        window.LemonSqueezy.Url.Open(checkoutUrl);
    } else {
        window.location.href = checkoutUrl;
    }
}

// Cancelar Suscripción
async function handleCancelSubscription() {
    if (!currentUser) return;
    
    const confirmed = confirm("¿Estás seguro de que deseas cancelar tu suscripción PRO?\n\nPerderás el acceso a las guías vocales sincronizadas, GPU Serverless y almacenamiento ilimitado al terminar tu periodo actual.");
    if (!confirmed) return;

    try {
        if (supabaseClient) {
            await supabaseClient.from("profiles").update({
                subscription_status: "cancelled",
                is_pro: false
            }).eq("id", currentUser.id);
        }

        if (userProfile) {
            userProfile.subscription_status = "cancelled";
            userProfile.is_pro = false;
        }

        updateProfileUI();
        alert("Tu suscripción ha sido cancelada. Tu cuenta ha vuelto al plan básico gratuito.");
    } catch (err) {
        alert("Error al procesar la cancelación: " + err.message);
    }
}

// Cerrar Sesión
async function handleSignOut() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    currentUser = null;
    userProfile = null;
    cachedRepertoire = [];
    updateProfileUI();
}

// Inicializar Google Identity Services
function initGoogleIdentityServices() {
    if (typeof window === "undefined" || !window.google || !window.google.accounts || !window.google.accounts.id) {
        setTimeout(initGoogleIdentityServices, 400);
        return;
    }

    try {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignInCallback,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: "signin"
        });

        const btnContainer = document.getElementById("googleBtnContainer");
        if (btnContainer) {
            btnContainer.innerHTML = "";
            window.google.accounts.id.renderButton(btnContainer, {
                type: "standard",
                shape: "pill",
                theme: "filled_black",
                text: "continue_with",
                size: "large",
                logo_alignment: "left",
                width: 320
            });
        }
    } catch (err) {
        console.warn("Error inicializando Google Identity:", err);
    }
}

async function handleGoogleSignInCallback(response) {
    if (!response || !response.credential || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.auth.signInWithIdToken({
            provider: "google",
            token: response.credential
        });

        if (error) throw error;

        if (data && data.user) {
            currentUser = data.user;
            await loadUserProfile(data.user.id);
            updateProfileUI();
        }
    } catch (err) {
        console.error("Error autenticando con Google IdToken:", err);
        const errEl = document.getElementById("loginErrorMsg");
        if (errEl) {
            errEl.textContent = "Error al iniciar con Google: " + (err.message || err);
            errEl.classList.remove("hidden");
        }
    }
}

// Event Listeners y formularios
document.addEventListener("DOMContentLoaded", async () => {
    // Escuchar búsqueda en repertorio
    const searchInput = document.getElementById("repertoireSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            renderRepertoireCards(e.target.value.toLowerCase().trim());
        });
    }

    // Toggle Login / Register
    const toggleBtn = document.getElementById("loginToggleModeBtn");
    const nameGroup = document.getElementById("loginNameGroup");
    const submitBtn = document.getElementById("loginSubmitBtn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            isAuthRegisterMode = !isAuthRegisterMode;
            const errEl = document.getElementById("loginErrorMsg");
            const succEl = document.getElementById("loginSuccessMsg");
            if (errEl) errEl.classList.add("hidden");
            if (succEl) succEl.classList.add("hidden");

            if (isAuthRegisterMode) {
                if (nameGroup) nameGroup.classList.remove("hidden");
                if (submitBtn) submitBtn.textContent = "CREAR CUENTA Y ACTIVAR 5 DÍAS";
                toggleBtn.innerHTML = "¿Ya tienes cuenta? <span class=\"text-red-500 font-bold underline\">Inicia sesión</span>";
            } else {
                if (nameGroup) nameGroup.classList.add("hidden");
                if (submitBtn) submitBtn.textContent = "INICIAR SESIÓN";
                toggleBtn.innerHTML = "¿No tienes cuenta? <span class=\"text-red-500 font-bold underline\">Regístrate gratis</span>";
            }
        });
    }

    // Formulario de Login / Registro
    const loginForm = document.getElementById("profileLoginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;

            const email = document.getElementById("loginEmailInput").value.trim();
            const password = document.getElementById("loginPasswordInput").value;
            const fullName = document.getElementById("loginNameInput") ? document.getElementById("loginNameInput").value.trim() : "";
            const errEl = document.getElementById("loginErrorMsg");
            const succEl = document.getElementById("loginSuccessMsg");

            if (errEl) errEl.classList.add("hidden");
            if (succEl) succEl.classList.add("hidden");
            if (submitBtn) submitBtn.disabled = true;

            try {
                if (isAuthRegisterMode) {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email: email,
                        password: password,
                        options: { data: { full_name: fullName } }
                    });
                    if (error) throw error;
                    if (succEl) {
                        succEl.textContent = "¡Cuenta creada con éxito! Ya puedes iniciar sesión.";
                        succEl.classList.remove("hidden");
                    }
                } else {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: email,
                        password: password
                    });
                    if (error) throw error;
                    if (data && data.user) {
                        currentUser = data.user;
                        await loadUserProfile(data.user.id);
                        updateProfileUI();
                    }
                }
            } catch (err) {
                if (errEl) {
                    errEl.textContent = err.message || "Error al autenticar.";
                    errEl.classList.remove("hidden");
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Actualizar nombre completo en la base de datos
    const updateProfileForm = document.getElementById("updateProfileForm");
    if (updateProfileForm) {
        updateProfileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentUser || !supabaseClient) return;

            const newName = document.getElementById("editFullNameInput").value.trim();
            const feedback = document.getElementById("updateProfileFeedback");

            try {
                await supabaseClient.from("profiles").upsert({
                    id: currentUser.id,
                    full_name: newName
                });

                if (userProfile) userProfile.full_name = newName;
                if (feedback) {
                    feedback.className = "text-xs font-mono p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-400";
                    feedback.textContent = "Nombre actualizado correctamente.";
                    feedback.classList.remove("hidden");
                }
                updateProfileUI();
            } catch (err) {
                if (feedback) {
                    feedback.className = "text-xs font-mono p-2.5 rounded-xl bg-red-950/40 border border-red-900/60 text-red-400";
                    feedback.textContent = "Error al actualizar nombre: " + err.message;
                    feedback.classList.remove("hidden");
                }
            }
        });
    }

    // Inicializar sesión Supabase
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            await loadUserProfile(session.user.id);
        }
        updateProfileUI();

        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                await loadUserProfile(session.user.id);
            } else {
                currentUser = null;
                userProfile = null;
                cachedRepertoire = [];
            }
            updateProfileUI();
        });
    }
});

// Lemon Squeezy Setup
if (window.LemonSqueezy) {
    window.LemonSqueezy.Setup({
        eventHandler: async (event) => {
            if (event.event === "Checkout.Success" && currentUser) {
                try {
                    const trialEnd = new Date();
                    trialEnd.setDate(trialEnd.getDate() + 5);
                    await supabaseClient.from("profiles").update({
                        is_pro: true,
                        subscription_status: "trialing",
                        trial_end: trialEnd.toISOString()
                    }).eq("id", currentUser.id);

                    await loadUserProfile(currentUser.id);
                    updateProfileUI();
                    alert("¡Suscripción PRO configurada con éxito! Disfruta de tus 5 días de prueba gratis.");
                } catch (e) {
                    console.error("Error al actualizar tras checkout:", e);
                }
            }
        }
    });
}

// Exponer funciones globales
window.handleProCheckout = handleProCheckout;
window.handleCancelSubscription = handleCancelSubscription;
window.handleSignOut = handleSignOut;
window.loadUserRepertoire = loadUserRepertoire;
window.deleteProjectFromVault = deleteProjectFromVault;
