// ==========================================
// FARRO MANAGER DASHBOARD - FINAL PRODUCTION
// ==========================================

console.log("[Farro] Initializing Manager Dashboard...");

const config = window.PHARMA_CONFIG;
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorContainer').innerText = "FATAL: config.js is missing or invalid.";
    throw new Error("Config missing");
}

// Initialize Supabase Client
const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

let map;
let markers = [];

window.onload = function() {
    console.log("[Farro] Window loaded. Starting initialization...");
    initMap();
    loadData();
};

function initMap() {
    map = L.map('commandMap', { zoomControl: false }).setView([32.0724, 72.6823], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

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

async function loadData() {
    console.log("[Farro] Fetching data...");
    showSkeletons();
    document.getElementById('errorContainer').style.display = 'none';
    
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const refreshIcon = document.getElementById('refreshIcon');
    refreshIcon.style.animation = 'spin 1s linear infinite';

    try {
        // We know this works now!
        const { data, error } = await supabase
            .from('checkins')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            document.getElementById('dataTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-secondary);">No field activity recorded yet.</td></tr>';
            return;
        }

        // Update Stats
        document.getElementById('totalCheckins').textContent = data.length;
        document.getElementById('uniqueAgents').textContent = new Set(data.map(row => row.agent_id)).size;
        const today = new Date().toDateString();
        document.getElementById('todayCheckins').textContent = data.filter(row => new Date(row.timestamp).toDateString() === today).length;

        // Render Table & Map
        renderTable(data);
        renderMap(data);
        console.log("[Farro] Rendering complete.");

    } catch (error) {
        console.error("[Farro] Critical Error:", error);
        document.getElementById('errorContainer').style.display = 'block';
        document.getElementById('errorContainer').innerText = "DATABASE ERROR: " + error.message;
    } finally {
        refreshIcon.style.animation = '';
    }
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    data.forEach(row => {
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
