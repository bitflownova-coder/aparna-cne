# Deployment Guide - Aparna CNE Management System

## 🔐 SSH Connection Details

**Server IP:** `72.60.19.158`  
**SSH Port:** `65002`  
**Username:** `u984810592`  
**Password:** Ask admin

## 📁 Server Paths

- **Project Root:** `/home/u984810592/domains/aparnaine.com/public_html`
- **Database:** MySQL on `127.0.0.1`
- **Database Name:** `u984810592_aparna_cne`
- **Database User:** `u984810592_aparna_admin`

## 🚀 Quick Deploy (Recommended)

### Method 1: Using PowerShell (Windows)

```powershell
# Connect to server
ssh -p 65002 u984810592@72.60.19.158

# Once connected, run:
cd domains/aparnaine.com/public_html
git pull origin main
touch tmp/restart.txt
exit
```

### Method 2: One-Line Command

```powershell
ssh -p 65002 u984810592@72.60.19.158 "cd domains/aparnaine.com/public_html && git pull origin main && touch tmp/restart.txt"
```

### Method 3: Using Hostinger CPanel

1. Login to Hostinger CPanel
2. Open **Terminal** from the dashboard
3. Run:
   ```bash
   cd domains/aparnaine.com/public_html
   git pull origin main
   touch tmp/restart.txt
   ```

## 📝 Step-by-Step Deployment

### 1. Commit Your Changes (Local)

```powershell
git add .
git commit -m "Your commit message"
git push origin main
```

### 2. Deploy to Production

**Connect via SSH:**
```powershell
ssh -p 65002 u984810592@72.60.19.158
```

**Pull Latest Code:**
```bash
cd domains/aparnaine.com/public_html
git pull origin main
```

**Restart Application:**
```bash
touch tmp/restart.txt
```

**Exit SSH:**
```bash
exit
```

## 🔍 Verification

After deployment, check:
- Main site: https://aparnaine.com
- Bitflow Portal: https://aparnaine.com/bitflow-login.html
- Admin Panel: https://aparnaine.com/admin-login.html

## 🔧 Troubleshooting

### Check Application Status
```bash
# Via CPanel Terminal
cd domains/aparnaine.com/public_html
cat logs/error.log
```

### Check Database Connection
```bash
mysql -u u984810592_aparna_admin -p u984810592_aparna_cne
```

### Force Restart
```bash
cd domains/aparnaine.com/public_html
touch tmp/restart.txt
```

### View Recent Logs
```bash
tail -n 50 logs/error.log
```

## 🔒 Private GitHub Repository Setup

### Question: Will Hostinger work with private repos?

**Yes!** But you need to set up SSH keys:

#### Step 1: Generate SSH Key on Server
```bash
ssh -p 65002 u984810592@72.60.19.158
cd ~/.ssh
ssh-keygen -t ed25519 -C "u984810592@hostinger"
# Press Enter for all prompts (no passphrase)
cat id_ed25519.pub
```

#### Step 2: Add SSH Key to GitHub
1. Copy the output from `cat id_ed25519.pub`
2. Go to GitHub → Settings → SSH and GPG keys
3. Click "New SSH key"
4. Paste the key and save

#### Step 3: Update Git Remote (on server)
```bash
cd domains/aparnaine.com/public_html
git remote set-url origin git@github.com:bitflownova-coder/aparna-cne.git
git pull origin main
```

#### Step 4: Test Connection
```bash
ssh -T git@github.com
# Should see: "Hi bitflownova-coder! You've successfully authenticated..."
```

### Making Repo Private

1. Go to GitHub repository settings
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Make private"
4. Confirm

**After making private:** Deployment will continue to work automatically if SSH keys are set up!

## 🎯 Bitflow Admin Portal

**URL:** https://aparnaine.com/bitflow-login.html  
**Username:** `bitflowadmin`  
**Password:** `sCARFACE@aMISHA@1804`

**Features:**
- Complete audit trail of all system changes
- Filter by action, entity, user, date
- View detailed JSON logs
- Real-time statistics
- Auto-refresh every 30 seconds

## 📊 Database Access

### Via CPanel phpMyAdmin
1. Login to Hostinger CPanel
2. Open phpMyAdmin
3. Select database: `u984810592_aparna_cne`

### Via Terminal
```bash
mysql -h 127.0.0.1 -u u984810592_aparna_admin -p u984810592_aparna_cne
```

## 🛠️ Common Tasks

### Update Node Dependencies
```bash
cd domains/aparnaine.com/public_html
npm install
touch tmp/restart.txt
```

### Backup Database
```bash
mysqldump -u u984810592_aparna_admin -p u984810592_aparna_cne > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
mysql -u u984810592_aparna_admin -p u984810592_aparna_cne < backup_20260117.sql
```

## 📞 Support

If deployment fails:
1. Check SSH connection: `ssh -p 65002 u984810592@72.60.19.158`
2. Verify git is up to date: `git status`
3. Check file permissions: `ls -la`
4. Review error logs: `cat logs/error.log`

---

**Last Updated:** January 17, 2026  
**Server Provider:** Hostinger  
**Live URL:** https://aparnaine.com
