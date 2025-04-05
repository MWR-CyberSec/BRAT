document.addEventListener('DOMContentLoaded', function() {

    console.log('main.js loaded at', new Date().toISOString());


    // Check if user is already logged in (has token in localStorage)
    const token = localStorage.getItem('jwt_token');
    if (token) {
        showDashboard();
        fetchUserProfile(token);
        fetchAgentStats();
    }

    // Toggle between login and register forms
    document.getElementById('show-register')?.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('login-panel').style.opacity = '0';
        document.getElementById('login-panel').style.transform = 'translateX(-50px)';
        document.getElementById('login-panel').style.pointerEvents = 'none';
        
        setTimeout(() => {
            document.getElementById('register-panel').style.opacity = '1';
            document.getElementById('register-panel').style.transform = 'translateX(0)';
            document.getElementById('register-panel').style.pointerEvents = 'auto';
        }, 300);
    });
    
    document.getElementById('show-login')?.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('register-panel').style.opacity = '0';
        document.getElementById('register-panel').style.transform = 'translateX(50px)';
        document.getElementById('register-panel').style.pointerEvents = 'none';
        
        setTimeout(() => {
            document.getElementById('login-panel').style.opacity = '1';
            document.getElementById('login-panel').style.transform = 'translateX(0)';
            document.getElementById('login-panel').style.pointerEvents = 'auto';
        }, 300);
    });

    document.getElementById('refresh-stats')?.addEventListener('click', function() {
        fetchAgentStats();
    });

    document.getElementById('view-agents-btn')?.addEventListener('click', function() {
        console.log("View agents button clicked"); // Debug
        const agentsPanel = document.getElementById('agents-panel');
        
        if (agentsPanel && dashboard) {
            agentsPanel.style.display = 'block';
        }
    });

    const loginForm = document.getElementById('login-form');
    console.log('Login form found:', !!loginForm);
    
    // Login form handling
    document.getElementById('login-form')?.addEventListener('submit', function(e) {
        console.log("Login form submitted"); // Debug
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        console.log("Email:", email, "Password length:", password.length); // Debug
        
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => {
            console.log("Response status:", response.status); // Debug
            return response.json();
        })
        .then(data => {
            console.log("Login response data:", data); // Debug
            console.log("response_key:", data.response_key); // Debug specific values
            console.log("data.data:", data.data); // Debug specific values
            
            if (data.response_key !== "SUCCESS") {
                console.error("Failed login attempt:", data.response_message);
                alert("Login failed: " + (data.response_message || "Unauthorized"));
            }

            if (data && data.response_key === "SUCCESS" && data.data && data.data.token) {
                console.log("Success branch taken"); // Debug
                localStorage.setItem('jwt_token', data.data.token);
                
                if (data.data.user) {
                    console.log("Updating user profile"); // Debug
                    updateUserProfile(data.data.user);
                }
                
                console.log("About to show dashboard"); // Debug
                showDashboard();
            } else {
                console.error("Failed branch taken - unexpected response structure:", data);
                alert("Login failed: " + (data.response_message || "Unexpected response"));
            }
        })
        .catch(error => {
            console.error('Error during login:', error);
            alert('An error occurred during login. Please try again.');
        });
    });
    
    // Register form handling
    document.getElementById('register-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        })
        .then(response => response.json())
        .then(data => {
            console.log("Register response:", data); // Debug output
            
            if (data && data.data && data.data.token) {
                localStorage.setItem('jwt_token', data.data.token);
                
                if (data.data.user) {
                    updateUserProfile(data.data.user);
                }
                
                showDashboard();
            } else {
                console.error("Unexpected response structure:", data);
                alert("Registration failed: Unexpected response from server");
            }
        })
        .catch(error => {
            console.error('Error during registration:', error);
            alert('An error occurred during registration. Please try again.');
        });
    });
    
    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', function() {
        localStorage.removeItem('jwt_token');
        hideDashboard();
    });
});

