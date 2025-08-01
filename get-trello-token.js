#!/usr/bin/env node

/**
 * Utility to generate a Trello authorization URL and get a new token
 * with proper read/write permissions for board access
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates the Trello authorization URL with full permissions
 * @returns {string} Authorization URL
 */
function generateAuthUrl() {
  const apiKey = process.env.TRELLO_API_KEY;
  
  if (!apiKey) {
    console.error('❌ TRELLO_API_KEY not found in .env file');
    process.exit(1);
  }

  const authUrl = new URL('https://trello.com/1/authorize');
  authUrl.searchParams.set('expiration', 'never');
  authUrl.searchParams.set('scope', 'read,write');
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('name', 'SyncNode - Trello to Notion Bridge');
  authUrl.searchParams.set('key', apiKey);

  return authUrl.toString();
}

/**
 * Main function to guide user through token generation
 */
async function main() {
  console.log('🔐 Trello Token Authorization Helper');
  console.log('===================================\n');
  
  console.log('📋 Current API Key:', process.env.TRELLO_API_KEY?.substring(0, 8) + '...');
  console.log('');
  
  const authUrl = generateAuthUrl();
  
  console.log('🌐 Step 1: Copy and paste this URL into your browser:');
  console.log('───────────────────────────────────────────────────');
  console.log(authUrl);
  console.log('');
  
  console.log('✅ Step 2: What you should see:');
  console.log('• A Trello authorization page');
  console.log('• Application name: "SyncNode - Trello to Notion Bridge"');
  console.log('• Permissions requested: Read and Write access');
  console.log('• Expiration: Never');
  console.log('');
  
  console.log('🔑 Step 3: After clicking "Allow":');
  console.log('• You\'ll see a token (long string starting with "ATTA")');
  console.log('• Copy this entire token');
  console.log('• Replace TRELLO_TOKEN in your .env file');
  console.log('');
  
  console.log('📝 Step 4: Test your new token:');
  console.log('• Run: npm run find-boards');
  console.log('• This will show all boards you have access to');
  console.log('• Find your target board and update TRELLO_BOARD_ID');
  console.log('');
  
  console.log('⚠️  Troubleshooting:');
  console.log('• Make sure you\'re logged into the correct Trello account');
  console.log('• If you see "unauthorized" errors, the token may be invalid');
  console.log('• Board owners need to grant you access to private boards');
  console.log('');
  
  console.log('🚀 Once complete, run: npm start');
}

main().catch(console.error);