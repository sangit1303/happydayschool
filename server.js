const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
    origin: '*', // Allow all origins (or specify 'https://happydayplayschools.in')
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, 'public')));

// --- File Upload Config ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// 1. Login
app.post('/api/login', (req, res) => {
    const { role, username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND password = ? AND role = ?";
    db.get(query, [username, password, role], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json({ success: true, user: { id: row.id, username: row.username, role: row.role, branch_id: row.branch_id } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });
});

// 2. Get All Branches
app.get('/api/branches', (req, res) => {
    db.all("SELECT * FROM branches", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/branches', (req, res) => {
    const { name, location } = req.body;
    const stmt = db.prepare("INSERT INTO branches (name, location) VALUES (?, ?)");
    stmt.run([name, location], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

app.delete('/api/branches/:id', (req, res) => {
    const id = req.params.id;
    // Optional: Check for dependencies (students/users) before deleting
    db.run("DELETE FROM branches WHERE id = ?", id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 3. Get Students (Optional Filter by Branch)
app.get('/api/students', (req, res) => {
    const branchId = req.query.branch_id;
    let query = "SELECT s.*, b.name as branch_name FROM students s LEFT JOIN branches b ON s.branch_id = b.id";
    let params = [];

    if (branchId && branchId !== 'all') {
        query += " WHERE s.branch_id = ?";
        params.push(branchId);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Add Student (with Photo)
app.post('/api/students', upload.single('photo'), (req, res) => {
    const { name, parent_phone, fees_total, fees_paid, branch_id, class_grade } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : '';

    const stmt = db.prepare("INSERT INTO students (name, parent_phone, fees_total, fees_paid, branch_id, class_grade, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?)");
    stmt.run([name, parent_phone, fees_total, fees_paid, branch_id, class_grade, photo_url], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID, photo_url });
    });
    stmt.finalize();
});

// 5. Delete Student
app.delete('/api/students/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM students WHERE id = ?", id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 6. Dashboard Stats
app.get('/api/stats', (req, res) => {
    const branchId = req.query.branch_id;
    let query = "SELECT COUNT(*) as total_students, SUM(fees_paid) as total_paid, SUM(fees_total - fees_paid) as total_due FROM students";
    let params = [];

    if (branchId && branchId !== 'all') {
        query += " WHERE branch_id = ?";
        params.push(branchId);
    }

    db.get(query, params, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// 7. User Management APIs
app.get('/api/users', (req, res) => {
    db.all("SELECT u.id, u.username, u.role, u.branch_id, u.student_id, b.name as branch_name, s.name as student_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id LEFT JOIN students s ON u.student_id = s.id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', (req, res) => {
    const { username, password, role, branch_id, student_id } = req.body;
    const stmt = db.prepare("INSERT INTO users (username, password, role, branch_id, student_id) VALUES (?, ?, ?, ?, ?)");
    stmt.run([username, password, role, branch_id || null, student_id || null], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM users WHERE id = ?", id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 8. Update APIs (PUT)
app.put('/api/branches/:id', (req, res) => {
    const { name, location } = req.body;
    db.run("UPDATE branches SET name = ?, location = ? WHERE id = ?", [name, location, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/students/:id', upload.single('photo'), (req, res) => {
    const { name, parent_phone, fees_total, fees_paid, branch_id, class_grade } = req.body;
    let query = "UPDATE students SET name=?, parent_phone=?, fees_total=?, fees_paid=?, branch_id=?, class_grade=?";
    let params = [name, parent_phone, fees_total, fees_paid, branch_id, class_grade];

    if (req.file) {
        query += ", photo_url=?";
        params.push(`/uploads/${req.file.filename}`);
    }

    query += " WHERE id=?";
    params.push(req.params.id);

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/users/:id', (req, res) => {
    const { username, password, role, branch_id, student_id } = req.body;
    let query = "UPDATE users SET username=?, role=?, branch_id=?, student_id=?";
    let params = [username, role, branch_id || null, student_id || null];

    if (password) {
        query += ", password=?";
        params.push(password);
    }

    query += " WHERE id=?";
    params.push(req.params.id);

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 9. Daily Updates APIs
app.get('/api/updates', (req, res) => {
    const { category, startDate, endDate } = req.query;
    let query = "SELECT * FROM daily_updates";
    let params = [];
    let conditions = [];

    if (category) {
        conditions.push("category = ?");
        params.push(category);
    }
    if (startDate) {
        conditions.push("date >= ?");
        params.push(startDate);
    }
    if (endDate) {
        conditions.push("date <= ?");
        params.push(endDate);
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY date DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/updates', (req, res) => {
    const { date, category, content, created_by } = req.body;
    const stmt = db.prepare("INSERT INTO daily_updates (date, category, content, created_by) VALUES (?, ?, ?, ?)");
    stmt.run([date, category, content, created_by], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

// Fallback
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
