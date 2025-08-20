import TrelloService from '../services/trello.js';
import NotionService from '../services/notion.js';
import { 
  mapTrelloToNotion, 
  mapNotionToTrello, 
  extractTrelloCustomFields, 
  hasChanged 
} from '../utils/mapping.js';
import { logger } from '../utils/logger.js';

/**
 * Core synchronization engine that orchestrates data sync between Trello and Notion
 */
class SyncEngine {
  constructor() {
    this.trelloService = new TrelloService();
    this.notionService = new NotionService();
    this.syncStats = {
      trelloToNotion: { created: 0, updated: 0 },
      notionToTrello: { created: 0, updated: 0 },
      errors: 0
    };
  }

  /**
   * Performs a complete sync between Trello and Notion
   * @returns {Promise<Object>} Sync statistics
   */
  async performSync() {
    logger.info('Starting sync process...');
    this.resetStats();

    try {
      // Fetch all data upfront
      const [trelloCards, trelloLists, trelloCustomFields, notionEntries] = await Promise.all([
        this.trelloService.getCards(),
        this.trelloService.getLists(),
        this.trelloService.getCustomFields(),
        this.notionService.getEntries()
      ]);

      // Create lookup maps
      const listIdToNameMap = this.createListMap(trelloLists);        // ID -> name for Trello→Notion
      const listNameToIdMap = this.createListMapReverse(trelloLists); // name -> ID for Notion→Trello
      const customFieldMap = this.createCustomFieldMap(trelloCustomFields);
      const notionByTrelloId = this.createNotionLookupMap(notionEntries);

      // Sync Trello → Notion
      await this.syncTrelloToNotion(trelloCards, listIdToNameMap, trelloCustomFields, notionByTrelloId);

      // Sync Notion → Trello (including Total Score sync)
      await this.syncNotionToTrello(notionEntries, listNameToIdMap, customFieldMap);

      // Handle deletion sync based on "synced" checkbox
      await this.handleDeletionSync(trelloCards, notionEntries, customFieldMap);

      // Note: syncTotalScoreToTrello is now called within syncNotionToTrello to avoid duplicate API calls

      logger.info('Sync completed successfully', this.syncStats);
      return this.syncStats;

    } catch (error) {
      logger.error('Sync process failed', error);
      this.syncStats.errors++;
      throw error;
    }
  }

