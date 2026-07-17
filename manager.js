// ==========================================
// PHARMAFIELD DIAGNOSTIC SCRIPT
// ==========================================
alert("STEP 1: manager.js has started running!");

// Hardcoded keys for GitHub Pages
const SUPABASE_URL = 'https://sxpvroftqiglonpmghjp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_922ZnL9I7l_-pkktN19CGw_5V-HlrgY'; 

alert("STEP 2: Initializing Supabase Client...\nURL: " + SUPABASE_URL);

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

alert("STEP 3: Client Initialized. Waiting for window to load...");

window.onload = async () => {
    alert("STEP 4: Window Loaded. Executing Database Query...");
    
    // The exact query to get your data
    const { data, error } = await supabase.from('checkins').select('*').order('timestamp', { ascending: false });
    
    // CHECK FOR ERRORS
    if (error) {
        alert("❌ STEP 5: SUPABASE ERROR!\n\n" + error.message + "\n\nThis means either:\n1. The API Key is wrong/expired.\n2. Row Level Security (RLS) is blocking the 'anon' role from reading the table.");
        document.getElementById('dataTableBody').innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">DB ERROR: ${error.message}</td></tr>`;
        return;
    }
    
    // CHECK FOR EMPTY DATA
    alert("✅ STEP 5: SUCCESS! Data received from Supabase.\n\nTotal Records Found: " + (data ? data.length : 0));
    
    if (!data || data.length === 0) {
        alert("⚠️ The database returned 0 records. The 'checkins' table might be empty.");
        document.getElementById('dataTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center;">Table is empty.</td></tr>';
        return;
    }
    
    // RENDER THE FIRST ROW TO PROVE IT WORKS
    alert("✅ STEP 6: Processing data and rendering the first row to the screen...");
    
    const r = data[0]; // Get the very first record
    
    // Update the stats
    document.getElementById('totalCheckins').textContent = data.length;
    document.getElementById('uniqueAgents').textContent = new Set(data.map(row => row.agent_id)).size;
    
    // Render just the first row in the table
    document.getElementById('dataTableBody').innerHTML = `
        <tr>
            <td><b>${r.agent_id}</b></td>
            <td>${new Date(r.timestamp).toLocaleString()}</td>
            <td>${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}</td>
            <td>${r.compliance_status || 'unknown'}</td>
            <td>${r.photo_url ? '✅ Photo' : '❌'}</td>
            <td><a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" style="color:cyan;">Track</a></td>
        </tr>
    `;
    
    alert("✅ STEP 7: COMPLETE! Look at your screen. You should see 1 row of data and the total count updated.");
};
