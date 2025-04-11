// Dashboard functionality for BARK C2
let currentAgentId = null;
let ws = null;
let commandHistory = [];
let historyIndex = -1;

function initDashboard(agentId) {
    console.log('Initializing dashboard for agent:', agentId);
    currentAgentId = agentId;
    
    // Load agent details
    loadAgentDetails(agentId);
    
    // Set up websocket connection
    setupWebSocket();
    
    // Set up command input
    setupCommandInput();
    
    // Set up command library
    setupCommandLibrary();
    
    // Set up activity log controls
    setupActivityLogControls();
    
    // Set up navigation controls
    setupNavigationControls();
}

function loadAgentDetails(agentId) {
    // Fetch agent details from API
    fetch(`/api/agents/${agentId}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch agent details');
        }
        return response.json();
    })
    .then(data => {
        if (data && data.data) {
            const agent = data.data;
            updateAgentUI(agent);
        }
    })
    .catch(error => {
        console.error('Error fetching agent details:', error);
        addConsoleMessage('Error fetching agent details: ' + error.message, 'error');
    });
}

function updateAgentUI(agent) {
    // Update agent info in header
    document.getElementById('agent-id').textContent = agent.name;
    document.getElementById('agent-status').textContent = 'ONLINE';
    document.getElementById('agent-status').className = 'cyber-status online';
    
    // Update last seen
    const lastSeen = new Date(agent.last_seen);
    document.getElementById('last-seen').textContent = 'Last seen: ' + formatDateTime(lastSeen);
    
    // Update details panel
    document.getElementById('detail-id').textContent = agent.name;
    document.getElementById('detail-ip').textContent = agent.source;
    document.getElementById('detail-type').textContent = agent.is_stager ? 'Stager' : 'Full Agent';
    
    // Parse and display system info
    if (agent.system_info) {
        try {
            const systemInfo = JSON.parse(agent.system_info);
            displaySystemInfo(systemInfo);
        } catch (e) {
            console.error('Error parsing system info:', e);
            document.getElementById('system-info').textContent = 'System info not available or invalid';
        }
    } else {
        document.getElementById('system-info').textContent = 'No system information available';
    }
    
    // Log activity
    addActivityLog('Agent details loaded', 'CONNECTION');
}

function displaySystemInfo(info) {
    const container = document.getElementById('system-info');
    container.innerHTML = '<h4>System Information</h4>';
    
    // Create a formatted display of system info
    for (const [key, value] of Object.entries(info)) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/([a-z])([A-Z])/g, '$1 $2');
        
        const item = document.createElement('div');
        item.className = 'system-info-item';
        
        const label = document.createElement('div');
        label.className = 'system-info-label';
        label.textContent = formattedKey + ':';
        
        const valueEl = document.createElement('div');
        valueEl.className = 'system-info-value';
        valueEl.textContent = value;
        
        item.appendChild(label);
        item.appendChild(valueEl);
        container.appendChild(item);
    }
}

// function setupWebSocket() {
//     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const wsUrl = `${protocol}//${window.location.host}/ws/agents/${currentAgentId}`;
    
//     ws = new WebSocket(wsUrl);
    
//     ws.onopen = function() {
//         console.log('WebSocket connection established');
//         addConsoleMessage('WebSocket connection established', 'system');
        
//         // Authenticate the websocket
//         if (localStorage.getItem('jwt_token')) {
//             ws.send(JSON.stringify({
//                 type: 'auth',
//                 token: localStorage.getItem('jwt_token')
//             }));
//         }
//     };
    
//     ws.onmessage = function(event) {
//         console.log('WebSocket message received:', event.data);
//         try {
//             const data = JSON.parse(event.data);
//             handleWebSocketMessage(data);
//         } catch (e) {
//             console.error('Error parsing WebSocket message:', e);
//             addConsoleMessage('Received non-JSON message: ' + event.data, 'error');
//         }
//     };
    
//     ws.onclose = function() {
//         console.log('WebSocket connection closed');
//         addConsoleMessage('WebSocket connection closed', 'system');
        
//         // Attempt to reconnect after delay
//         setTimeout(() => {
//             if (document.visibilityState !== 'hidden') {
//                 setupWebSocket();
//             }
//         }, 5000);
//     };
    
//     ws.onerror = function(error) {
//         console.error('WebSocket error:', error);
//         addConsoleMessage('WebSocket error occurred', 'error');
//     };
// }

// function handleWebSocketMessage(data) {
//     // Handle different message types
//     switch (data.type) {
//         case 'auth_success':
//             addConsoleMessage('Authentication successful', 'system');
//             break;
        
//         case 'auth_error':
//             addConsoleMessage('Authentication failed: ' + data.message, 'error');
//             break;
        
//         case 'command_response':
//             addConsoleMessage(data.message, 'response');
//             addActivityLog(data.message, 'RESPONSE');
//             break;
        
//         case 'agent_status':
//             updateAgentStatus(data.status);
//             break;
        
//         case 'error':
//             addConsoleMessage('Error: ' + data.message, 'error');
//             addActivityLog(data.message, 'ERROR');
//             break;
        
//         default:
//             addConsoleMessage('Received message: ' + JSON.stringify(data), 'system');
//     }
// }

function updateAgentStatus(status) {
    const statusEl = document.getElementById('agent-status');
    
    if (status === 'online') {
        statusEl.textContent = 'ONLINE';
        statusEl.className = 'cyber-status online';
    } else {
        statusEl.textContent = 'OFFLINE';
        statusEl.className = 'cyber-status offline';
    }
    
    addConsoleMessage('Agent is now ' + status, 'system');
    addActivityLog('Agent status changed to ' + status.toUpperCase(), 'CONNECTION');
}

function setupCommandInput() {
    const commandInput = document.getElementById('command-input');
    
    commandInput.addEventListener('keydown', function(e) {
        // Handle Enter key to send command
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const command = commandInput.value.trim();
            
            if (command) {
                sendCommand(command);
                commandInput.value = '';
                
                // Add to history
                commandHistory.unshift(command);
                if (commandHistory.length > 50) {
                    commandHistory.pop();
                }
                historyIndex = -1;
            }
        }
        
        // Handle up/down arrows for command history
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                commandInput.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                commandInput.value = commandHistory[historyIndex];
            } else if (historyIndex === 0) {
                historyIndex = -1;
                commandInput.value = '';
            }
        }
    });
}