  /**
   * Syncs data from Trello to Notion
   * @param {Array} trelloCards - Trello cards  
   * @param {Object} listIdToNameMap - Map of list ID to name
   * @param {Array} trelloCustomFields - Custom field definitions
   * @param {Object} notionByTrelloId - Notion entries mapped by Trello ID
   */
  async syncTrelloToNotion(trelloCards, listIdToNameMap, trelloCustomFields, notionByTrelloId) {
    logger.info('Syncing Trello → Notion');

    // DEBUG: Log the BOARD ID being used
    logger.info(`Using Board ID: ${this.trelloService.boardId}`);
    
    // DEBUG: Analyze the card IDs to see if they're from different sources
    const cardIdPrefixes = {};
    trelloCards.forEach(card => {
      const prefix = card.id.substring(0, 5);
      if (!cardIdPrefixes[prefix]) {
        cardIdPrefixes[prefix] = [];
      }
      cardIdPrefixes[prefix].push({
        id: card.id,
        name: card.name,
        listId: card.idList,
        listName: listIdToNameMap[card.idList]
      });
    });
    
    logger.info('Card ID Prefixes Analysis:');
    Object.entries(cardIdPrefixes).forEach(([prefix, cards]) => {
      logger.info(`  ${prefix}***: ${cards.length} cards`);
      // Show first few examples
      cards.slice(0, 3).forEach(card => {
        logger.info(`    - ${card.name} in ${card.listName}`);
      });
      if (cards.length > 3) {
        logger.info(`    - ... and ${cards.length - 3} more`);
      }
    });

    // DEBUG: First, let's see what we're actually getting from Trello
    logger.info(`Total cards received from Trello API: ${trelloCards.length}`);
    
    // Group cards by their actual Trello ID to see if we have true duplicates
    const cardsByTrelloId = {};
    trelloCards.forEach(card => {
      if (!cardsByTrelloId[card.id]) {
        cardsByTrelloId[card.id] = [];
      }
      cardsByTrelloId[card.id].push(card);
    });

    // Log any cards that appear multiple times with the same Trello ID
    const trueDuplicates = Object.entries(cardsByTrelloId).filter(([id, cards]) => cards.length > 1);
    if (trueDuplicates.length > 0) {
      logger.error('FOUND TRUE DUPLICATES - Same Trello ID appearing multiple times:');
      trueDuplicates.forEach(([trelloId, cards]) => {
        logger.error(`Trello ID ${trelloId} appears ${cards.length} times:`);
        cards.forEach((card, index) => {
          logger.error(`  ${index + 1}. "${card.name}" in list ${card.idList} (${listIdToNameMap[card.idList]})`);
        });
      });
    }

    // Get unique cards only (deduplicate by Trello ID)
    const uniqueCards = Object.values(cardsByTrelloId).map(cards => cards[0]);
    logger.info(`Unique cards after deduplication: ${uniqueCards.length}`);

    // Now check for cards with same NAME but different Trello IDs (legitimate but confusing)
    const cardsByName = {};
    uniqueCards.forEach(card => {
      const name = card.name.trim();
      if (!cardsByName[name]) {
        cardsByName[name] = [];
      }
      cardsByName[name].push({
        trelloId: card.id,
        listId: card.idList,
        listName: listIdToNameMap[card.idList] || 'Unknown'
      });
    });

    const sameNameDifferentIds = Object.entries(cardsByName).filter(([name, cards]) => cards.length > 1);
    if (sameNameDifferentIds.length > 0) {
      logger.warn('Cards with same NAME but different Trello IDs (these are actually different cards):');
      sameNameDifferentIds.forEach(([cardName, cards]) => {
        logger.warn(`"${cardName}" appears in ${cards.length} different cards:`);
        cards.forEach((card, index) => {
          logger.warn(`  ${index + 1}. Trello ID: ${card.trelloId} | List: ${card.listName} (${card.listId})`);
        });
      });
    }

    // Continue with the sync using only unique cards
    for (const card of uniqueCards) {
      try {
        const listName = listIdToNameMap[card.idList] || 'Unknown';
        const customFields = extractTrelloCustomFields(card, trelloCustomFields);
        const notionProperties = mapTrelloToNotion(card, customFields, listName);

        logger.debug(`Processing card: "${card.name}" | Trello ID: ${card.id} | List: ${listName}`);

        const existingNotionEntry = notionByTrelloId[card.id];

        if (existingNotionEntry) {
          // Update existing entry if needed
          if (this.shouldUpdateNotionEntry(existingNotionEntry, card, customFields, listName)) {
            await this.notionService.updateEntry(existingNotionEntry.id, notionProperties);
            this.syncStats.trelloToNotion.updated++;
            logger.info(`Updated Notion entry for Trello card: ${card.name} (${listName})`);
          }
        } else {
          // Create new entry
          await this.notionService.createEntry(notionProperties);
          this.syncStats.trelloToNotion.created++;
          logger.info(`Created new Notion entry for Trello card: ${card.name} (${listName}) - Trello ID: ${card.id}`);
        }
      } catch (error) {
        logger.error(`Error syncing Trello card ${card.id} to Notion`, error);
        this.syncStats.errors++;
      }
    }
  }

