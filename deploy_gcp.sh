#!/bin/bash

# deploy_gcp.sh
# Provisions GCP resources and deploys the app

set -e

APP_NAME="founderstribe-server"
REGION="us-central1"
ZONE="us-central1-a"

echo "🚀 Starting GCP Deployment for $APP_NAME..."

# 0. Check Login
echo "🔍 Checking GCP Authentication..."
gcloud auth print-access-token > /dev/null 2>&1 || { echo "❌ Not logged in. Run 'gcloud auth login' first."; exit 1; }

# 1. Create Static IP
if ! gcloud compute addresses describe $APP_NAME-ip --region $REGION > /dev/null 2>&1; then
    echo "🌐 Creating Static IP..."
    gcloud compute addresses create $APP_NAME-ip --region $REGION
else
    echo "✅ Static IP exists."
fi

IP_ADDRESS=$(gcloud compute addresses describe $APP_NAME-ip --region $REGION --format='get(address)')
echo "📌 External IP: $IP_ADDRESS"
echo "⚠️  ACTION REQUIRED: Go to your DNS provider and point your domain to $IP_ADDRESS"
read -p "Press Enter after you have updated your DNS..."

# 2. Create Firewall Rules
echo "🛡️  Checking Firewall Rules..."

if ! gcloud compute firewall-rules describe allow-livekit-tcp > /dev/null 2>&1; then
    gcloud compute firewall-rules create allow-livekit-tcp --allow tcp:7880,tcp:7881 --target-tags=livekit-server --description="LiveKit TCP"
fi

if ! gcloud compute firewall-rules describe allow-livekit-udp > /dev/null 2>&1; then
    gcloud compute firewall-rules create allow-livekit-udp --allow udp:50000-60000 --target-tags=livekit-server --description="LiveKit UDP"
fi

if ! gcloud compute firewall-rules describe allow-http-https > /dev/null 2>&1; then
    gcloud compute firewall-rules create allow-http-https --allow tcp:80,tcp:443 --target-tags=livekit-server --description="Web HTTP/S"
fi

# 3. Create VM
if ! gcloud compute instances describe $APP_NAME --zone $ZONE > /dev/null 2>&1; then
    echo "💻 Creating VM Instance..."
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

# 4. Copy Files
echo "xor  Copying project files to server..."
# Remove node_modules to speed up transfer
echo "   (Cleaning local node_modules...)"
rm -rf frontend/node_modules backend/node_modules

# Copy files
gcloud compute scp --recurse \
    ./docker-compose.prod.yml ./Caddyfile ./livekit.yaml ./backend ./frontend ./certs \
    ubuntu@$APP_NAME:~/app \
    --zone=$ZONE

# 5. Start Docker
echo "🐳 Starting Docker on server..."
gcloud compute ssh ubuntu@$APP_NAME --zone=$ZONE --command="cd ~/app && sudo docker compose -f docker-compose.prod.yml up -d --build"

echo "🎉 Deployment Complete!"
echo "🌍 Your app should be live at the domain you configured."
