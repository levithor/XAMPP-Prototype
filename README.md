# Read this to understand the backend

### Install Dependencies

Run 'npm install' command in a terminal within the backend folder

### Configure Environment Variables

Create a .env file with data that corresponds to your SQL stuff:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=occuvision

PORT=3000

### Start Server

Run 'node server.js' in the same terminal

Server runs at:

http://localhost:3000


## FOR REFERENCE: Here is what the database looks like:
## *currently only rooms has GET and POST functionality*

### Room

Represents a physical room being monitored.

| Field | Type |
|---------|---------|
| room_id | Integer |
| room_name | String |
| capacity_limit | Integer |
| occupancy_threshold | Integer |

### Camera

Represents a camera assigned to a room.

| Field | Type |
|---------|---------|
| camera_id | Integer |
| camera_name | String |
| ip_address | String |
| status | String |
| assigned_room_id | Integer |

### Occupancy Log

Stores occupancy data over time.

| Field | Type |
|---------|---------|
| log_id | Integer |
| room_id | Integer |
| occupancy_count | Integer |
| recorded_at | DateTime |



---------------------------OLD XAMPP PROJECT----------------------------

This is a prototype for the occupancy detection dashboard using XAMPP and MySQL

What you need installed:
- XAMPP (Apache + MySQL must be enabled)
- Python

Setup:
1. Once you have XAMPP installed, copy this project folder into C:\xampp\htdocs\
2. Start Apache and MySQL in the XAMPP control panel
3. Open phpMyAdmin
4. Import sql/schema.sql
5. Visit http://0.0.0.0/prototype (replace 0.0.0.0 with your server's IP address)
