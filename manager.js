// ==========================================
// PHARMAFIELD COMMAND CENTER LOGIC
// ==========================================

// 1. CONFIGURATION & INITIALIZATION
// Hardcoded for GitHub Pages deployment (Anon Key is public, secured by RLS)
const SUPABASE_URL = 'https://sxpvroftqiglonpmghjp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_922ZnL9I7l_-pkktN19CGw_5V-HlrgY'; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let map, mapTileLayer, markers = [];
let complianceChartInstance = null;
let activityChartInstance = null;

window.onload = () => {
    initMap();
    syncAll();
    initRealtimeSOS();
};

function initMap() {
    map = L.map('commandMap', { zoomControl: false }).setView([32.0724, 72.6823], 10);
    const theme = document.documentElement.getAttribute('data-theme');
    const tileUrl = theme === 'light' 
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    
    mapTileLayer = L.tileLayer(tileUrl, { attribution: '&copy; CartoDB' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// 2. TAB NAVIGATION
function showTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(id).style.display = 'block';
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');

    if (id === 'sos') loadSOS();
    if (id === 'devices') loadDevices();
    if (id === 'analytics') loadAnalytics();
    if (id === 'dashboard' && map) setTimeout(() => map.invalidateSize(), 100);
}

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    
    if (mapTileLayer) {
        const url = next === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        mapTileLayer.setUrl(url);
    }
}

async function syncAll() {
    await loadDashboard();
    if (document.getElementById('sos').style.display !== 'none') loadSOS();
    if (document.getElementById('devices').style.display !== 'none') loadDevices();
}

// 3. DATA FETCHING & RENDERING
async function loadDashboard() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Loading data...</td></tr>';
    
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const { data, error } = await supabase.from('checkins').select('*').order('timestamp', { ascending: false });
    
    if (error) {
        console.error("Supabase Error:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--red);">Error loading data: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No field activity recorded yet.</td></tr>';
        return;
    }

    // Update Stats
    document.getElementById('totalCheckins').textContent = data.length;
    document.getElementById('uniqueAgents').textContent = new Set(data.map(r => r.agent_id)).size;
    const today = new Date().toDateString();
    document.getElementById('todayCheckins').textContent = data.filter(r => new Date(r.timestamp).toDateString() === today).length;

    // Render Table & Map
    data.forEach(r => {
        let complianceBadge = '<span class="badge badge-gray">--</span>';
        let markerColor = '#00E5FF'; 
        
        if (r.compliance_status === 'compliant') {
            complianceBadge = `<span class="badge badge-green">✅ COMPLIANT (${Math.round(r.distance_meters || 0)}m)</span>`;
            markerColor = '#10B981';
        } else if (r.compliance_status === 'out_of_bounds') {
            complianceBadge = `<span class="badge badge-red">🚨 OUT OF BOUNDS (${Math.round(r.distance_meters || 0)}m)</span>`;
            markerColor = '#EF4444';
        } else if (r.compliance_status === 'auto_log') {
            complianceBadge = `<span class="badge badge-amber">⏰ AUTO LOG</span>`;
            markerColor = '#F59E0B';
        }

        const photo = r.photo_url ? supabase.storage.from('proofs').getPublicUrl(r.photo_url).data.publicUrl : null;
        const audio = r.audio_url ? supabase.storage.from('proofs').getPublicUrl(r.audio_url).data.publicUrl : null;
        
        let mediaHtml = '';
        if (photo) mediaHtml += `<img src="${photo}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; margin-right:8px; border:1px solid var(--border);">`;
        if (audio) mediaHtml += `<span title="Audio Available">🎵</span>`;
        if (!photo && !audio) mediaHtml = '<span style="color:var(--text2);">--</span>';

        tbody.innerHTML += `<tr>
            <td><b>${r.agent_id}</b></td>
            <td>${new Date(r.timestamp).toLocaleString()}</td>
            <td style="font-family:monospace; font-size:0.85rem;">${r.latitude?.toFixed(4) || 'N/A'}, ${r.longitude?.toFixed(4) || 'N/A'}</td>
            <td>${complianceBadge}</td>
            <td>${mediaHtml}</td>
            <td><a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--cyan); font-weight:600;">Track 📍</a></td>
        </tr>`;

        if (r.latitude && r.longitude) {
            const iconHtml = `<div style="width: 16px; height: 16px; background: ${markerColor}; border-radius: 50%; box-shadow: 0 0 15px ${markerColor}; border: 2px solid #fff;"></div>`;
            const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
            const m = L.marker([r.latitude, r.longitude], { icon: customIcon })
                .addTo(map)
                .bindPopup(`<b>${r.agent_id}</b><br>${complianceBadge}<br><small>${new Date(r.timestamp).toLocaleString()}</small>`);
            markers.push(m);
        }
    });

    if (markers.length > 0) {
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
    }
}

async function loadSOS() {
    const tbody = document.getElementById('sosTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading alerts...</td></tr>';
    
    const { data, error } = await supabase.from('sos_alerts').select('*').order('timestamp', { ascending: false });
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--green);">✅ No active SOS alerts. All agents safe.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    data.forEach(r => {
        tbody.innerHTML += `<tr style="background: rgba(239, 68, 68, 0.05);">
            <td><b style="color:var(--red);">${r.agent_id}</b></td>
            <td>${new Date(r.timestamp).toLocaleString()}</td>
            <td><a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--red); font-weight:700;">🚨 VIEW LOCATION (${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)})</a></td>
            <td><span class="badge badge-red">ACTIVE</span></td>
        </tr>`;
    });
}

