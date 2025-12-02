// index.mjs (AWS Lambda Function Code)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    PutCommand, 
    QueryCommand, 
    UpdateCommand, 
    DeleteCommand 
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
const TABLE_NAME = 'ToDoTaskManager';
const client = new DynamoDBClient({}); // Initialize client with default region/credentials
const docClient = DynamoDBDocumentClient.from(client);

// --- Lambda Handler ---

export const handler = async (event) => {
    // Set up standard headers for CORS
    const headers = {
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    // Handle CORS preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        let body;
        try {
            body = event.body ? JSON.parse(event.body) : {};
        } catch (e) {
            console.error("Error parsing body:", e);
            body = {}; 
        }

        let response;
        const httpMethod = event.httpMethod;
        const path = event.path;
        
        console.log(`Processing ${httpMethod} request for path: ${path}`);
        
// ---------------------------------------------
// 1. CREATE Task (POST /tasks)
// ---------------------------------------------
        if (httpMethod === 'POST' && path === '/tasks') {
            const { userId, text, priority } = body;
            
            if (!userId || !text) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId and text are required' }) };
            }

            const task = {
                userId: String(userId),
                taskId: uuidv4(), // Generate unique ID
                text: text.trim(),
                completed: false,
                priority: priority || 'medium',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const command = new PutCommand({
                TableName: TABLE_NAME,
                Item: task,
            });

            await docClient.send(command);
            
            response = { 
                statusCode: 200, 
                body: JSON.stringify({ success: true, task }) 
            };
        }

// ---------------------------------------------
// 2. READ Tasks (GET /tasks/{userId})
// ---------------------------------------------
        else if (httpMethod === 'GET' && path.startsWith('/tasks/')) {
            // Extracts userId from a path like /tasks/123
            const userId = path.split('/').pop(); 
            
            if (!userId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId is required' }) };
            }
            
            const command = new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'userId = :uid',
                ExpressionAttributeValues: {
                    ':uid': userId,
                },
                ScanIndexForward: false, // Optional: return newest tasks first
            });

            const result = await docClient.send(command);
            
            response = { 
                statusCode: 200, 
                body: JSON.stringify({ success: true, tasks: result.Items }) 
            };
        }

// ---------------------------------------------
// 3. UPDATE/DELETE (PUT/DELETE /tasks/{taskId})
// ---------------------------------------------
        else if ((httpMethod === 'PUT' || httpMethod === 'DELETE') && path.startsWith('/tasks/')) {
            // Extracts taskId from the path (e.g., /tasks/task-uuid-abc)
            const taskId = path.split('/').pop(); 
            // The frontend sends the necessary 'userId' in the request body for the composite key.
            const { userId } = body; 

            if (!userId || !taskId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId and taskId are required' }) };
            }
            
            // --- UPDATE (PUT) ---
            if (httpMethod === 'PUT') {
                const { text, completed, priority } = body;
                
                const updateExpressionParts = [];
                const ExpressionAttributeValues = { ':updatedAt': new Date().toISOString() };
                
                if (text !== undefined) {
                    updateExpressionParts.push('text = :t');
                    ExpressionAttributeValues[':t'] = text.trim();
                }
                if (completed !== undefined) {
                    updateExpressionParts.push('completed = :c');
                    ExpressionAttributeValues[':c'] = completed;
                }
                if (priority !== undefined) {
                    updateExpressionParts.push('priority = :p');
                    ExpressionAttributeValues[':p'] = priority;
                }

                if (updateExpressionParts.length === 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No update parameters provided' }) };
                }
                
                const updateExpression = 'SET ' + updateExpressionParts.join(', ') + ', updatedAt = :updatedAt';

                const command = new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { userId, taskId },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeValues: ExpressionAttributeValues,
                    ReturnValues: 'ALL_NEW', 
                });

                const result = await docClient.send(command);
                response = { 
                    statusCode: 200, 
                    body: JSON.stringify({ success: true, task: result.Attributes }) 
                };
            }
            
            // --- DELETE (DELETE) ---
            else if (httpMethod === 'DELETE') {
                const command = new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { userId, taskId },
                });

                await docClient.send(command);
                response = { 
                    statusCode: 200, 
                    body: JSON.stringify({ success: true, message: `Task ${taskId} deleted` }) 
                };
            }
        }
        
// ---------------------------------------------
// 4. UNKNOWN Route
// ---------------------------------------------
        else {
            response = {
                statusCode: 404,
                body: JSON.stringify({ success: false, error: 'Route Not Found' }),
            };
        }
        
        return { ...response, headers };
        
    } catch (error) {
        console.error('Lambda Execution Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Internal Server Error', details: error.message }),
        };
    }
};