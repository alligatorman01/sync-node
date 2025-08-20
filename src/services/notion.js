import { Client } from '@notionhq/client';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Notion API service for managing database entries
 */
class NotionService {
  constructor() {
    this.client = new Client({
      auth: config.notion.apiKey
    });
    this.databaseId = config.notion.databaseId;
  }

  /**
   * Gets all entries from the Notion database
   * @returns {Promise<Array>} Array of Notion database entries
   */
  async getEntries() {
    try {
      logger.info('Fetching entries from Notion database');
      const response = await this.client.databases.query({
        database_id: this.databaseId
      });
      
      logger.info(`Retrieved ${response.results.length} entries from Notion`);
      return response.results;
    } catch (error) {
      logger.error('Error fetching Notion entries', error);
      throw error;
    }
  }

  /**
   * Creates a new entry in the Notion database
   * @param {Object} properties - Entry properties
   * @returns {Promise<Object>} Created entry data
   */
  async createEntry(properties) {
    try {
      logger.info('Creating new Notion entry', { title: properties['Priority Name']?.title?.[0]?.text?.content });
      const response = await this.client.pages.create({
        parent: {
          database_id: this.databaseId
        },
        properties
      });
      
      logger.info(`Created Notion entry with ID: ${response.id}`);
      return response;
    } catch (error) {
      logger.error('Error creating Notion entry', error);
      throw error;
    }
  }

  /**
   * Updates an existing Notion database entry
   * @param {string} pageId - Page ID to update
   * @param {Object} properties - Properties to update
   * @returns {Promise<Object>} Updated entry data
   */
  async updateEntry(pageId, properties) {
    try {
      logger.info(`Updating Notion entry ${pageId}`, { 
        updates: Object.keys(properties) 
      });
      
      const response = await this.client.pages.update({
        page_id: pageId,
        properties
      });
      
      logger.info(`Updated Notion entry ${pageId}`);
      return response;
    } catch (error) {
      logger.error(`Error updating Notion entry ${pageId}`, error);
      throw error;
    }
  }

  /**
   * Finds an entry by Trello ID
   * @param {string} trelloId - Trello card ID to search for
   * @returns {Promise<Object|null>} Notion entry or null if not found
   */
  async findEntryByTrelloId(trelloId) {
    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: 'Trello ID',
          rich_text: {
            equals: trelloId
          }
        }
      });

      return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
      logger.error(`Error finding Notion entry by Trello ID ${trelloId}`, error);
      throw error;
    }
  }

  /**
   * Gets the database schema/properties
   * @returns {Promise<Object>} Database properties schema
   */
  async getDatabaseSchema() {
    try {
      const response = await this.client.databases.retrieve({
        database_id: this.databaseId
      });
      
      return response.properties;
    } catch (error) {
      logger.error('Error retrieving database schema', error);
      throw error;
    }
  }

  /**
   * Extracts the plain text value from a Notion rich text property
   * @param {Object} richTextProperty - Notion rich text property
   * @returns {string} Plain text content
   */
  extractRichTextValue(richTextProperty) {
    if (!richTextProperty?.rich_text || richTextProperty.rich_text.length === 0) {
      return '';
    }
    return richTextProperty.rich_text[0]?.text?.content || '';
  }

  /**
   * Extracts the value from a Notion title property
   * @param {Object} titleProperty - Notion title property
   * @returns {string} Title text
   */
  extractTitleValue(titleProperty) {
    if (!titleProperty?.title || titleProperty.title.length === 0) {
      return '';
    }
    return titleProperty.title[0]?.text?.content || '';
  }

  /**
   * Extracts the value from a Notion select property
   * @param {Object} selectProperty - Notion select property
   * @returns {string} Select option name
   */
  extractSelectValue(selectProperty) {
    return selectProperty?.select?.name || '';
  }

  /**
   * Extracts the value from a Notion number property
   * @param {Object} numberProperty - Notion number property
   * @returns {number|null} Number value
   */
  extractNumberValue(numberProperty) {
    return numberProperty?.number;
  }

  /**
   * Extracts the value from a Notion formula property
   * @param {Object} formulaProperty - Notion formula property
   * @returns {number|null} Formula result value
   */
  extractFormulaValue(formulaProperty) {
    if (!formulaProperty?.formula) {
      return null;
    }
    
    const formula = formulaProperty.formula;
    
    // Handle different formula result types
    switch (formula.type) {
      case 'number':
        return formula.number;
      case 'string':
        return formula.string;
      case 'boolean':
        return formula.boolean;
      case 'date':
        return formula.date;
      default:
        return null;
    }
  }

  /**
   * Extracts value from either a regular number property or a formula property
   * @param {Object} property - Notion property (could be number or formula)
   * @returns {number|null} Numeric value
   */
  extractNumericValue(property) {
    // Try as regular number property first
    if (property?.number !== undefined) {
      return property.number;
    }
    
    // Try as formula property
    if (property?.formula?.type === 'number') {
      return property.formula.number;
    }
    
    return null;
  }

  /**
   * Generates the public URL for a Notion page
   * @param {string} pageId - Notion page ID
   * @returns {string} Public Notion page URL
   */
  generateNotionPageUrl(pageId) {
    // Remove dashes from page ID for URL
    const cleanPageId = pageId.replace(/-/g, '');
    return `https://www.notion.so/${cleanPageId}`;
  }

  /**
   * Finds entries that need Trello ID assignment (newly created in Notion)
   * @returns {Promise<Array>} Entries without Trello ID
   */
  async findEntriesWithoutTrelloId() {
    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: 'Trello ID',
          rich_text: {
            is_empty: true
          }
        }
      });

      return response.results;
    } catch (error) {
      logger.error('Error finding entries without Trello ID', error);
      throw error;
    }
  }

  /**
   * Deletes a Notion page
   * @param {string} pageId - Page ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deletePage(pageId) {
    try {
      logger.info(`Deleting Notion page ${pageId}`);
      const response = await this.client.pages.update({
        page_id: pageId,
        archived: true
      });
      
      logger.info(`Deleted Notion page ${pageId}`);
      return response;
    } catch (error) {
      logger.error(`Error deleting Notion page ${pageId}`, error);
      throw error;
    }
  }

  /**
   * Extracts the value from a Notion checkbox property
   * @param {Object} checkboxProperty - Notion checkbox property
   * @returns {boolean} Checkbox value
   */
  extractCheckboxValue(checkboxProperty) {
    return checkboxProperty?.checkbox || false;
  }
}

export default NotionService;