// This functionality will be changed to send a reuqest to the to be implemnted
// command rest endpoints that will store the command in the redis database
// and send it to the agent when the next heartbeat comes through

// function sendCommand(command) {
//     if (!ws || ws.readyState !== WebSocket.OPEN) {
//         addConsoleMessage('WebSocket not connected. Cannot send command.', 'error');
//         return;
//     }
    
//     addConsoleMessage(command, 'command');
//     addActivityLog(command, 'COMMAND');
    
//     ws.send(JSON.stringify({
//         type: 'command',
//         agent_id: currentAgentId,
//         command: command
//     }));
// }

function setupCommandLibrary() {
    const commandItems = document.querySelectorAll('.command-item');
    
    commandItems.forEach(item => {
        item.addEventListener('click', function() {
            const command = this.getAttribute('data-command');
            document.getElementById('command-input').value = command;
            document.getElementById('command-input').focus();
        });
    });
}

function setupActivityLogControls() {
    document.getElementById('clear-log').addEventListener('click', function() {
        document.getElementById('activity-table-body').innerHTML = '';
        addActivityLog('Activity log cleared', 'CONNECTION');
    });
}

function setupNavigationControls() {
    document.getElementById('back-to-main').addEventListener('click', function() {
        // Go back to main agents page
        window.location.href = '/';
    });
    
    document.getElementById('refresh-agent').addEventListener('click', function() {
        // Refresh agent data
        loadAgentDetails(currentAgentId);
    });
}

function addConsoleMessage(message, type = 'response') {
    const consoleOutput = document.getElementById('console-output');
    const timestamp = new Date().toTimeString().split(' ')[0];
    
    const line = document.createElement('div');
    line.className = `console-line ${type}-line`;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = timestamp;
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'message-content';
    contentSpan.textContent = message;
    
    line.appendChild(timestampSpan);
    line.appendChild(contentSpan);
    
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function addActivityLog(activity, type) {
    const activityLog = document.getElementById('activity-table-body');
    const timestamp = new Date().toTimeString().split(' ')[0];
    
    const row = document.createElement('tr');
    
    const timeCell = document.createElement('td');
    timeCell.textContent = timestamp;
    
    const typeCell = document.createElement('td');
    const typeSpan = document.createElement('span');
    typeSpan.className = `activity-type ${type.toLowerCase()}`;
    typeSpan.textContent = type;
    typeCell.appendChild(typeSpan);
    
    const activityCell = document.createElement('td');
    activityCell.textContent = activity;
    
    row.appendChild(timeCell);
    row.appendChild(typeCell);
    row.appendChild(activityCell);
    
    activityLog.insertBefore(row, activityLog.firstChild);
}

function formatDateTime(date) {
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Update agents_modal.tmpl to include links to the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Extend the existing agents list to include dashboard links
    const agentRows = document.querySelectorAll('#agents-table-body tr');
    
    agentRows.forEach(row => {
        const actionsCell = row.querySelector('td:last-child');
        if (actionsCell) {
            const agentId = row.getAttribute('data-agent-id');
            
            // Add dashboard link
            const dashboardLink = document.createElement('a');
            dashboardLink.href = `/dashboard/${agentId}`;
            dashboardLink.className = 'btn btn-small';
            dashboardLink.innerHTML = '<i class="fas fa-terminal btn-icon"></i> Console';
            
            actionsCell.appendChild(dashboardLink);
        }
    });
});