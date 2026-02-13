#!/bin/bash

# setup_config.sh
# Automates the configuration for deployment

set -e

echo "🚀 Starting Configuration Setup..."

# 1. Ask for Domain
read -p "Enter your domain name (e.g., my-app.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo "❌ Domain name is required."
    exit 1
fi

echo "✅ Domain: $DOMAIN_NAME"

# 2. Generate Keys
echo "🔑 Generating LiveKit API Keys..."
LK_API_KEY=$(openssl rand -base64 12)
LK_API_SECRET=$(openssl rand -base64 24)

echo "   Key: $LK_API_KEY"
echo "   Secret: (Generated)"

# 3. Update livekit.yaml
echo "📝 Updating livekit.yaml..."
# Create a temporary file to avoid messing up if sed fails
cat > livekit.yaml <<EOL
# LiveKit Server Configuration
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50060
  use_external_ip: true
keys:
  $LK_API_KEY: $LK_API_SECRET
logging:
  json: false
  level: info
room:
  auto_create: true
  max_participants: 200
EOL

# 4. Create backend/.env.production
echo "📝 Creating backend/.env.production..."
cat > backend/.env.production <<EOL
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://$DOMAIN_NAME

# LiveKit Config
LIVEKIT_API_URL=https://$DOMAIN_NAME
LIVEKIT_API_KEY=$LK_API_KEY
LIVEKIT_API_SECRET=$LK_API_SECRET

# Supabase (Placeholders - You must update these!)
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_KEY

# Redis
REDIS_URL=redis://redis:6379
EOL

echo "⚠️  IMPORTANT: Please manually update 'backend/.env.production' with your real Supabase credentials!"

# 5. Update Caddyfile
echo "📝 Updating Caddyfile..."
cat > Caddyfile <<EOL
{
    email admin@$DOMAIN_NAME
}

$DOMAIN_NAME {
    # Serve Frontend
    root * /srv
    encode gzip
    file_server

    # API Proxy
    handle /api/* {
        reverse_proxy backend:3001
    }

    # Socket.io Proxy
    handle /socket.io/* {
        reverse_proxy backend:3001
    }

    # SPA Fallback
    try_files {path} /index.html
}

livekit.$DOMAIN_NAME {
    reverse_proxy livekit:7880
}
EOL

# 6. Build Frontend
echo "📦 Building Frontend..."
cd frontend
# Create temp .env for build
cat > .env <<EOL
VITE_BACKEND_URL=https://$DOMAIN_NAME/api
VITE_LIVEKIT_URL=wss://livekit.$DOMAIN_NAME
VITE_SUPABASE_URL=SEE_BACKEND_ENV
VITE_SUPABASE_ANON_KEY=SEE_BACKEND_ENV
EOL

echo "   Running npm install..."
npm install > /dev/null

echo "   Running npm build..."
npm run build

# Restore clean state if needed, or leave it.
cd ..

echo "✅ Configuration Complete!"
echo "👉 Next step: Run ./deploy_gcp.sh"
