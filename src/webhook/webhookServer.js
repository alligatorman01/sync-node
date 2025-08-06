import express from 'express';
import crypto from 'crypto';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import SyncEngine from '../sync/syncEngine.js';

/**
 * Webhook server for handling Trello events
 */
class WebhookServer {
  constructor() {
    this.app = express();
    this.syncEngine = new SyncEngine();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Sets up Express middleware
   */
  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Add request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, { 
        headers: req.headers,
        body: req.body 
      });
      next();
    });
  }

  /**
   * Sets up webhook routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Webhook verification endpoint (for initial setup)
    this.app.head('/webhook/trello', (req, res) => {
      logger.info('Webhook verification request received');
      res.status(200).send();
    });

    // Main webhook endpoint
    this.app.post('/webhook/trello', async (req, res) => {
      try {
        await this.handleTrelloWebhook(req, res);
      } catch (error) {
        logger.error('Webhook handler error', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  /**
   * Handles incoming Trello webhook events
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async handleTrelloWebhook(req, res) {
    const webhookData = req.body;
    
    // Verify webhook authenticity if secret is configured
    if (config.webhook.secret) {
      const isValid = this.verifyWebhookSignature(req);
      if (!isValid) {
        logger.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    logger.info('Trello webhook received', {
      action: webhookData.action?.type,
      cardId: webhookData.action?.data?.card?.id,
      cardName: webhookData.action?.data?.card?.name
    });

    // Check if this is a custom field update
    if (this.shouldTriggerSync(webhookData)) {
      logger.info('Custom field update detected, triggering sync...');
      
      // Trigger sync asynchronously
      setImmediate(async () => {
        try {
          const stats = await this.syncEngine.performSync();
          logger.info('Webhook-triggered sync completed', stats);
        } catch (error) {
          logger.error('Webhook-triggered sync failed', error);
        }
      });

      res.json({ 
        status: 'accepted', 
        message: 'Sync triggered',
        timestamp: new Date().toISOString()
      });
    } else {
      logger.debug('Event does not require sync', {
        actionType: webhookData.action?.type
      });
      res.json({ 
        status: 'ignored', 
        message: 'Event does not trigger sync'
      });
    }
  }

  /**
   * Determines if the webhook event should trigger a sync
   * @param {Object} webhookData - Trello webhook payload
   * @returns {boolean} True if sync should be triggered
   */
  shouldTriggerSync(webhookData) {
    const action = webhookData.action;
    if (!action) return false;

    // Trigger on custom field updates
    if (action.type === 'updateCustomFieldItem') {
      return true;
    }

    // Trigger on card updates (name changes, list moves)
    if (action.type === 'updateCard') {
      const data = action.data;
      // Check if card name or list changed
      if (data.old?.name || data.old?.idList) {
        return true;
      }
    }

    // Trigger on new cards
    if (action.type === 'createCard') {
      return true;
    }

    return false;
  }

  /**
   * Verifies webhook signature for security
   * @param {Request} req - Express request object
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(req) {
    const signature = req.headers['x-trello-webhook'];
    if (!signature) return false;

    const body = JSON.stringify(req.body);
    const webhookSecret = config.webhook.secret;
    
    // Create HMAC hash
    const hmac = crypto.createHmac('sha1', webhookSecret);
    hmac.update(body);
    const expectedSignature = hmac.digest('base64');

    return signature === expectedSignature;
  }

  /**
   * Starts the webhook server
   * @param {number} port - Port to listen on
   */
  start(port = 3000) {
    this.app.listen(port, () => {
      logger.info(`Webhook server listening on port ${port}`);
      logger.info(`Webhook URL: http://localhost:${port}/webhook/trello`);
    });
  }
}

export default WebhookServer;