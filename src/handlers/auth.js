// auth.mjs (AWS Lambda Function Code for User Authentication)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand, 
    QueryCommand 
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// --- Configuration ---
const USER_TABLE_NAME = 'UserTaskManager';
const client = new DynamoDBClient({}); 
const docClient = DynamoDBDocumentClient.from(client);

// --- Auth Utilities ---
const SALT_ROUNDS = 10;

/**
 * Generates a unique user ID and hashes the password.
 * @param {string} password - plain text password
 * @returns {{userId: string, passwordHash: string}}
 */
const generateUserCredentials = async (password) => {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    return { userId, passwordHash };
};

// --- CRUD Operations ---

// 1. REGISTER (POST /register)
const registerUser = async (body) => {
    const { email, password, firstName } = body;
    
    if (!email || !password || !firstName) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Email, password, and first name are required.' }) };
    }

    // Check if user already exists (Query by email - requires a Global Secondary Index (GSI) on 'email')
    // NOTE: For simplicity here, we skip the GSI check. In production, you MUST check email uniqueness.
    
    const { userId, passwordHash } = await generateUserCredentials(password);

    const userItem = {
        userId: userId,
        email: email.toLowerCase(),
        passwordHash: passwordHash,
        firstName: firstName.trim(),
        createdAt: new Date().toISOString(),
        // Note: No session token generation here, that is handled by API Gateway or a separate service (Cognito).
    };

    const command = new PutCommand({
        TableName: USER_TABLE_NAME,
        Item: userItem,
    });

    await docClient.send(command);
    
    // Return basic user info (without the hash)
    const safeUser = { id: userId, email: userItem.email, firstName: userItem.firstName };
    
    return { 
        statusCode: 200, 
        body: JSON.stringify({ success: true, message: 'User registered successfully.', user: safeUser }) 
    };
};

// 2. LOGIN (POST /login)
const loginUser = async (body) => {
    const { email, password } = body;

    if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Email and password are required.' }) };
    }

    // --- QUERY BY EMAIL (Requires GSI on 'email' attribute) ---
    // Since DynamoDB cannot query by a non-key attribute efficiently, 
    // you must create a GSI on the 'email' attribute for this to work in production.
    const command = new QueryCommand({
        TableName: USER_TABLE_NAME,
        IndexName: 'EmailIndex', // ASSUME a GSI named 'EmailIndex' exists on the 'email' attribute
        KeyConditionExpression: 'email = :e',
        ExpressionAttributeValues: {
            ':e': email.toLowerCase(),
        },
        Limit: 1,
    });

    const result = await docClient.send(command);
    const user = result.Items ? result.Items[0] : null;

    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Invalid credentials.' }) };
    }

    // Verify password hash
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
        return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Invalid credentials.' }) };
    }

    // Return user details and a token (Token logic is omitted for simplicity, 
    // often handled by API Gateway or Cognito)
    const safeUser = { id: user.userId, email: user.email, firstName: user.firstName };

    return { 
        statusCode: 200, 
        body: JSON.stringify({ success: true, message: 'Login successful.', user: safeUser }) 
    };
};


// --- Lambda Handler ---

export const handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        let body = event.body ? JSON.parse(event.body) : {};
        const path = event.path;
        let response;
        
        if (event.httpMethod === 'POST') {
            if (path === '/login') {
                response = await loginUser(body);
            } else if (path === '/register') {
                response = await registerUser(body);
            } else {
                response = { statusCode: 404, body: JSON.stringify({ success: false, error: 'Auth Endpoint Not Found' }) };
            }
        } else {
            response = { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method Not Allowed' }) };
        }
        
        return { ...response, headers };
        
    } catch (error) {
        console.error('Auth Lambda Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Internal Server Error', details: error.message }),
        };
    }
};