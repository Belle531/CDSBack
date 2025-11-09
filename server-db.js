const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3003;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            preferredLanguage TEXT DEFAULT 'en',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// Registration endpoint with real database storage
app.post('/register', async (req, res) => {
    console.log('📝 Registration request received:', req.body);
    
    // Handle both field name variations from frontend
    const { 
        firstName, 
        lastName, 
        email, 
        password, 
        confirmPassword, 
        selectedLanguage,
        language  // fallback for old frontend code
    } = req.body;
    
    const userLanguage = selectedLanguage || language || 'en';
    
    // Validation with specific error messages
    if (!firstName || !lastName || !email || !password) {
        console.log('❌ Validation failed: Missing required fields');
        return res.status(400).json({
            success: false,
            error: 'All fields are required'
        });
    }
    
    // Only check password match if confirmPassword is provided
    if (confirmPassword && password !== confirmPassword) {
        console.log('❌ Validation failed: Passwords do not match');
        return res.status(400).json({
            success: false,
            error: 'Passwords do not match'
        });
    }

    if (password.length < 6) {
        console.log('❌ Validation failed: Password too short');
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 6 characters long'
        });
    }

    try {
        // Check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingUser) {
            console.log('❌ Registration failed: Email already registered');
            return res.status(400).json({
                success: false,
                error: 'This email is already registered. Please use a different email or try logging in.'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user into database
        const userId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (firstName, lastName, email, passwordHash, preferredLanguage) 
                 VALUES (?, ?, ?, ?, ?)`,
                [firstName, lastName, email, passwordHash, userLanguage],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        console.log('✅ User successfully registered with ID:', userId);

        // Return success response
        const userData = {
            id: userId,
            firstName: firstName,
            lastName: lastName,
            email: email,
            preferredLanguage: userLanguage,
            uid: `user-${userId}` // For compatibility with your frontend
        };

        res.json({
            success: true,
            message: 'Registration successful! User account created.',
            user: userData
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error. Please try again.'
        });
    }
});

// Get all users endpoint (for testing)
app.get('/users', (req, res) => {
    db.all('SELECT id, firstName, lastName, email, preferredLanguage, createdAt FROM users', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ users: rows });
    });
});

// Login endpoint
app.post('/login', async (req, res) => {
    console.log('🔐 Login request received:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
        console.log('❌ Login failed: Missing credentials');
        return res.status(400).json({
            success: false,
            error: 'Email and password are required'
        });
    }

    try {
        // Find user by email
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            console.log('❌ Login failed: User not found');
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            console.log('❌ Login failed: Invalid password');
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        console.log('✅ Login successful for user:', user.email);

        // Return success response (without password hash)
        const { passwordHash, ...userResponse } = user;
        
        res.json({
            success: true,
            message: 'Login successful!',
            user: {
                ...userResponse,
                uid: `user-${user.id}` // For compatibility with your frontend
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error. Please try again.'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Database server running' });
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Database-powered server running on http://127.0.0.1:${PORT}`);
    console.log(`📝 Registration endpoint: http://127.0.0.1:${PORT}/register`);
    console.log(`� Login endpoint: http://127.0.0.1:${PORT}/login`);
    console.log(`� View users: http://127.0.0.1:${PORT}/users`);
    console.log(`� Database: ${dbPath}`);
});