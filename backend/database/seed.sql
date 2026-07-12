USE occuvision;

DELETE FROM alerts;
DELETE FROM occupancy_logs;
DELETE FROM cameras;
DELETE FROM rooms;
DELETE FROM admins;

INSERT INTO rooms
(room_name, capacity_limit, occupancy_threshold)
VALUES
('Computer Lab A', 40, 35),
('Lecture Hall 101', 120, 100),
('Library Study Room', 20, 15),
('Engineering Lab', 60, 50),
('Meeting Room B', 15, 12);

INSERT INTO cameras
(camera_name, rtsp_url, status, assigned_room_id, last_communication)
VALUES
('Cam-LabA', 'rtsp://192.168.1.101/stream', 'ONLINE', 1, NOW()),
('Cam-Lecture101', 'rtsp://192.168.1.102/stream', 'ONLINE', 2, NOW()),
('Cam-Library', 'rtsp://192.168.1.103/stream', 'ONLINE', 3, NOW()),
('Cam-EngLab', 'rtsp://192.168.1.104/stream', 'ONLINE', 4, NOW()),
('Cam-MeetingB', '192.168.1.105', 'OFFLINE', 5, DATE_SUB(NOW(), INTERVAL 2 HOUR));

INSERT INTO admins
(email, password_hash, username)
VALUES
(
'admin@occuvision.com',
'$2b$10$demo.demo.demo.demo.demo.demo.demo.demo.demo',
'admin'
);

INSERT INTO occupancy_logs
(room_id, camera_id, occupancy_count, recorded_at)
VALUES
(1,1,5,'2026-06-23 08:00:00'),
(1,1,12,'2026-06-23 09:00:00'),
(1,1,18,'2026-06-23 10:00:00'),
(1,1,24,'2026-06-23 11:00:00'),
(1,1,30,'2026-06-23 12:00:00'),
(1,1,34,'2026-06-23 13:00:00'),
(1,1,28,'2026-06-23 14:00:00'),
(1,1,20,'2026-06-23 15:00:00');

INSERT INTO occupancy_logs
(room_id, camera_id, occupancy_count, recorded_at)
VALUES
(2,2,15,'2026-06-23 08:00:00'),
(2,2,60,'2026-06-23 09:00:00'),
(2,2,95,'2026-06-23 10:00:00'),
(2,2,110,'2026-06-23 11:00:00'),
(2,2,118,'2026-06-23 12:00:00'),
(2,2,115,'2026-06-23 13:00:00'),
(2,2,90,'2026-06-23 14:00:00'),
(2,2,40,'2026-06-23 15:00:00');

INSERT INTO occupancy_logs
(room_id, camera_id, occupancy_count, recorded_at)
VALUES
(3,3,1,'2026-06-23 08:00:00'),
(3,3,3,'2026-06-23 09:00:00'),
(3,3,5,'2026-06-23 10:00:00'),
(3,3,7,'2026-06-23 11:00:00'),
(3,3,9,'2026-06-23 12:00:00'),
(3,3,8,'2026-06-23 13:00:00'),
(3,3,6,'2026-06-23 14:00:00'),
(3,3,4,'2026-06-23 15:00:00');

INSERT INTO occupancy_logs
(room_id, camera_id, occupancy_count, recorded_at)
VALUES
(4,4,8,'2026-06-23 08:00:00'),
(4,4,12,'2026-06-23 09:00:00'),
(4,4,20,'2026-06-23 10:00:00'),
(4,4,28,'2026-06-23 11:00:00'),
(4,4,35,'2026-06-23 12:00:00'),
(4,4,45,'2026-06-23 13:00:00'),
(4,4,52,'2026-06-23 14:00:00'),
(4,4,50,'2026-06-23 15:00:00');

INSERT INTO occupancy_logs
(room_id, camera_id, occupancy_count, recorded_at)
VALUES
(5,5,0,'2026-06-23 08:00:00'),
(5,5,2,'2026-06-23 09:00:00'),
(5,5,4,'2026-06-23 10:00:00'),
(5,5,6,'2026-06-23 11:00:00'),
(5,5,3,'2026-06-23 12:00:00'),
(5,5,2,'2026-06-23 13:00:00'),
(5,5,0,'2026-06-23 14:00:00'),
(5,5,0,'2026-06-23 15:00:00');

INSERT INTO alerts
(room_id, alert_type, message, is_resolved, created_at)
VALUES
(
2,
'CAPACITY_THRESHOLD',
'Lecture Hall 101 exceeded occupancy threshold of 100 people.',
FALSE,
'2026-06-23 11:05:00'
),

(
4,
'CAPACITY_THRESHOLD',
'Engineering Lab exceeded occupancy threshold of 50 people.',
FALSE,
'2026-06-23 14:10:00'
),

(
5,
'CAMERA_OFFLINE',
'Meeting Room B camera has not communicated for over 2 hours.',
TRUE,
'2026-06-23 10:00:00'
);