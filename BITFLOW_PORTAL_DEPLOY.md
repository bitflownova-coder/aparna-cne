# Bitflow Owner Portal Deployment Guide

## What's New?
Created a comprehensive audit logging portal for Bitflow owners to monitor all system changes.

### New Features:
1. **Bitflow Owner Login** - Dedicated login page at `/bitflow-login.html`
2. **Audit Dashboard** - Complete system activity monitoring at `/bitflow-portal.html`
3. **Advanced Filtering** - Filter logs by action, entity, user, date range
4. **Detailed View** - Click any log to see complete JSON details
5. **Real-time Stats** - Total logs, today's activity, active users, last activity
6. **Auto-refresh** - Dashboard auto-refreshes every 30 seconds

## Admin Credentials
- **Username:** `bitflowadmin`
- **Password:** `sCARFACE@aMISHA@1804`
- **Access:** Full system audit trail

## Deployment Steps

### Option 1: Via Terminal (SSH)
```bash
ssh -p 21098 u984810592@162.214.113.53
cd domains/aparnaine.com/public_html
bash deploy.sh
```

### Option 2: Via Hostinger CPanel File Manager
1. Login to Hostinger CPanel
2. Open File Manager
3. Navigate to `domains/aparnaine.com/public_html`
4. Find and click on `deploy.sh` file
5. Click "Edit" and save (to trigger modification)
6. Open Terminal in CPanel
7. Run: `cd domains/aparnaine.com/public_html && bash deploy.sh`

### Option 3: Manual Git Pull
1. Login to Hostinger CPanel Terminal
2. Run:
```bash
cd domains/aparnaine.com/public_html
git pull origin main
pm2 restart cne-app
```

## How to Access

1. Go to: `https://aparnaine.com/bitflow-login.html`
2. Login with credentials above
3. View comprehensive audit logs
4. Filter by action type, entity, user, or date
5. Click any row to see full details

## What Gets Logged

The system now logs ALL changes including:
- Workshop creation, updates, deletion
- Student registration creation, updates
- User management activities
- Attendance marking
- Bulk upload operations
- Admin actions
- And more...

Each log contains:
- **Action Type:** CREATE, UPDATE, DELETE, VIEW, LOGIN
- **Entity Type:** workshop, registration, student, user, attendance
- **User Details:** Who made the change (name, role, ID)
- **Timestamp:** Exact date and time
- **IP Address:** Where the change was made from
- **Full Details:** Complete before/after values in JSON format

## Files Modified/Created

### New Files:
- `public/bitflow-login.html` - Login page for Bitflow owners
- `public/bitflow-portal.html` - Main audit log dashboard
- `database/create-bitflow-admin.sql` - SQL script to create admin user

### Modified Files:
- `routes/admin.js` - Added audit log API endpoints
- `database/mysql-db.js` - Added `getAll()` and `getById()` methods to AuditLog

## API Endpoints

### GET /api/admin/audit-logs
Get all logs with optional filters:
- `?action=CREATE` - Filter by action type
- `?entityType=workshop` - Filter by entity
- `?userId=USR123` - Filter by user
- `?dateFrom=2026-01-01` - Filter from date
- `?dateTo=2026-01-31` - Filter to date

### GET /api/admin/audit-logs/:id
Get specific log by ID with full details

## Security

- Only `bitflowadmin` user can access the portal
- All other users will get "Access denied" error
- Session-based authentication required
- Auto-redirects to login if not authenticated

## Next Steps

After deployment:
1. Test login at https://aparnaine.com/bitflow-login.html
2. Verify audit logs are displaying
3. Test filters and detail view
4. Confirm all recent activities are being logged

## Support

If you encounter any issues:
1. Check PM2 logs: `pm2 logs cne-app`
2. Verify database connection
3. Ensure all files are deployed
4. Restart server: `pm2 restart cne-app`
