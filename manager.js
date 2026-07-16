// ==========================================
// PHARMAFIELD MANAGER DASHBOARD LOGIC
// ==========================================

console.log("[PharmaField] Initializing Manager Dashboard...");

// 1. CONFIGURATION GUARD
const config = window.PHARMA_CONFIG;
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.error("[PharmaField] FATAL: Configuration missing.");
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorContainer').innerText = "FATAL ERROR: config.js is missing or invalid. Please check your repository.";
    throw new Error("Config missing");
}

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
    document.getElementById('errorContainer').style.display = 'none'; // Hide previous errors
    
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const refreshIcon = document.getElementById('refreshIcon');
    refreshIcon.style.animation = 'spin 1s linear infinite';

    try {
        const { data, error } = await supabase
            .from('checkins')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error("[PharmaField] Supabase Error:", error);
            throw new Error(error.message);
        }

        console.log(`[PharmaField] Success! Found ${data ? data.length : 0} records.`);

        if (!data || data.length === 0) {
            document.getElementById('dataTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-secondary);">No field activity recorded yet.</td></tr>';
            return;
        }

        // Update Stats
        document.getElementById('totalCheckins').textContent = data.length;
        document.getElementById('uniqueAgents').textContent = new Set(data.map(row => row.agent_id)).size;
        const today = new Date().toDateString();
        document.getElementById('todayCheckins').textContent = data.filter(row => new Date(row.timestamp).toDateString() === today).length;

        // Render
        renderTable(data);
        renderMap(data);

    } catch (error) {
        console.error("[PharmaField] Critical Error:", error);
        document.getElementById('errorContainer').style.display = 'block';
        document.getElementById('errorContainer').innerText = "DATABASE ERROR: " + error.message + "\n\n(Hint: Check that config.js has the correct API key and that RLS policies allow reading).";
        
        document.getElementById('dataTableBody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--accent-red);">Failed to load data.</td></tr>`;
    } finally {
        refreshIcon.style.animation = '';
    }
}

// 5. RENDERING
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
            <td><a href="https://www.google.com/maps?q=${
