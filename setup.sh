#!/bin/bash
# Setup script for Seruntul Advanced

echo "🚀 Setting up Seruntul Advanced..."

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

if ! command -v git &> /dev/null; then
    echo "❌ git is not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment
echo "🔧 Setting up environment..."
if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local with your Supabase credentials"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
fi

# Initialize git if not already
if [ ! -d .git ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: Seruntul Advanced"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Run: npm run supabase:start (for local development)"
echo "3. Run: npm run dev (to start development server)"
echo "4. Push to GitHub: git remote add origin <your-repo-url> && git push -u origin main"
echo ""
echo "For Supabase production setup:"
echo "1. Create project at supabase.com"
echo "2. Run migrations in Supabase SQL editor"
echo "3. Update .env.local with production credentials"
