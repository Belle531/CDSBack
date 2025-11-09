# CDS Spice Rack Backend API

## 🚀 Getting Started

This is the backend API for The Spice Rack - Recipe Community Platform. Built with AWS Lambda, API Gateway, and DynamoDB.

## 📦 Installation

```bash
# Install dependencies
npm install

# Install Serverless CLI globally (if not already installed)
npm install -g serverless

# Set up AWS credentials
aws configure
```

## 🔧 Environment Setup

Create a `.env` file in the root directory:

```bash
JWT_SECRET=your-super-secret-jwt-key-here
AWS_REGION=us-east-1
```

## 🏗️ Local Development

```bash
# Start local development server
npm run dev

# This will start serverless offline on http://localhost:3000
```

## 📡 API Endpoints

### Authentication Routes
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile (protected)
- `PUT /auth/profile` - Update user profile (protected)

### Frontend Integration
The registration endpoint accepts data in the format expected by `RegisterView.jsx`:
```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "selectedLanguage": "en"
}
```

## 🗄️ Database Structure

### DynamoDB Tables
- **Users Table** - User accounts and profiles
- **Recipes Table** - Recipe content and metadata
- **Favorites Table** - User favorite recipes
- **Ratings Table** - Recipe ratings and reviews

## 🚀 Deployment

```bash
# Deploy to AWS
npm run deploy

# Deploy to specific stage
serverless deploy --stage prod
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📝 Project Structure

```
backend/
├── src/
│   ├── handlers/          # Lambda function handlers
│   │   └── auth.js       # Authentication endpoints
│   ├── models/           # Data models (coming soon)
│   └── utils/            # Helper functions
│       └── helpers.js    # API response helpers
├── serverless.yml        # Serverless configuration
├── package.json          # Dependencies
└── README.md            # This file
```

## 🔐 Authentication

This API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer your-jwt-token-here
```

## 📊 Response Format

All API responses follow this structure:

```json
{
  "message": "Success message",
  "success": true,
  "data": {},
  "error": "Error message (if applicable)"
}
```

---

**Status:** Ready for Frontend Integration  
**Version:** 1.0.0  
**Last Updated:** November 2025