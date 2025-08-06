# Health check endpoint for Railway
# This helps Railway determine if the service is running properly

curl_version=$(curl --version 2>/dev/null | head -n1 || echo "curl not available")
node_version=$(node --version 2>/dev/null || echo "node not available") 
npm_version=$(npm --version 2>/dev/null || echo "npm not available")

echo "=== Health Check ==="
echo "Node.js: $node_version"
echo "NPM: $npm_version"
echo "Time: $(date)"
echo "Environment: ${NODE_ENV:-development}"
echo "===================="
