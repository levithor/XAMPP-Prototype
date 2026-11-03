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
    rtsp_url VARCHAR(500),
    status VARCHAR(20),
    desired_connection_state VARCHAR(20) NOT NULL DEFAULT 'disconnected',
    source_type VARCHAR(24) NOT NULL DEFAULT 'rtsp_yolo',
    external_camera_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    external_area_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    dahua_mapping_revision INT NOT NULL DEFAULT 0,
    dahua_mapping_updated_at DATETIME(6) NULL,
    assigned_room_id INT,
    last_communication DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    connection_enabled TINYINT(1) NOT NULL DEFAULT 0,

    UNIQUE KEY uq_cameras_external_mapping
        (source_type, external_camera_id, external_area_id),
    FOREIGN KEY (assigned_room_id)
        REFERENCES rooms(room_id)
        ON DELETE SET NULL
);

CREATE TABLE occupancy_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    camera_id INT NULL,
    occupancy_count INT NOT NULL,
    recorded_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    source_type VARCHAR(24) NOT NULL DEFAULT 'rtsp_yolo',
    external_observation_id BIGINT UNSIGNED NULL,
    external_camera_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    external_area_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,

    UNIQUE KEY uq_occupancy_external_observation
        (source_type, external_observation_id),
    FOREIGN KEY (room_id)
        REFERENCES rooms(room_id),

    FOREIGN KEY (camera_id)
        REFERENCES cameras(camera_id)
        ON DELETE SET NULL
);

CREATE TABLE camera_external_state (
    camera_id INT PRIMARY KEY,
    external_camera_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    external_area_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    occupancy_count INT NULL,
    occupancy_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    observation_id BIGINT UNSIGNED NULL,
    observed_at_utc DATETIME(6) NULL,
    received_at_utc DATETIME(6) NULL,
    status_evaluated_at_utc DATETIME(6) NULL,
    reporting_status VARCHAR(32) NULL,
    sync_health VARCHAR(16) NOT NULL DEFAULT 'disabled',
    last_successful_sync_at DATETIME(6) NULL,
    last_error_code VARCHAR(64) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_camera_external_state_camera
        FOREIGN KEY (camera_id) REFERENCES cameras(camera_id)
        ON DELETE CASCADE
);

CREATE TABLE dahua_sync_checkpoints (
    checkpoint_key CHAR(64) PRIMARY KEY,
    camera_id INT NOT NULL,
    external_camera_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    external_area_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    completed_observation_id BIGINT UNSIGNED NULL,
    scan_target_observation_id BIGINT UNSIGNED NULL,
    scan_before_observation_id BIGINT UNSIGNED NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_dahua_sync_checkpoints_camera (camera_id),
    CONSTRAINT fk_dahua_sync_checkpoints_camera
        FOREIGN KEY (camera_id) REFERENCES cameras(camera_id)
        ON DELETE CASCADE
);

CREATE TABLE alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    log_id INT,
    alert_type VARCHAR(50),
    message TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (room_id)
        REFERENCES rooms(room_id)
);
