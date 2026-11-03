USE occuvision;

ALTER TABLE cameras
    ADD COLUMN source_type VARCHAR(24) NOT NULL DEFAULT 'rtsp_yolo',
    ADD COLUMN external_camera_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    ADD COLUMN external_area_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    ADD COLUMN dahua_mapping_revision INT NOT NULL DEFAULT 0,
    ADD COLUMN dahua_mapping_updated_at DATETIME(6) NULL,
    ADD UNIQUE KEY uq_cameras_external_mapping
        (source_type, external_camera_id, external_area_id);

ALTER TABLE occupancy_logs
    ADD COLUMN source_type VARCHAR(24) NOT NULL DEFAULT 'rtsp_yolo',
    ADD COLUMN external_observation_id BIGINT UNSIGNED NULL,
    ADD COLUMN external_camera_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    ADD COLUMN external_area_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    MODIFY COLUMN recorded_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD UNIQUE KEY uq_occupancy_external_observation
        (source_type, external_observation_id);

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