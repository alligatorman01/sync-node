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
  sync: {
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 60000, // Default 60 seconds
    // Production settings
    minPollInterval: 30000, // Minimum 30 seconds to avoid API rate limits
    maxPollInterval: 900000, // Maximum 15 minutes
    retryDelay: 5000 // Delay before retrying failed operations
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

  // Validate polling interval is within acceptable range
  const pollInterval = config.sync.pollInterval;
  
  // Debug logging for troubleshooting
  console.log('POLL_INTERVAL Debug Info:');
  console.log('  Raw env var:', process.env.POLL_INTERVAL);
  console.log('  Parsed value:', pollInterval);
  console.log('  Type:', typeof pollInterval);
  console.log('  Min allowed:', config.sync.minPollInterval);
  console.log('  Max allowed:', config.sync.maxPollInterval);
  
  if (pollInterval < config.sync.minPollInterval) {
    throw new Error(`POLL_INTERVAL must be at least ${config.sync.minPollInterval}ms (${config.sync.minPollInterval/1000} seconds)`);
  }
  
  if (pollInterval > config.sync.maxPollInterval) {
    throw new Error(`POLL_INTERVAL must not exceed ${config.sync.maxPollInterval}ms (${config.sync.maxPollInterval/60000} minutes)`);
  }
}
