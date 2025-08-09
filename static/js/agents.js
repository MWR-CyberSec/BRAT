document.addEventListener('DOMContentLoaded', function() {
    console.log('Agents.js loaded at', new Date().toISOString());
    
    // Get modal elements
    const agentsModal = document.getElementById('agents-modal');
    const closeButton = agentsModal?.querySelector('.close');
    const viewAgentsBtn = document.getElementById('view-agents-btn');
    
    // Set up event listeners
    if (viewAgentsBtn) {
        viewAgentsBtn.addEventListener('click', openAgentsModal);
    }
    
    if (closeButton) {
        closeButton.addEventListener('click', closeAgentsModal);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === agentsModal) {
            closeAgentsModal();
        }
    });
    
    // Function to open the modal and load agent data
    function openAgentsModal() {
        console.log('Opening agents modal');
        fetchAgentsData();
        if (agentsModal) {
            agentsModal.style.display = 'block';
        }
    }
    
    // Function to close the modal
    function closeAgentsModal() {
        console.log('Closing agents modal');
        if (agentsModal) {
            agentsModal.style.display = 'none';
        }
    }
    
    // Function to fetch agents data from the API
    function fetchAgentsData() {
        console.log('Fetching agents data');
        
        fetch('/agents')
            .then(response => {
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
                if (!response.ok) {
                    throw new Error(`Failed to fetch agents data: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(agents => {
                console.log('Agents data received:', agents);
                console.log('Number of agents:', agents ? agents.length : 'null/undefined');
                if (agents && Array.isArray(agents)) {
                    console.log('Agents array details:', agents.map(a => ({ id: a.id, name: a.name, source: a.source })));
                }
                populateAgentsTable(agents);
            })
            .catch(error => {
                console.error('Error fetching agents data:', error);
                showErrorInTable('Failed to load agents data. Please try again.');
            });
    }
    
    // Function to populate the agents table
    function populateAgentsTable(agents) {
        const tableBody = document.getElementById('agents-table-body');
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        if (agents.length === 0) {
            showErrorInTable('No agents connected.');
            return;
        }
        
        // Add new rows
        agents.forEach(agent => {
            // Parse system info if it's a string
            let systemInfo = {};
            if (agent.SystemInfo && typeof agent.SystemInfo === 'string') {
                try {
                    systemInfo = JSON.parse(agent.SystemInfo);
                } catch (e) {
                    console.error('Error parsing system info:', e);
                }
            } else if (agent.SystemInfo) {
                systemInfo = agent.SystemInfo;
            }
            
            // Extract hostname from system info if available
            const hostname = systemInfo.hostname || 'Unknown';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${agent.name || 'Unknown'}</td>
                <td>${hostname}</td>
                <td>${agent.source || 'Unknown'}</td>
                <td>${agent.is_stager ? 'Stager' : 'Agent'}</td>
                <td>
                    <button class="btn" data-agent-id="${agent.id}">
                        <span class="btn-icon">⚡</span> Manage
                    </button>
                </td>
            `;
            
            // Add a class if it's a stager
            if (agent.is_stager) {
                row.classList.add('agent-stager');
            }
            
            tableBody.appendChild(row);
            
            // Add click event for the connect button
            const connectBtn = row.querySelector('button');
            connectBtn.addEventListener('click', function() {
                const agentId = this.getAttribute('data-agent-id');
                console.log('Connecting to agent with ID:', agentId);
                // Redirect to the agent's dashboard
                window.location.href = `/dashboard/${agentId}`;
            });
        });
    }
    
    // Function to show error message in table
    function showErrorInTable(message) {
        const tableBody = document.getElementById('agents-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--cyberpunk-accent);">
                    ${message}
                </td>
            </tr>
        `;
    }
    
});