// ==========================================
// Farro MANAGER DASHBOARD (DIAGNOSTIC)
// ==========================================

console.log("[Farro] Initializing Manager Dashboard...");

// 1. CONFIGURATION GUARD
const config = window.PHARMA_CONFIG;
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    alert("FATAL ERROR: config.js is missing, not loaded, or does not contain window.PHARMA_CONFIG. Please check the file.");
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorContainer').innerText = "FATAL ERROR: config.js is missing or invalid.";
    throw new Error("Config missing");
}

console.log("[PharmaField] Config loaded. Initializing Supabase...");
const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

let map;
let markers = [];

// 2. INITIALIZATION
window.onload = function() {
    console.log("[PharmaField] Window loaded. Starting initialization...");
    try {
        initMap();
        loadData();
    } catch (e) {
        console.error("[PharmaField] Init error:", e);
        alert("INITIALIZATION ERROR: " + e.message);
        document.getElementById('errorContainer').style.display = 'block';
        document.getElementById('errorContainer').innerText = "Initialization Error: " + e.message;
    }
};

function initMap() {
    map = L.map('commandMap', { zoomControl: false }).setView([32.0724, 72.6823], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// 3. SKELETON LOADERS
function showSkeletons() {
    const tbody = document.getElementById('dataTableBody');
    let skeletonHTML = '';
    for (let i = 0; i < 5; i++) {
        skeletonHTML += `
            <tr>
                <td><div class="skeleton" style="width: 60px;"></div></td>
                <td><div class="skeleton" style="width: 120px;"></div></td>
                <td><div class="skeleton" style="width: 100px;"></div></td>
                <td><div class="skeleton skeleton-circle"></div></td>
                <td><div class="skeleton" style="width: 100px; height: 32px;"></div></td>
                <td><div class="skeleton" style="width: 50px;"></div></td>
            </tr>
        `;
    }
    tbody.innerHTML = skeletonHTML;
}

// 4. DATA FETCHING
async function loadData() {
    console.log("[PharmaField] Fetching data from Supabase...");
    showSkeletons();
    document.getElementById('errorContainer').style.display = 'none';
    
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const refreshIcon = document.getElementById('refreshIcon');
    refreshIcon.style.animation = 'spin 1s linear infinite';

    try {
        console.log("[PharmaField] Executing Supabase query...");
        const { data, error } = await supabase
            .from('checkins')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error("[PharmaField] Supabase Error:", error);
            alert("DATABASE ERROR:\n\n" + error.message + "\n\n(Hint: Check RLS policies or API key)");
            throw new Error(error.message);
        }

        // THIS ALERT WILL TELL US EXACTLY WHAT THE DATABASE RETURNED
        alert("DATA RECEIVED FROM DATABASE:\n\nRecords found: " + (data ? data.length : "NULL") + "\n\nCheck console (F12) for full JSON.");
        console.log("FULL DATA PAYLOAD:", data);

        if (!data || data.length === 0) {
            alert("NO DATA FOUND. The table is empty.");
            document.getElementById('dataTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-secondary);">No field activity recorded yet.</td></tr>';
            return;
        }

        console.log("[PharmaField] Rendering table and map...");
        renderTable(data);
        renderMap(data);
        console.log("[PharmaField] Rendering complete.");

    } catch (error) {
        console.error("[PharmaField] Critical Error:", error);
        document.getElementById('errorContainer').style.display = 'block';
        document.getElementById('errorContainer').innerText = "DATABASE ERROR: " + error.message;
        document.getElementById('dataTableBody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--accent-red);">Failed to load data.</td></tr>`;
    } finally {
        refreshIcon.style.animation = '';
    }
}

// 5. RENDERING
function renderTable(data) {
    console.log("[PharmaField] renderTable called with", data.length, "rows");
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    data.forEach((row, index) => {
        console.log(`[PharmaField] Rendering row ${index + 1}:`, row);
        const dateStr = new Date(row.timestamp).toLocaleString();
        
        let photoHtml = '<span class="no-media">No Image</span>';
        if (row.photo_url && row.photo_url.trim() !== "") {
            const photoUrl = supabase.storage.from('proofs').getPublicUrl(row.photo_url).data.publicUrl;
            photoHtml = `<img src="${photoUrl}" class="table-thumb" onclick="openModal('${photoUrl}')" alt="Proof">`;
        }

        let audioHtml = '<span class="no-media">No Audio</span>';
        if (row.audio_url && row.audio_url.trim() !== "") {
            const audioUrl = supabase.storage.from('proofs').getPublicUrl(row.audio_url).data.publicUrl;
            audioHtml = `<audio controls src="${audioUrl}" class="table-audio"></audio>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="agent-badge-sm">#${row.agent_id}</span></td>
            <td>${dateStr}</td>
            <td><span class="coord-text">${row.latitude?.toFixed(4) || 'N/A'}, ${row.longitude?.toFixed(4) || 'N/A'}</span></td>
            <td>${photoHtml}</td>
            <td>${audioHtml}</td>
            <td><a href="https://www.google.com/maps?q=${row.latitude},${row.longitude}" target="_blank" class="action-btn">📍 Track</a></td>
        `;
        tbody.appendChild(tr);
    });
    console.log("[PharmaField] Table rendering finished.");
}

function renderMap(data) {
    const bounds = L.latLngBounds();
    let hasValidCoords = false;

    data.forEach(row => {
        if (row.latitude && row.longitude) {
            const glowIcon = L.divIcon({
                className: 'custom-glow-marker',
                html: `<div style="width: 16px; height: 16px; background: #00E5FF; border-radius: 50%; box-shadow: 0 0 15px #00E5FF, 0 0 30px #00E5FF; border: 2px solid #fff;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            const marker = L.marker([row.latitude, row.longitude], { icon: glowIcon })
                .addTo(map)
                .bindPopup(`<div style="font-family: sans-serif; padding: 4px;"><strong style="color: #00E5FF;">Agent #${row.agent_id}</strong><br><span style="font-size: 0.8rem; color: #666;">${new Date(row.timestamp).toLocaleString()}</span></div>`);
            
            markers.push(marker);
            bounds.extend([row.latitude, row.longitude]);
            hasValidCoords = true;
        }
    });

    if (hasValidCoords) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}

function openModal(url) {
    document.getElementById('modalImage').src = url;
    document.getElementById('imageModal').classList.add('active');
}

function closeModal() {
    document.getElementById('imageModal').classList.remove('active');
    document.getElementById('modalImage').src = '';
}

// Dynamic CSS for refresh icon
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);
