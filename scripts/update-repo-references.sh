#!/bin/bash
# Update repository-specific references for migrated repository
# This script updates URLs, repository names, and other references

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get repository information
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Update Repository References${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Ask for repository details
read -p "Enter repository owner (e.g., hiranotomo): " REPO_OWNER
read -p "Enter repository name (e.g., zeami4): " REPO_NAME

if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
    echo -e "${RED}Error: Repository owner and name are required${NC}"
    exit 1
fi

OLD_OWNER="hiranotomo"
OLD_REPO="giflearn"
NEW_OWNER="$REPO_OWNER"
NEW_REPO="$REPO_NAME"

echo ""
echo -e "${YELLOW}Updating references:${NC}"
echo -e "  From: ${OLD_OWNER}/${OLD_REPO}"
echo -e "  To:   ${NEW_OWNER}/${NEW_REPO}"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Update cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Updating package.json...${NC}"
if [ -f "package.json" ]; then
    sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" package.json
    sed -i.bak "s|\"name\": \"$OLD_REPO\"|\"name\": \"$NEW_REPO\"|g" package.json
    sed -i.bak "s|\"description\": \".*\"|\"description\": \"Auto-development system powered by Claude Code\"|g" package.json
    rm package.json.bak
    echo "✓ Updated package.json"
else
    echo -e "${YELLOW}package.json not found (skipped)${NC}"
fi

echo ""
echo -e "${GREEN}Updating README.md (if exists)...${NC}"
if [ -f "README.md" ]; then
    sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" README.md
    rm README.md.bak
    echo "✓ Updated README.md"
else
    echo -e "${YELLOW}README.md not found (skipped)${NC}"
fi

echo ""
echo -e "${GREEN}Updating workflow files...${NC}"
if [ -d ".github/workflows" ]; then
    find .github/workflows -name "*.yml" -type f -exec sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" {} \;
    find .github/workflows -name "*.bak" -type f -delete
    echo "✓ Updated workflow files"
else
    echo -e "${YELLOW}.github/workflows not found (skipped)${NC}"
fi

echo ""
echo -e "${GREEN}Updating template files...${NC}"
if [ -d ".github" ]; then
    find .github -name "*.md" -type f -exec sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" {} \;
    find .github -name "*.yml" -type f -exec sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" {} \;
    find .github -name "*.bak" -type f -delete
    echo "✓ Updated template files"
fi

echo ""
echo -e "${GREEN}Updating agent files...${NC}"
if [ -d ".claude/agents" ]; then
    find .claude/agents -name "*.md" -type f -exec sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" {} \;
    find .claude/agents -name "*.bak" -type f -delete
    echo "✓ Updated agent files"
else
    echo -e "${YELLOW}.claude/agents not found (skipped)${NC}"
fi

echo ""
echo -e "${GREEN}Updating config files...${NC}"
if [ -d ".claude/config" ]; then
    find .claude/config -name "*.md" -type f -exec sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" {} \;
    find .claude/config -name "*.bak" -type f -delete
    echo "✓ Updated config files"
fi

echo ""
echo -e "${GREEN}Updating command files...${NC}"
if [ -d ".claude/commands" ]; then
    find .claude/commands -name "*.md" -type f -exec sed -i.bak "s|$OLD_OWNER/$OLD_REPO|$NEW_OWNER/$NEW_REPO|g" {} \;
    find .claude/commands -name "*.bak" -type f -delete
    echo "✓ Updated command files"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Repository references updated!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Updated files:${NC}"
echo "  - package.json"
echo "  - README.md"
echo "  - .github/workflows/*.yml"
echo "  - .github/**/*.md"
echo "  - .github/**/*.yml"
echo "  - .claude/agents/*.md"
echo "  - .claude/config/*.md"
echo "  - .claude/commands/*.md"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review changes: git diff"
echo "2. Test the system: npm test"
echo "3. Configure GitHub Secrets (see MIGRATION_SETUP.md)"
echo "4. Commit changes: git add . && git commit -m 'chore: Setup auto-development system from giflearn'"
echo ""
