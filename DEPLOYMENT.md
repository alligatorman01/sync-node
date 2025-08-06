# Railway Deployment Instructions

## Quick Deploy
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/sync-node)

## Manual Deployment Steps

### 1. Create Railway Account
- Sign up at [railway.app](https://railway.app)
- Connect your GitHub account

### 2. Deploy from GitHub
1. Click "New Project" in Railway dashboard
2. Select "Deploy from GitHub repo"
3. Choose your sync-node repository
4. Railway will automatically detect this as a Node.js project

### 3. Configure Environment Variables
In Railway dashboard, go to your project → Variables tab and add:

```bash
# Required Variables
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_TOKEN=your_trello_token_here
TRELLO_BOARD_ID=your_trello_board_id_here
NOTION_API_KEY=your_notion_integration_token_here
NOTION_DATABASE_ID=your_notion_database_id_here

# Optional Production Settings
NODE_ENV=production
LOG_LEVEL=info
POLL_INTERVAL=120000
```

### 4. Production Settings
- **POLL_INTERVAL**: Set to 120000 (2 minutes) for production to balance responsiveness with API rate limits
- **LOG_LEVEL**: Use 'info' for production (reduces log volume)
- **NODE_ENV**: Set to 'production' for optimized performance

### 5. Deploy
- Railway will automatically build and deploy
- The service will start with `npm run start:production`
- Monitor logs in Railway dashboard

## Monitoring
- View logs: Railway Dashboard → Your Project → Deployments → View Logs
- Check metrics: Railway Dashboard → Your Project → Metrics
- Set up alerts: Railway Dashboard → Your Project → Settings → Notifications

## Cost Optimization
- Free tier: $5/month usage credit
- Expected usage: ~$2-3/month for typical sync workloads
- Monitor usage in Railway dashboard

## Troubleshooting
1. **Build fails**: Check package.json scripts and dependencies
2. **Environment variables**: Verify all required vars are set in Railway
3. **API connection issues**: Test locally first with `npm run setup`
4. **High memory usage**: Increase polling interval (POLL_INTERVAL)

## Local Development
```bash
# Install dependencies
npm install

# Test configuration
npm run setup

# Run locally
npm run sync:continuous
```
