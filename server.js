const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

// REQUIRED FOR RENDER HTTPS
app.set('trust proxy', 1);

// --- CORS FIX ---
app.use(cors({
    origin: [
        "https://happydayplayschools.in",
        "https://www.happydayplayschools.in",
        "http://localhost:3000",
        "http://127.0.0.1:5500"
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

// --- API Endpoints ---

// 1. Login
app.post('/api/login', async (req, res) => {
    const { role, username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = $1 AND password = $2 AND role = $3";
    try {
        const { rows } = await db.query(query, [username, password, role]);
        if (rows.length > 0) {
            const row = rows[0];
            res.json({ success: true, user: { id: row.id, username: row.username, role: row.role, branch_id: row.branch_id } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get All Branches
app.get('/api/branches', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM branches");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/branches', async (req, res) => {
    const { name, location } = req.body;
    try {
        const { rows } = await db.query("INSERT INTO branches (name, location) VALUES ($1, $2) RETURNING id", [name, location]);
        res.json({ success: true, id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/branches/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.query("DELETE FROM branches WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get Students (Optional Filter by Branch)
app.get('/api/students', async (req, res) => {
    const branchId = req.query.branch_id;
    let query = "SELECT s.*, b.name as branch_name FROM students s LEFT JOIN branches b ON s.branch_id = b.id";
    let params = [];

    if (branchId && branchId !== 'all') {
        query += " WHERE s.branch_id = $1";
        params.push(branchId);
    }

    try {
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Add Student (with Photo)
app.post('/api/students', upload.single('photo'), async (req, res) => {
    const { name, parent_phone, fees_total, fees_paid, branch_id, class_grade } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        const { rows } = await db.query(
            "INSERT INTO students (name, parent_phone, fees_total, fees_paid, branch_id, class_grade, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            [name, parent_phone, fees_total, fees_paid, branch_id, class_grade, photo_url]
        );
        res.json({ success: true, id: rows[0].id, photo_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Delete Student
app.delete('/api/students/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.query("DELETE FROM students WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Dashboard Stats
app.get('/api/stats', async (req, res) => {
    const branchId = req.query.branch_id;
    let query = "SELECT COUNT(*) as total_students, SUM(fees_paid) as total_paid, SUM(fees_total - fees_paid) as total_due FROM students";
    let params = [];

    if (branchId && branchId !== 'all') {
        query += " WHERE branch_id = $1";
        params.push(branchId);
    }

    try {
        const { rows } = await db.query(query, params);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. User Management APIs
app.get('/api/users', async (req, res) => {
    try {
        const { rows } = await db.query("SELECT u.id, u.username, u.role, u.branch_id, u.student_id, b.name as branch_name, s.name as student_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id LEFT JOIN students s ON u.student_id = s.id");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role, branch_id, student_id } = req.body;
    try {
        const { rows } = await db.query(
            "INSERT INTO users (username, password, role, branch_id, student_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [username, password, role, branch_id || null, student_id || null]
        );
        res.json({ success: true, id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Update APIs (PUT)
app.put('/api/branches/:id', async (req, res) => {
    const { name, location } = req.body;
    try {
        await db.query("UPDATE branches SET name = $1, location = $2 WHERE id = $3", [name, location, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/students/:id', upload.single('photo'), async (req, res) => {
    const { name, parent_phone, fees_total, fees_paid, branch_id, class_grade } = req.body;
    let query = "UPDATE students SET name=$1, parent_phone=$2, fees_total=$3, fees_paid=$4, branch_id=$5, class_grade=$6";
    let params = [name, parent_phone, fees_total, fees_paid, branch_id, class_grade];

    if (req.file) {
        query += ", photo_url=$7";
        params.push(`/uploads/${req.file.filename}`);
    }

    query += " WHERE id=$" + (params.length + 1);
    params.push(req.params.id);

    try {
        await db.query(query, params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { username, password, role, branch_id, student_id } = req.body;
    let query = "UPDATE users SET username=$1, role=$2, branch_id=$3, student_id=$4";
    let params = [username, role, branch_id || null, student_id || null];

    if (password) {
        query += ", password=$5";
        params.push(password);
    }

    query += " WHERE id=$" + (params.length + 1);
    params.push(req.params.id);

    try {
        await db.query(query, params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Daily Updates APIs
app.get('/api/updates', async (req, res) => {
    const { category, startDate, endDate } = req.query;
    let query = "SELECT * FROM daily_updates";
    let params = [];
    let conditions = [];
    let paramCount = 1;

    if (category) {
        conditions.push(`category = $${paramCount++}`);
        params.push(category);
    }
    if (startDate) {
        conditions.push(`date >= $${paramCount++}`);
        params.push(startDate);
    }
    if (endDate) {
        conditions.push(`date <= $${paramCount++}`);
        params.push(endDate);
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY date DESC";

    try {
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/updates', async (req, res) => {
    const { date, category, content, created_by } = req.body;
    try {
        const { rows } = await db.query(
            "INSERT INTO daily_updates (date, category, content, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
            [date, category, content, created_by]
        );
        res.json({ success: true, id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
