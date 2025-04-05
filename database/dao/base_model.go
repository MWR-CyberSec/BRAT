package dao

import (
	"time"

	"gorm.io/gorm"
)

type BaseModel struct {
	CreatedAt time.Time      `gorm:"->:false;column:created_at" json:"-"`
	UpdatedAt time.Time      `gorm:"->:false;column:updated_at" json:"-"`
	DeletedAt gorm.DeletedAt `gorm:"->:false;column:deleted_at" json:"-"`
}

type User struct {
	BaseModel
	ID       int    `gorm:"column:id; primary_key; not null" json:"id"`
	Name     string `gorm:"column:name" json:"name"`
	Email    string `gorm:"column:email" json:"email"`
	Password string `gorm:"column:password" json:"-"` // Hmm this is apprently how yo udo it idfk
	Role     string `gorm:"column:role;default:user" json:"role"`
}

type Agent struct {
	BaseModel
	ID         int    `gorm:"column:id; primary_key; not null" json:"id"`
	Name       string `gorm:"column:name" json:"name"`
	IsStager   bool   `gorm:"column:is_stager" json:"is_stager"`
	SystemInfo string `gorm:"column:system_info" json:"system_info"` // This is the system info of the agent
	SourceIP   string `gorm:"column:source" json:"source"`           // This is the source IP of the agent
}
