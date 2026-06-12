#!/bin/bash
# Production Build & Deploy Script
# Usage: ./deploy-production.sh

set -e

echo "🚀 Starting PairWithCode Production Build..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify environment
echo -e "${YELLOW}Step 1: Verifying environment...${NC}"
if [ ! -f ".env" ]; then
  echo -e "${RED}Error: .env file not found. Create it with your production settings.${NC}"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Run from project root.${NC}"
  exit 1
fi

# Step 2: Clean build
echo -e "${YELLOW}Step 2: Cleaning previous build...${NC}"
rm -rf out/
rm -rf dist/
rm -f pair-with-code-*.vsix

# Step 3: Install dependencies
echo -e "${YELLOW}Step 3: Installing dependencies...${NC}"
npm install

# Step 4: Compile TypeScript
echo -e "${YELLOW}Step 4: Compiling TypeScript...${NC}"
npm run compile

if [ ! -d "out" ]; then
  echo -e "${RED}Error: Compilation failed - no out/ directory created.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Frontend compiled successfully${NC}"

# Step 5: Backend checks
echo -e "${YELLOW}Step 5: Checking backend...${NC}"
cd backend
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Backend package.json not found.${NC}"
  exit 1
fi

npm install
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}Error: Backend compilation failed.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Backend compiled successfully${NC}"
cd ..

# Step 6: Security audit
echo -e "${YELLOW}Step 6: Running security audit...${NC}"
npm audit

echo -e "${YELLOW}Backend security audit:${NC}"
cd backend && npm audit
cd ..

# Step 7: Package extension
echo -e "${YELLOW}Step 7: Packaging extension...${NC}"
npm install -g vsce 2>/dev/null || true

VERSION=$(grep '"version"' package.json | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
FILENAME="pair-with-code-${VERSION}.vsix"

vsce package --out "$FILENAME"

if [ ! -f "$FILENAME" ]; then
  echo -e "${RED}Error: Extension packaging failed.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Extension packaged: $FILENAME${NC}"

# Step 8: Summary
echo -e "${GREEN}"
echo "====================================="
echo "✅ PRODUCTION BUILD COMPLETE!"
echo "====================================="
echo ""
echo "📦 Extension Package: $FILENAME"
echo "📊 Size: $(du -h "$FILENAME" | cut -f1)"
echo ""
echo "🚀 Next steps:"
echo "1. Test the extension locally: code --install-extension $FILENAME"
echo "2. Verify backend is deployed"
echo "3. Publish: vsce publish"
echo ""
echo "====================================="
echo -e "${NC}"
