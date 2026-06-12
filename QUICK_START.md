# Quick Start Guide - PairWithCode Enterprise

Get PairWithCode up and running in 5 minutes.

## Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)
- Redis (or use Docker)
- VS Code 1.85+

## Option 1: Docker (Recommended)

```bash
# 1. Clone and setup
git clone <repo-url>
cd pairwithcode

# 2. Set environment variables
cp .env.example .env
export CLAUDE_API_KEY="sk-..." # Get from claude.ai/api

# 3. Start all services
docker-compose up

# 4. Apply database migrations
docker-compose exec backend npm run migrate

# 5. Open VS Code
# The extension auto-activates on startup
# Command: Pair Tool: Create Room
```

## Option 2: Local Development

```bash
# 1. Setup PostgreSQL & Redis
# On macOS:
brew install postgresql redis
brew services start postgresql
brew services start redis

# 2. Create database
createdb pairwithcode
psql pairwithcode < backend/migrations/001-create-core-tables.sql

# 3. Install dependencies
npm install
cd backend && npm install && cd ..

# 4. Set environment variables
cp .env.example .env
export CLAUDE_API_KEY="sk-..."

# 5. Start backend
cd backend && npm run dev

# 6. In another terminal, compile extension
npm run watch

# 7. In VS Code: Debug > Launch Extension
```

## Testing End-to-End

1. **Open VS Code** with extension loaded
2. **Command**: "Pair Tool: Create Room" → Choose room name
3. **Command**: "Pair Tool: Copy Room ID" → Share with partner
4. **Partner**: "Pair Tool: Join Room" → Paste room ID

### Test Each Feature

- **Chat**: Command "Pair Tool: Open Chat" → Type message
- **Analytics**: Command "Pair Tool: Session Analytics" → See live metrics
- **Code Review**: Create a comment on a line → See it in Code Review panel
- **Recording**: Command "Pair Tool: Session Recording" → Start/Stop
- **OAuth**: Command "Pair Tool: Sign in with GitHub" → Authenticate

## Production Deployment

### AWS Deployment

```bash
# 1. Create RDS PostgreSQL instance
# 2. Create ElastiCache Redis cluster
# 3. Deploy backend to ECS/Lambda

docker build -t pairwithcode-backend ./backend
aws ecr get-login-password | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker tag pairwithcode-backend <account-id>.dkr.ecr.<region>.amazonaws.com/pairwithcode:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/pairwithcode:latest
```

### GCP Deployment

```bash
# 1. Create Cloud SQL PostgreSQL instance
# 2. Create Memorystore Redis instance
# 3. Deploy to Cloud Run

gcloud run deploy pairwithcode --source=./backend --region=us-central1
```

### Azure Deployment

```bash
# 1. Create Azure Database for PostgreSQL
# 2. Create Azure Cache for Redis
# 3. Deploy to Container Instances

az container create --resource-group rg-pairwithcode --file docker-compose.yml
```

## Environment Configuration

### Required Variables

```
CLAUDE_API_KEY=sk-... # From Anthropic
DB_HOST=localhost
DB_PORT=5432
DB_USER=pairwithcode
DB_PASSWORD=***
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<random-32-chars>
```

### Optional Variables

```
# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=

# AWS S3 (for recordings)
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# Twilio (for video calls)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

## Troubleshooting

### Port already in use
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database connection failed
```bash
# Check PostgreSQL is running
psql postgres -c "SELECT version();"

# Reset database
dropdb pairwithcode
createdb pairwithcode
psql pairwithcode < backend/migrations/001-create-core-tables.sql
```

### Extension not appearing
```bash
# In VS Code: Ctrl+Shift+P → Developer: Show Extension Folder
# Check extension is properly compiled
npm run compile
```

## Next Steps

- [ ] Deploy to cloud provider
- [ ] Set up SSL/TLS certificates
- [ ] Configure OAuth providers
- [ ] Enable end-to-end encryption
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Create admin dashboard
- [ ] Onboard team members

## Support

- Documentation: https://docs.pairwithcode.dev
- Issues: https://github.com/pairwithcode/issues
- Email: support@pairwithcode.dev
