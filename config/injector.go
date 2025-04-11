//go:build wireinject
// +build wireinject

package config

import (
	"github.com/Et43/BARK/controller"
	"github.com/Et43/BARK/repository"
	"github.com/Et43/BARK/service"
	"github.com/google/wire"
)

var db = wire.NewSet(InitDB)

var userServiceSet = wire.NewSet(service.UserServiceInit, wire.Bind(new(service.UserService), new(*service.UserServiceImpl)))

var userRepoSet = wire.NewSet(repository.UserRepositoryInit, wire.Bind(new(repository.UserRepository), new(*repository.UserRepositoryImpl)))

var userCtrlSet = wire.NewSet(controller.UserControllerInit, wire.Bind(new(controller.UserController), new(*controller.UserControllerImpl)))

var authServiceSet = wire.NewSet(service.AuthServiceInit, wire.Bind(new(service.AuthService), new(*service.AuthServiceImpl)))

var authCtrlSet = wire.NewSet(controller.AuthControllerInit, wire.Bind(new(controller.AuthController), new(*controller.AuthControllerImpl)))

var agentRepoSet = wire.NewSet(repository.AgentRepositoryInit, wire.Bind(new(repository.AgentRepository), new(*repository.AgentRepositoryImpl)))

var agentServiceSet = wire.NewSet(service.AgentServiceInit, wire.Bind(new(service.AgentService), new(*service.AgentServiceImpl)))

var agentCtrlSet = wire.NewSet(controller.AgentControllerInit, wire.Bind(new(controller.AgentController), new(*controller.AgentControllerImpl)))

// Make sure dashboardServiceSet uses agentService
var dashboardServiceSet = wire.NewSet(
	service.DashboardServiceInit,
	wire.Bind(new(service.DashboardService), new(*service.DashboardServiceImpl)),
)

var dashboardCtrlSet = wire.NewSet(
	controller.DashboardControllerInit,
	wire.Bind(new(controller.DashboardController), new(*controller.DashboardControllerImpl)),
)

func Init() *Initialization {
	wire.Build(
		db,
		userRepoSet,
		agentRepoSet,
		userServiceSet,
		authServiceSet,
		agentServiceSet,
		dashboardServiceSet,
		userCtrlSet,
		authCtrlSet,
		agentCtrlSet,
		dashboardCtrlSet,
		NewInitialization,
	)
	return nil
}
