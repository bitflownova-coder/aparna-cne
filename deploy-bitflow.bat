@echo off
echo ============================================
echo Deploying Bitflow Owner Portal
echo ============================================
echo.

echo [1/3] Committing changes to Git...
git add .
git commit -m "Deploy Bitflow Owner Portal" 2>nul
git push origin main
echo ✓ Pushed to GitHub
echo.

echo [2/3] Instructions to deploy on Hostinger:
echo.
echo METHOD 1 - Via CPanel Terminal:
echo   1. Login to Hostinger CPanel
echo   2. Open Terminal
echo   3. Run: cd domains/aparnaine.com/public_html ^&^& git pull origin main ^&^& pm2 restart cne-app
echo.
echo METHOD 2 - Via File Manager:
echo   1. Login to Hostinger CPanel
echo   2. Open File Manager
echo   3. Navigate to domains/aparnaine.com/public_html
echo   4. Click on 'deploy.sh' and run it
echo.

echo [3/3] Access Portal:
echo   URL: https://aparnaine.com/bitflow-login.html
echo   Username: bitflowadmin
echo   Password: sCARFACE@aMISHA@1804
echo.

echo ============================================
echo Deployment preparation complete!
echo Now deploy on Hostinger using one of the methods above.
echo ============================================
pause
