const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
    });

    const schema = fs.readFileSync(
        path.join(__dirname, '../database/schema.sql'),
        'utf8'
    );

    await connection.query(schema);

    const seed = fs.readFileSync(
        path.join(__dirname, '../database/seed.sql'),
        'utf8'
    );

    await connection.query(seed);

    console.log('Database initialized');

    await connection.end();
}

setupDatabase();