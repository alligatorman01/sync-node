#!/usr/bin/env node

/**
 * Setup script to help users configure their Trello and Notion integrations
 */

import { config } from './src/config/config.js';
import TrelloService from './src/services/trello.js';
import NotionService from './src/services/notion.js';
import { logger } from './src/utils/logger.js';

async function testTrelloConnection() {
  console.log('\n🔧 Testing Trello Connection...');
  try {
    const trelloService = new TrelloService();
    const cards = await trelloService.getCards();
    const lists = await trelloService.getLists();
    const customFields = await trelloService.getCustomFields();
    
    console.log(`✅ Trello connection successful!`);
    console.log(`   - Found ${cards.length} cards`);
    console.log(`   - Found ${lists.length} lists: ${lists.map(l => l.name).join(', ')}`);
    console.log(`   - Found ${customFields.length} custom fields: ${customFields.map(f => f.name).join(', ')}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Trello connection failed: ${error.message}`);
    return false;
  }
}

async function testNotionConnection() {
  console.log('\n🔧 Testing Notion Connection...');
  try {
    const notionService = new NotionService();
    const entries = await notionService.getEntries();
    const schema = await notionService.getDatabaseSchema();
    
    console.log(`✅ Notion connection successful!`);
    console.log(`   - Found ${entries.length} entries`);
    console.log(`   - Database properties: ${Object.keys(schema).join(', ')}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Notion connection failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 SyncNode Setup & Test Script');
  console.log('===============================');
  
  // Check environment variables
  console.log('\n📋 Checking Environment Variables...');
  const requiredVars = [
    'TRELLO_API_KEY',
    'TRELLO_TOKEN', 
    'TRELLO_BOARD_ID',
    'NOTION_API_KEY',
    'NOTION_DATABASE_ID'
  ];
  
  const missing = requiredVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.log('\nPlease create a .env file with the following variables:');
    missing.forEach(key => {
      console.log(`${key}=your_value_here`);
    });
    console.log('\nSee .env.example for more details.');
    process.exit(1);
  } else {
    console.log('✅ All environment variables are set');
  }
  
  // Test connections
  const trelloOk = await testTrelloConnection();
  const notionOk = await testNotionConnection();
  
  console.log('\n📊 Setup Summary');
  console.log('================');
  console.log(`Trello: ${trelloOk ? '✅ Ready' : '❌ Needs attention'}`);
  console.log(`Notion: ${notionOk ? '✅ Ready' : '❌ Needs attention'}`);
  
  if (trelloOk && notionOk) {
    console.log('\n🎉 All systems ready! You can now run:');
    console.log('   npm start           # Run sync once');
    console.log('   npm run dev         # Run with auto-restart');
  } else {
    console.log('\n⚠️  Please fix the connection issues above before running the sync.');
  }
}

main().catch(error => {
  console.error('Setup script failed:', error);
  process.exit(1);
});
