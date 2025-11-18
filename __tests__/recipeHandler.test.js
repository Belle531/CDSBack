// backend/__tests__/recipeHandler.test.js

const { handler } = require('../src/handlers/recipeHandler');
const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Recipe Lambda Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('should create a new recipe', async () => {
    ddbMock.on(PutCommand).resolves({});
    const event = {
      httpMethod: 'POST',
      path: '/api/recipes',
      body: JSON.stringify({
        title: 'Test Recipe',
        ingredients: ['flour', 'sugar'],
        steps: ['Mix', 'Bake'],
        authorId: 'user123',
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).title).toBe('Test Recipe');
  });

  it('should return all recipes', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ title: 'Test Recipe' }] });
    const event = {
      httpMethod: 'GET',
      path: '/api/recipes',
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(result.body))).toBe(true);
  });
});
