#!/bin/bash
# deploy.sh - One-click Vercel deployment script

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}"
echo "🚀 Vercel Edge JSON API Deployment"
echo "===================================="
echo -e "${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed${NC}"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ $NODE_VERSION -lt 18 ]; then
    echo -e "${RED}Node.js 18+ is required. Current: v$NODE_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js v$NODE_VERSION${NC}"

# Install Vercel CLI if not present
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Installing Vercel CLI...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✓ Vercel CLI installed${NC}"
fi

# Install project dependencies
echo -e "\n${YELLOW}Installing project dependencies...${NC}"
npm ci --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Type check
echo -e "\n${YELLOW}Running type checks...${NC}"
npm run type-check
echo -e "${GREEN}✓ Type check passed${NC}"

# Build project
echo -e "\n${YELLOW}Building project...${NC}"
npm run build
echo -e "${GREEN}✓ Build successful${NC}"

# Check if user is logged into Vercel
echo -e "\n${YELLOW}Checking Vercel authentication...${NC}"
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}Please log in to Vercel:${NC}"
    vercel login
fi

# Get current user
VERCEL_USER=$(vercel whoami)
echo -e "${GREEN}✓ Logged in as: $VERCEL_USER${NC}"

# Ask for deployment type
echo -e "\n${BLUE}Select deployment type:${NC}"
echo "1) Production (production branch)"
echo "2) Preview (development/testing)"
echo "3) Both (preview first, then production)"
echo "4) Setup only (configure but don't deploy)"

read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo -e "\n${YELLOW}Deploying to production...${NC}"
        vercel --prod --yes
        ;;
    2)
        echo -e "\n${YELLOW}Deploying preview...${NC}"
        PREVIEW_URL=$(vercel --yes)
        echo -e "\n${GREEN}✓ Preview deployed!${NC}"
        echo -e "${BLUE}Preview URL: $PREVIEW_URL${NC}"
        ;;
    3)
        echo -e "\n${YELLOW}Deploying preview...${NC}"
        PREVIEW_URL=$(vercel --yes)
        echo -e "\n${GREEN}✓ Preview deployed: $PREVIEW_URL${NC}"
        
        read -p "Deploy to production? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo -e "\n${YELLOW}Deploying to production...${NC}"
            vercel --prod --yes
        fi
        ;;
    4)
        echo -e "\n${YELLOW}Setting up project only...${NC}"
        vercel link
        echo -e "${GREEN}✓ Project linked to Vercel${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# KV Store setup reminder
echo -e "\n${BLUE}📦 Vercel KV Setup Required:${NC}"
echo -e "${YELLOW}Don't forget to set up your KV store:${NC}"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Navigate to your project → Storage"
echo "3. Create a new KV store"
echo "4. Link it to your project"
echo ""
echo -e "${YELLOW}Then pull environment variables:${NC}"
echo "vercel env pull .env.local"

# Test deployment
if [[ $choice != "4" ]]; then
    echo -e "\n${YELLOW}Testing deployment...${NC}"
    sleep 5  # Wait for deployment to propagate

    # Get deployment URL
    if command -v vercel &> /dev/null; then
        DEPLOYMENT_URL=$(vercel ls | head -n 2 | tail -n 1 | awk '{print $2}' | sed 's/.*\(https[^[:space:]]*\).*/\1/')
        
        if [[ $DEPLOYMENT_URL == https* ]]; then
            echo -e "${YELLOW}Testing health endpoint...${NC}"
            
            if curl -s "$DEPLOYMENT_URL/api/health" | grep -q "healthy"; then
                echo -e "${GREEN}✓ Deployment test successful!${NC}"
                echo -e "${BLUE}🌐 Your API is live at: $DEPLOYMENT_URL${NC}"
                echo -e "${BLUE}📊 Health check: $DEPLOYMENT_URL/api/health${NC}"
                echo -e "${BLUE}📖 API docs: $DEPLOYMENT_URL${NC}"
            else
                echo -e "${YELLOW}⚠️  Deployment is live but health check failed${NC}"
                echo -e "${YELLOW}   This might be due to missing KV store setup${NC}"
            fi
        fi
    fi
fi

# Success message
echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Set up Vercel KV store (if not done)"
echo "2. Test your API endpoints"
echo "3. Configure custom domain (optional)"
echo "4. Set up monitoring and alerts"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo "vercel logs           # View deployment logs"
echo "vercel env ls         # List environment variables"
echo "vercel domains        # Manage custom domains"
echo "vercel --help         # Full CLI documentation"

echo -e "\n${GREEN}🚀 Happy deploying!${NC}"