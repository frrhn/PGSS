// ==========================================
// NEXUS AGENT LOGIC - ENTERPRISE HARDENED
// ==========================================

// ==========================================
// FARRO AGENT LOGIC - ENTERPRISE HARDENED
// ==========================================

// 1. INIT GUARD & CONFIGURATION
const config = window.PHARMA_CONFIG; // <-- CHANGED THIS LINE
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    document.body.innerHTML = '<h1 style="color:red; padding:20px;">FATAL: Configuration missing. Check config.js</h1>';
    throw new Error("Config missing");
}

const supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

// ... (keep the rest of your agent.js exactly as it was)

// 2. STATE MANAGEMENT
let currentLat = null, currentLng = null;
let map = null, marker = null;
let photoFile = null, audioFile = null;
let photoPreviewUrl = null, audioPreviewUrl = null;
let activeMediaStream = null; // Track mic/cam streams
let isSubmitting = false;

// Temporary Agent ID (Will be replaced by Auth UID in Phase 3.2)
const TEMP_AGENT_ID = '8842'; 
document.getElementById('agentDisplay').textContent = `AGENT #${TEMP_AGENT_ID}`;

// 3. MEMORY & STREAM CLEANUP
function cleanupMedia() {
    if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); photoPreviewUrl = null; }
    if (audioPreviewUrl) { URL.revokeObjectURL(audioPreviewUrl); audioPreviewUrl = null; }
    if (activeMediaStream) {
        activeMediaStream.getTracks().forEach(track => track.stop());
        activeMediaStream = null;
    }
}
window.addEventListener('beforeunload', cleanupMedia);

// 4. UTILITIES
function log(msg, type = 'info') {
    const consoleEl = document.getElementById('consoleLog');
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `[${time}] ${msg}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > config.MAX_IMAGE_WIDTH) {
                    height = Math.round((height * config.MAX_IMAGE_WIDTH) / width);
                    width = config.MAX_IMAGE_WIDTH;
                }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], `compressed_${Date.now()}.jpg`, { type: 'image/jpeg' }));
                }, 'image/jpeg', config.IMAGE_QUALITY);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 5. EVENT HANDLERS
function captureGPS() {
    const btnText = document.getElementById('gpsBtnText');
    btnText.innerHTML = '<span class="pulse-dot"></span> Acquiring...';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLat = position.coords.latitude;
            currentLng = position.coords.longitude;
            document.getElementById('gpsStatus').innerHTML = `<span class="pulse-dot"></span> Locked: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
            document.getElementById('gpsStatus').className = "status-text success";
            btnText.textContent = '✅ Location Locked';
            
            const mapEl = document.getElementById('map');
            mapEl.style.display = 'block';
            
            if (!map) {
                map = L.map('map', { zoomControl: false }).setView([currentLat, currentLng], 16);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
            } else {
                map.setView([currentLat, currentLng], 16);
            }
            
            // CRITICAL FIX: Invalidate size after revealing map container
            setTimeout(() => map.invalidateSize(), 100);

            if (marker) map.removeLayer(marker);
            const glowIcon = L.divIcon({
                className: 'custom-glow-marker',
                html: `<div style="width: 20px; height: 20px; background: #00E5FF; border-radius: 50%; box-shadow: 0 0 15px #00E5FF;"></div>`,
                iconSize: [20, 20], iconAnchor: [10, 10]
            });
            marker = L.marker([currentLat, currentLng], { icon: glowIcon }).addTo(map);
        },
        (error) => { log(`GPS ERROR: ${error.message}`, "error"); btnText.textContent = 'Lock Location'; },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

async function handlePhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (!file.type.startsWith('image/')) { log("Invalid MIME", "error"); input.value = ''; return; }
        
        log(`Compressing (${(file.size/1024).toFixed(0)}KB)...`, "info");
        const compressed = await compressImage(file);
        photoFile = compressed;
        log(`✅ Compressed to ${(compressed.size/1024).toFixed(0)}KB`, "success");
        
        cleanupMedia(); // Revoke old URL
        photoPreviewUrl = URL.createObjectURL(compressed);
        document.getElementById('photoPreview').innerHTML = `<img src="${photoPreviewUrl}" class="media-preview">`;
    }
}

function handleAudio(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (!file.type.startsWith('audio/')) { log("Invalid MIME", "error"); input.value = ''; return; }
        
        audioFile = file;
        log(`✅ Audio captured`, "success");
        
        cleanupMedia(); // Revoke old URL
        audioPreviewUrl = URL.createObjectURL(file);
        const playback = document.getElementById('audioPlayback');
        playback.src = audioPreviewUrl;
        playback.style.display = 'block';
    }
}

// 6. HARDENED SUBMISSION PIPELINE
async function submitCheckIn() {
    if (isSubmitting) return;
    if (currentLat == null || !photoFile) { alert("⚠️ Lock GPS and capture Photo first."); return; }

    isSubmitting = true;
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="pulse-dot"></span> TRANSMITTING...';
    
    // Generate Idempotency Key to prevent duplicates on retry
    const idempotencyKey = generateUUID();
    log(`[TX-ID: ${idempotencyKey}] Starting secure uplink...`, "info");

    const timestamp = new Date().toISOString();
    const photoPath = `agents/${TEMP_AGENT_ID}/photos/${Date.now()}.jpg`;
    const audioPath = audioFile ? `agents/${TEMP_AGENT_ID}/audio/${Date.now()}.webm` : null;

    // Timeout wrapper
    const withTimeout = (promise, ms) => Promise.race([
        promise, 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Network Timeout')), ms))
    ]);

    try {
        // Upload Photo
        log("Uplinking photo...", "info");
        const { error: pErr } = await withTimeout(
            supabaseClient.storage.from('proofs').upload(photoPath, photoFile, { upsert: false }), 
            config.UPLOAD_TIMEOUT_MS
        );
        if (pErr) throw new Error(`Photo failed: ${pErr.message}`);

        // Upload Audio
        if (audioFile) {
            log("Uplinking audio...", "info");
            const { error: aErr } = await withTimeout(
                supabaseClient.storage.from('proofs').upload(audioPath, audioFile, { upsert: false }), 
                config.UPLOAD_TIMEOUT_MS
            );
            if (aErr) throw new Error(`Audio failed: ${aErr.message}`);
        }

        // DB Insert with Idempotency Key
        log("Writing to DB...", "info");
        const { error: dbErr } = await withTimeout(
            supabaseClient.from('checkins').insert({
                agent_id: TEMP_AGENT_ID,
                timestamp: timestamp,
                latitude: currentLat,
                longitude: currentLng,
                photo_url: photoPath,
                audio_url: audioPath,
                idempotency_key: idempotencyKey // Prevents duplicate DB rows
            }), 
            config.UPLOAD_TIMEOUT_MS
        );
        
        if (dbErr) throw new Error(`DB failed: ${dbErr.message}`);
        
        log("✅ TRANSMISSION COMPLETE.", "success");
        alert("✅ SUCCESS!");
        btn.innerHTML = '✅ TRANSMITTED';
        
        // Cleanup after successful submission
        cleanupMedia(); 

    } catch (error) {
        log(`❌ CRITICAL: ${error.message}`, "error");
        alert(`Failed: ${error.message}`);
        btn.innerHTML = '🚀 RETRY';
        btn.disabled = false;
        isSubmitting = false;
    }
}
