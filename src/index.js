import { validateConfig } from './config/config.js';
import { logger } from './utils/logger.js';
import SyncEngine from './sync/syncEngine.js';

/**
 * Main application entry point
 */
async function main() {
  try {
    // Validate configuration
    logger.info('SyncNode - Trello ↔ Notion Bridge Starting...');
    validateConfig();
    logger.info('Configuration validated successfully');

    // Initialize sync engine
    const syncEngine = new SyncEngine();

    // Perform synchronization
    const startTime = Date.now();
    const stats = await syncEngine.performSync();
    const duration = Date.now() - startTime;

    // Log final results
    logger.info('Sync process completed', {
      duration: `${duration}ms`,
      stats
    });

    // Log summary
    console.log('\n=== SYNC SUMMARY ===');
    console.log(`Duration: ${duration}ms`);
    console.log(`Trello → Notion: ${stats.trelloToNotion.created} created, ${stats.trelloToNotion.updated} updated`);
    console.log(`Notion → Trello: ${stats.notionToTrello.created} created, ${stats.notionToTrello.updated} updated`);
    console.log(`Errors: ${stats.errors}`);
    console.log('==================\n');

    if (stats.errors > 0) {
      process.exit(1);
    }

  } catch (error) {
    logger.error('Application failed to start', error);
    console.error('\nApplication failed:', error.message);
    
    if (error.message.includes('Missing required environment variables')) {
      console.error('\nPlease ensure you have created a .env file with all required variables.');
      console.error('See .env.example for the required format.');
    }
    
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the application
main();
