CREATE DATABASE bark_c2;
\connect bark_c2;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_stager BOOLEAN NOT NULL,
    source VARCHAR(255),
    system_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Add default admin user (password: admin123)
INSERT INTO users (name, email, password, role);
VALUES ('Admin', 'admin@example.com', '$2a$10$ZWvkAx8Qj0G0CrVt.AJhU.mQjndiYxj4H5PUfA3Kc4MhlQFqAKtMS', 'admin');