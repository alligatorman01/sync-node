#!/usr/bin/env node

import TrelloService from './src/services/trello.js';
import { logger } from './src/utils/logger.js';

async function debugTrelloAPI() {
  const trelloService = new TrelloService();
  
  console.log('🔍 Debugging Trello API Response');
  console.log('=================================');
  console.log(`Board ID: ${trelloService.boardId}`);
  console.log('');

  try {
    // Get raw API response
    const response = await trelloService.makeRequest(`/boards/${trelloService.boardId}/cards`, {
      params: {
        customFieldItems: 'true',
        list: 'true',
        fields: 'all',
        filter: 'all' // This includes archived cards too
      }
    });

    console.log(`📊 Total cards returned: ${response.length}`);
    console.log('');

    // Group by name to see duplicates
    const cardsByName = {};
    response.forEach(card => {
      const name = card.name.trim();
      if (!cardsByName[name]) {
        cardsByName[name] = [];
      }
      cardsByName[name].push({
        id: card.id,
        name: card.name,
        listId: card.idList,
        closed: card.closed,
        dateLastActivity: card.dateLastActivity
      });
    });

    // Show duplicates with full details
    const duplicates = Object.entries(cardsByName).filter(([name, cards]) => cards.length > 1);
    
    console.log(`🔍 Cards with duplicate names: ${duplicates.length}`);
    console.log('');

    duplicates.forEach(([cardName, cards]) => {
      console.log(`"${cardName}" (${cards.length} cards):`);
      cards.forEach((card, index) => {
        console.log(`  ${index + 1}. ID: ${card.id}`);
        console.log(`     List: ${card.listId}`);
        console.log(`     Closed: ${card.closed}`);
        console.log(`     Last Activity: ${card.dateLastActivity}`);
        console.log('');
      });
    });

    // Check specifically for Strategic Ops
    const strategicOpsCards = response.filter(card => card.name.trim() === 'Strategic Ops');
    if (strategicOpsCards.length > 0) {
      console.log('🎯 Strategic Ops Cards Details:');
      strategicOpsCards.forEach((card, index) => {
        console.log(`  ${index + 1}. ID: ${card.id}`);
        console.log(`     List ID: ${card.idList}`);
        console.log(`     Closed: ${card.closed}`);
        console.log(`     Archived: ${card.closed}`);
        console.log(`     Date Created: ${card.dateLastActivity}`);
        console.log(`     Full card:`, JSON.stringify(card, null, 2));
        console.log('');
      });
    }

    // Let's also check what filter=open returns
    console.log('🔍 Checking with filter=open (non-archived only)...');
    const openCardsResponse = await trelloService.makeRequest(`/boards/${trelloService.boardId}/cards`, {
      params: {
        customFieldItems: 'true',
        list: 'true',
        filter: 'open' // Only open (non-archived) cards
      }
    });

    console.log(`📊 Open cards only: ${openCardsResponse.length}`);
    
    const openStrategicOps = openCardsResponse.filter(card => card.name.trim() === 'Strategic Ops');
    console.log(`🎯 Open Strategic Ops cards: ${openStrategicOps.length}`);
    
    if (openStrategicOps.length > 1) {
      console.log('❌ PROBLEM: Multiple open Strategic Ops cards found!');
      openStrategicOps.forEach((card, index) => {
        console.log(`  ${index + 1}. ID: ${card.id} | List: ${card.idList}`);
      });
    } else if (openStrategicOps.length === 1) {
      console.log('✅ Only one open Strategic Ops card found (as expected)');
      console.log(`   ID: ${openStrategicOps[0].id} | List: ${openStrategicOps[0].idList}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugTrelloAPI();