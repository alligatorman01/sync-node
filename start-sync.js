#!/usr/bin/env node

import SyncService from './src/services/syncService.js';
import { logger } from './src/utils/logger.js';
import { validateConfig } from './src/config/config.js';

/**
 * Start the continuous sync service using polling strategy
 * Optimized for production deployment on Railway
 */
async function startSync() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('🔄 SyncNode - Continuous Sync Mode');
  console.log('==================================');
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
  console.log('Monitors Trello for changes and runs full sync when detected');
  console.log('');
  
  try {
    // Validate configuration
    validateConfig();
    
    const syncService = new SyncService();
    
    // Handle graceful shutdown
    const shutdown = () => {
      console.log('\n🛑 Shutting down sync service...');
      syncService.stop();
      
      // Give time for cleanup
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    };

    // Handle various shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown); // Railway uses this for deployment updates

    // Handle uncaught exceptions in production
    if (isProduction) {
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', error);
        console.error('💥 Uncaught exception:', error.message);
        shutdown();
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled rejection', { reason, promise });
        console.error('💥 Unhandled rejection:', reason);
        shutdown();
      });
    }

    // Start the service
    await syncService.start();
    
    console.log('✅ Continuous sync started successfully');
    console.log(`   Polling interval: ${syncService.pollingStrategy.syncInterval / 1000} seconds`);
    console.log('   Will run full sync when Trello changes are detected');
    
    if (isProduction) {
      console.log('   Running in production mode');
      console.log('   Logs available in Railway dashboard');
    } else {
      console.log('   Press Ctrl+C to stop');
    }
    console.log('');

    // Status reporting (less frequent in production)
    const statusInterval = isProduction ? 300000 : 30000; // 5 minutes vs 30 seconds
    
    setInterval(() => {
      const status = syncService.getStatus();
      
      if (isProduction) {
        // Production: Only log essential status
        logger.info('Service status', {
          isRunning: status.isRunning,
          isSyncing: status.isSyncing,
          lastSync: status.polling.lastSyncTime,
          pollInterval: status.configuration.pollIntervalSeconds
        });
      } else {
        // Development: Show detailed status
        logger.debug('Service status', status);
        
        if (status.polling.nextCheckIn) {
          const nextCheck = new Date(status.polling.nextCheckIn);
          const timeUntilCheck = Math.round((nextCheck - new Date()) / 1000);
          console.log(`⏱️  Next check in ${timeUntilCheck} seconds | Last sync: ${status.polling.lastSyncTime.toLocaleTimeString()}`);
        }
      }
    }, statusInterval);

    // Keep process alive
    const keepAlive = () => {
      setTimeout(keepAlive, 60000); // Check every minute
    };
    keepAlive();

  } catch (error) {
    logger.error('Failed to start sync service', error);
    console.error('❌ Failed to start sync service:', error.message);
    
    if (isProduction) {
      // In production, exit with error code for Railway to detect failure
      process.exit(1);
    } else {
      process.exit(1);
    }
  }
}

startSync();