
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in (has token in localStorage)
    const token = localStorage.getItem('jwt_token');
    if (token) {
        showDashboard();
        fetchUserProfile(token);
    }

    // Toggle between login and register forms
    document.getElementById('show-register').addEventListener('click', function(e) {
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
    
    document.getElementById('show-login').addEventListener('click', function(e) {
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
    
    // Login form handling
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                localStorage.setItem('jwt_token', data.data.token);
                showDashboard();
                updateUserProfile(data.data.user);
            } else {
                alert('Login failed: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred during login');
        });
    });
    
    // Register form handling
    document.getElementById('register-form').addEventListener('submit', function(e) {
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
            if (data.status === 'success') {
                localStorage.setItem('jwt_token', data.data.token);
                showDashboard();
                updateUserProfile(data.data.user);
            } else {
                alert('Registration failed: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred during registration');
        });
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('jwt_token');
        hideDashboard();
    });
    
    // Modal handling
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');
    
    // Edit profile button
    document.getElementById('edit-profile-btn').addEventListener('click', function() {
        document.getElementById('profile-modal').style.display = 'block';
        
        // Populate form with current user data
        const userName = document.getElementById('user-name').textContent;
        const userEmail = document.getElementById('user-email').textContent;
        
        document.getElementById('edit-name').value = userName;
        document.getElementById('edit-email').value = userEmail;
    });
    
    // View agents button
    document.getElementById('view-agents-btn').addEventListener('click', function() {
        document.getElementById('agents-modal').style.display = 'block';
        fetchAgents();
    });
    
    // Close buttons for modals
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Edit profile form submission
    document.getElementById('edit-profile-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('edit-name').value;
        const email = document.getElementById('edit-email').value;
        const password = document.getElementById('edit-password').value;
        
        const updateData = { name, email };
        if (password) {
            updateData.password = password;
        }
        
        const token = localStorage.getItem('jwt_token');
        fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(updateData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Profile updated successfully');
                document.getElementById('profile-modal').style.display = 'none';
                updateUserProfile(data.data);
            } else {
                alert('Failed to update profile: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while updating profile');
        });
    });
});

// Helper functions
function showDashboard() {
    document.getElementById('auth-panels').style.display = 'none';
    document.getElementById('dashboard').style.display = 'grid';
}

function hideDashboard() {
    document.getElementById('auth-panels').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
}

function updateUserProfile(user) {
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-role').textContent = user.role;
}

function fetchUserProfile(token) {
    fetch('/api/user', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            updateUserProfile(data.data[0]);
        } else {
            alert('Failed to load user profile: ' + data.message);
            localStorage.removeItem('jwt_token');
            hideDashboard();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        localStorage.removeItem('jwt_token');
        hideDashboard();
    });
}

function fetchAgents() {
    const token = localStorage.getItem('jwt_token');
    fetch('/api/agents', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            populateAgentsTable(data.data);
        } else {
            alert('Failed to load agents: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while fetching agents');
    });
}

function populateAgentsTable(agents) {
    const tableBody = document.getElementById('agents-table-body');
    tableBody.innerHTML = '';
    
    if (agents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No agents connected</td></tr>';
        return;
    }
    
    agents.forEach(agent => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${agent.id}</td>
            <td>${agent.hostname}</td>
            <td>${agent.ip_address}</td>
            <td>${new Date(agent.last_checkin).toLocaleString()}</td>
            <td>
                <button class="btn btn-small">Connect</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}