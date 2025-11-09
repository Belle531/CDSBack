const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Simple test endpoint for RegisterView.jsx
app.post('/register', (req, res) => {
  console.log('📝 Registration request received:', req.body);
  
  const { firstName, lastName, email, password, confirmPassword, selectedLanguage } = req.body;
  
  // Simple validation
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required'
    });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'Passwords do not match'
    });
  }
  
  // Mock successful registration
  const userData = {
    email: email,
    firstName: firstName,
    lastName: lastName,
    uid: `user-${Date.now()}`,
    preferredLanguage: selectedLanguage || 'en'
  };
  
  console.log('✅ Registration successful for:', userData);
  
  res.json({
    success: true,
    message: 'Registration successful! Please check your email for verification.',
    user: userData
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📝 Registration endpoint: http://localhost:${PORT}/register`);
});