FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o app ./main.go

# Use a minimal alpine image for the final stage
FROM alpine:latest

WORKDIR /root/

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy the binary from the builder stage
COPY --from=builder /app/app .

# Copy .env file if it exists (Docker will just warn if missing)
COPY --from=builder /app/.env ./ 

# initialize the database
COPY --from=builder /app/build_scripts/init.sql ./

# Expose the port
EXPOSE 8080

# Run the binary
CMD ["./app"]