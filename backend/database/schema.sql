DROP DATABASE IF EXISTS occuvision;
CREATE DATABASE IF NOT EXISTS occuvision;
USE occuvision;

CREATE TABLE admins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    profile_image_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL
);

CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    capacity_limit INT NOT NULL,
    occupancy_threshold INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cameras (
    camera_id INT AUTO_INCREMENT PRIMARY KEY,
    camera_name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    status VARCHAR(20),
    assigned_room_id INT,
    last_communication DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (assigned_room_id)
        REFERENCES rooms(room_id)
);

CREATE TABLE occupancy_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    camera_id INT,
    occupancy_count INT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (room_id)
        REFERENCES rooms(room_id),

    FOREIGN KEY (camera_id)
        REFERENCES cameras(camera_id)
);

CREATE TABLE alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    alert_type VARCHAR(50),
    message TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (room_id)
        REFERENCES rooms(room_id)
);
