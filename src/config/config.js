import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration loaded from environment variables
 */
export const config = {
  trello: {
    apiKey: process.env.TRELLO_API_KEY,
    token: process.env.TRELLO_TOKEN,
    boardId: process.env.TRELLO_BOARD_ID,
    baseUrl: 'https://api.trello.com/1'
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required environment variable is missing
 */
export function validateConfig() {
  const required = [
    'TRELLO_API_KEY',
    'TRELLO_TOKEN', 
    'TRELLO_BOARD_ID',
    'NOTION_API_KEY',
    'NOTION_DATABASE_ID'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
