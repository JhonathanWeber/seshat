const API_URL = 'http://localhost:3344/health';
const POLL_INTERVAL = 2000; // 2 seconds

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');
const modelSelect = document.getElementById('model-select');
const memRss = document.getElementById('mem-rss');
const memHeap = document.getElementById('mem-heap');
const heapFill = document.getElementById('heap-fill');
const uptime = document.getElementById('uptime');
const apiVersion = document.getElementById('api-version');

const SET_MODEL_URL = 'http://localhost:3344/api/v1/system/ollama/model';

// Listen for model change
let isUpdatingModel = false;
modelSelect.addEventListener('change', async (e) => {
    if (!e.isTrusted) return; // Ignores programmatic or browser autofill events on page load

    const newModel = e.target.value;
    if (!newModel) return;

    isUpdatingModel = true;
    modelSelect.disabled = true;

    try {
        const res = await fetch(SET_MODEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: newModel })
        });

        if (res.ok) {
            console.log('Model switched successfully to', newModel);
        } else {
            console.error('Failed to switch model', await res.text());
        }
    } catch (error) {
        console.error('Error calling switch model API', error);
    } finally {
        modelSelect.disabled = false;
        isUpdatingModel = false;
    }
});

// Format seconds to HH:MM:SS
function formatUptime(seconds) {
    if (!seconds) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function fetchHealth() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        updateUI(data);
        setOnlineStatus(true);
    } catch (error) {
        console.warn('API connection failed:', error);
        setOnlineStatus(false);
    }
}

function updateUI(data) {
    // Version and model
    apiVersion.textContent = data.version || '1.0.0';

    if (data.system) {
        // Only update select if user isn't currently interacting with it
        if (!isUpdatingModel && document.activeElement !== modelSelect) {
            if (data.system.model) {
                // If the backend has a model not in our list, add it dynamically
                const exists = Array.from(modelSelect.options).some(opt => opt.value === data.system.model);
                if (!exists) {
                    const newOpt = document.createElement('option');
                    newOpt.value = data.system.model;
                    newOpt.textContent = data.system.model + " (Unknown)";
                    modelSelect.appendChild(newOpt);
                }
                modelSelect.value = data.system.model;
                // Once synced at least once, enable it (removes 'Sincronizando' state)
                modelSelect.disabled = false;
            }
        }

        uptime.textContent = formatUptime(data.system.uptime);

        // Memory
        if (data.system.memory) {
            const mem = data.system.memory;
            memRss.textContent = `${mem.rss} MB`;
            memHeap.textContent = `${mem.heapUsed} MB / ${mem.heapTotal} MB`;

            // Calculate percentage for progress bar
            const percent = (mem.heapUsed / mem.heapTotal) * 100;
            heapFill.style.width = `${Math.min(percent, 100)}%`;

            // Change color if memory is getting high (>85%)
            if (percent > 85) {
                heapFill.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
            } else {
                heapFill.style.background = 'linear-gradient(90deg, var(--accent), #8b5cf6)';
            }
        }
    }
}

function setOnlineStatus(isOnline) {
    if (isOnline) {
        connectionDot.className = 'dot online';
        connectionText.textContent = 'API Online';
        connectionText.style.color = 'var(--success)';
    } else {
        connectionDot.className = 'dot offline';
        connectionText.textContent = 'Offline - Aguardando...';
        connectionText.style.color = 'var(--error)';

        // Reset values when offline
        modelSelect.value = '';
        modelSelect.disabled = true;
        memRss.textContent = '-- MB';
        memHeap.textContent = '-- MB / -- MB';
        heapFill.style.width = '0%';
        uptime.textContent = '--';
    }
}

// Initial fetch and start polling
fetchHealth();
setInterval(fetchHealth, POLL_INTERVAL);

// --- Real-time Logs via SSE ---
const logContainer = document.getElementById('log-container');
const LOGS_URL = 'http://localhost:3344/api/v1/system/logs/stream';
let eventSource = null;

function appendLog(level, message) {
    const line = document.createElement('div');
    // Parse potential prefixes like "[ERROR] [2026-03...] message"
    let displayMessage = message;
    let finalLevel = level;

    // Look for tags like [INFO], [ERROR], [WARN], [DEBUG]
    const tagMatch = displayMessage.match(/^\[([A-Z]+)\]\s*(.*)/);
    if (tagMatch) {
        finalLevel = tagMatch[1].toLowerCase();
        displayMessage = tagMatch[2];
    }

    // Fallback normalization
    if (!['info', 'warn', 'error', 'system', 'debug'].includes(finalLevel)) {
        finalLevel = 'info';
    }

    line.className = `log-line ${finalLevel}`;

    const time = document.createElement('span');
    time.className = 'timestamp';
    const now = new Date();
    time.textContent = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

    const text = document.createTextNode(` [${finalLevel.toUpperCase()}] ${displayMessage}`);

    line.appendChild(time);
    line.appendChild(text);
    logContainer.appendChild(line);

    // Keep only the last 100 logs to avoid memory bloat
    if (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

function connectLogs() {
    if (eventSource) return;

    appendLog('system', 'Connecting to real-time log stream...');
    eventSource = new EventSource(LOGS_URL);

    eventSource.onopen = () => {
        appendLog('system', 'Connected to Seshat logging system.');
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            appendLog(data.level, data.message);
        } catch (e) {
            appendLog('info', event.data);
        }
    };

    eventSource.onerror = () => {
        appendLog('error', 'Lost connection to logging system. Retrying...');
        eventSource.close();
        eventSource = null;
        setTimeout(connectLogs, 5000);
    };
}

// Start log connection explicitly
connectLogs();