  /**
   * Syncs data from Notion to Trello (including one-way Total Score)
   * @param {Array} notionEntries - Notion database entries
   * @param {Object} listNameToIdMap - Map of list name to ID
   * @param {Object} customFieldMap - Map of custom field name to ID
   */
  async syncNotionToTrello(notionEntries, listNameToIdMap, customFieldMap) {
    logger.info('Syncing Notion → Trello');

    // Get all Trello cards for lookup
    const trelloCards = await this.trelloService.getCards();
    const trelloCardMap = {};
    trelloCards.forEach(card => {
      trelloCardMap[card.id] = card;
    });

    for (const entry of notionEntries) {
      try {
        const trelloId = this.notionService.extractRichTextValue(entry.properties['Trello ID']);
        
        if (!trelloId) {
          // This is a new Notion entry that needs a Trello card
          await this.createTrelloCardFromNotion(entry, listNameToIdMap);
          this.syncStats.notionToTrello.created++;
          continue;
        }

        const trelloCard = trelloCardMap[trelloId];
        if (!trelloCard) {
          logger.warn(`Trello card ${trelloId} not found for Notion entry ${entry.id}`);
          continue;
        }

        // Update Trello card with Notion data
        await this.updateTrelloFromNotion(entry, trelloCard, listNameToIdMap, customFieldMap);

      } catch (error) {
        logger.error(`Error syncing Notion entry ${entry.id} to Trello`, error);
        this.syncStats.errors++;
      }
    }

    // Pass the existing trelloCardMap to avoid re-fetching
    await this.syncTotalScoreToTrello(notionEntries, customFieldMap, trelloCardMap);
  }

  /**
   * Creates a new Trello card from a Notion entry
   * @param {Object} notionEntry - Notion database entry
   * @param {Object} listNameToIdMap - Map of list name to ID
   */
  async createTrelloCardFromNotion(notionEntry, listNameToIdMap) {
    const title = this.notionService.extractTitleValue(notionEntry.properties['Priority Name']);
    const department = this.notionService.extractSelectValue(notionEntry.properties.Department);
    const listId = listNameToIdMap[department] || Object.values(listNameToIdMap)[0]; // Default to first list

    const cardData = {
      name: title || 'Untitled',
      idList: listId
    };

    const newCard = await this.trelloService.createCard(cardData);
    
    // Update the Notion entry with the new Trello ID
    await this.notionService.updateEntry(notionEntry.id, {
      'Trello ID': {
        rich_text: [
          {
            text: {
              content: newCard.id
            }
          }
        ]
      }
    });

    // Set initial Notion Link in the new Trello card if the field exists
    const customFields = await this.trelloService.getCustomFields();
    const customFieldMap = this.createCustomFieldMap(customFields);
    
    if (customFieldMap['Notion Link']) {
      const notionPageUrl = this.notionService.generateNotionPageUrl(notionEntry.id);
      await this.trelloService.updateTextCustomField(
        newCard.id, 
        customFieldMap['Notion Link'], 
        notionPageUrl
      );
      logger.info(`Set Notion Link for new Trello card "${title}": ${notionPageUrl}`);
    }

    logger.info(`Created new Trello card for Notion entry: ${title}`);
  }

  /**
   * Updates a Trello card with data from Notion
   * @param {Object} notionEntry - Notion database entry
   * @param {Object} trelloCard - Trello card
   * @param {Object} listNameToIdMap - Map of list name to ID
   * @param {Object} customFieldMap - Map of custom field name to ID
   */
  async updateTrelloFromNotion(notionEntry, trelloCard, listNameToIdMap, customFieldMap) {
    const { update, customFields } = mapNotionToTrello(notionEntry);
    let hasUpdates = false;

    // Update basic card properties
    if (update.name && hasChanged(update.name, trelloCard.name)) {
      await this.trelloService.updateCard(trelloCard.id, { name: update.name });
      hasUpdates = true;
    }

    // Update list/department
    const department = this.notionService.extractSelectValue(notionEntry.properties.Department);
    const targetListId = listNameToIdMap[department];
    if (targetListId && hasChanged(targetListId, trelloCard.idList)) {
      await this.trelloService.moveCard(trelloCard.id, targetListId);
      hasUpdates = true;
    }

    // Update custom fields (two-way sync)
    for (const [fieldName, value] of Object.entries(customFields)) {
      const fieldId = customFieldMap[fieldName];
      if (fieldId && value !== null && value !== undefined) {
        // Handle different field types
        if (fieldName === 'synced') {
          // Handle checkbox field
          await this.trelloService.updateCheckboxCustomField(trelloCard.id, fieldId, value);
        } else if (typeof value === 'boolean') {
          // Handle other checkbox fields
          await this.trelloService.updateCheckboxCustomField(trelloCard.id, fieldId, value);
        } else if (typeof value === 'string') {
          // Handle text fields
          await this.trelloService.updateTextCustomField(trelloCard.id, fieldId, value);
        } else {
          // Handle number fields
          await this.trelloService.updateCustomField(trelloCard.id, fieldId, value);
        }
        hasUpdates = true;
      }
    }

    // One-way sync: Total Score from Notion to Trello (using formula-aware method)
    const totalScore = this.notionService.extractNumericValue(notionEntry.properties['Total Score']);
    if (totalScore !== null && totalScore !== undefined && customFieldMap['Total Score']) {
      await this.trelloService.updateCustomField(
        trelloCard.id, 
        customFieldMap['Total Score'], 
        totalScore
      );
      hasUpdates = true;
    }

    // One-way sync: Notion Link from Notion to Trello
    if (customFieldMap['Notion Link']) {
      const notionPageUrl = this.notionService.generateNotionPageUrl(notionEntry.id);
      
      // Get current Notion Link value from Trello
      const currentNotionLink = this.getTrelloTextCustomFieldValue(trelloCard, customFieldMap['Notion Link']);
      
      // Only update if values are different
      if (hasChanged(currentNotionLink, notionPageUrl)) {
        await this.trelloService.updateTextCustomField(
          trelloCard.id, 
          customFieldMap['Notion Link'], 
          notionPageUrl
        );
        hasUpdates = true;
        logger.info(`Updated Notion Link for Trello card "${trelloCard.name}": ${notionPageUrl}`);
      }
    }

    if (hasUpdates) {
      this.syncStats.notionToTrello.updated++;
      logger.info(`Updated Trello card from Notion: ${trelloCard.name}`);
    }
  }

