require('dotenv').config();
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios'); // Make sure axios is installed

const app = express();
const PORT = process.env.PORT || 3003;

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
    
    // Create tasks table for ToDoApp
    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            text TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            priority TEXT DEFAULT 'medium',
            dueDate DATETIME,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
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
            error: 'Password must be at least 10 characters long'
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

// ====================================================================
// TASK MANAGEMENT ENDPOINTS FOR TODOAPP
// ====================================================================

// Get all tasks for a specific user
app.get('/tasks/:userId', (req, res) => {
    const { userId } = req.params;
    
    console.log('📋 Getting tasks for user:', userId);
    
    db.all(
        'SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC',
        [userId],
        (err, rows) => {
            if (err) {
                console.error('❌ Error fetching tasks:', err);
                return res.status(500).json({ error: 'Failed to fetch tasks' });
            }
            
            console.log(`✅ Found ${rows.length} tasks for user ${userId}`);
            res.json({ 
                success: true, 
                tasks: rows.map(task => ({
                    ...task,
                    completed: Boolean(task.completed) // Convert 0/1 to boolean
                }))
            });
        }
    );
});

// Create a new task
app.post('/tasks', (req, res) => {
    const { userId, text, priority = 'medium', dueDate } = req.body;
    
    console.log('➕ Creating new task:', { userId, text, priority });
    
    if (!userId || !text) {
        return res.status(400).json({ 
            success: false, 
            error: 'userId and text are required' 
        });
    }
    
    db.run(
        `INSERT INTO tasks (userId, text, priority, dueDate) VALUES (?, ?, ?, ?)`,
        [userId, text, priority, dueDate],
        function(err) {
            if (err) {
                console.error('❌ Error creating task:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to create task' 
                });
            }
            
            console.log('✅ Task created with ID:', this.lastID);
            
            // Return the created task
            db.get(
                'SELECT * FROM tasks WHERE id = ?',
                [this.lastID],
                (err, row) => {
                    if (err) {
                        return res.status(500).json({ 
                            success: false, 
                            error: 'Task created but failed to retrieve' 
                        });
                    }
                    
                    res.json({
                        success: true,
                        message: 'Task created successfully',
                        task: {
                            ...row,
                            completed: Boolean(row.completed)
                        }
                    });
                }
            );
        }
    );
});

// Update task (toggle completion or edit text)
app.put('/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    const { completed, text, priority, dueDate } = req.body;
    
    console.log('✏️ Updating task:', taskId, req.body);
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    
    if (completed !== undefined) {
        updates.push('completed = ?');
        values.push(completed ? 1 : 0);
    }
    
    if (text !== undefined) {
        updates.push('text = ?');
        values.push(text);
    }
    
    if (priority !== undefined) {
        updates.push('priority = ?');
        values.push(priority);
    }
    
    if (dueDate !== undefined) {
        updates.push('dueDate = ?');
        values.push(dueDate);
    }
    
    updates.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(taskId);
    
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('❌ Error updating task:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update task' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task not found' 
            });
        }
        
        console.log('✅ Task updated successfully');
        
        // Return updated task
        db.get(
            'SELECT * FROM tasks WHERE id = ?',
            [taskId],
            (err, row) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        error: 'Task updated but failed to retrieve' 
                    });
                }
                
                res.json({
                    success: true,
                    message: 'Task updated successfully',
                    task: {
                        ...row,
                        completed: Boolean(row.completed)
                    }
                });
            }
        );
    });
});

// Delete a task
app.delete('/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    
    console.log('🗑️ Deleting task:', taskId);
    
    db.run(
        'DELETE FROM tasks WHERE id = ?',
        [taskId],
        function(err) {
            if (err) {
                console.error('❌ Error deleting task:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to delete task' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Task not found' 
                });
            }
            
            console.log('✅ Task deleted successfully');
            res.json({
                success: true,
                message: 'Task deleted successfully'
            });
        }
    );
});

// Get task statistics for a user
app.get('/tasks/:userId/stats', (req, res) => {
    const { userId } = req.params;
    
    db.all(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as remaining
         FROM tasks WHERE userId = ?`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error('❌ Error fetching task stats:', err);
                return res.status(500).json({ error: 'Failed to fetch stats' });
            }
            
            const stats = rows[0] || { total: 0, completed: 0, remaining: 0 };
            res.json({ success: true, stats });
        }
    );
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Database server running' });
});

// Weather endpoint
app.get('/weather', async (req, res) => {
    const { city } = req.query;
    if (!city) {
        return res.status(400).json({ error: 'City is required' });
    }
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=imperial`
        );
        res.json(response.data);
    } catch (error) {
        // Add this for better debugging:
        console.error('OpenWeather error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

app.get('/', (req, res) => {
  res.send('Backend is running! Available endpoints: /register, /login, /tasks, /users');
});

app.listen(PORT, () => {
    console.log(`🚀 Database-powered server running on http://localhost:${PORT}`);
    console.log(`📝 Registration endpoint: http://localhost:${PORT}/register`);
    console.log(`🔐 Login endpoint: http://localhost:${PORT}/login`);
    console.log(`📋 Task endpoints: http://localhost:${PORT}/tasks`);
    console.log(`👥 View users: http://localhost:${PORT}/users`);
    console.log(`💾 Database: ${dbPath}`);
});