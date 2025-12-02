const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'school.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // 1. Branches Table
        db.run(`CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            location TEXT
        )`);

        // 2. Users Table (Updated with branch_id)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT, -- 'admin', 'manager', 'student'
            branch_id INTEGER,
            student_id INTEGER,
            FOREIGN KEY(branch_id) REFERENCES branches(id),
            FOREIGN KEY(student_id) REFERENCES students(id)
        )`);

        // Migration: Add student_id if it doesn't exist (for existing DBs)
        db.run("ALTER TABLE users ADD COLUMN student_id INTEGER REFERENCES students(id)", (err) => {
            // Ignore error if column already exists
        });

        // 3. Students Table (Updated with detailed fields)
        db.run(`CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            parent_phone TEXT,
            fees_total INTEGER DEFAULT 0,
            fees_paid INTEGER DEFAULT 0,
            fees_due INTEGER GENERATED ALWAYS AS (fees_total - fees_paid) VIRTUAL,
            branch_id INTEGER,
            photo_url TEXT,
            report_card_url TEXT,
            class_grade TEXT, -- e.g., 'Nursery', 'LKG'
            FOREIGN KEY(branch_id) REFERENCES branches(id)
        )`);

        // 4. Audit Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 5. Daily Updates Table
        db.run(`CREATE TABLE IF NOT EXISTS daily_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            category TEXT, -- 'Nursery', 'LKG', 'UKG'
            content TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(id)
        )`);

        // Seed Data
        seedData();
    });
}

function seedData() {
    db.get("SELECT count(*) as count FROM branches", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding Branches...");
            const branches = [
                ['Main Branch', 'Chennai'],
                ['North Wing', 'Bangalore']
            ];
            const stmt = db.prepare("INSERT INTO branches (name, location) VALUES (?, ?)");
            branches.forEach(b => stmt.run(b));
            stmt.finalize();
        }
    });

    db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding Users...");
            // Admin has no branch (null), Manager has branch 1, Student has branch 1
            const users = [
                ['admin', 'Happy@2026', 'admin', null],
                ['manager', 'manager123', 'manager', 1],
                ['student', 'student123', 'student', 1]
            ];
            const stmt = db.prepare("INSERT INTO users (username, password, role, branch_id) VALUES (?, ?, ?, ?)");
            users.forEach(u => stmt.run(u));
            stmt.finalize();
        }
    });

    db.get("SELECT count(*) as count FROM students", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding Students...");
            const students = [
                ['Alice Johnson', '919876543210', 10000, 5000, 1, 'Nursery'],
                ['Bob Smith', '919876543211', 10000, 10000, 2, 'LKG'],
                ['Charlie Brown', '919876543212', 12000, 10000, 1, 'Nursery']
            ];
            const stmt = db.prepare("INSERT INTO students (name, parent_phone, fees_total, fees_paid, branch_id, class_grade) VALUES (?, ?, ?, ?, ?, ?)");
            students.forEach(s => stmt.run(s));
            stmt.finalize();
        }
    });
}

module.exports = db;
