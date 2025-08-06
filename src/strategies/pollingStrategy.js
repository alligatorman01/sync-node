import TrelloService from '../services/trello.js';
import { logger } from '../utils/logger.js';

/**
 * Polling-based sync strategy that triggers full sync on changes
 * Monitors Trello board for changes by periodically checking board actions
 */
class PollingStrategy extends TrelloService {
  /**
   * Initialize polling strategy
   * @param {number} syncInterval - Polling interval in milliseconds (default: 60 seconds)
   */
  constructor(syncInterval = 30000) {
    super();
    this.syncInterval = syncInterval;
    this.lastSyncTime = new Date();
    this.isRunning = false;
    this.pollInterval = null;
  }

  /**
   * Start polling for board changes
   * @param {Function} onChangeCallback - Called when changes are detected
   * @returns {Promise<void>}
   */
  async startPolling(onChangeCallback) {
    if (this.isRunning) {
      logger.warn('Polling already running');
      return;
    }

    if (typeof onChangeCallback !== 'function') {
      throw new Error('onChangeCallback must be a function');
    }

    this.isRunning = true;
    logger.info('Starting polling strategy', { 
      interval: this.syncInterval,
      boardId: this.boardId 
    });

    try {
      // Set up polling interval
      this.pollInterval = setInterval(async () => {
        try {
          await this.checkForChanges(onChangeCallback);
        } catch (error) {
          logger.error('Polling check failed', error);
        }
      }, this.syncInterval);

      logger.info('Polling started successfully');
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start polling', error);
      throw error;
    }
  }

  /**
   * Stop polling for changes
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    logger.info('Polling stopped');
  }

  /**
   * Check for board changes since last sync
   * @param {Function} onChangeCallback - Callback for processing changes
   * @returns {Promise<void>}
   */
  async checkForChanges(onChangeCallback) {
    try {
      logger.debug('Checking for changes', { 
        lastSyncTime: this.lastSyncTime.toISOString(),
        boardId: this.boardId
      });

      // Get board actions since last sync
      const actions = await this.makeRequest(`/boards/${this.boardId}/actions`, {
        params: {
          since: this.lastSyncTime.toISOString(),
          filter: 'updateCard,createCard,updateCustomFieldItem',
          limit: 100
        }
      });

      if (actions.length > 0) {
        logger.info(`Found ${actions.length} changes since last sync`);
        
        // Trigger sync callback - don't care about individual changes, just that something changed
        await onChangeCallback({
          changesDetected: actions.length,
          lastSyncTime: this.lastSyncTime,
          actions: actions.map(a => ({ id: a.id, type: a.type, date: a.date }))
        });
      } else {
        logger.debug('No changes detected');
      }

      // Update last sync time
      this.lastSyncTime = new Date();

    } catch (error) {
      logger.error('Failed to check for changes', error);
      throw error;
    }
  }

  /**
   * Get current polling status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      syncInterval: this.syncInterval,
      lastSyncTime: this.lastSyncTime,
      boardId: this.boardId,
      nextCheckIn: this.isRunning ? 
        new Date(Date.now() + this.syncInterval) : null
    };
  }
}

export default PollingStrategy;