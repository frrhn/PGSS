// ==========================================
// SETINGS AGENT: SILENT HARDWARE BINDING (DEBUG)
// ==========================================
console.log("[Setings] Script started.");

const config = window.PHARMA_CONFIG;
console.log("[Setings] Config loaded:", config ? "YES" : "NO");

if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.error("[Setings] FATAL: Configuration missing.");
    document.body.innerHTML = '<h1 style="color:red; padding:20px; font-family:sans-serif; background:white;">FATAL: Configuration missing. Check config.js</h1>';
    throw new Error("Config missing");
}

console.log("[Setings] Initializing Supabase...");
const supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
console.log("[Setings] Supabase initialized.");

async function initializeDeviceIdentity() {
    console.log("[Setings] initializeDeviceIdentity called.");
    const statusEl = document.getElementById('agentDisplay');
    if(statusEl) statusEl.textContent = "Initializing System...";

    try {
        console.log("[Setings] Requesting Device ID...");
        const info = await Capacitor.Plugins.Device.getId();
        const deviceFingerprint = info.identifier; 
        console.log("[Setings] Hardware Fingerprint:", deviceFingerprint);

        console.log("[Setings] Querying Supabase for fingerprint...");
        const { data, error } = await supabaseClient
            .from('employees')
            .select('employee_name, role, status')
            .eq('device_fingerprint', deviceFingerprint)
            .single();

        console.log("[Setings] Supabase response - Error:", error, "Data:", data);

        if (error || !data) {
            console.log("[Setings] Device not recognized. Showing registration screen.");
            if(statusEl) statusEl.textContent = "Unregistered Device";
            document.body.innerHTML = `
                <div style="background:#0B0F19; color:white; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px; font-family:sans-serif;">
                    <h1 style="font-size:3rem; margin-bottom:10px;">⚙️</h1>
                    <h2>System Configuration Required</h2>
                    <p style="color:#94A3B8; margin-bottom:20px;">This device is not mapped in the central registry.</p>
                    <p style="color:#00E5FF; font-family:monospace; background:#1e293b; padding:10px; border-radius:8px; word-break:break-all;">Device ID: ${deviceFingerprint}</p>
                    <p style="color:#94A3B8; margin-top:20px; font-size:0.9rem;">Please provide this ID to your system administrator for activation.</p>
                </div>
            `;
            return;
        }

        if (data.status === 'blocked') {
            console.log("[Setings] Device is blocked.");
            document.body.innerHTML = `<h1 style="color:red; text-align:center; margin-top:50px; font-family:sans-serif; background:white;">ACCESS DENIED. CONTACT ADMIN.</h1>`;
            return;
        }

        console.log("[Setings] Authenticated:", data.employee_name);
        if(statusEl) statusEl.textContent = `${data.employee_name}`;
        
        console.log("[Setings] Loading main interface...");
        // Ensure the main UI is visible
        const mainContent = document.querySelector('.main-content');
        if(mainContent) mainContent.style.display = 'block';
        const submitBar = document.querySelector('.submit-bar');
        if(submitBar) submitBar.style.display = 'block';

    } catch (err) {
        console.error("[Setings] Identity Bridge Failed:", err);
        document.body.innerHTML = `<h1 style="color:red; text-align:center; margin-top:50px; font-family:sans-serif; background:white;">SYSTEM ERROR: ${err.message}</h1>`;
    }
}

// Run this the millisecond the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Setings] DOMContentLoaded. Starting initialization.");
    initializeDeviceIdentity();
});
