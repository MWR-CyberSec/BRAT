// Plugin Library Management System
// This handles the plugin creation, editing, and management UI

class PluginLibrary {
    constructor() {
        this.plugins = [];
        this.currentPlugin = null;
        this.editor = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupLibrary());
        } else {
            this.setupLibrary();
        }
    }

    setupLibrary() {
        this.bindEvents();
        this.loadPlugins();
        this.initializeCodeEditor();
    }

    bindEvents() {
        // Plugin library toggle button
        const libraryBtn = document.getElementById('plugin-library-btn');
        if (libraryBtn) {
            libraryBtn.addEventListener('click', () => this.openLibrary());
        }

        // Close library modal
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-library')) {
                this.closeLibrary();
            }
        });

        // Create new plugin button
        const newPluginBtn = document.getElementById('new-plugin-btn');
        if (newPluginBtn) {
            newPluginBtn.addEventListener('click', () => this.createNewPlugin());
        }

        // Save plugin button
        const savePluginBtn = document.getElementById('save-plugin-btn');
        if (savePluginBtn) {
            savePluginBtn.addEventListener('click', () => this.saveCurrentPlugin());
        }

        // Load template button
        const loadTemplateBtn = document.getElementById('load-template-btn');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', () => this.loadTemplate());
        }

        // Plugin list clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('plugin-list-item') || e.target.closest('.plugin-list-item')) {
                const item = e.target.classList.contains('plugin-list-item') ? e.target : e.target.closest('.plugin-list-item');
                this.selectPlugin(item.dataset.pluginName);
            }
        });

        // Delete plugin buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-plugin-btn')) {
                const pluginName = e.target.dataset.pluginName;
                this.deletePlugin(pluginName);
            }
        });
    }

    async loadPlugins() {
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
            this.plugins = data.plugins || [];
            this.renderPluginList();
        } catch (error) {
            console.error('Error loading plugins:', error);
            this.showError('Failed to load plugins: ' + error.message);
        }
    }

    renderPluginList() {
        const pluginList = document.getElementById('plugin-library-list');
        if (!pluginList) return;

        if (this.plugins.length === 0) {
            pluginList.innerHTML = '<div class="no-plugins">No plugins available. Create your first plugin!</div>';
            return;
        }

        pluginList.innerHTML = '';
        
        this.plugins.forEach(plugin => {
            const pluginItem = document.createElement('div');
            pluginItem.className = 'plugin-list-item';
            pluginItem.dataset.pluginName = plugin.name;
            
            pluginItem.innerHTML = `
                <div class="plugin-info">
                    <h4>${plugin.name}</h4>
                    <p>${plugin.description}</p>
                    <small>File: ${plugin.filename}</small>
                </div>
                <div class="plugin-actions">
                    <button class="btn-icon edit-plugin-btn" title="Edit Plugin">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-plugin-btn" data-plugin-name="${plugin.name}" title="Delete Plugin">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            pluginList.appendChild(pluginItem);
        });
    }

    initializeCodeEditor() {
        const editorContainer = document.getElementById('plugin-code-editor');
        if (!editorContainer) return;

        // Simple code editor with syntax highlighting support
        const textarea = document.createElement('textarea');
        textarea.id = 'plugin-code-textarea';
        textarea.className = 'code-editor';
        textarea.placeholder = 'Plugin code will appear here...';
        editorContainer.appendChild(textarea);

        this.editor = textarea;

        // Add basic features
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
        });
    }

    async loadTemplate() {
        try {
            const response = await fetch('/api/stager/plugins/template', {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (this.editor) {
                this.editor.value = data.template;
            }

            // Clear current plugin info
            this.currentPlugin = null;
            this.updateEditorInfo('New Plugin Template');

        } catch (error) {
            console.error('Error loading template:', error);
            this.showError('Failed to load template: ' + error.message);
        }
    }

    createNewPlugin() {
        this.currentPlugin = null;
        this.loadTemplate();
        
        // Focus on the editor
        if (this.editor) {
            this.editor.focus();
        }
    }

    selectPlugin(pluginName) {
        const plugin = this.plugins.find(p => p.name === pluginName);
        if (!plugin) return;

        this.currentPlugin = plugin;
        
        if (this.editor) {
            this.editor.value = plugin.content || '';
        }

        this.updateEditorInfo(plugin.name);
        
        // Update form fields
        const nameInput = document.getElementById('plugin-name-input');
        const descInput = document.getElementById('plugin-description-input');
        
        if (nameInput) nameInput.value = plugin.name;
        if (descInput) descInput.value = plugin.description;
    }

    updateEditorInfo(pluginName) {
        const editorTitle = document.getElementById('editor-title');
        if (editorTitle) {
            editorTitle.textContent = `Editing: ${pluginName}`;
        }
    }

    async saveCurrentPlugin() {
        const nameInput = document.getElementById('plugin-name-input');
        const descInput = document.getElementById('plugin-description-input');
        
        const name = nameInput ? nameInput.value.trim() : '';
        const description = descInput ? descInput.value.trim() : '';
        const content = this.editor ? this.editor.value : '';

        if (!name) {
            this.showError('Plugin name is required');
            return;
        }

        if (!content.trim()) {
            this.showError('Plugin content is required');
            return;
        }

        const saveBtn = document.getElementById('save-plugin-btn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;

        try {
            const pluginData = {
                name: name,
                description: description || 'No description provided',
                content: content
            };

            let response;
            if (this.currentPlugin) {
                // Update existing plugin
                response = await fetch(`/api/stager/plugins/${this.currentPlugin.name}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
                    },
                    body: JSON.stringify(pluginData)
                });
            } else {
                // Create new plugin
                response = await fetch('/api/stager/plugins', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
                    },
                    body: JSON.stringify(pluginData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.showSuccess(result.message || 'Plugin saved successfully!');
            
            // Reload plugins list
            await this.loadPlugins();
            
            // Update current plugin reference
            this.currentPlugin = pluginData;

        } catch (error) {
            console.error('Error saving plugin:', error);
            this.showError('Failed to save plugin: ' + error.message);
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    async deletePlugin(pluginName) {
        if (!confirm(`Are you sure you want to delete the plugin "${pluginName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/stager/plugins/${pluginName}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.showSuccess(result.message || 'Plugin deleted successfully!');
            
            // Clear editor if this plugin was being edited
            if (this.currentPlugin && this.currentPlugin.name === pluginName) {
                this.currentPlugin = null;
                if (this.editor) {
                    this.editor.value = '';
                }
                this.updateEditorInfo('No plugin selected');
            }
            
            // Reload plugins list
            await this.loadPlugins();

        } catch (error) {
            console.error('Error deleting plugin:', error);
            this.showError('Failed to delete plugin: ' + error.message);
        }
    }

    openLibrary() {
        const modal = document.getElementById('plugin-library-modal');
        if (modal) {
            modal.style.display = 'block';
            this.loadPlugins(); // Refresh plugins when opening
        }
    }

    closeLibrary() {
        const modal = document.getElementById('plugin-library-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Remove on click
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
}

// Initialize the plugin library when the script loads
window.pluginLibrary = new PluginLibrary();