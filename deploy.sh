#!/bin/bash

# deploy.sh
# One-click deployment for Clubhouse Clone on GCP

set -e

APP_NAME="founderstribe-server"
REGION="us-central1"
ZONE="us-central1-a"

export CLOUDSDK_CORE_DISABLE_PROMPTS=1

echo "🚀 Starting Deployment..."

# 0. Check Login
echo "🔍 Checking GCP Authentication..."
gcloud auth print-access-token > /dev/null 2>&1 || { echo "❌ Not logged in. Run 'gcloud auth login' first."; exit 1; }

# 1. Provision IP (Need this for domain)
if ! gcloud compute addresses describe $APP_NAME-ip --region $REGION > /dev/null 2>&1; then
    echo "🌐 Creating Static IP..."
    gcloud compute addresses create $APP_NAME-ip --region $REGION
else
    echo "✅ Static IP exists."
fi

IP_ADDRESS=$(gcloud compute addresses describe $APP_NAME-ip --region $REGION --format='get(address)')
echo "📌 External IP: $IP_ADDRESS"

# 2. Determine Domain
echo ""
echo "--------------------------------------------------"
echo "Do you have a custom domain? (y/n)"
echo "If 'n', we will use a magic domain ($IP_ADDRESS.nip.io) for automatic SSL."
echo "--------------------------------------------------"
read -p "Use custom domain? (y/N): " USE_CUSTOM

if [[ "$USE_CUSTOM" =~ ^[Yy]$ ]]; then
    read -p "Enter your domain (e.g., myapp.com): " DOMAIN_NAME
    echo "⚠️  ACTION REQUIRED: Go to your DNS provider and point $DOMAIN_NAME to $IP_ADDRESS"
    echo "⚠️  ALSO point livekit.$DOMAIN_NAME to $IP_ADDRESS"
    read -p "Press Enter after you have updated your DNS..."
else
    DOMAIN_NAME="$IP_ADDRESS.nip.io"
    echo "✨ Using Magic Domain: $DOMAIN_NAME"
    echo "   (SSL will work automatically!)"
fi

# 3. Generate Keys & Config
echo "🔑 Generating Keys & Config..."
LK_API_KEY=$(openssl rand -base64 12)
LK_API_SECRET=$(openssl rand -base64 24)

# Read Supabase credentials from backend/.env
SUPABASE_URL=$(grep '^SUPABASE_URL=' backend/.env | cut -d'=' -f2-)
SUPABASE_SERVICE_KEY=$(grep '^SUPABASE_SERVICE_KEY=' backend/.env | cut -d'=' -f2-)
SUPABASE_JWT_SECRET=$(grep '^SUPABASE_JWT_SECRET=' backend/.env | cut -d'=' -f2-)
# Read anon key from frontend/.env.example
SUPABASE_ANON_KEY=$(grep '^VITE_SUPABASE_ANON_KEY=' frontend/.env.example | cut -d'=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Missing Supabase credentials in backend/.env"
    exit 1
fi

echo "   Supabase URL: $SUPABASE_URL"

# Update livekit.yaml
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

# Create backend/.env.production
cat > backend/.env.production <<EOL
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://$DOMAIN_NAME

# LiveKit Config
LIVEKIT_URL=http://livekit:7880
LIVEKIT_API_KEY=$LK_API_KEY
LIVEKIT_API_SECRET=$LK_API_SECRET

# Supabase
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET

# Redis
REDIS_URL=redis://redis:6379
EOL

# Update Caddyfile
cat > Caddyfile <<EOL
{
    email admin@$DOMAIN_NAME
}

$DOMAIN_NAME {
    root * /srv
    encode gzip
    file_server
    handle /api/* {
        reverse_proxy backend:3001
    }
    handle /socket.io/* {
        reverse_proxy backend:3001
    }
    try_files {path} /index.html
}

livekit.$DOMAIN_NAME {
    reverse_proxy livekit:7880
}
EOL

# 4. Build Frontend
echo "📦 Building Frontend..."
cd frontend
cat > .env <<EOL
VITE_BACKEND_URL=https://$DOMAIN_NAME
VITE_LIVEKIT_URL=wss://livekit.$DOMAIN_NAME
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOL

npm install --legacy-peer-deps > /dev/null
npm run build
cd ..

# 5. Firewall Rules
echo "🛡️  Ensuring Firewall Rules..."
gcloud compute firewall-rules create allow-livekit-tcp --allow tcp:7880,tcp:7881 --target-tags=livekit-server 2>/dev/null || true
gcloud compute firewall-rules create allow-livekit-udp --allow udp:50000-60000 --target-tags=livekit-server 2>/dev/null || true
gcloud compute firewall-rules create allow-http-https --allow tcp:80,tcp:443 --target-tags=livekit-server 2>/dev/null || true

# 6. Create/Update VM
echo "💻 Provisioning IP & VM..."
if ! gcloud compute instances describe $APP_NAME --zone $ZONE > /dev/null 2>&1; then
    gcloud compute instances create $APP_NAME \
        --zone=$ZONE \
        --machine-type=e2-medium \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --tags=livekit-server,http-server,https-server \
        --address=$IP_ADDRESS \
        --boot-disk-size=20GB \
        --metadata=startup-script='#! /bin/bash
        apt-get update
        apt-get install -y docker.io docker-compose-plugin
        usermod -aG docker ubuntu
        '
    echo "⏳ Waiting for VM to initialize (60s)..."
    sleep 60
else
    echo "✅ VM Instance exists."
fi

# 7. Check & Install Docker
echo "🔍 Checking for Docker on server..."
if ! gcloud compute ssh ubuntu@$APP_NAME --zone=$ZONE --command="command -v docker" >/dev/null 2>&1; then
    echo "⚠️  Docker not found! Installing..."
    gcloud compute ssh ubuntu@$APP_NAME --zone=$ZONE --command="
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker ubuntu
    "
else
    echo "✅ Docker is already installed."
fi

# Ensure user is in docker group (sometimes takes a re-login to apply, but we do what we can)
gcloud compute ssh ubuntu@$APP_NAME --zone=$ZONE --command="sudo usermod -aG docker ubuntu" >/dev/null 2>&1

echo "⏳ Verifying Docker availability..."
until gcloud compute ssh ubuntu@$APP_NAME --zone=$ZONE --command="docker --version" >/dev/null 2>&1; do
    echo "   Waiting for Docker... (might need to wait for permissions)"
    sleep 5
done

# 8. Deploy Code
echo "🚀 Deploying Code..."
# Clean node_modules before upload
rm -rf frontend/node_modules backend/node_modules

gcloud compute scp --recurse \
    ./docker-compose.prod.yml ./Caddyfile ./livekit.yaml ./backend ./frontend ./certs \
    ubuntu@$APP_NAME:~/app \
    --zone=$ZONE

echo "🐳 Starting Services..."
gcloud compute ssh ubuntu@$APP_NAME --zone=$ZONE --command="cd ~/app && sudo docker compose -f docker-compose.prod.yml up -d --build && sudo docker compose -f docker-compose.prod.yml restart livekit"

echo ""
echo "🎉 SUCCESS!"
echo "🌍 App URL: https://$DOMAIN_NAME"
echo "📹 LiveKit: wss://livekit.$DOMAIN_NAME"
echo ""
echo "⚠️  IMPORTANT: Automatic SSL might take 1-2 minutes to register."
echo "⚠️  Don't forget to update SUPABASE credentials in backend/.env.production on the server if needed!"
