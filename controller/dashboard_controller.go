package controller

import (
	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
)

type DashboardController interface {
	ShowDashboard(*gin.Context)
}

type DashboardControllerImpl struct {
	dashboardService service.DashboardService
}

func (d *DashboardControllerImpl) ShowDashboard(c *gin.Context) {
	// Add null check for safety
	if d.dashboardService == nil {
		c.JSON(500, gin.H{"error": "Dashboard service not initialized"})
		return
	}

	d.dashboardService.ShowDashboard(c)
}

func DashboardControllerInit(dashboardService service.DashboardService) *DashboardControllerImpl {
	// Log or print to verify
	if dashboardService == nil {
		panic("dashboardService cannot be nil")
	}

	return &DashboardControllerImpl{
		dashboardService: dashboardService,
	}
}
