# 🚀 Deployment Guide - Aparna CNE Registration System

## ⚠️ CRITICAL: Read Before Deploying

This system uses **MySQL database** on Hostinger. The `.env` file contains database credentials and is **NOT tracked by git** (for security). You must be careful not to delete it during deployment.

---

## 📋 Server Details

| Item | Value |
|------|-------|
| **Server** | Hostinger Shared Hosting |
| **SSH Host** | 72.60.19.158 |
| **SSH Port** | 65002 |
| **SSH User** | u984810592 |
| **Website URL** | https://aparnaine.com |
| **App Directory** | ~/domains/aparnaine.com/public_html |

---

## ✅ SAFE Deployment Method (Recommended)

### Step 1: Push Changes from Local Machine
```powershell
# On your local Windows machine
cd "d:\Bitflow Software\CNE\aparna_cne"
git add .
git commit -m "Your commit message"
git push origin main
```

### Step 2: Connect to Server
```powershell
ssh -p 65002 u984810592@72.60.19.158
# Enter password when prompted
```

### Step 3: Pull Changes (SAFE - Preserves .env)
```bash
cd ~/domains/aparnaine.com/public_html
git pull origin main
```

### Step 4: Restart Server
```bash
touch tmp/restart.txt
```

### Step 5: Verify Deployment
```bash
# Check for errors
tail -20 stderr.log

# Test API
curl -s https://aparnaine.com/api/admin/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

---

## ❌ DANGEROUS Commands (Avoid These)

### Never use `git reset --hard` without backup!
```bash
# ❌ THIS DELETES .env FILE!
git reset --hard origin/main

# If you must use it, FIRST backup .env:
cp .env .env.backup
git reset --hard origin/main
cp .env.backup .env
rm .env.backup
touch tmp/restart.txt
```

### Never use `git clean -fd`
```bash
# ❌ THIS DELETES ALL UNTRACKED FILES INCLUDING .env!
git clean -fd
```

---

## 🔧 .env File Contents

If the `.env` file gets deleted, recreate it with:

```bash
cat > .env << 'EOF'
USE_MYSQL=true
DB_HOST=127.0.0.1
DB_USER=u984810592_aparna_admin
DB_PASSWORD=sCARFACE@2003?.
DB_NAME=u984810592_aparna_cne
PORT=3000
SESSION_SECRET=aparna-cne-secret-2025
EOF
```

**Variable Meanings:**
| Variable | Description |
|----------|-------------|
| `USE_MYSQL` | Set to `true` to use MySQL, `false` for local JSON |
| `DB_HOST` | MySQL server (127.0.0.1 for Hostinger) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name |
| `PORT` | Server port (managed by Passenger) |
| `SESSION_SECRET` | Secret for session encryption |

---

## 🔄 Full Deployment Workflow

### Quick Deploy (Most Common)
```bash
# 1. SSH to server
ssh -p 65002 u984810592@72.60.19.158

# 2. Navigate and pull
cd ~/domains/aparnaine.com/public_html
git pull origin main

# 3. Restart
touch tmp/restart.txt

# 4. Verify
tail -10 stderr.log
```

### Deploy with Dependency Updates
```bash
# 1. SSH to server
ssh -p 65002 u984810592@72.60.19.158

# 2. Navigate and pull
cd ~/domains/aparnaine.com/public_html
git pull origin main

# 3. Install new dependencies
npm install

# 4. Restart
touch tmp/restart.txt

# 5. Verify
tail -10 stderr.log
```

### Emergency Recovery (If .env Deleted)
```bash
# 1. Recreate .env file
cat > .env << 'EOF'
USE_MYSQL=true
DB_HOST=127.0.0.1
DB_USER=u984810592_aparna_admin
DB_PASSWORD=sCARFACE@2003?.
DB_NAME=u984810592_aparna_cne
PORT=3000
SESSION_SECRET=aparna-cne-secret-2025
EOF

# 2. Restart server
touch tmp/restart.txt

# 3. Verify
tail -10 stderr.log
curl -s https://aparnaine.com/api/admin/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"aparnainstitutes","password":"APARNA@2025!Admin"}'
```

---

## 🗄️ Database Information

### MySQL Database
- **Host:** 127.0.0.1 (localhost on Hostinger)
- **Database:** u984810592_aparna_cne
- **User:** u984810592_aparna_admin
- **Password:** sCARFACE@2003?.

### Check Database Status
```bash
mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne -e "
SELECT 'Users' as tbl, COUNT(*) as cnt FROM users 
UNION ALL SELECT 'Workshops', COUNT(*) FROM workshops 
UNION ALL SELECT 'Registrations', COUNT(*) FROM registrations 
UNION ALL SELECT 'Students', COUNT(*) FROM students
UNION ALL SELECT 'Attendance', COUNT(*) FROM attendance
UNION ALL SELECT 'Agents', COUNT(*) FROM agents;"
```

### Backup Database
```bash
mysqldump -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
mysql -u u984810592_aparna_admin -p'sCARFACE@2003?.' u984810592_aparna_cne < backup_file.sql
```

---

## 📝 Troubleshooting

### Server Returns 503 Error
```bash
# Check error log
tail -50 stderr.log

# Common causes:
# 1. Syntax error in code
# 2. Missing .env file
# 3. Database connection failed
```

### "Access denied for user 'root'" Error
```bash
# .env file is missing or has wrong variable names
# Recreate it with the command above
cat .env  # Check if it exists
```

### "Cannot find module" Error
```bash
# Install dependencies
npm install
touch tmp/restart.txt
```

### Changes Not Reflecting
```bash
# Make sure you restarted
touch tmp/restart.txt

# Wait 5-10 seconds, then test
sleep 5
curl -s https://aparnaine.com
```

---

## 🔐 Admin Credentials

| Portal | Username | Password |
|--------|----------|----------|
| Admin Panel | aparnainstitutes | APARNA@2025!Admin |

---

## 📁 Important File Locations

| File/Directory | Purpose |
|----------------|---------|
| `~/domains/aparnaine.com/public_html/` | Application root |
| `.env` | Environment configuration (NOT in git) |
| `stderr.log` | Server error logs |
| `tmp/restart.txt` | Touch to restart Passenger |
| `database/mysql-db.js` | MySQL database operations |
| `routes/` | All API route handlers |

---

## 🚨 Emergency Contacts

If something breaks and you can't fix it:
1. Check `stderr.log` for error messages
2. Verify `.env` file exists and has correct values
3. Try restarting with `touch tmp/restart.txt`
4. If database issue, check MySQL credentials in Hostinger panel

---

## 📌 Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    QUICK DEPLOY COMMANDS                     │
├─────────────────────────────────────────────────────────────┤
│ SSH:     ssh -p 65002 u984810592@72.60.19.158               │
│ CD:      cd ~/domains/aparnaine.com/public_html             │
│ PULL:    git pull origin main                               │
│ RESTART: touch tmp/restart.txt                              │
│ LOGS:    tail -20 stderr.log                                │
├─────────────────────────────────────────────────────────────┤
│                    IF .env DELETED                          │
├─────────────────────────────────────────────────────────────┤
│ cat > .env << 'EOF'                                         │
│ USE_MYSQL=true                                              │
│ DB_HOST=127.0.0.1                                           │
│ DB_USER=u984810592_aparna_admin                             │
│ DB_PASSWORD=sCARFACE@2003?.                                 │
│ DB_NAME=u984810592_aparna_cne                               │
│ PORT=3000                                                   │
│ SESSION_SECRET=aparna-cne-secret-2025                       │
│ EOF                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

*Last Updated: January 14, 2026*
