# SyncNode – Trello ↔ Notion Bridge

A Node.js script that syncs properties between Trello cards and Notion database entries. This script runs as a scheduled task to keep project prioritization data consistent between the two platforms.

## Features

- **Two-Way Sync**:
  - Trello card Title ⟷ Notion Title
  - Trello custom fields (Reach, Confidence, Effort, Impact) ⟷ Notion number properties
  - Trello list name ⟷ Notion select property "Department"

- **One-Way Sync** (Notion → Trello):
  - Notion formula property "Total Score" → Trello custom field "Total Score"

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your API credentials:
   ```env
   TRELLO_API_KEY=your_trello_api_key
   TRELLO_TOKEN=your_trello_token
   TRELLO_BOARD_ID=your_trello_board_id
   NOTION_API_KEY=your_notion_api_key
   NOTION_DATABASE_ID=your_notion_database_id
   ```

## Configuration

### Trello Setup
1. Get your API key from: https://trello.com/app-key
2. Generate a token by visiting: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=SyncNode&key=YOUR_API_KEY
3. Find your board ID from the board URL or using the API

### Notion Setup
1. Create an integration at: https://www.notion.so/my-integrations
2. Get your integration token (starts with `secret_`)
3. Share your database with the integration
4. Get your database ID from the database URL

## Usage

Run the sync script:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Logging

All sync actions are logged to the console with timestamps for audit and debugging purposes.

## Project Structure

```
sync-node/
├── src/
│   ├── index.js          # Main entry point
│   ├── config/
│   │   └── config.js     # Configuration and environment variables
│   ├── services/
│   │   ├── trello.js     # Trello API service
│   │   └── notion.js     # Notion API service
│   ├── sync/
│   │   └── syncEngine.js # Core synchronization logic
│   └── utils/
│       ├── logger.js     # Logging utilities
│       └── mapping.js    # Data mapping utilities
├── .env                  # Environment variables (create this)
├── .env.example          # Environment variables example
├── package.json
└── README.md
```
