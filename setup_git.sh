#!/bin/bash
echo "🚀 Complete Git Setup for Seruntul Advanced"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Step 1: Initialize Git Repository${NC}"
if [ -d .git ]; then
    echo -e "${YELLOW}✓ Git repository already initialized${NC}"
else
    git init
    echo -e "${GREEN}✓ Git repository initialized${NC}"
fi

echo -e "\n${GREEN}Step 2: Add all files${NC}"
git add .
echo -e "${GREEN}✓ All files added to staging${NC}"

echo -e "\n${GREEN}Step 3: Create initial commit${NC}"
git commit -m "Initial commit: Seruntul Advanced v1.0
- Complete business management system
- Supabase PostgreSQL database
- Next.js frontend
- Tailwind CSS styling
- TypeScript support"
echo -e "${GREEN}✓ Initial commit created${NC}"

echo -e "\n${GREEN}Step 4: Add GitHub remote${NC}"
git remote add origin https://github.com/slametreadie-cell/SERUNTUL.git
echo -e "${GREEN}✓ GitHub remote added${NC}"

echo -e "\n${GREEN}Step 5: Push to GitHub${NC}"
echo -e "${YELLOW}Note: If repository exists with different content, you may need to force push.${NC}"
echo -e "${YELLOW}Choose one:${NC}"
echo "1. Standard push (if empty repo): git push -u origin main"
echo "2. Force push (if conflicts): git push -u origin main --force"
echo ""
echo -e "${RED}Warning: Force push will overwrite existing content!${NC}"

echo -e "\n${GREEN}Step 6: Verify setup${NC}"
echo "Check repository at: https://github.com/slametreadie-cell/SERUNTUL"
