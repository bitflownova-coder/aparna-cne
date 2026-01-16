# Bitflow Portal - Direct Deploy via SSH
# This script will deploy the portal to production server

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Deploying Bitflow Owner Portal to Production" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Try SSH deployment
Write-Host "[1/2] Attempting SSH deployment..." -ForegroundColor Yellow

$sshCommand = "cd domains/aparnaine.com/public_html && git pull origin main && pm2 restart cne-app"

Write-Host "Connecting to production server..." -ForegroundColor Gray

# Try first method
$result = ssh u984810592@srv1005.hstgr.io "$sshCommand" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "First SSH attempt failed. Trying alternate port..." -ForegroundColor Yellow
    
    # Try alternate method
    $result = ssh -p 21098 u984810592@162.214.113.53 "$sshCommand" 2>&1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully deployed to production!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[2/2] Portal is now live!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access the portal at:" -ForegroundColor Cyan
    Write-Host "  URL: https://aparnaine.com/bitflow-login.html" -ForegroundColor White
    Write-Host "  Username: bitflowadmin" -ForegroundColor White
    Write-Host "  Password: sCARFACE@aMISHA@1804" -ForegroundColor White
} else {
    Write-Host "✗ SSH deployment failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please deploy manually via Hostinger CPanel:" -ForegroundColor Yellow
    Write-Host "  1. Login to Hostinger CPanel" -ForegroundColor White
    Write-Host "  2. Open Terminal" -ForegroundColor White
    Write-Host "  3. Run: cd domains/aparnaine.com/public_html && bash deploy.sh" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use File Manager:" -ForegroundColor Yellow
    Write-Host "  1. Go to File Manager in CPanel" -ForegroundColor White
    Write-Host "  2. Navigate to domains/aparnaine.com/public_html" -ForegroundColor White
    Write-Host "  3. Right-click deploy.sh > Execute" -ForegroundColor White
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"
