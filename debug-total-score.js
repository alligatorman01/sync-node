#!/usr/bin/env node

import TrelloService from './src/services/trello.js';
import NotionService from './src/services/notion.js';
import { logger } from './src/utils/logger.js';

async function debugTotalScore() {
  console.log('🔍 Debugging Total Score Sync');
  console.log('=============================');
  
  try {
    const trelloService = new TrelloService();
    const notionService = new NotionService();

    // 1. Check Trello custom fields
    console.log('\n📋 Trello Custom Fields:');
    const customFields = await trelloService.getCustomFields();
    customFields.forEach(field => {
      console.log(`  - "${field.name}" (ID: ${field.id})`);
    });

    const totalScoreField = customFields.find(field => field.name === 'Total Score');
    if (!totalScoreField) {
      console.log('❌ "Total Score" custom field NOT found in Trello');
      console.log('\n💡 To fix this:');
      console.log('1. Go to your Trello board');
      console.log('2. Click "Show Menu" → Power-Ups → Custom Fields');
      console.log('3. Add a new Number field called "Total Score"');
      console.log('4. Run the sync again');
      return;
    } else {
      console.log('✅ "Total Score" custom field found in Trello');
    }

    // 2. Check Notion entries for Total Score values
    console.log('\n📊 Notion Total Score Values:');
    const notionEntries = await notionService.getEntries();
    let entriesWithTotalScore = 0;

    notionEntries.slice(0, 5).forEach(entry => {
      const title = notionService.extractTitleValue(entry.properties['Priority Name']);
      const totalScore = notionService.extractNumericValue(entry.properties['Total Score']); // Updated method
      const trelloId = notionService.extractRichTextValue(entry.properties['Trello ID']);
      
      // Also show the raw property structure for debugging
      console.log(`  - "${title}": Total Score = ${totalScore} | Trello ID = ${trelloId}`);
      console.log(`    Raw property:`, JSON.stringify(entry.properties['Total Score'], null, 2));
      
      if (totalScore !== null && totalScore !== undefined) {
        entriesWithTotalScore++;
      }
    });

    console.log(`\n📈 Summary: ${entriesWithTotalScore}/${notionEntries.length} Notion entries have Total Score values`);

    // 3. Check if Trello cards have Total Score values
    console.log('\n🎯 Trello Total Score Values (first 5 cards):');
    const trelloCards = await trelloService.getCards();
    
    trelloCards.slice(0, 5).forEach(card => {
      const totalScoreValue = card.customFieldItems?.find(
        item => item.idCustomField === totalScoreField.id
      )?.value?.number;
      
      console.log(`  - "${card.name}": Total Score = ${totalScoreValue || 'not set'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugTotalScore();