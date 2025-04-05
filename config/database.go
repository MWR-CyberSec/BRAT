package config

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

/*
*
* BARK Database Configuration
*
* This module is responsible for configuring the database connection using GORM.
* It uses PostgreSQL as the database driver.
* The connection string is read from the environment variable DATABASE_URL.
*
*
* The InitDB function initializes the database connection and returns a gorm.DB instance.
* It logs an error message and exits the program if the connection fails.
*
 */

func InitDB() *gorm.DB {

	var err error

	dsn := os.Getenv("DATABASE_URL")

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	if err != nil {
		log.Fatalf("Error connecting to database: %v", err)
	}

	return db
}
