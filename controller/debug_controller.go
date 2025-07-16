package controller

import (
	"github.com/Et43/BARK/service"
	"github.com/gin-gonic/gin"
)

type DebugController interface {
	GetDebugDashboard(*gin.Context)
	GetRedisQueueData(*gin.Context)
	GetAgentDebugData(*gin.Context)
	GetSystemHealth(*gin.Context)
	GetWebSocketConnections(*gin.Context)
	FlushRedisQueues(*gin.Context)
	TestDatabaseConnection(*gin.Context)
}

type DebugControllerImpl struct {
	debugService service.DebugService
}

func (ctrl *DebugControllerImpl) GetDebugDashboard(c *gin.Context) {
	ctrl.debugService.GetDebugDashboard(c)
}

func (ctrl *DebugControllerImpl) GetRedisQueueData(c *gin.Context) {
	ctrl.debugService.GetRedisQueueData(c)
}

func (ctrl *DebugControllerImpl) GetAgentDebugData(c *gin.Context) {
	ctrl.debugService.GetAgentDebugData(c)
}

func (ctrl *DebugControllerImpl) GetSystemHealth(c *gin.Context) {
	ctrl.debugService.GetSystemHealth(c)
}

func (ctrl *DebugControllerImpl) GetWebSocketConnections(c *gin.Context) {
	ctrl.debugService.GetWebSocketConnections(c)
}

func (ctrl *DebugControllerImpl) FlushRedisQueues(c *gin.Context) {
	ctrl.debugService.FlushRedisQueues(c)
}

func (ctrl *DebugControllerImpl) TestDatabaseConnection(c *gin.Context) {
	ctrl.debugService.TestDatabaseConnection(c)
}

func DebugControllerInit(debugService service.DebugService) *DebugControllerImpl {
	return &DebugControllerImpl{
		debugService: debugService,
	}
}
