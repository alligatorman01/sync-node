#!/usr/bin/env node

/**
 * Complete authentication fix helper
 */

import dotenv from 'dotenv';

dotenv.config();

function main() {
  console.log('🔧 Trello Authentication Fix Helper');
  console.log('===================================\n');

  const apiKey = process.env.TRELLO_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No TRELLO_API_KEY found in .env file');
    console.log('\n📝 Step 1: Get your API key');
    console.log('   1. Visit: https://trello.com/app-key');
    console.log('   2. Copy your API key');
    console.log('   3. Add to .env file: TRELLO_API_KEY=your_key_here');
    return;
  }

  console.log('✅ API Key found:', apiKey.substring(0, 8) + '...');
  console.log('');

  console.log('🔑 Step 1: Generate a new token');
  console.log('──────────────────────────────────');
  
  const authUrl = `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=SyncNode&key=${apiKey}`;
  
  console.log('Copy this URL and paste it in your browser:');
  console.log('');
  console.log(authUrl);
  console.log('');
  
  console.log('✅ Step 2: What to do:');
  console.log('• Make sure you\'re logged into Trello');
  console.log('• Click "Allow" to authorize the application');
  console.log('• Copy the ENTIRE token that appears (it should be very long!)');
  console.log('• Update your .env file with: TRELLO_TOKEN=your_complete_token');
  console.log('');
  
  console.log('🔍 Step 3: Verify the token');
  console.log('• The token should be around 64+ characters long');
  console.log('• It should start with "ATTA"');
  console.log('• Make sure you copied the complete token');
  console.log('');
  
  console.log('🧪 Step 4: Test the setup');
  console.log('• Run: node test-trello-auth.js');
  console.log('• If that works, run: npm run find-boards');
  console.log('• Update TRELLO_BOARD_ID with the correct board ID');
  console.log('• Finally run: npm start');
  console.log('');
  
  console.log('⚠️  Common Issues:');
  console.log('• Token got truncated when copying - make sure to get the full token');
  console.log('• Board is private and token doesn\'t have access');
  console.log('• API key doesn\'t match your Trello account');
}

main();