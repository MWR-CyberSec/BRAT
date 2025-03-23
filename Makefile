init-dependency:
	go get -u github.com/antonfisher/nested-logrus-formatter
	go get -u github.com/gin-gonic/gin
	go get -u golang.org/x/crypto
	go get -u gorm.io/gorm
	go get -u gorm.io/driver/postgres
	go get -u github.com/sirupsen/logrus
	go get -u github.com/joho/godotenv
	go get -u github.com/gorilla/websocket


build-docker:
	docker compose down
	-docker volume prune -f
	-docker rm bark
	-docker rmi bark
	docker compose build --no-cache app
	docker compose up -d


clean:
	docker compose down
	docker volume prune -f
	-docker rmi bark-app
	-docker rm bark

rebuild-docker:
	docker compose down
	docker compose build app
	docker compose up -d