#!/bin/bash

# Define variables
KEY_FILE="HelpdeskIntratimetest.pem"
REMOTE_USER="ubuntu"
REMOTE_HOST="ec2-13-49-137-139.eu-north-1.compute.amazonaws.com"
REMOTE_DIR="~/HelpDesk"

# Fix permissions on key file just in case
chmod 400 "$KEY_FILE"

# Create destination directory on remote
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

# Rsync project files
echo "Deploying to $REMOTE_HOST..."
rsync -avz -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.DS_Store' \
    --exclude '__pycache__' \
    --exclude 'venv' \
    --exclude 'vendor' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude 'build' \
    ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR"

echo "Deployment complete."
