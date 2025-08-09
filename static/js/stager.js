// Stager Configurator JavaScript
// This handles the stager generation UI and API interactions

class StagerConfigurator {
    constructor() {
        this.modal = null;
        this.availablePlugins = [];
        this.selectedPlugins = [];
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupModal());
        } else {
            this.setupModal();
        }
    }

    setupModal() {
        this.modal = document.getElementById('payload-modal');
        if (!this.modal) {
            console.warn('Stager modal not found');
            return;
        }

        this.bindEvents();
        this.loadAvailablePlugins();
    }

    bindEvents() {
        // Close modal events
        const closeBtn = this.modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Generate stager button
        const generateBtn = document.getElementById('generate-stager');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateStager());
        }

        // Show full source button
        const showSourceBtn = document.getElementById('show-full-source');
        if (showSourceBtn) {
            showSourceBtn.addEventListener('click', () => this.toggleFullSource());
        }

        // Copy buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn') || e.target.closest('.copy-btn')) {
                const btn = e.target.classList.contains('copy-btn') ? e.target : e.target.closest('.copy-btn');
                this.copyToClipboard(btn);
            }
        });
    }

    async loadAvailablePlugins() {
        try {
            const response = await fetch('/api/stager/plugins', {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.availablePlugins = data.plugins || [];
            this.renderPluginList();
        } catch (error) {
            console.error('Error loading plugins:', error);
            this.showPluginError('Failed to load plugins: ' + error.message);
        }
    }

    renderPluginList() {
        const pluginList = document.getElementById('plugin-list');
        if (!pluginList) return;

        if (this.availablePlugins.length === 0) {
            pluginList.innerHTML = '<div class="loading">No plugins available</div>';
            return;
        }

        pluginList.innerHTML = '';
        
        this.availablePlugins.forEach(plugin => {
            const pluginItem = document.createElement('div');
            pluginItem.className = 'plugin-item';
            pluginItem.dataset.pluginName = plugin.name;
            
            pluginItem.innerHTML = `
                <h4>${plugin.name}</h4>
                <p>${plugin.description}</p>
            `;

            pluginItem.addEventListener('click', () => this.togglePlugin(plugin.name, pluginItem));
            pluginList.appendChild(pluginItem);
        });
    }

    showPluginError(message) {
        const pluginList = document.getElementById('plugin-list');
        if (pluginList) {
            pluginList.innerHTML = `<div class="loading" style="color: var(--cyberpunk-accent);">${message}</div>`;
        }
    }

    togglePlugin(pluginName, element) {
        const index = this.selectedPlugins.indexOf(pluginName);
        
        if (index === -1) {
            // Add plugin
            this.selectedPlugins.push(pluginName);
            element.classList.add('selected');
        } else {
            // Remove plugin
            this.selectedPlugins.splice(index, 1);
            element.classList.remove('selected');
        }
    }

    async generateStager() {
        const generateBtn = document.getElementById('generate-stager');
        const serverIP = document.getElementById('server-ip').value.trim();
        const serverPort = document.getElementById('server-port').value.trim();
        const useHTTPS = document.getElementById('use-https').checked;
        const agentID = document.getElementById('agent-id').value.trim();
        const minifyCode = document.getElementById('minify-code').checked;
        const obfuscate = document.getElementById('obfuscate').checked;

        // Validation
        if (!serverIP) {
            alert('Server IP is required');
            return;
        }

        if (!serverPort) {
            alert('Server Port is required');
            return;
        }

        // Disable button and show loading
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        try {
            const config = {
                server_ip: serverIP,
                server_port: serverPort,
                use_https: useHTTPS,
                agent_id: agentID || '',
                plugins: this.selectedPlugins,
                minify_code: minifyCode,
                obfuscate: obfuscate
            };

            const response = await fetch('/api/stager/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.displayResults(result);

        } catch (error) {
            console.error('Error generating stager:', error);
            alert('Failed to generate stager: ' + error.message);
        } finally {
            // Re-enable button
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-cogs"></i> Generate Stager';
        }
    }

    displayResults(result) {
        // Show results section
        const resultsSection = document.getElementById('stager-results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        // Show minification stats if available
        if (result.minified_source && result.stager_source) {
            const originalSize = result.stager_source.length;
            const minifiedSize = result.minified_source.length;
            const reduction = Math.round(((originalSize - minifiedSize) / originalSize) * 100);
            
            this.showMinificationInfo(originalSize, minifiedSize, reduction);
        }

        // Update script tag URL
        const scriptTagUrl = document.getElementById('script-tag-url');
        if (scriptTagUrl && result.stager_url) {
            const fullUrl = window.location.origin + result.stager_url;
            scriptTagUrl.textContent = `<script src="${fullUrl}"></script>`;
        }

        // Update inline code
        const inlineCode = document.getElementById('inline-code');
        if (inlineCode && result.minified_source) {
            inlineCode.value = result.minified_source;
        }

        // Update full source
        const fullSource = document.getElementById('full-source');
        if (fullSource && result.stager_source) {
            fullSource.value = result.stager_source;
        }

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    showMinificationInfo(originalSize, minifiedSize, reduction) {
        // Remove any existing minification info
        const existingInfo = document.querySelector('.minification-info');
        if (existingInfo) {
            existingInfo.remove();
        }

        // Create minification info element
        const info = document.createElement('div');
        info.className = 'minification-info';
        info.innerHTML = `
            <div>
                <i class="fas fa-compress-alt"></i> 
                <strong>Minification Results:</strong>
            </div>
            <div class="minification-stats">
                <div class="size-stat">
                    <span>Original:</span>
                    <span>${this.formatBytes(originalSize)}</span>
                </div>
                <div class="size-stat">
                    <span>Minified:</span>
                    <span>${this.formatBytes(minifiedSize)}</span>
                </div>
                <div class="size-stat">
                    <span>Reduction:</span>
                    <span class="size-reduction">${reduction}%</span>
                </div>
            </div>
        `;

        // Insert before the delivery methods
        const deliveryMethods = document.querySelector('.delivery-methods');
        if (deliveryMethods) {
            deliveryMethods.parentNode.insertBefore(info, deliveryMethods);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Refresh plugin list (called when plugin library makes changes)
    refreshPluginList() {
        this.loadAvailablePlugins();
    }

    toggleFullSource() {
        const container = document.getElementById('full-source-container');
        const btn = document.getElementById('show-full-source');
        
        if (container.style.display === 'none') {
            container.style.display = 'block';
            btn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Full Source';
        } else {
            container.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-code"></i> Show Full Source';
        }
    }

    async copyToClipboard(button) {
        const targetId = button.dataset.target;
        const targetElement = document.getElementById(targetId);
        
        if (!targetElement) {
            console.error('Target element not found:', targetId);
            this.showCopyFeedback(button, 'error', 'Target not found');
            return;
        }

        let textToCopy = '';
        if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
            textToCopy = targetElement.value;
        } else {
            textToCopy = targetElement.textContent || targetElement.innerText;
        }

        if (!textToCopy.trim()) {
            this.showCopyFeedback(button, 'error', 'Nothing to copy');
            return;
        }

        try {
            // Modern clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
                this.showCopyFeedback(button, 'success', 'Copied!');
            } else {
                // Fallback for older browsers or non-HTTPS
                this.fallbackCopyToClipboard(textToCopy, button);
            }
        } catch (error) {
            console.error('Clipboard API failed:', error);
            this.fallbackCopyToClipboard(textToCopy, button);
        }
    }

    fallbackCopyToClipboard(text, button) {
        try {
            // Create a temporary textarea
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                this.showCopyFeedback(button, 'success', 'Copied!');
            } else {
                this.showCopyFeedback(button, 'error', 'Copy failed');
            }
        } catch (error) {
            console.error('Fallback copy failed:', error);
            this.showCopyFeedback(button, 'error', 'Copy not supported');
        }
    }

    showCopyFeedback(button, type, message) {
        const originalContent = button.innerHTML;
        const originalColor = button.style.backgroundColor;
        
        if (type === 'success') {
            button.innerHTML = '<i class="fas fa-check"></i> ' + message;
            button.style.backgroundColor = '#00ff41';
        } else {
            button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + message;
            button.style.backgroundColor = '#ff0041';
        }
        
        button.disabled = true;
        
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.style.backgroundColor = originalColor;
            button.disabled = false;
        }, 2000);
    }

    openModal() {
        if (this.modal) {
            this.modal.style.display = 'block';
            
            // Set default server IP to current hostname if empty
            const serverIpInput = document.getElementById('server-ip');
            if (serverIpInput && !serverIpInput.value) {
                serverIpInput.value = window.location.hostname || 'localhost';
            }
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            
            // Reset results
            const resultsSection = document.getElementById('stager-results');
            if (resultsSection) {
                resultsSection.style.display = 'none';
            }
            
            // Reset full source toggle
            const container = document.getElementById('full-source-container');
            const btn = document.getElementById('show-full-source');
            if (container && btn) {
                container.style.display = 'none';
                btn.innerHTML = '<i class="fas fa-code"></i> Show Full Source';
            }
        }
    }
}

// Initialize the stager configurator when the script loads
window.stagerConfigurator = new StagerConfigurator();