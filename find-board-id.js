#!/usr/bin/env node

/**
 * Utility script to find Trello board IDs
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function findBoardId() {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!apiKey || !token) {
    console.error('❌ Missing TRELLO_API_KEY or TRELLO_TOKEN in .env file');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching your Trello boards...\n');
    
    const response = await axios.get('https://api.trello.com/1/members/me/boards', {
      params: {
        key: apiKey,
        token: token,
        filter: 'open' // Only show open boards
      }
    });

    const boards = response.data;

    if (boards.length === 0) {
      console.log('No boards found. Make sure your API credentials are correct.');
      return;
    }

    console.log('📋 Your Trello Boards:');
    console.log('=====================');
    
    boards.forEach((board, index) => {
      console.log(`${index + 1}. ${board.name}`);
      console.log(`   ID: ${board.id}`);
      console.log(`   URL: ${board.url}`);
      console.log(`   Closed: ${board.closed}`);
      console.log('');
    });

    console.log('💡 Copy the ID of the board you want to sync and update your .env file:');
    console.log('   TRELLO_BOARD_ID=your_board_id_here');

  } catch (error) {
    console.error('❌ Error fetching boards:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('\n🔐 Authentication failed. Please check:');
      console.error('   - Your TRELLO_API_KEY is correct');
      console.error('   - Your TRELLO_TOKEN is valid and not expired');
      console.error('   - The token has the necessary permissions');
    }
  }
}

findBoardId();