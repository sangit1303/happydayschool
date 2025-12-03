const { Pool } = require('pg');

// Use the Supabase Connection Pooler string (IPv4 compatible)
// Note: We are parsing it manually to handle the special characters in the password if needed,
// but for the pooler string, the standard connection string usually works best.
const connectionString = 'postgresql://postgres.yjapxqurcmmrmlzielye:Nothing@2026@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Required for Supabase/Render connections
    }
});

// Helper to initialize the database tables
const initializeDatabase = async () => {
    try {
        const client = await pool.connect();
        console.log("Connected to Supabase PostgreSQL via Pooler");

        // 1. Branches Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS branches (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE,
                location TEXT
            );
        `);

        // 2. Students Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                name TEXT,
                parent_phone TEXT,
                fees_total INTEGER DEFAULT 0,
                fees_paid INTEGER DEFAULT 0,
                fees_due INTEGER GENERATED ALWAYS AS (fees_total - fees_paid) STORED,
                branch_id INTEGER REFERENCES branches(id),
                photo_url TEXT,
                report_card_url TEXT,
                class_grade TEXT
            );
        `);

        // 3. Users Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT,
                branch_id INTEGER REFERENCES branches(id),
                student_id INTEGER REFERENCES students(id)
            );
        `);

        // 4. Daily Updates Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_updates (
                id SERIAL PRIMARY KEY,
                date TEXT,
                category TEXT,
                content TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed Data (Only if empty)
        const res = await client.query('SELECT count(*) FROM users');
        if (parseInt(res.rows[0].count) === 0) {
            console.log("Seeding initial data...");
            await client.query(`
                INSERT INTO users (username, password, role) 
                VALUES ('admin', 'Happy@2026', 'admin');
            `);
        }

        client.release();
    } catch (err) {
        console.error("Database Initialization Error:", err);
    }
};

// Run init
initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
};