async function loadDevices() {
    const tbody = document.getElementById('deviceTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading devices...</td></tr>';
    
    const { data, error } = await supabase.from('employees').select('*');
    
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Error loading devices.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(r => {
        const statusColor = r.status === 'active' ? 'var(--green)' : 'var(--red)';
        tbody.innerHTML += `<tr>
            <td><b>${r.employee_name}</b></td>
            <td>${r.phone_number || '-'}</td>
            <td style="font-family:monospace; font-size:0.8rem; color:var(--text2);">${r.device_fingerprint}</td>
            <td><span style="color:${statusColor}; font-weight:600;">● ${r.status}</span></td>
        </tr>`;
    });
}

async function registerDevice() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const fp = document.getElementById('regFP').value.trim();
    
    if (!name || !fp) return alert("⚠️ Employee Name and Device ID are required.");
    
    const { error } = await supabase.from('employees').insert({ 
        employee_name: name, 
        phone_number: phone, 
        device_fingerprint: fp, 
        role: 'agent', 
        status: 'active' 
    });
    
    if (error) alert("❌ Error: " + error.message);
    else { 
        alert("✅ Device Registered Successfully!"); 
        document.getElementById('regName').value = '';
        document.getElementById('regPhone').value = '';
        document.getElementById('regFP').value = '';
        loadDevices(); 
    }
}

async function exportCSV() {
    const { data, error } = await supabase.from('checkins').select('*').order('timestamp', { ascending: false });
    if (error || !data) return alert("❌ No data to export.");
    
    const headers = ['Agent ID', 'Timestamp', 'Latitude', 'Longitude', 'Compliance Status', 'Distance (m)', 'Photo URL', 'Audio URL'];
    const rows = data.map(r => [
        r.agent_id, r.timestamp, r.latitude, r.longitude, 
        r.compliance_status, r.distance_meters, r.photo_url, r.audio_url
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(r => csv += r.map(v => `"${v || ''}"`).join(',') + '\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PharmaField_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// 4. REAL-TIME SOS LISTENER
function initRealtimeSOS() {
    supabase.channel('sos-monitor')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_alerts' }, (payload) => {
            console.log("🚨 REAL-TIME SOS RECEIVED:", payload.new);
            
            // Flash screen red
            document.body.style.transition = 'background-color 0.2s';
            document.body.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
            setTimeout(() => { document.body.style.backgroundColor = ''; }, 1000);
            
            alert(`🚨 SOS ALERT FROM: ${payload.new.agent_id}\nLocation: ${payload.new.latitude}, ${payload.new.longitude}`);
            
            if (document.getElementById('sos').style.display !== 'none') loadSOS();
        })
        .subscribe();
}

// 5. ANALYTICS (Chart.js)
async function loadAnalytics() {
    const { data, error } = await supabase.from('checkins').select('compliance_status, timestamp');
    if (error || !data) return;

    if (complianceChartInstance) complianceChartInstance.destroy();
    if (activityChartInstance) activityChartInstance.destroy();

    const textColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#F8FAFC' : '#0F172A';
    const gridColor = document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    // 1. Compliance Doughnut Chart
    const compliant = data.filter(r => r.compliance_status === 'compliant').length;
    const oob = data.filter(r => r.compliance_status === 'out_of_bounds').length;
    const auto = data.filter(r => r.compliance_status === 'auto_log').length;
    const unknown = data.filter(r => !r.compliance_status || r.compliance_status === 'unknown').length;

    complianceChartInstance = new Chart(document.getElementById('complianceChart'), {
        type: 'doughnut',
        data: {
            labels: ['Compliant', 'Out of Bounds', 'Auto-Logs', 'Unknown'],
            datasets: [{ data: [compliant, oob, auto, unknown], backgroundColor: ['#10B981', '#EF4444', '#F59E0B', '#64748B'], borderWidth: 0 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Geofence Compliance Rate', color: textColor, font: { size: 16 } }, legend: { labels: { color: textColor } } } 
        }
    });

    // 2. Daily Activity Bar Chart
    const dailyCounts = {};
    data.forEach(r => {
        const day = new Date(r.timestamp).toLocaleDateString();
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    activityChartInstance = new Chart(document.getElementById('activityChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(dailyCounts),
            datasets: [{ label: 'Daily Check-ins', data: Object.values(dailyCounts), backgroundColor: '#00E5FF', borderRadius: 6 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Field Activity Trends', color: textColor, font: { size: 16 } }, legend: { labels: { color: textColor } } },
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
                x: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
        }
    });
}
