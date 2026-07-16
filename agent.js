// ==========================================
// NEXUS CORE LOGIC (ENTERPRISE GRADE)
// ==========================================

// 1. CONFIGURATION
const SUPABASE_URL = 'https://sxpvroftqiglonpmghjp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_922ZnL9I7l_-pkktN19CGw_5V-HlrgY'; // YOUR KEY HERE
const AGENT_ID = '8842';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
document.getElementById('agentDisplay').textContent = `AGENT #${AGENT_ID}`;

// 2. STATE VARIABLES
let currentLat = null, currentLng = null;
let map = null, marker = null;
let photoFile = null, audioFile = null;
let isSubmitting = false;
let photoPreviewUrl = null, audioPreviewUrl = null;

// Cleanup memory on exit
window.addEventListener('beforeunload', () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
});

// 3. UTILITIES
function log(msg, type = 'info') {
    const consoleEl = document.getElementById('consoleLog');
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `[${time}] ${msg}`;
    consoleEl.appendChild(div);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// 🚀 ENTERPRISE IMAGE COMPRESSION ENGINE
// Uses HTML5 Canvas to redraw and compress the image client-side before upload
async function compressImage(file, maxWidth = 1080, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions to maintain aspect ratio
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // Fill white background to prevent transparency issues
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Convert canvas to a compressed JPEG Blob
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas compression failed'));
                        return;
                    }
                    // Create a new File object from the compressed blob
                    const compressedFile = new File([blob], `compressed_${Date.now()}.jpg`, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality); // 0.7 = 70% quality (Perfect balance of size vs visual quality)
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 4. EVENT HANDLERS
function captureGPS() {
    const btnText = document.getElementById('gpsBtnText');
    btnText.innerHTML = '<span class="pulse-dot"></span> Acquiring Signal...';
    log("Requesting high-accuracy GPS...", "info");
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLat = position.coords.latitude;
            currentLng = position.coords.longitude;
            
            document.getElementById('gpsStatus').innerHTML = `<span class="pulse-dot"></span> Locked: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
            document.getElementById('gpsStatus').className = "status-text success";
            btnText.textContent = '✅ Location Locked';
            log(`SUCCESS: Location captured`, "success");
            
            const mapEl = document.getElementById('map');
            mapEl.style.display = 'block';
            
            if (!map) {
                map = L.map('map', { zoomControl: false }).setView([currentLat, currentLng], 16);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; CartoDB'
                }).addTo(map);
            } else {
                map.setView([currentLat, currentLng], 16);
            }
            if (marker) map.removeLayer(marker);
            
            const glowIcon = L.divIcon({
                className: 'custom-glow-marker',
                html: `<div style="width: 20px; height: 20px; background: #00E5FF; border-radius: 50%; box-shadow: 0 0 15px #00E5FF, 0 0 30px #00E5FF;"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            marker = L.marker([currentLat, currentLng], { icon: glowIcon }).addTo(map);
        },
        (error) => {
            log(`GPS ERROR: ${error.message}`, "error");
            btnText.textContent = 'Lock Current Location';
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

async function handlePhoto(input) {
    if (input.files && input.files[0]) {
        const originalFile = input.files[0];
        
        // Basic check
        if (!originalFile.type.startsWith('image/')) {
            log("Invalid file type. Please select an image.", "error");
            input.value = '';
            return;
        }

        log(`Processing image (${(originalFile.size/1024).toFixed(1)} KB)...`, "info");

        try {
            // 🚀 COMPRESS THE IMAGE BEFORE SAVING IT TO STATE
            const compressedFile = await compressImage(originalFile, 1080, 0.7);
            log(`✅ Image compressed to ${(compressedFile.size/1024).toFixed(1)} KB`, "success");

            photoFile = compressedFile; // Save the COMPRESSED version
            
            if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
            photoPreviewUrl = URL.createObjectURL(compressedFile);
            document.getElementById('photoPreview').innerHTML = `<img src="${photoPreviewUrl}" class="media-preview">`;
        } catch (err) {
            log(`Compression failed: ${err.message}`, "error");
        }
    }
}

function handleAudio(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // BULLETPROOF AUDIO CHECK: Accept ANY audio format from native recorders
        if (!file.type.startsWith('audio/')) {
            log(`Invalid audio type: ${file.type}`, "error");
            input.value = '';
            return;
        }

        audioFile = file;
        log(`SUCCESS: Audio captured (${(file.size/1024).toFixed(1)} KB)`, "success");
        
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        audioPreviewUrl = URL.createObjectURL(file);
        
        const playback = document.getElementById('audioPlayback');
        playback.src = audioPreviewUrl;
        playback.style.display = 'block';
        document.getElementById('audioStatus').innerHTML = `✅ Audio recorded successfully.`;
        document.getElementById('audioStatus').className = "status-text success";
    }
}

async function submitCheckIn() {
    if (isSubmitting) return;
    if (currentLat == null || currentLng == null) { alert("⚠️ Please lock your GPS location first."); return; }
    if (!photoFile) { alert("⚠️ Please capture a site photo."); return; }

    isSubmitting = true;
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="pulse-dot"></span> TRANSMITTING TO HQ...';
    log("Starting secure uplink...", "info");

    try {
        const timestamp = new Date().toISOString();
        const photoPath = `agents/${AGENT_ID}/photos/${Date.now()}.jpg`;
        const audioPath = audioFile ? `agents/${AGENT_ID}/audio/${Date.now()}.webm` : null;

        const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), ms))]);

        log("Uplinking compressed photo...", "info");
        const { error: photoError } = await withTimeout(supabaseClient.storage.from('proofs').upload(photoPath, photoFile, { upsert: false }), 15000);
        if (photoError) throw new Error(`Photo uplink failed: ${photoError.message}`);
        log("✅ Photo secured", "success");

        if (audioFile) {
            log("Uplinking audio...", "info");
            const { error: audioError } = await withTimeout(supabaseClient.storage.from('proofs').upload(audioPath, audioFile, { upsert: false }), 15000);
            if (audioError) throw new Error(`Audio uplink failed: ${audioError.message}`);
            log("✅ Audio secured", "success");
        }

        log("Writing to central database...", "info");
        const { error: dbError } = await withTimeout(supabaseClient.from('checkins').insert({
            agent_id: AGENT_ID, timestamp: timestamp, latitude: currentLat, longitude: currentLng, photo_url: photoPath, audio_url: audioPath
        }), 10000);
        
        if (dbError) throw new Error(`Database write failed: ${dbError.message}`);
        
        log("✅ TRANSMISSION COMPLETE. DATA SECURED.", "success");
        alert("✅ SUCCESS! Check-in transmitted to HQ.");
        btn.innerHTML = '✅ TRANSMITTED';

    } catch (error) {
        log(`❌ CRITICAL ERROR: ${error.message}`, "error");
        alert(`Transmission Failed: ${error.message}`);
        btn.innerHTML = '🚀 RETRY SUBMISSION';
        btn.disabled = false;
    } finally {
        isSubmitting = false;
    }
}
