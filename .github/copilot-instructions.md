<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# SyncNode Project Instructions

This is a Node.js project that syncs data between Trello and Notion APIs.

## Project Context
- Use ES6 modules (import/export syntax)
- Follow async/await patterns for API calls
- Implement proper error handling with try/catch blocks
- Use consistent logging throughout the application
- Follow the single responsibility principle for services and utilities

## API Integration Guidelines
- Use the @notionhq/client library for Notion API interactions
- Use axios for Trello REST API calls
- Always handle rate limits and API errors gracefully
- Implement retry logic for failed API requests

## Data Mapping Rules
- Maintain data type consistency between platforms
- Handle null/undefined values appropriately
- Use unique identifiers for matching entries between platforms
- Preserve data integrity during sync operations

## Code Style
- Use descriptive variable and function names
- Add JSDoc comments for complex functions
- Keep functions focused and modular
- Use environment variables for all configuration
