const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const fs = require('fs');

const app = express();

// REQUIRED FOR RENDER HTTPS
app.set('trust proxy', 1);

// --- CORS FIX ---
app.use(cors({
    origin: [
        "https://happydayplayschools.in",
        "https://www.happydayplayschools.in"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

// Manual headers (Render needs this)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "https://happydayplayschools.in");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

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

// ======================
//    API ENDPOINTS
// ======================

// Login
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

// Branch APIs
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
    db.run("DELETE FROM branches WHERE id = ?", id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Students + Upload
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

// User APIs
app.get('/api/users', (req, res) => {
    db.all("SELECT u.id, u.username, u.role, u.branch_id, u.student_id, b.name as branch_name, s.name as student_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id LEFT JOIN students s ON u.student_id = s.id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Daily updates
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

// Fallback — serve login UI
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'login.html'));
});

// ======================
//  REQUIRED FOR RENDER
// ======================
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