// Helper functions

function fetchAgentStats() {
    const refreshButton = document.getElementById('refresh-stats');
    
    if (refreshButton) {
        // Show loading state
        refreshButton.disabled = true;
        refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading...</span>';
    }
    
    fetch('/agents')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch agent stats');
            }
            return response.json();
        })
        .then(data => {
            console.log("Agent stats data:", data);
            
            // Get the count of agents
            const clientsCount = data.length || 0;
            
            // Count active sessions (non-stagers)
            const sessionsCount = data.filter(agent => !agent.IsStager).length || 0;
            
            // Update UI elements
            updateStatsUI(sessionsCount, clientsCount);
        })
        .catch(error => {
            console.error('Error fetching agent stats:', error);
            
            // Update network status to show error
            const networkStatus = document.getElementById('network-status');
            if (networkStatus) {
                networkStatus.textContent = 'ERROR';
                networkStatus.className = 'cyber-status offline';
            }
        })
        .finally(() => {
            // Reset button state
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.innerHTML = '<i class="fas fa-sync"></i> <span>Refresh</span>';
            }
        });
}

function updateStatsUI(sessions, clients) {
    // Update sessions stat
    const sessionsCount = document.getElementById('sessions-count');
    const sessionsBar = document.getElementById('sessions-bar');
    if (sessionsCount) sessionsCount.textContent = sessions;
    if (sessionsBar) {
        // Calculate percentage (capped at 100%)
        const sessionPercentage = Math.min(sessions * 10, 100);
        sessionsBar.style.setProperty('--fill-level', `${sessionPercentage}%`);
    }
    
    // Update clients stat
    const clientsCount = document.getElementById('clients-count');
    const clientsBar = document.getElementById('clients-bar');
    if (clientsCount) clientsCount.textContent = clients;
    if (clientsBar) {
        // Calculate percentage (capped at 100%)
        const clientPercentage = Math.min(clients * 10, 100);
        clientsBar.style.setProperty('--fill-level', `${clientPercentage}%`);
    }
    
    // Update network status
    const networkStatus = document.getElementById('network-status');
    if (networkStatus) {
        networkStatus.textContent = 'ONLINE';
        networkStatus.className = 'cyber-status online';
    }
    
    console.log("Stats UI updated:", { sessions, clients });
}

function showDashboard() {
    const authPanels = document.getElementById('auth-panels');
    const dashboard = document.getElementById('dashboard');
    
    if (authPanels) authPanels.style.display = 'none';
    if (dashboard) dashboard.style.display = 'grid';
    
    console.log("Dashboard shown");
}

function hideDashboard() {
    const authPanels = document.getElementById('auth-panels');
    const dashboard = document.getElementById('dashboard');
    
    if (authPanels) authPanels.style.display = 'block';
    if (dashboard) dashboard.style.display = 'none';
    
    console.log("Dashboard hidden");
}

function updateUserProfile(user) {
    const nameElement = document.getElementById('user-name');
    const emailElement = document.getElementById('user-email');
    const roleElement = document.getElementById('user-role');
    
    if (nameElement) nameElement.textContent = user.name || '-';
    if (emailElement) emailElement.textContent = user.email || '-';
    if (roleElement) roleElement.textContent = user.role || '-';
    
    console.log("User profile updated:", user);
}

function fetchUserProfile(token) {
    fetch('/api/user', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        return response.json();
    })
    .then(data => {
        console.log("User profile data:", data); // Debug output
        
        if (data && data.data && data.data.length > 0) {
            updateUserProfile(data.data[0]);
        } else {
            console.error("Unexpected user profile data structure:", data);
            localStorage.removeItem('jwt_token');
            hideDashboard();
        }
    })
    .catch(error => {
        console.error('Error fetching user profile:', error);
        localStorage.removeItem('jwt_token');
        hideDashboard();
    });
}