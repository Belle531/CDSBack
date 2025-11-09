const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { response, validateInput } = require('../utils/helpers');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Validation schemas
const registerSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  preferredLanguage: Joi.string().valid('en', 'es', 'fr').default('en')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * Register a new user
 */
const register = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body);
    const { error, value } = validateInput(body, registerSchema);
    
    if (error) {
      return response(400, { error: error.details[0].message });
    }

    const { firstName, lastName, email, password, preferredLanguage } = value;

    // Check if user already exists
    const existingUser = await dynamodb.query({
      TableName: process.env.USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }).promise();

    if (existingUser.Items.length > 0) {
      return response(400, { error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    const timestamp = Date.now();
    
    const user = {
      userId,
      email,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      preferredLanguage,
      isVerified: false, // In production, you'd implement email verification
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await dynamodb.put({
      TableName: process.env.USERS_TABLE,
      Item: user
    }).promise();

    // Generate JWT token
    const token = jwt.sign(
      { userId, email, firstName, lastName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (without password hash)
    const { passwordHash, ...userResponse } = user;
    
    return response(201, {
      message: 'User registered successfully',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

/**
 * Login user
 */
const login = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body);
    const { error, value } = validateInput(body, loginSchema);
    
    if (error) {
      return response(400, { error: error.details[0].message });
    }

    const { email, password } = value;

    // Find user by email
    const result = await dynamodb.query({
      TableName: process.env.USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }).promise();

    if (result.Items.length === 0) {
      return response(401, { error: 'Invalid email or password' });
    }

    const user = result.Items[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return response(401, { error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.userId, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (without password hash)
    const { passwordHash, ...userResponse } = user;
    
    return response(200, {
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

/**
 * Get user profile (protected route)
 */
const getProfile = async (event) => {
  try {
    // Extract user info from JWT (middleware would handle this in production)
    const token = event.headers.Authorization?.replace('Bearer ', '');
    if (!token) {
      return response(401, { error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await dynamodb.get({
      TableName: process.env.USERS_TABLE,
      Key: { userId: decoded.userId }
    }).promise();

    if (!result.Item) {
      return response(404, { error: 'User not found' });
    }

    // Return user data (without password hash)
    const { passwordHash, ...userResponse } = result.Item;
    
    return response(200, { user: userResponse });

  } catch (error) {
    console.error('Get profile error:', error);
    if (error.name === 'JsonWebTokenError') {
      return response(401, { error: 'Invalid token' });
    }
    return response(500, { error: 'Internal server error' });
  }
};

/**
 * Update user profile (protected route)
 */
const updateProfile = async (event) => {
  try {
    // Extract user info from JWT
    const token = event.headers.Authorization?.replace('Bearer ', '');
    if (!token) {
      return response(401, { error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Parse request body
    const body = JSON.parse(event.body);
    const { firstName, lastName, preferredLanguage } = body;

    // Validate input
    const updateSchema = Joi.object({
      firstName: Joi.string().min(1).max(50),
      lastName: Joi.string().min(1).max(50),
      preferredLanguage: Joi.string().valid('en', 'es', 'fr')
    });

    const { error, value } = validateInput(body, updateSchema);
    if (error) {
      return response(400, { error: error.details[0].message });
    }

    // Update user in database
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (firstName) {
      updateExpression.push('#firstName = :firstName');
      expressionAttributeNames['#firstName'] = 'firstName';
      expressionAttributeValues[':firstName'] = firstName;
    }

    if (lastName) {
      updateExpression.push('#lastName = :lastName');
      expressionAttributeNames['#lastName'] = 'lastName';
      expressionAttributeValues[':lastName'] = lastName;
    }

    if (preferredLanguage) {
      updateExpression.push('preferredLanguage = :preferredLanguage');
      expressionAttributeValues[':preferredLanguage'] = preferredLanguage;
    }

    updateExpression.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = Date.now();

    await dynamodb.update({
      TableName: process.env.USERS_TABLE,
      Key: { userId: decoded.userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ...(Object.keys(expressionAttributeNames).length > 0 && { ExpressionAttributeNames: expressionAttributeNames })
    }).promise();

    return response(200, { message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Update profile error:', error);
    if (error.name === 'JsonWebTokenError') {
      return response(401, { error: 'Invalid token' });
    }
    return response(500, { error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile
};