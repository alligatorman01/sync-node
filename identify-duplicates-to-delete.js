#!/usr/bin/env node

import TrelloService from './src/services/trello.js';

async function identifyDuplicatesToDelete() {
  const trelloService = new TrelloService();
  
  console.log('🔍 Identifying Duplicate Cards to Delete');
  console.log('=========================================');
  
  try {
    // Get all open cards
    const cards = await trelloService.makeRequest(`/boards/${trelloService.boardId}/cards`, {
      params: {
        customFieldItems: 'true',
        list: 'true',
        filter: 'open'
      }
    });
    
    // Group by name
    const cardsByName = {};
    cards.forEach(card => {
      const name = card.name.trim();
      if (!cardsByName[name]) {
        cardsByName[name] = [];
      }
      cardsByName[name].push(card);
    });
    
    // Find duplicates and determine which to delete
    const duplicates = Object.entries(cardsByName).filter(([name, cards]) => cards.length > 1);
    const toDelete = [];
    
    duplicates.forEach(([cardName, cards]) => {
      // Sort by creation date (older first)
      cards.sort((a, b) => new Date(a.dateLastActivity) - new Date(b.dateLastActivity));
      
      const original = cards[0]; // Keep the oldest
      const copies = cards.slice(1); // Delete the rest
      
      console.log(`\n📋 "${cardName}":`);
      console.log(`  ✅ KEEP: ${original.id} (created ${original.dateLastActivity})`);
      
      copies.forEach(copy => {
        console.log(`  ❌ DELETE: ${copy.id} (created ${copy.dateLastActivity})`);
        toDelete.push({
          id: copy.id,
          name: copy.name,
          created: copy.dateLastActivity
        });
      });
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total duplicate sets: ${duplicates.length}`);
    console.log(`  Cards to delete: ${toDelete.length}`);
    console.log(`  Cards to keep: ${duplicates.length}`);
    
    console.log(`\n⚠️  MANUAL ACTION REQUIRED:`);
    console.log(`  1. Go to your Trello board`);
    console.log(`  2. Delete the cards marked "DELETE" above`);
    console.log(`  3. Most are in the "Content / Curriculum" list`);
    console.log(`  4. After cleanup, run your sync again`);
    
    // Show the most problematic cards
    const contentCurriculumDuplicates = toDelete.filter(card => 
      cards.find(c => c.id === card.id)?.idList === '686df2204803664e4331f70d'
    );
    
    console.log(`\n🎯 Quick Cleanup: ${contentCurriculumDuplicates.length} cards in "Content / Curriculum" to delete`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

identifyDuplicatesToDelete();