  /**
   * Determines if a Notion entry should be updated based on Trello data
   * @param {Object} notionEntry - Existing Notion entry
   * @param {Object} trelloCard - Trello card data
   * @param {Object} customFields - Trello custom field values
   * @param {string} listName - Trello list name
   * @returns {boolean} True if update is needed
   */
  shouldUpdateNotionEntry(notionEntry, trelloCard, customFields, listName) {
    // Check title - Changed from 'Title' to 'Priority Name'
    const currentTitle = this.notionService.extractTitleValue(notionEntry.properties['Priority Name']);
    if (hasChanged(currentTitle, trelloCard.name)) {
      return true;
    }

    // Check department
    const currentDepartment = this.notionService.extractSelectValue(notionEntry.properties.Department);
    if (hasChanged(currentDepartment, listName)) {
      return true;
    }

    // Check custom fields
    const fieldsToCheck = ['Reach', 'Confidence', 'Effort', 'Impact'];
    for (const fieldName of fieldsToCheck) {
      const currentValue = this.notionService.extractNumberValue(notionEntry.properties[fieldName]);
      const newValue = customFields[fieldName];
      if (hasChanged(currentValue, newValue)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Creates helper lookup maps
   */
  createListMap(trelloLists) {
    const map = {};
    trelloLists.forEach(list => {
      map[list.id] = list.name;  // Map ID -> name for Trello→Notion
    });
    return map;
  }

  createListMapReverse(trelloLists) {
    const map = {};
    trelloLists.forEach(list => {
      map[list.name] = list.id;  // Map name -> ID for Notion→Trello
    });
    return map;
  }

  /**
   * Creates a map of custom field names to IDs for Trello
   * @param {Array} trelloCustomFields - Array of Trello custom field definitions
   * @returns {Object} Map of field name to field ID
   */
  createCustomFieldMap(trelloCustomFields) {
    const map = {};
    trelloCustomFields.forEach(field => {
      map[field.name] = field.id;
    });
    return map;
  }

  /**
   * Creates a lookup map of Notion entries by their Trello ID
   * @param {Array} notionEntries - Array of Notion database entries
   * @returns {Object} Map of Trello ID to Notion entry
   */
  createNotionLookupMap(notionEntries) {
    const map = {};
    notionEntries.forEach(entry => {
      const trelloId = this.notionService.extractRichTextValue(entry.properties['Trello ID']);
      if (trelloId) {
        map[trelloId] = entry;
      }
    });
    return map;
  }

  /**
   * Syncs Total Score formula values from Notion to Trello custom fields
   * @param {Array} notionEntries - Notion database entries
   * @param {Object} customFieldMap - Map of custom field name to ID
   * @param {Object} trelloCardMap - Pre-built map of Trello cards by ID
   */
  async syncTotalScoreToTrello(notionEntries, customFieldMap, trelloCardMap = null) {
    logger.info('Syncing Total Score from Notion → Trello');

    const totalScoreFieldId = customFieldMap['Total Score'];
    if (!totalScoreFieldId) {
      logger.warn('Total Score custom field not found in Trello - skipping Total Score sync');
      return;
    }

    // Use provided trelloCardMap or fetch fresh data
    let cardMap = trelloCardMap;
    if (!cardMap) {
      const trelloCards = await this.trelloService.getCards();
      cardMap = {};
      trelloCards.forEach(card => {
        cardMap[card.id] = card;
      });
    }

    let totalScoreUpdates = 0;

    for (const entry of notionEntries) {
      try {
        const trelloId = this.notionService.extractRichTextValue(entry.properties['Trello ID']);
        
        if (!trelloId) {
          continue; // Skip entries without Trello ID
        }

        const trelloCard = cardMap[trelloId];
        if (!trelloCard) {
          logger.warn(`Trello card ${trelloId} not found for Notion entry ${entry.id}`);
          continue;
        }

        // Get the Total Score from Notion (formula result) - using formula-aware method
        const notionTotalScore = this.notionService.extractNumericValue(entry.properties['Total Score']);
        
        if (notionTotalScore === null || notionTotalScore === undefined) {
          logger.debug(`No Total Score found for Notion entry ${entry.id}`);
          continue;
        }

        // Get current Total Score from Trello
        const currentTrelloTotalScore = this.getTrelloCustomFieldValue(trelloCard, totalScoreFieldId);

        // Only update if values are different
        if (hasChanged(currentTrelloTotalScore, notionTotalScore)) {
          await this.trelloService.updateCustomField(
            trelloCard.id, 
            totalScoreFieldId, 
            notionTotalScore
          );
          
          totalScoreUpdates++;
          logger.info(`Updated Total Score for Trello card "${trelloCard.name}": ${currentTrelloTotalScore} → ${notionTotalScore}`);
        }

      } catch (error) {
        logger.error(`Error syncing Total Score for Notion entry ${entry.id}`, error);
        this.syncStats.errors++;
      }
    }

    logger.info(`Total Score sync complete: ${totalScoreUpdates} cards updated`);
  }

  /**
   * Gets a custom field value from a Trello card
   * @param {Object} trelloCard - Trello card with customFieldItems
   * @param {string} customFieldId - Custom field ID to look for
   * @returns {number|null} Custom field value or null if not found
   */
  getTrelloCustomFieldValue(trelloCard, customFieldId) {
    if (!trelloCard.customFieldItems) {
      return null;
    }

    const fieldItem = trelloCard.customFieldItems.find(item => item.idCustomField === customFieldId);
    return fieldItem?.value?.number || null;
  }

  /**
   * Gets a text custom field value from a Trello card
   * @param {Object} trelloCard - Trello card with customFieldItems
   * @param {string} customFieldId - Custom field ID to look for
   * @returns {string|null} Custom field text value or null if not found
   */
  getTrelloTextCustomFieldValue(trelloCard, customFieldId) {
    if (!trelloCard.customFieldItems) {
      return null;
    }

    const fieldItem = trelloCard.customFieldItems.find(item => item.idCustomField === customFieldId);
    return fieldItem?.value?.text || null;
  }

  /**
   * Gets a checkbox custom field value from a Trello card
   * @param {Object} trelloCard - Trello card with customFieldItems
   * @param {string} customFieldId - Custom field ID to look for
   * @returns {boolean|null} Custom field checkbox value or null if not found
   */
  getTrelloCheckboxCustomFieldValue(trelloCard, customFieldId) {
    if (!trelloCard.customFieldItems) {
      return null;
    }

    const fieldItem = trelloCard.customFieldItems.find(item => item.idCustomField === customFieldId);
    return fieldItem?.value?.checked === 'true'; // Convert string to boolean
  }

  /**
   * Handles deletion sync based on "synced" checkbox property
   * @param {Array} trelloCards - Array of Trello cards
   * @param {Array} notionEntries - Array of Notion entries
   * @param {Object} customFieldMap - Map of custom field names to IDs
   */
  async handleDeletionSync(trelloCards, notionEntries, customFieldMap) {
    logger.info('Checking for deletion sync based on "synced" checkbox...');

    const syncedFieldId = customFieldMap['synced'];
    if (!syncedFieldId) {
      logger.warn('Synced checkbox field not found in Trello - skipping deletion sync');
      return;
    }

    // Create lookup maps
    const trelloCardMap = {};
    trelloCards.forEach(card => {
      trelloCardMap[card.id] = card;
    });

    const notionEntryMap = {};
    notionEntries.forEach(entry => {
      const trelloId = this.notionService.extractRichTextValue(entry.properties['Trello ID']);
      if (trelloId) {
        notionEntryMap[trelloId] = entry;
      }
    });

    // Check for Notion entries marked for deletion (synced=true but Trello card doesn't exist)
    for (const entry of notionEntries) {
      try {
        const isSynced = this.notionService.extractCheckboxValue(entry.properties.synced);
        const trelloId = this.notionService.extractRichTextValue(entry.properties['Trello ID']);

        if (isSynced && trelloId && !trelloCardMap[trelloId]) {
          logger.info(`Deleting Notion entry (synced=true but Trello card ${trelloId} not found): ${this.notionService.extractTitleValue(entry.properties['Priority Name'])}`);
          await this.notionService.deletePage(entry.id);
          this.syncStats.notionToTrello.updated++; // Count as update for stats
        }
      } catch (error) {
        logger.error(`Error checking Notion entry ${entry.id} for deletion`, error);
        this.syncStats.errors++;
      }
    }

    // Check for Trello cards marked for deletion (synced=true but Notion entry doesn't exist)
    for (const card of trelloCards) {
      try {
        const isSynced = this.getTrelloCheckboxCustomFieldValue(card, syncedFieldId);
        
        if (isSynced && !notionEntryMap[card.id]) {
          logger.info(`Deleting Trello card (synced=true but Notion entry not found): ${card.name}`);
          await this.trelloService.deleteCard(card.id);
          this.syncStats.trelloToNotion.updated++; // Count as update for stats
        }
      } catch (error) {
        logger.error(`Error checking Trello card ${card.id} for deletion`, error);
        this.syncStats.errors++;
      }
    }

    logger.info('Deletion sync check completed');
  }

  /**
   * Resets sync statistics
   */
  resetStats() {
    this.syncStats = {
      trelloToNotion: { created: 0, updated: 0 },
      notionToTrello: { created: 0, updated: 0 },
      errors: 0
    };
  }
}

export default SyncEngine;
