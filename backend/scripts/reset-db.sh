#!/bin/bash

# Database Reset Script for Pair With Code
# This script completely resets the database and applies all migrations

set -e

echo "🔄 Database Reset Starting..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
else
  echo "❌ .env file not found"
  exit 1
fi

# Database connection details
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-pairwithcode}
DB_NAME=${DB_NAME:-pairwithcode}
DB_PASSWORD=${DB_PASSWORD:-pairwithcode123}

# Export password for psql
export PGPASSWORD=$DB_PASSWORD

echo "📊 Connecting to database: $DB_HOST:$DB_PORT/$DB_NAME"

# Drop existing database if it exists
echo "🗑️  Dropping existing database..."
psql -h $DB_HOST -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 && \
  psql -h $DB_HOST -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" || true

# Create fresh database
echo "✨ Creating fresh database..."
psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Enable extensions
echo "🔧 Enabling extensions..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"

# Apply initial schema
echo "📝 Applying initial schema (001_init.sql)..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/001_init.sql || {
  echo "⚠️  Initial schema might already exist or have errors"
}

# Apply advanced features schema
echo "📝 Applying advanced features schema (002_add_advanced_features.sql)..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/002_add_advanced_features.sql || {
  echo "⚠️  Advanced features schema might already exist or have errors"
}

# Seed basic data
echo "🌱 Seeding initial data..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<'EOF'
-- Create default admin user if not exists
INSERT INTO users (id, email, username, oauth_provider)
VALUES ('admin', 'admin@pairwithcode.local', 'admin', 'local')
ON CONFLICT DO NOTHING;

-- Log seed completion
SELECT 'Database seeded successfully' AS status;
EOF

# Display table count
echo "📊 Verifying tables..."
TABLE_COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
echo "✅ Total tables created: $TABLE_COUNT"

# Display tables
echo "📋 Tables in database:"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tc "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" | sed 's/^/  - /'

echo ""
echo "✅ Database reset complete!"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Check database connection: npm run db:check"
echo "3. Run migrations if needed: npm run db:migrate"
echo ""
