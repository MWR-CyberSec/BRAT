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
    
    // Set up command library with predefined commands
    setupCommandLibrary();
    
    // Set up activity log controls
    setupActivityLogControls();
    
    // Set up navigation controls
    setupNavigationControls();
    
    // Set up refresh interval for pending commands and command history
    setInterval(() => {
        loadPendingCommands();
        loadCommandHistory();
    }, 5000); // Refresh every 5 seconds
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

    document.getElementById('remote_view')?.addEventListener('click', function() {
        const remote_panel = document.getElementById('remote_view_panel');
        remote_panel.style.display = remote_panel.style.display === 'block' ? 'none' : 'block';
        this.textContent = remote_panel.style.display === 'block' ? 'Hide Remote View' : 'Show Remote View';
    });
    
    commandInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const command = this.value.trim();
            if (command) {
                // Queue the command
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

function setupCommandLibrary() {
    // Clear existing command categories
    const libraryContent = document.querySelector('.command-library .panel-content');
    libraryContent.innerHTML = '';
    
    // Define command categories with their commands
    const commandCategories = [
        {
            name: 'Basic',
            commands: [
                { name: 'Ping', command: 'ping' }
            ]
        },
        {
            name: 'Attacks',
            commands: [
                { name: 'Enable Remote View', command: 'attacks.enable_remote_view' },
            ]
        },
        {
            name: 'Reconnaissance',
            commands: [
                { name: 'Browser Info', command: 'recon.browser_info' },
                { name: 'Capture Cookies', command: 'recon.capture_cookies' },
                { name: 'Screen Info', command: 'recon.screen_info' },
                { name: 'Location Info', command: 'recon.location_info' }
            ]
        },
        {
            name: 'DOM Manipulation',
            commands: [
                { name: 'Get Element', command: 'dom.get_element.', prompt: true, placeholder: 'Enter selector (e.g. #myId, .myClass)' },
                { name: 'Get Elements', command: 'dom.get_elements.', prompt: true, placeholder: 'Enter selector (e.g. .myClass)' },
                { name: 'Inject Script', command: 'dom.inject_script.', prompt: true, placeholder: 'Enter script URL' }
            ]
        },
        {
            name: 'Storage',
            commands: [
                { name: 'Get Local Storage', command: 'storage.get_local_storage' },
                { name: 'Get Session Storage', command: 'storage.get_session_storage' },
                { name: 'Set Local Storage', command: 'storage.set_local_storage' }
            ]
        },
        {
            name: 'Network',
            commands: [
                { name: 'Fetch Google', command: 'net.fetch.google.com' },
                { name: 'WebSocket Info', command: 'net.websocket_info' }
            ]
        },
        {
            name: 'Code Execution',
            commands: [
                { name: 'Evaluate JS', command: 'exec.eval.', prompt: true, placeholder: 'Enter JavaScript code to execute' }
            ]
        }
    ];
    
    // Create command categories and buttons
    commandCategories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'command-category';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'category-header';
        headerDiv.textContent = category.name;
        
        const commandListDiv = document.createElement('div');
        commandListDiv.className = 'command-list';
        
        category.commands.forEach(cmd => {
            const cmdDiv = document.createElement('div');
            cmdDiv.className = 'command-item';
            cmdDiv.setAttribute('data-command', cmd.command);
            cmdDiv.textContent = cmd.name;
            
            if (cmd.prompt) {
                cmdDiv.setAttribute('data-prompt', 'true');
                cmdDiv.setAttribute('data-placeholder', cmd.placeholder || 'Enter value');
            }
            
            cmdDiv.addEventListener('click', function() {
                const baseCommand = this.getAttribute('data-command');
                const needsPrompt = this.getAttribute('data-prompt') === 'true';
                const placeholder = this.getAttribute('data-placeholder') || '';
                
                if (needsPrompt) {
                    const userInput = prompt(placeholder);
                    if (userInput !== null) { // Only if user didn't cancel
                        document.getElementById('command-input').value = baseCommand + userInput;
                    }
                } else {
                    document.getElementById('command-input').value = baseCommand;
                }
                
                document.getElementById('command-input').focus();
            });
            
            commandListDiv.appendChild(cmdDiv);
        });
        
        categoryDiv.appendChild(headerDiv);
        categoryDiv.appendChild(commandListDiv);
        libraryContent.appendChild(categoryDiv);
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
    
    // Add a handler for the refresh commands button
    document.getElementById('refresh-commands')?.addEventListener('click', function() {
        console.log('Refreshing commands...');
        loadPendingCommands();
        loadCommandHistory();
        addConsoleMessage('Commands refreshed', 'system');
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
    
    // Handle different types of messages
    if (typeof message === 'object') {
        try {
            contentSpan.innerHTML = `<pre>${JSON.stringify(message, null, 2)}</pre>`;
        } catch (e) {
            contentSpan.textContent = 'Complex object: ' + message.toString();
        }
    } else {
        contentSpan.textContent = message;
    }
    
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

function queueCommand(command) {
    const queueId = window.agentName || currentAgentId;
    console.log(`Queueing command for agent: ${queueId}, Command: ${command}`);
    
    // Display the command in the console
    addConsoleMessage(`> ${command}`, 'command');
    
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
        
        // Refresh pending commands
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
        
        // Process completed commands to show in console
        processCompletedCommands(commands);
    })
    .catch(error => {
        console.error('Error loading command history:', error);
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

// Process command history to display responses in the console
function processCompletedCommands(commands) {
    if (!commands || commands.length === 0) return;
    
    // Get only completed commands since last check
    const completedCommands = commands.filter(cmd => 
        (cmd.Status === 'completed' || cmd.status === 'completed' || cmd.Status === 'failed' || cmd.status === 'failed') &&
        !cmd.processedByConsole
    );
    
    // Sort commands by creation time
    completedCommands.sort((a, b) => {
        const timeA = new Date(a.CreatedAt || a.created_at);
        const timeB = new Date(b.CreatedAt || b.created_at);
        return timeA - timeB;
    });
    
    // Process each completed command to show in console
    completedCommands.forEach(cmd => {
        const status = cmd.Status || cmd.status;
        const command = cmd.Command || cmd.command;
        const response = cmd.Response || cmd.response;
        
        // Display response in console
        try {
            if (response) {
                const responseObj = JSON.parse(response);
                addConsoleMessage(responseObj, 'response');
            } else {
                addConsoleMessage(`Command ${status}: No response data`, 'system');
            }
        } catch (e) {
            // If not JSON, display as is
            if (response) {
                addConsoleMessage(response, 'response');
            } else {
                addConsoleMessage(`Command ${status}: No response data`, 'system');
            }
        }
        
        // Mark command as processed
        cmd.processedByConsole = true;
    });
}