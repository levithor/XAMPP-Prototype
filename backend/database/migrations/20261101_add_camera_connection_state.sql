USE occuvision;

ALTER TABLE cameras
    ADD COLUMN desired_connection_state VARCHAR(20) NOT NULL DEFAULT 'disconnected';
