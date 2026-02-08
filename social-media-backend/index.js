const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
// CRA (react-scripts) uses 3000 by default, so keep the backend on 3001 unless overridden.
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key'; // Use a secure key in production
const saltRounds = 10;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));

// Database setup
const Database = require('better-sqlite3');
const db = new Database('./database.db', { verbose: console.log });

// Enable foreign key constraints
db.exec(`PRAGMA foreign_keys = ON`);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY,
    title TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    challenge_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );
`);

// Routes

// 1. User Signup
app.post('/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const stmt = db.prepare(`INSERT INTO users (email, password) VALUES (?, ?)`);
      const result = stmt.run(email, hash);
      res.json({ id: result.lastInsertRowid, message: 'User created successfully!' });
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });
});

// 2. User Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
    const user = stmt.get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, message: 'Login successful!' });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// 3. Create Challenge
app.post('/challenges', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  try {
    const stmt = db.prepare(`INSERT INTO challenges (title, description) VALUES (?, ?)`);
    const result = stmt.run(title, description);
    res.json({ id: result.lastInsertRowid, message: 'Challenge created successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create challenge. Please try again later.' });
  }
});

// 4. List Challenges
app.get('/challenges', authenticateToken, (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const stmt = db.prepare(`SELECT * FROM challenges LIMIT ? OFFSET ?`);
    const challenges = stmt.all(limit, offset);
    res.json(challenges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create Post
app.post('/posts', authenticateToken, (req, res) => {
  const { challenge_id, content } = req.body;
  if (!challenge_id || !content) {
    return res.status(400).json({ error: 'Challenge ID and content are required' });
  }
  try {
    const stmt = db.prepare(`INSERT INTO posts (challenge_id, content) VALUES (?, ?)`);
    const result = stmt.run(challenge_id, content);
    res.json({ id: result.lastInsertRowid, message: 'Post created successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post. Please try again later.' });
  }
});

// 6. List Posts
app.get('/posts', authenticateToken, (req, res) => {
  const { challenge_id } = req.query;
  try {
    const query = challenge_id
      ? `SELECT * FROM posts WHERE challenge_id = ?`
      : `SELECT * FROM posts`;
    const stmt = db.prepare(query);
    const posts = challenge_id ? stmt.all(challenge_id) : stmt.all();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Social Media App Backend!');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

//token to test protected routes:
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzcwMzkxNjc1LCJleHAiOjE3NzAzOTUyNzV9.F4THiARRI8gkylDxfiyyQPSYvB31wsCss8KqziiW7M8