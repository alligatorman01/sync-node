/**
 * Data mapping utilities for transforming data between Trello and Notion formats
 */

/**
 * Maps Trello card data to Notion database entry format
 * @param {Object} trelloCard - Trello card object
 * @param {Object} customFields - Trello custom fields data
 * @param {string} listName - Name of the Trello list (column)
 * @returns {Object} Notion database entry properties
 */
export function mapTrelloToNotion(trelloCard, customFields, listName) {
  const properties = {
    'Priority Name': {  // Changed from 'Title' to 'Priority Name'
      title: [
        {
          text: {
            content: trelloCard.name || ''
          }
        }
      ]
    },
    Department: {
      select: {
        name: listName || 'Unknown'
      }
    },
    'Trello ID': {
      rich_text: [
        {
          text: {
            content: trelloCard.id
          }
        }
      ]
    }
  };

  // Map custom fields - ensure numbers are actual numbers, not strings
  if (customFields.Reach !== undefined && customFields.Reach !== null) {
    properties.Reach = { number: Number(customFields.Reach) };
  }
  if (customFields.Confidence !== undefined && customFields.Confidence !== null) {
    properties.Confidence = { number: Number(customFields.Confidence) };
  }
  if (customFields.Effort !== undefined && customFields.Effort !== null) {
    properties.Effort = { number: Number(customFields.Effort) };
  }
  if (customFields.Impact !== undefined && customFields.Impact !== null) {
    properties.Impact = { number: Number(customFields.Impact) };
  }

  // Map synced checkbox - always set to true after sync
  properties.synced = { checkbox: true };

  return properties;
}

/**
 * Maps Notion database entry to Trello card update format
 * @param {Object} notionEntry - Notion database entry
 * @returns {Object} Trello card update data
 */
export function mapNotionToTrello(notionEntry) {
  const update = {};
  const customFields = {};

  // Map title - Changed from 'Title' to 'Priority Name'
  if (notionEntry.properties['Priority Name']?.title?.[0]?.text?.content) {
    update.name = notionEntry.properties['Priority Name'].title[0].text.content;
  }

  // Map custom fields
  if (notionEntry.properties.Reach?.number !== null && notionEntry.properties.Reach?.number !== undefined) {
    customFields.Reach = notionEntry.properties.Reach.number;
  }
  if (notionEntry.properties.Confidence?.number !== null && notionEntry.properties.Confidence?.number !== undefined) {
    customFields.Confidence = notionEntry.properties.Confidence.number;
  }
  if (notionEntry.properties.Effort?.number !== null && notionEntry.properties.Effort?.number !== undefined) {
    customFields.Effort = notionEntry.properties.Effort.number;
  }
  if (notionEntry.properties.Impact?.number !== null && notionEntry.properties.Impact?.number !== undefined) {
    customFields.Impact = notionEntry.properties.Impact.number;
  }

  // Map synced checkbox - always set to true after sync
  customFields.synced = true;

  return { update, customFields };
}

/**
 * Extracts custom field values from Trello card
 * @param {Object} trelloCard - Trello card with customFieldItems
 * @param {Array} boardCustomFields - Board's custom field definitions
 * @returns {Object} Custom field values mapped by name
 */
export function extractTrelloCustomFields(trelloCard, boardCustomFields) {
  const customFields = {};
  
  if (!trelloCard.customFieldItems || !boardCustomFields) {
    return customFields;
  }

  // Create a map of custom field IDs to names
  const fieldMap = {};
  boardCustomFields.forEach(field => {
    fieldMap[field.id] = field.name;
  });

  // Extract values
  trelloCard.customFieldItems.forEach(item => {
    const fieldName = fieldMap[item.idCustomField];
    if (fieldName) {
      // Handle different custom field types
      if (item.value?.number !== undefined) {
        customFields[fieldName] = item.value.number;
      } else if (item.value?.text !== undefined) {
        customFields[fieldName] = item.value.text;
      } else if (item.value?.checked !== undefined) {
        // Convert string to boolean for checkbox fields
        customFields[fieldName] = item.value.checked === 'true';
      } else {
        customFields[fieldName] = 0; // Default for number fields
      }
    }
  });

  return customFields;
}

/**
 * Determines if two values are different for sync purposes
 * @param {any} value1 - First value
 * @param {any} value2 - Second value
 * @returns {boolean} True if values are different
 */
export function hasChanged(value1, value2) {
  // Handle null/undefined cases
  if (value1 == null && value2 == null) return false;
  if (value1 == null || value2 == null) return true;
  
  // Handle numbers
  if (typeof value1 === 'number' && typeof value2 === 'number') {
    return Math.abs(value1 - value2) > 0.001; // Handle floating point precision
  }
  
  // Handle strings
  return String(value1).trim() !== String(value2).trim();
}
