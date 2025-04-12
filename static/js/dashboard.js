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
    
    // Load pending commands and history
    loadPendingCommands();
    loadCommandHistory();
    
    // Set up command input
    setupCommandInput();
    
    // Set up command library
    setupCommandLibrary();
    
    // Set up activity log controls
    setupActivityLogControls();
    
    // Set up navigation controls
    setupNavigationControls();
    
    // Set up a refresh interval for pending commands
    setInterval(() => {
        loadPendingCommands();
        loadCommandHistory();
    }, 10000); // Refresh every 10 seconds
}

function loadAgentDetails(agentId) {
    // Fetch agent details from API
    fetch(`/agents/${agentId}`, {
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
        if (data) {
            console.log('Agent details fetched:', data);
            const agent = data;
            // Store the agent name for command queueing
            window.agentName = agent.name;
            console.log('Agent name set:', window.agentName);
            
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
    console.log(agent);
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

function clearAllCommands() {
    fetch('/commands/clear', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to clear commands');
        }
        return response.json();
    })
    .then(data => {
        addConsoleMessage('All commands cleared from Redis server', 'system');
        addActivityLog('All commands cleared', 'SYSTEM');
        
        // Refresh the commands displays
        loadPendingCommands();
        loadCommandHistory();
    })
    .catch(error => {
        console.error('Error clearing commands:', error);
        addConsoleMessage('Error clearing commands: ' + error.message, 'error');
    });
}

function setupCommandInput() {
    const commandInput = document.getElementById('command-input');

    document.getElementById('clear-all-commands')?.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all commands from the Redis server? This action cannot be undone.')) {
            clearAllCommands();
        }
    });
    
    commandInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const command = this.value.trim();
            if (command) {
                // Queue the command instead of sending directly
                queueCommand(command);
                this.value = '';
                
                // Add to command history for this session
                commandHistory.push(command);
                historyIndex = commandHistory.length;
            }
        } else if (e.key === 'ArrowUp') {
            // Navigate command history (up)
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                this.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            // Navigate command history (down)
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                this.value = commandHistory[historyIndex];
            } else if (historyIndex === commandHistory.length - 1) {
                historyIndex = commandHistory.length;
                this.value = '';
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

function queueCommand(command) {
    const queueId = window.agentName || currentAgentId;
    console.log(`Queueing command for agent: ${queueId}, Command: ${command}`);
    
    fetch(`/commands/agent/${queueId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        },
        body: JSON.stringify({
            command: command
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to queue command');
        }
        return response.json();
    })
    .then(data => {
        addConsoleMessage(`Command queued: ${command}`, 'system');
        addActivityLog(`Command queued: ${command}`, 'COMMAND');
        
        // Refresh pending commands using the same ID
        loadPendingCommands();
    })
    .catch(error => {
        console.error('Error queueing command:', error);
        addConsoleMessage('Error queueing command: ' + error.message, 'error');
    });
}

// Load pending commands for the current agent
function loadPendingCommands() {
    const queueId = window.agentName || currentAgentId;
    
    fetch(`/commands/agent/${queueId}/pending`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to load pending commands');
        }
        return response.json();
    })
    .then(data => {
        console.log('Pending commands:', data);
        // Make sure we're handling the correct data structure
        const commands = data.commands || [];
        // Update UI to show pending commands
        updatePendingCommandsUI(commands);
    })
    .catch(error => {
        console.error('Error loading pending commands:', error);
    });
}

// Load command history for the current agent
function loadCommandHistory() {
    const queueId = window.agentName || currentAgentId;
    
    fetch(`/commands/agent/${queueId}/history`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to load command history');
        }
        return response.json();
    })
    .then(data => {
        console.log('Command history:', data);
        // Make sure we're handling the correct data structure
        const commands = data.commands || [];
        // Update UI to show command history
        updateCommandHistoryUI(commands);
    })
    .catch(error => {
        console.error('Error loading command history:', error);
    });
}

// Update the formatDateTime function to handle both string dates and Date objects
function formatDateTime(date) {
    // If date is a string, convert it to a Date object
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
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
    
    // Add a handler for the refresh commands button
    document.getElementById('refresh-commands')?.addEventListener('click', function() {
        console.log('Refreshing commands...');
        loadPendingCommands();
        loadCommandHistory();
        addConsoleMessage('Commands refreshed', 'system');
    });
}

// Update the pending commands UI
function updatePendingCommandsUI(commands) {
    const pendingList = document.getElementById('pending-commands');
    if (!pendingList) return;
    
    pendingList.innerHTML = '';
    
    if (!commands || commands.length === 0) {
        pendingList.innerHTML = '<div class="no-commands">No pending commands</div>';
        return;
    }
    
    commands.forEach(cmd => {
        const cmdElement = document.createElement('div');
        cmdElement.className = 'command-item pending';
        cmdElement.innerHTML = `
            <div class="command-content">${cmd.Command || cmd.command}</div>
            <div class="command-time">Queued: ${formatDateTime(cmd.CreatedAt || cmd.created_at)}</div>
            <div class="command-id">ID: ${cmd.ID || cmd.id}</div>
        `;
        pendingList.appendChild(cmdElement);
    });
}

// Update the command history UI
function updateCommandHistoryUI(commands) {
    const historyList = document.getElementById('command-history');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    if (!commands || commands.length === 0) {
        historyList.innerHTML = '<div class="no-commands">No command history</div>';
        return;
    }
    
    commands.forEach(cmd => {
        const status = cmd.Status || cmd.status;
        const cmdElement = document.createElement('div');
        cmdElement.className = `command-item ${status.toLowerCase()}`;
        
        let responseHtml = '';
        const response = cmd.Response || cmd.response;
        
        if (response) {
            try {
                // Try to parse the response as JSON for better display
                const responseObj = JSON.parse(response);
                responseHtml = `<pre class="command-response">${JSON.stringify(responseObj, null, 2)}</pre>`;
            } catch (e) {
                // If not JSON, display as is
                responseHtml = `<div class="command-response">${response}</div>`;
            }
        }
        
        const createdAt = cmd.CreatedAt || cmd.created_at;
        const completedAt = cmd.CompletedAt || cmd.completed_at;
        
        cmdElement.innerHTML = `
            <div class="command-content">${cmd.Command || cmd.command}</div>
            <div class="command-status ${status.toLowerCase()}">${status.toUpperCase()}</div>
            <div class="command-time">Queued: ${formatDateTime(createdAt)}</div>
            ${completedAt ? `<div class="command-time">Completed: ${formatDateTime(completedAt)}</div>` : ''}
            ${responseHtml}
        `;
        historyList.appendChild(cmdElement);
    });
}