#!/bin/bash
# Safe Deployment Script - Preserves .env and uploads

echo "🚀 Starting Safe Deployment..."

# Step 1: Backup .env if it exists
if [ -f .env ]; then
    cp .env .env.backup
    echo "✅ Backed up .env"
else
    echo "⚠️  No .env found, will create after pull"
fi

# Step 2: Pull latest code
echo "📥 Pulling latest code..."
git checkout main
git pull origin main

# Step 3: Ensure uploads symlink exists (points to persistent storage)
if [ ! -L uploads ]; then
    rm -rf uploads
    ln -s ../persistent_uploads uploads
    echo "✅ Created uploads symlink"
else
    echo "✅ Uploads symlink already exists"
fi

# Step 4: Restore .env
if [ -f .env.backup ]; then
    cp .env.backup .env
    rm .env.backup
    echo "✅ Restored .env"
elif [ ! -f .env ]; then
    # Create default .env if it doesn't exist
    cat > .env << 'EOF'
USE_MYSQL=true
DB_HOST=127.0.0.1
DB_USER=u984810592_aparna_admin
DB_PASSWORD=sCARFACE@2003?.
DB_NAME=u984810592_aparna_cne
PORT=3000
SESSION_SECRET=aparna-cne-secret-2025
EOF
    echo "✅ Created new .env"
fi

# Step 4: Restart server
touch tmp/restart.txt
echo "🔄 Server restarting..."

# Step 5: Wait and verify
sleep 3
echo ""
echo "📊 Checking status..."
if [ -f .env ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file MISSING!"
fi

# Check for errors
if [ -f stderr.log ]; then
    ERRORS=$(tail -5 stderr.log | grep -i "error\|fail" | head -2)
    if [ -n "$ERRORS" ]; then
        echo "⚠️  Recent errors:"
        echo "$ERRORS"
    else
        echo "✅ No recent errors"
    fi
fi

echo ""
echo "🎉 Deployment complete!"
echo "🔗 Test: curl -s https://aparnaine.com/api/admin/login -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}'"
