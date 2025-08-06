import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import PollingStrategy from '../strategies/pollingStrategy.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sync service that monitors Trello for changes and triggers full sync
 * Uses configurable polling interval from environment settings
 */
class SyncService {
  constructor() {
    // Use the configured polling interval from config
    this.pollingStrategy = new PollingStrategy(config.sync.pollInterval);
    this.isRunning = false;
    this.isSyncing = false;
    
    logger.info('SyncService initialized', {
      pollInterval: `${config.sync.pollInterval / 1000}s`,
      minInterval: `${config.sync.minPollInterval / 1000}s`,
      maxInterval: `${config.sync.maxPollInterval / 60000}m`
    });
  }

  /**
   * Start the synchronization service
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Sync service already running');
      return;
    }

    try {
      logger.info('Starting sync service', {
        pollInterval: `${config.sync.pollInterval / 1000} seconds`,
        boardId: config.trello.boardId
      });
      
      // Start polling for changes
      await this.pollingStrategy.startPolling(this.handleChanges.bind(this));
      
      this.isRunning = true;
      logger.info('Sync service started successfully');
      
    } catch (error) {
      logger.error('Failed to start sync service', error);
      throw error;
    }
  }

  /**
   * Stop the synchronization service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Sync service not running');
      return;
    }

    try {
      this.pollingStrategy.stopPolling();
      this.isRunning = false;
      logger.info('Sync service stopped');
    } catch (error) {
      logger.error('Error stopping sync service', error);
    }
  }

  /**
   * Handle detected changes by running full sync
   * @param {Object} changeData - Information about detected changes
   * @returns {Promise<void>}
   */
  async handleChanges(changeData) {
    if (this.isSyncing) {
      logger.info('Sync already in progress, skipping this cycle', {
        pendingChanges: changeData.changesDetected
      });
      return;
    }

    try {
      this.isSyncing = true;
      
      logger.info('Changes detected, triggering full sync', {
        changesDetected: changeData.changesDetected,
        actionTypes: changeData.actions.map(a => a.type),
        lastSyncTime: changeData.lastSyncTime
      });

      const syncStartTime = Date.now();
      await this.runFullSync();
      const syncDuration = Date.now() - syncStartTime;
      
      logger.info('Full sync completed successfully', {
        duration: `${syncDuration}ms`,
        changesProcessed: changeData.changesDetected
      });

    } catch (error) {
      logger.error('Full sync failed', error);
      
      // Optional: Implement retry logic with exponential backoff
      await this.handleSyncFailure(error);
      
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Handle sync failure with retry logic
   * @param {Error} error - The sync error
   * @returns {Promise<void>}
   */
  async handleSyncFailure(error) {
    logger.warn('Implementing retry delay after sync failure', {
      retryDelay: config.sync.retryDelay,
      error: error.message
    });
    
    // Wait before allowing next sync attempt
    await new Promise(resolve => setTimeout(resolve, config.sync.retryDelay));
  }

  /**
   * Run the main index.js sync process as child process
   * @returns {Promise<void>}
   */
  async runFullSync() {
    return new Promise((resolve, reject) => {
      const indexPath = path.resolve(__dirname, '../index.js');
      
      logger.debug('Spawning sync process', { indexPath });
      
      const syncProcess = spawn('node', [indexPath], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Pass sync context to child process
          SYNC_TRIGGER: 'polling_strategy',
          SYNC_TIMESTAMP: new Date().toISOString()
        }
      });

      let stdout = '';
      let stderr = '';

      syncProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      syncProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      syncProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('Sync process completed successfully');
          
          // Extract and display sync summary
          this.displaySyncSummary(stdout);
          resolve();
        } else {
          logger.error('Sync process failed', { 
            exitCode: code, 
            stderr: stderr.trim(),
            stdout: stdout.trim()
          });
          reject(new Error(`Sync process exited with code ${code}: ${stderr.trim()}`));
        }
      });

      syncProcess.on('error', (error) => {
        logger.error('Failed to spawn sync process', error);
        reject(error);
      });
    });
  }

  /**
   * Extract and display sync summary from stdout
   * @param {string} stdout - Process output
   */
  displaySyncSummary(stdout) {
    if (stdout.includes('SYNC SUMMARY')) {
      const summaryStart = stdout.indexOf('=== SYNC SUMMARY ===');
      const summaryEnd = stdout.indexOf('==================');
      
      if (summaryStart !== -1 && summaryEnd !== -1) {
        const summary = stdout.substring(summaryStart, summaryEnd + 18);
        console.log('\n' + summary);
      }
    }
  }

  /**
   * Update polling interval dynamically
   * @param {number} newInterval - New interval in milliseconds
   * @returns {Promise<void>}
   */
  async updatePollInterval(newInterval) {
    // Validate new interval
    if (newInterval < config.sync.minPollInterval || newInterval > config.sync.maxPollInterval) {
      throw new Error(`Poll interval must be between ${config.sync.minPollInterval}ms and ${config.sync.maxPollInterval}ms`);
    }

    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }
    
    // Update the polling strategy with new interval
    this.pollingStrategy = new PollingStrategy(newInterval);
    
    logger.info('Poll interval updated', {
      oldInterval: `${config.sync.pollInterval / 1000}s`,
      newInterval: `${newInterval / 1000}s`
    });
    
    if (wasRunning) {
      await this.start();
    }
  }

  /**
   * Get comprehensive service status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      configuration: {
        pollInterval: config.sync.pollInterval,
        pollIntervalSeconds: config.sync.pollInterval / 1000,
        minInterval: config.sync.minPollInterval,
        maxInterval: config.sync.maxPollInterval,
        retryDelay: config.sync.retryDelay
      },
      polling: this.pollingStrategy.getStatus(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: config.logging.level
      }
    };
  }
}

export default SyncService;