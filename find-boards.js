#!/usr/bin/env node

/**
 * Utility script to find Trello board IDs with enhanced error handling
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fetches and displays user's Trello boards
 */
async function findBoards() {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!apiKey || !token) {
    console.error('❌ Missing TRELLO_API_KEY or TRELLO_TOKEN in .env file');
    console.log('\n💡 Run: node get-trello-token.js to get a new token');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching your Trello boards...\n');
    
    const response = await axios.get('https://api.trello.com/1/members/me/boards', {
      params: {
        key: apiKey,
        token: token,
        filter: 'all', // Get both open and closed boards
        fields: 'id,name,url,closed,prefs'
      }
    });

    const boards = response.data;

    if (boards.length === 0) {
      console.log('📭 No boards found.');
      console.log('• Make sure you have access to at least one Trello board');
      console.log('• Check that your token has the correct permissions');
      return;
    }

    console.log(`📋 Found ${boards.length} board(s):`);
    console.log('═'.repeat(60));
    
    boards.forEach((board, index) => {
      const status = board.closed ? '🔒 CLOSED' : '✅ OPEN';
      const visibility = board.prefs?.permissionLevel || 'unknown';
      
      console.log(`${index + 1}. ${board.name} ${status}`);
      console.log(`   📍 ID: ${board.id}`);
      console.log(`   🔗 URL: ${board.url}`);
      console.log(`   👥 Visibility: ${visibility}`);
      console.log('');
    });

    console.log('💡 Usage:');
    console.log('• Copy the ID of your target board');
    console.log('• Update TRELLO_BOARD_ID in your .env file');
    console.log('• Run: npm start');

  } catch (error) {
    console.error('❌ Error fetching boards:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('\n🔐 Authentication failed:');
      console.error('• Your token may be invalid or expired');
      console.error('• Run: node get-trello-token.js to get a new token');
    } else if (error.response?.status === 429) {
      console.error('\n⏱️  Rate limit exceeded. Please wait and try again.');
    }
  }
}

findBoards();