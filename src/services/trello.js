import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Trello API service for managing cards and custom fields
 */
class TrelloService {
  constructor() {
    this.baseUrl = config.trello.baseUrl;
    this.apiKey = config.trello.apiKey;
    this.token = config.trello.token;
    this.boardId = config.trello.boardId;
  }

  /**
   * Makes authenticated request to Trello API
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Axios options
   * @returns {Promise<any>} API response data
   */
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      // Ensure authentication parameters are always included
      const params = {
        key: this.apiKey,
        token: this.token,
        ...options.params
      };

      const requestConfig = {
        method: options.method || 'GET',
        url,
        params,
        ...options
      };

      // Remove params from options to avoid duplication
      delete requestConfig.params;
      
      const response = await axios({
        ...requestConfig,
        params
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Trello API error: ${error.message}`, { 
        endpoint, 
        error: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Gets all cards from the configured board, filtering out known duplicates
   * @returns {Promise<Array>} Array of Trello cards
   */
  async getCards() {
    logger.info('Fetching cards from Trello board');
    const cards = await this.makeRequest(`/boards/${this.boardId}/cards`, {
      params: {
        customFieldItems: 'true',
        filter: 'open' // Only get open (non-archived) cards
      }
    });
    
    // Apply aggressive filtering to remove duplicate cards
    const filteredCards = this.removeProblematicCards(cards);
    
    logger.info(`Retrieved ${cards.length} cards from Trello (${filteredCards.length} after removing duplicates)`);
    return filteredCards;
  }

  /**
   * Removes problematic duplicate cards based on ID patterns and creation dates
   * @param {Array} cards - Array of Trello cards
   * @returns {Array} Filtered array with problematic cards removed
   */
  removeProblematicCards(cards) {
    logger.info('Applying aggressive duplicate filtering...');
    
    // First, group cards by name
    const cardsByName = {};
    cards.forEach(card => {
      const name = card.name.trim();
      if (!cardsByName[name]) {
        cardsByName[name] = [];
      }
      cardsByName[name].push(card);
    });
    
    const keptCards = [];
    const removedCards = [];
    
    Object.entries(cardsByName).forEach(([cardName, duplicateCards]) => {
      if (duplicateCards.length === 1) {
        // No duplicates, keep the card
        keptCards.push(duplicateCards[0]);
      } else {
        // Multiple cards with same name - apply filtering logic
        
        // Sort by creation date (dateLastActivity as proxy)
        duplicateCards.sort((a, b) => new Date(a.dateLastActivity) - new Date(b.dateLastActivity));
        
        // Strategy 1: Prefer cards NOT in "Content / Curriculum" list (686df2204803664e4331f70d)
        const nonContentCurriculumCards = duplicateCards.filter(card => 
          card.idList !== '686df2204803664e4331f70d'
        );
        
        // Strategy 2: Prefer cards with older ID prefixes (686df, 687f vs 688bc)
        const originalCards = duplicateCards.filter(card => 
          !card.id.startsWith('688bc')
        );
        
        let cardToKeep;
        
        if (nonContentCurriculumCards.length > 0) {
          // Keep the oldest card that's NOT in Content/Curriculum
          cardToKeep = nonContentCurriculumCards[0];
          logger.debug(`Keeping "${cardName}" from outside Content/Curriculum list`);
        } else if (originalCards.length > 0) {
          // Keep the oldest card that doesn't have the problematic ID prefix
          cardToKeep = originalCards[0];
          logger.debug(`Keeping "${cardName}" with original ID prefix`);
        } else {
          // Fallback: keep the oldest card
          cardToKeep = duplicateCards[0];
          logger.debug(`Keeping oldest "${cardName}" as fallback`);
        }
        
        keptCards.push(cardToKeep);
        
        // Track removed cards for logging
        duplicateCards.forEach(card => {
          if (card.id !== cardToKeep.id) {
            removedCards.push({
              name: card.name,
              id: card.id,
              list: card.idList
            });
          }
        });
      }
    });
    
    if (removedCards.length > 0) {
      logger.info(`Filtered out ${removedCards.length} duplicate cards:`);
      removedCards.forEach(card => {
        logger.info(`  - "${card.name}" (${card.id})`);
      });
    }
    
    return keptCards;
  }

  /**
   * Gets all cards from the configured board with full data
   * @returns {Promise<Array>} Array of Trello cards
   */
  async getAllCards() {
    logger.info('Fetching all cards from Trello board');
    const cards = await this.makeRequest(`/boards/${this.boardId}/cards`, {
      params: {
        customFieldItems: 'true',
        list: 'true',
        fields: 'all'
      }
    });
    logger.info(`Retrieved ${cards.length} cards from Trello`);
    return cards;
  }

  /**
   * Gets board lists
   * @returns {Promise<Array>} Array of board lists
   */
  async getBoardLists() {
    logger.info('Fetching lists from Trello board');
    return await this.makeRequest(`/boards/${this.boardId}/lists`);
  }

  /**
   * Gets board lists (alias for getBoardLists for compatibility)
   * @returns {Promise<Array>} Array of board lists
   */
  async getLists() {
    return await this.getBoardLists();
  }

  /**
   * Gets custom field definitions for the board
   * @returns {Promise<Array>} Array of custom field definitions
   */
  async getCustomFields() {
    logger.info('Fetching custom fields from Trello board');
    const customFields = await this.makeRequest(`/boards/${this.boardId}/customFields`);
    return customFields;
  }

  /**
   * Updates a Trello card
   * @param {string} cardId - Card ID to update
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated card data
   */
  async updateCard(cardId, updates) {
    logger.info(`Updating Trello card ${cardId}`, updates);
    return await this.makeRequest(`/cards/${cardId}`, {
      method: 'PUT',
      params: updates
    });
  }

  /**
   * Updates a custom field on a card
   * @param {string} cardId - Card ID
   * @param {string} customFieldId - Custom field ID
   * @param {number} value - New value
   * @returns {Promise<Object>} Update result
   */
  async updateCustomField(cardId, customFieldId, value) {
    logger.debug(`Updating custom field ${customFieldId} on card ${cardId} to ${value}`);
    return await this.makeRequest(`/cards/${cardId}/customField/${customFieldId}/item`, {
      method: 'PUT',
      data: {
        value: {
          number: String(value)
        }
      }
    });
  }

  /**
   * Updates a text custom field on a card
   * @param {string} cardId - Card ID
   * @param {string} customFieldId - Custom field ID
   * @param {string} value - New text value
   * @returns {Promise<Object>} Update result
   */
  async updateTextCustomField(cardId, customFieldId, value) {
    logger.debug(`Updating text custom field ${customFieldId} on card ${cardId} to ${value}`);
    return await this.makeRequest(`/cards/${cardId}/customField/${customFieldId}/item`, {
      method: 'PUT',
      data: {
        value: {
          text: String(value)
        }
      }
    });
  }

  /**
   * Updates a checkbox custom field on a card
   * @param {string} cardId - Card ID
   * @param {string} customFieldId - Custom field ID
   * @param {boolean} checked - Checkbox state
   * @returns {Promise<Object>} Update result
   */
  async updateCheckboxCustomField(cardId, customFieldId, checked) {
    logger.debug(`Updating checkbox custom field ${customFieldId} on card ${cardId} to ${checked}`);
    return await this.makeRequest(`/cards/${cardId}/customField/${customFieldId}/item`, {
      method: 'PUT',
      data: {
        value: {
          checked: String(checked) // Trello expects checkbox values as strings
        }
      }
    });
  }

  /**
   * Updates a custom field value on a card
   * @param {string} cardId - Card ID
   * @param {string} customFieldId - Custom field ID
   * @param {string} value - New value as string
   * @returns {Promise<Object>} Update result
   */
  async updateCustomFieldValue(cardId, customFieldId, value) {
    logger.debug(`Updating custom field ${customFieldId} on card ${cardId} to ${value}`);
    return await this.makeRequest(`/cards/${cardId}/customField/${customFieldId}/item`, {
      method: 'PUT',
      data: {
        value: {
          number: value
        }
      }
    });
  }

  /**
   * Creates a new card on the board
   * @param {Object} cardData - Card data including name, listId, etc.
   * @returns {Promise<Object>} Created card data
   */
  async createCard(cardData) {
    logger.info('Creating new Trello card', { name: cardData.name });
    return await this.makeRequest('/cards', {
      method: 'POST',
      params: cardData
    });
  }

  /**
   * Moves a card to a different list
   * @param {string} cardId - Card ID
   * @param {string} listId - Target list ID
   * @returns {Promise<Object>} Updated card data
   */
  async moveCard(cardId, listId) {
    logger.info(`Moving card ${cardId} to list ${listId}`);
    return await this.updateCard(cardId, { idList: listId });
  }

  /**
   * Deletes a Trello card
   * @param {string} cardId - Card ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteCard(cardId) {
    logger.info(`Deleting Trello card ${cardId}`);
    return await this.makeRequest(`/cards/${cardId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Gets a map of list names to list IDs
   * @returns {Promise<Object>} Map of list name -> list ID
   */
  async getListMap() {
    const lists = await this.getBoardLists(); // Changed from getLists() to getBoardLists()
    const listMap = {};
    lists.forEach(list => {
      listMap[list.name] = list.id;
    });
    return listMap;
  }

  /**
   * Gets a map of custom field names to field IDs
   * @returns {Promise<Object>} Map of field name -> field ID
   */
  async getCustomFieldMap() {
    const customFields = await this.getCustomFields();
    const fieldMap = {};
    customFields.forEach(field => {
      fieldMap[field.name] = field.id;
    });
    return fieldMap;
  }
}

export default TrelloService;
