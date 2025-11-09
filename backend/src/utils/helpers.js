/**
 * Helper functions for API responses and validation
 */

/**
 * Create standardized API response
 * @param {number} statusCode - HTTP status code
 * @param {object} body - Response body
 * @returns {object} Lambda response object
 */
const response = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(body)
  };
};

/**
 * Validate input using Joi schema
 * @param {object} data - Data to validate
 * @param {object} schema - Joi validation schema
 * @returns {object} Validation result
 */
const validateInput = (data, schema) => {
  return schema.validate(data, { abortEarly: false });
};

/**
 * Extract user ID from JWT token
 * @param {string} token - JWT token
 * @returns {string} User ID
 */
const getUserIdFromToken = (token) => {
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Create standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {object} Lambda error response
 */
const errorResponse = (statusCode, message) => {
  return response(statusCode, { error: message });
};

/**
 * Create standardized success response
 * @param {object} data - Success data
 * @param {string} message - Success message
 * @returns {object} Lambda success response
 */
const successResponse = (data, message = 'Success') => {
  return response(200, { message, data });
};

module.exports = {
  response,
  validateInput,
  getUserIdFromToken,
  errorResponse,
  successResponse
};