#!/usr/bin/env node

/**
 * Quick test script to verify Trello authentication
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testTrelloAuth() {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  console.log('🔐 Testing Trello Authentication');
  console.log('================================');
  console.log(`API Key: ${apiKey?.substring(0, 8)}...`);
  console.log(`Token: ${token?.substring(0, 20)}...`);
  console.log(`Token Length: ${token?.length} characters`);
  console.log('');

  if (!apiKey || !token) {
    console.error('❌ Missing API key or token');
    return;
  }

  try {
    // Test basic authentication by getting user info
    console.log('🧪 Testing basic authentication...');
    const userResponse = await axios.get('https://api.trello.com/1/members/me', {
      params: { key: apiKey, token: token }
    });
    
    console.log(`✅ Authentication successful!`);
    console.log(`   User: ${userResponse.data.fullName} (${userResponse.data.username})`);
    console.log('');

    // Test board access
    console.log('🧪 Testing board access...');
    const boardId = process.env.TRELLO_BOARD_ID;
    console.log(`   Board ID: ${boardId}`);
    
    const boardResponse = await axios.get(`https://api.trello.com/1/boards/${boardId}`, {
      params: { key: apiKey, token: token }
    });
    
    console.log(`✅ Board access successful!`);
    console.log(`   Board: ${boardResponse.data.name}`);
    console.log(`   URL: ${boardResponse.data.url}`);
    console.log('');

    // Test cards access
    console.log('🧪 Testing cards access...');
    const cardsResponse = await axios.get(`https://api.trello.com/1/boards/${boardId}/cards`, {
      params: { 
        key: apiKey, 
        token: token,
        customFieldItems: 'true',
        list: 'true'
      }
    });
    
    console.log(`✅ Cards access successful!`);
    console.log(`   Found ${cardsResponse.data.length} cards`);
    console.log('');
    console.log('🎉 All tests passed! Your Trello setup is working correctly.');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n🔍 Diagnosis: Authentication failed');
        console.error('   Possible causes:');
        console.error('   1. Token is invalid, expired, or incomplete');
        console.error('   2. API key is incorrect');
        console.error('   3. Token doesn\'t have proper permissions');
        console.error('\n💡 Solutions:');
        console.error('   1. Generate a new token: npm run get-token');
        console.error('   2. Verify API key from https://trello.com/app-key');
        console.error('   3. Ensure token has read/write scope');
      } else if (error.response.status === 404) {
        console.error('\n🔍 Diagnosis: Board not found or no access');
        console.error('   Possible causes:');
        console.error('   1. Board ID is incorrect');
        console.error('   2. Token doesn\'t have access to this board');
        console.error('\n💡 Solutions:');
        console.error('   1. Find correct board ID: npm run find-boards');
        console.error('   2. Ensure you have access to the board');
      }
    }
  }
}

testTrelloAuth();