package service

import (
	"net/http"
	"strconv"

	"github.com/Et43/BARK/constant"
	"github.com/Et43/BARK/database/dao"
	"github.com/Et43/BARK/pkg"
	"github.com/Et43/BARK/repository"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
)

type UserService interface {
	GetAllUserData(c *gin.Context)
	AddUserData(c *gin.Context)
	GetUserById(c *gin.Context)
	UpdateUserData(c *gin.Context)
	DeleteUser(c *gin.Context)
}

type UserServiceImpl struct {
	userRepository repository.UserRepository
}

func (u UserServiceImpl) UpdateUserData(c *gin.Context) {

	defer pkg.PanicHandler(c)

	log.Info("UpdateUserData")
	userID, _ := strconv.Atoi(c.Param("userID"))

	var request dao.User
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Error(err)
		pkg.PanicException(constant.InvalidRequest)
	}

	data, err := u.userRepository.FindUserById(userID)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.DataNotFound)
	}

	data.Name = request.Name
	data.Email = request.Email
	data.Password = request.Password
	u.userRepository.Save(&data)

	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, data))
}

func (u UserServiceImpl) GetUserById(c *gin.Context) {

	defer pkg.PanicHandler(c)

	log.Info("GetUserById")
	userID, _ := strconv.Atoi(c.Param("userID"))

	data, err := u.userRepository.FindUserById(userID)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.DataNotFound)
	}

	c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, data))
}

func (u UserServiceImpl) AddUserData(c *gin.Context) {

	defer pkg.PanicHandler(c)

	log.Info("AddUserData")
	var request dao.User
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Error(err)
		pkg.PanicException(constant.InvalidRequest)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	log.Info("request", request)
	request.Password = string(hash)
	u.userRepository.Save(&request)

	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.UnkownError)
	}

	c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, request))
}

func (u UserServiceImpl) GetAllUserData(c *gin.Context) {
	defer pkg.PanicHandler(c)
	log.Info("GetAllUserData")

	// Get user role and ID from JWT context (set by JWTAuth middleware)
	role, exists := c.Get("userRole")
	if !exists {
		log.Error("User role not found in context")
		pkg.PanicException(constant.Unauthorised)
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		log.Error("User ID not found in context")
		pkg.PanicException(constant.Unauthorised)
		return
	}

	// For admin users, return all users
	if role.(string) == "admin" {
		data, err := u.userRepository.FindAllUser()
		if err != nil {
			log.Error(err)
			pkg.PanicException(constant.DataNotFound)
		}
		c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, data))
		return
	}

	// For regular users, return only their own user data
	data, err := u.userRepository.FindUserById(userID.(int))
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.DataNotFound)
	}

	// Wrap single user in array to maintain consistent response format
	users := []dao.User{data}
	c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, users))
}

func (u UserServiceImpl) DeleteUser(c *gin.Context) {

	defer pkg.PanicHandler(c)

	log.Info("DeleteUser")
	userID, _ := strconv.Atoi(c.Param("userID"))

	err := u.userRepository.DeleteUserById(userID)
	if err != nil {
		log.Error(err)
		pkg.PanicException(constant.DataNotFound)
	}

	c.JSON(http.StatusOK, pkg.BuildResponse(constant.Success, pkg.Null()))
}

func UserServiceInit(userRepository repository.UserRepository) *UserServiceImpl {
	return &UserServiceImpl{userRepository: userRepository}
}
