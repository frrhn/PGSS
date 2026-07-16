// ==========================================
// NUCLEAR DIAGNOSTIC MANAGER SCRIPT
// ==========================================

alert("STEP 1: manager.js has started running!");

// Check if config is loaded
const config = window.PHARMA_CONFIG;
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    alert("❌ STEP 2 FAILED: window.PHARMA_CONFIG is missing or incomplete!\n\nPlease check your config.js file.");
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorContainer').innerText = "CONFIG ERROR: Check config.js";
} else {
    alert("✅ STEP 2 PASSED: Config loaded successfully!\nURL: " + config.SUPABASE_URL);
}

window.onload = function() {
    alert("STEP 3: Window loaded. Attempting to fetch data directly from Supabase...");
    
    // Use raw fetch to bypass any Supabase JS client issues
    const url = config.SUPABASE_URL + '/rest/v1/checkins?select=*&order=timestamp.desc';
    
    fetch(url, {
        method: 'GET',
        headers: {
            'apikey': config.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + config.SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        alert("STEP 4: Server responded with Status Code: " + response.status + "\n\n(200 means success, 401 means bad key, 403 means permission denied)");
        if (!response.ok) {
            throw new Error("HTTP error! status: " + response.status);
        }
        return response.json();
    })
    .then(data => {
        alert("✅ STEP 5 PASSED: Data received!\n\nTotal Records Found: " + (data ? data.length : 0) + "\n\nCheck Console (F12) to see the data.");
        console.log("FULL DATA PAYLOAD:", data);
        
        // Manually update the stats to prove the JS is working
        document.getElementById('totalCheckins').innerText = data.length;
        
        const uniqueAgents = new Set(data.map(row => row.agent_id)).size;
        document.getElementById('uniqueAgents').innerText = uniqueAgents;
        
        const today = new Date().toDateString();
        const todayCount = data.filter(row => new Date(row.timestamp).toDateString() === today).length;
        document.getElementById('todayCheckins').innerText = todayCount;

        // Manually build the table
        const tbody = document.getElementById('dataTableBody');
        tbody.innerHTML = ''; // Clear skeletons
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No records found in database.</td></tr>';
        } else {
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="agent-badge-sm">#${row.agent_id}</span></td>
                    <td>${new Date(row.timestamp).toLocaleString()}</td>
                    <td><span class="coord-text">${row.latitude}, ${row.longitude}</span></td>
                    <td>${row.photo_url ? '✅ Photo' : '❌ No Photo'}</td>
                    <td>${row.audio_url ? '✅ Audio' : '❌ No Audio'}</td>
                    <td><a href="https://www.google.com/maps?q=${row.latitude},${row.longitude}" target="_blank" class="action-btn">📍 Track</a></td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        alert("✅ STEP 6 PASSED: Table and Stats updated successfully on the screen!");
    })
    .catch(error => {
        alert("❌ STEP FAILED: " + error.message + "\n\nCheck Console (F12) for details.");
        console.error("Fetch Error:", error);
        document.getElementById('errorContainer').style.display = 'block';
        document.getElementById('errorContainer').innerText = "FETCH ERROR: " + error.message;
    });
};
