const config = window.PHARMA_CONFIG;
const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
let map, markers = [];

window.onload = () => { initMap(); syncAll(); };

function initMap() {
    map = L.map('commandMap').setView([32.0724, 72.6823], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
}

function showTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    btn.classList.add('active');
    if(id === 'sos') loadSOS();
    if(id === 'devices') loadDevices();
}

function toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
}

async function syncAll() {
    await loadDashboard();
    if(document.getElementById('sos').style.display !== 'none') loadSOS();
    if(document.getElementById('devices').style.display !== 'none') loadDevices();
}

async function loadDashboard() {
    const { data } = await supabase.from('checkins').select('*').order('timestamp', { ascending: false });
    if(!data) return;
    
    document.getElementById('totalCheckins').textContent = data.length;
    document.getElementById('uniqueAgents').textContent = new Set(data.map(r => r.agent_id)).size;
    document.getElementById('todayCheckins').textContent = data.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString()).length;

    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    markers.forEach(m => map.removeLayer(m)); markers = [];

    data.forEach(r => {
        const photo = r.photo_url ? supabase.storage.from('proofs').getPublicUrl(r.photo_url).data.publicUrl : null;
        const audio = r.audio_url ? supabase.storage.from('proofs').getPublicUrl(r.audio_url).data.publicUrl : null;
        
        tbody.innerHTML += `<tr>
            <td><b>${r.agent_id}</b></td>
            <td>${new Date(r.timestamp).toLocaleString()}</td>
            <td>${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}</td>
            <td>${photo ? `<img src="${photo}" style="width:40px; border-radius:6px;">` : '❌'} ${audio ? '🎵' : ''}</td>
            <td><a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--cyan);">Track</a></td>
        </tr>`;

        if(r.latitude) {
            const m = L.marker([r.latitude, r.longitude]).addTo(map).bindPopup(`<b>${r.agent_id}</b><br>${new Date(r.timestamp).toLocaleString()}`);
            markers.push(m);
        }
    });
    if(markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
}

async function loadSOS() {
    const { data } = await supabase.from('sos_alerts').select('*').order('timestamp', { ascending: false });
    const tbody = document.getElementById('sosTableBody');
    tbody.innerHTML = '';
    if(!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No active SOS alerts. All agents safe.</td></tr>'; return; }
    
    data.forEach(r => {
        tbody.innerHTML += `<tr style="background: rgba(239, 68, 68, 0.1);">
            <td><b style="color:var(--red);">${r.agent_id}</b></td>
            <td>${new Date(r.timestamp).toLocaleString()}</td>
            <td><a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--red); font-weight:700;">🚨 VIEW LOCATION</a></td>
            <td><span style="background:var(--red); color:#fff; padding:4px 8px; border-radius:12px; font-size:0.8rem;">ACTIVE</span></td>
        </tr>`;
    });
}

async function loadDevices() {
    const { data } = await supabase.from('employees').select('*');
    const tbody = document.getElementById('deviceTableBody');
    tbody.innerHTML = '';
    data.forEach(r => {
        tbody.innerHTML += `<tr>
            <td>${r.employee_name}</td>
            <td>${r.phone_number || '-'}</td>
            <td style="font-family:monospace; font-size:0.8rem;">${r.device_fingerprint}</td>
            <td><span style="color:var(--green);">● ${r.status}</span></td>
        </tr>`;
    });
}

async function registerDevice() {
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const fp = document.getElementById('regFP').value;
    if(!name || !fp) return alert("Name and Device ID are required.");
    
    const { error } = await supabase.from('employees').insert({ employee_name: name, phone_number: phone, device_fingerprint: fp, role: 'agent', status: 'active' });
    if(error) alert("Error: " + error.message);
    else { alert("Device Registered!"); loadDevices(); }
}

async function exportCSV() {
    const { data } = await supabase.from('checkins').select('*').order('timestamp', { ascending: false });
    if(!data) return alert("No data to export.");
    
    const headers = ['Agent ID', 'Timestamp', 'Latitude', 'Longitude', 'Photo URL', 'Audio URL'];
    const rows = data.map(r => [r.agent_id, r.timestamp, r.latitude, r.longitude, r.photo_url, r.audio_url]);
    let csv = headers.join(',') + '\n';
    rows.forEach(r => csv += r.map(v => `"${v || ''}"`).join(',') + '\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PharmaField_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
