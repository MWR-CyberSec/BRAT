package repository

import (
	"github.com/Et43/BARK/database/dao"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type UserRepository interface {
	FindAllUser() ([]dao.User, error)
	FindUserById(userID int) (dao.User, error)
	Save(user *dao.User) (dao.User, error)
	DeleteUserById(userID int) error
	FindByEmail(email string) (dao.User, error)
}

type UserRepositoryImpl struct {
	db *gorm.DB
}

func (u UserRepositoryImpl) FindAllUser() ([]dao.User, error) {
	var users []dao.User
	err := u.db.Find(&users).Error
	if err != nil {
		log.Error(err)
		return nil, err
	}
	return users, nil
}

func (u UserRepositoryImpl) FindByEmail(email string) (dao.User, error) {
	var user dao.User
	err := u.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		log.Error(err)
		return user, err
	}
	return user, nil
}

func (u UserRepositoryImpl) FindUserById(userID int) (dao.User, error) {
	user := dao.User{
		ID: userID,
	}
	err := u.db.First(&user).Error
	if err != nil {
		log.Error(err)
		return user, err
	}
	return user, nil
}

func (u UserRepositoryImpl) DeleteUserById(id int) error {
	user := dao.User{
		ID: id,
	}
	err := u.db.Delete(&user).Error
	if err != nil {
		log.Error(err)
		return err
	}
	return nil
}

func (u UserRepositoryImpl) Save(user *dao.User) (dao.User, error) {
	println("user", user)
	println("user", user.Password)
	err := u.db.Save(user).Error
	if err != nil {
		log.Error(err)
		return dao.User{}, err
	}
	return *user, nil
}

func UserRepositoryInit(db *gorm.DB) *UserRepositoryImpl {
	return &UserRepositoryImpl{db: db}
}
