# CNE Workshop Registration System - Deployment Guide

## Hostinger Cloud Startup Deployment

### Prerequisites
- Hostinger Cloud Startup plan
- Domain pointed to your server
- SSH access to server

---

## Step 1: Initial Server Setup

### 1.1 Connect to Server via SSH
```bash
ssh root@your-server-ip
```

### 1.2 Update System
```bash
apt update && apt upgrade -y
```

### 1.3 Install Node.js (LTS version)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node --version  # Should show v20.x.x
npm --version
```

### 1.4 Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### 1.5 Install Git
```bash
apt install -y git
```

---

## Step 2: Clone and Setup Application

### 2.1 Create Application Directory
```bash
mkdir -p /var/www
cd /var/www
```

### 2.2 Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/aparna-cne.git
cd aparna-cne
```

### 2.3 Install Dependencies
```bash
npm install --production
```

### 2.4 Setup Environment Variables
```bash
cp .env.example .env
nano .env
```

**Edit the .env file with your production values:**
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=generate-a-long-random-string-here
ADMIN_USERNAME=aparnainstitutes
ADMIN_PASSWORD=your-secure-password
```

### 2.5 Create Required Directories
```bash
mkdir -p logs
mkdir -p uploads/payments
mkdir -p uploads/qr-codes
mkdir -p uploads/bulk
```

### 2.6 Set Permissions
```bash
chmod -R 755 /var/www/aparna-cne
chown -R www-data:www-data /var/www/aparna-cne
```

---

## Step 3: Start Application with PM2

### 3.1 Start the Application
```bash
cd /var/www/aparna-cne
pm2 start ecosystem.config.js --env production
```

### 3.2 Save PM2 Process List
```bash
pm2 save
```

### 3.3 Setup PM2 Startup Script
```bash
pm2 startup systemd -u root --hp /root
```

### 3.4 Verify Application is Running
```bash
pm2 status
pm2 logs cne-app
```

---

## Step 4: Configure Nginx Reverse Proxy

### 4.1 Install Nginx (if not installed)
```bash
apt install -y nginx
```

### 4.2 Create Nginx Configuration
```bash
nano /etc/nginx/sites-available/cne-app
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # File upload size limit (adjust as needed)
        client_max_body_size 50M;
    }
}
```

### 4.3 Enable the Site
```bash
ln -s /etc/nginx/sites-available/cne-app /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

---

## Step 5: Setup SSL with Let's Encrypt

### 5.1 Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 5.2 Obtain SSL Certificate
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 5.3 Auto-renewal (automatic with certbot)
```bash
certbot renew --dry-run  # Test renewal
```

---

## Step 6: Firewall Configuration

```bash
ufw allow 22       # SSH
ufw allow 80       # HTTP
ufw allow 443      # HTTPS
ufw enable
ufw status
```

---

## Useful Commands

### PM2 Commands
```bash
pm2 status              # Check app status
pm2 logs cne-app        # View logs
pm2 restart cne-app     # Restart app
pm2 stop cne-app        # Stop app
pm2 reload cne-app      # Zero-downtime restart
pm2 monit               # Monitor in real-time
```

### Update Application
```bash
cd /var/www/aparna-cne
git pull origin main
npm install --production
pm2 restart cne-app
```

### Backup Database
```bash
cp -r /var/www/aparna-cne/database /root/backups/database-$(date +%Y%m%d)
```

---

## Troubleshooting

### App not starting?
```bash
pm2 logs cne-app --lines 100
```

### Port already in use?
```bash
lsof -i :3000
kill -9 <PID>
```

### Permission issues?
```bash
chown -R www-data:www-data /var/www/aparna-cne
chmod -R 755 /var/www/aparna-cne
```

### Nginx errors?
```bash
nginx -t
tail -f /var/log/nginx/error.log
```

---

## Default Login Credentials

**Admin Panel:** `/admin-login.html`
- Username: `aparnainstitutes`
- Password: (set in .env file)

**Attendance Portal:** `/attendance-login.html`
- Username: `attendance`
- Password: `attendance123`

⚠️ **IMPORTANT:** Change all default passwords after first login!

---

## Support

For issues, check:
1. PM2 logs: `pm2 logs cne-app`
2. Nginx logs: `/var/log/nginx/error.log`
3. App logs: `/var/www/aparna-cne/logs/`
