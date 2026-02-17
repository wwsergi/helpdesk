#!/bin/bash

# HelpDesk Docker Helper Script
# Makes it easy to manage your Docker containers

set -e

PROJECT_DIR="/Users/sergicabo/Documents/Antigravity/HelpDesk"
cd "$PROJECT_DIR"

case "${1:-help}" in
    build)
        echo "🔨 Building Docker images..."
        docker-compose build
        echo "✅ Build complete!"
        ;;
    
    start)
        echo "🚀 Starting containers..."
        docker-compose up -d
        echo "⏳ Waiting for MySQL to be ready..."
        sleep 10
        echo "✅ Containers started!"
        echo ""
        echo "📍 Access your application at:"
        echo "   Frontend: http://localhost"
        echo "   Backend:  http://localhost:8000/api"
        ;;
    
    setup)
        echo "🔧 Setting up application..."
        
        # Generate app key
        echo "Generating application key..."
        docker-compose exec backend php artisan key:generate --force
        
        # Run migrations
        echo "Running database migrations..."
        docker-compose exec backend php artisan migrate --force
        
        # Run seeders
        echo "Seeding database..."
        docker-compose exec backend php artisan db:seed --force
        
        # Cache config
        echo "Optimizing Laravel..."
        docker-compose exec backend php artisan config:cache
        docker-compose exec backend php artisan route:cache
        
        echo "✅ Setup complete!"
        echo ""
        echo "📍 You can now access:"
        echo "   Frontend: http://localhost"
        echo "   Backend:  http://localhost:8000/api"
        echo ""
        echo "🔑 Default login:"
        echo "   Email: admin@example.com"
        echo "   Password: password"
        ;;
    
    stop)
        echo "🛑 Stopping containers..."
        docker-compose down
        echo "✅ Containers stopped!"
        ;;
    
    restart)
        echo "🔄 Restarting containers..."
        docker-compose restart
        echo "✅ Containers restarted!"
        ;;
    
    logs)
        SERVICE="${2:-}"
        if [ -z "$SERVICE" ]; then
            echo "📋 Showing all logs (Ctrl+C to exit)..."
            docker-compose logs -f
        else
            echo "📋 Showing logs for $SERVICE (Ctrl+C to exit)..."
            docker-compose logs -f "$SERVICE"
        fi
        ;;
    
    shell)
        SERVICE="${2:-backend}"
        echo "🐚 Opening shell in $SERVICE container..."
        docker-compose exec "$SERVICE" /bin/sh
        ;;
    
    fresh)
        echo "🔄 Fresh install (WARNING: This will delete all data)..."
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY == "yes" ]]; then
            docker-compose down -v
            docker-compose up -d
            sleep 10
            docker-compose exec backend php artisan key:generate --force
            docker-compose exec backend php artisan migrate:fresh --seed --force
            echo "✅ Fresh install complete!"
        else
            echo "❌ Cancelled"
        fi
        ;;
    
    status)
        echo "📊 Container status:"
        docker-compose ps
        ;;
    
    clean)
        echo "🧹 Cleaning up Docker resources..."
        docker-compose down -v
        docker system prune -f
        echo "✅ Cleanup complete!"
        ;;
    
    help|*)
        echo "HelpDesk Docker Management Script"
        echo ""
        echo "Usage: ./docker.sh [command]"
        echo ""
        echo "Commands:"
        echo "  build    - Build Docker images"
        echo "  start    - Start all containers"
        echo "  setup    - Run migrations and seed database"
        echo "  stop     - Stop all containers"
        echo "  restart  - Restart all containers"
        echo "  logs     - View logs (optional: logs backend/frontend/mysql)"
        echo "  shell    - Open shell in container (optional: shell backend/frontend)"
        echo "  status   - Show container status"
        echo "  fresh    - Fresh install (deletes all data!)"
        echo "  clean    - Clean up Docker resources"
        echo "  help     - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./docker.sh build          # Build images"
        echo "  ./docker.sh start          # Start containers"
        echo "  ./docker.sh setup          # Setup application"
        echo "  ./docker.sh logs backend   # View backend logs"
        echo "  ./docker.sh shell backend  # Open backend shell"
        ;;
esac
