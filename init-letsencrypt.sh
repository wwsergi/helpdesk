#!/bin/bash
# Run this ONCE on the server before starting the full stack.
# It bootstraps Let's Encrypt certificates for soporte.intratime.es.

set -e

DOMAIN="soporte.intratime.es"
EMAIL="your@email.com"   # <-- change this
CERTBOT_CONF="./proxy/certbot/conf"
CERTBOT_WWW="./proxy/certbot/www"

echo "### Creating required directories..."
mkdir -p "$CERTBOT_CONF" "$CERTBOT_WWW"

echo "### Downloading recommended TLS parameters..."
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
  -o "$CERTBOT_CONF/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
  -o "$CERTBOT_CONF/ssl-dhparams.pem"

echo "### Creating dummy certificate for $DOMAIN..."
DUMMY_PATH="$CERTBOT_CONF/live/$DOMAIN"
mkdir -p "$DUMMY_PATH"
docker run --rm \
  -v "$CERTBOT_CONF:/etc/letsencrypt" \
  certbot/certbot \
  certonly --standalone \
  --register-unsafely-without-email \
  --agree-tos \
  --staging \
  -d "$DOMAIN" \
  --cert-path /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  --key-path /etc/letsencrypt/live/$DOMAIN/privkey.pem 2>/dev/null || \
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$DUMMY_PATH/privkey.pem" \
  -out "$DUMMY_PATH/fullchain.pem" \
  -subj "/CN=localhost" 2>/dev/null

echo "### Starting nginx (HTTP only mode for challenge)..."
docker-compose up -d proxy

echo "### Requesting Let's Encrypt certificate..."
docker-compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "### Reloading nginx with real certificate..."
docker-compose exec proxy nginx -s reload

echo "### Done! Certificate issued for $DOMAIN."
echo "    Certbot will auto-renew every 12h via the certbot container."
