@echo off
echo 🔍 Vercel Blocked - Status Check
echo ================================

echo.
echo 1. CHECKING VERCEL STATUS PAGE...
echo Opening: https://vercel-status.com
start https://vercel-status.com

echo.
echo 2. CHECKING GITHUB DEPLOYMENT...
echo Repository: https://github.com/slametreadie-cell/SERUNTUL
start https://github.com/slametreadie-cell/SERUNTUL

echo.
echo 3. CHECKING ALTERNATIVE URLS...
echo.
echo Current: https://seruntul-advanced-lime.vercel.app
echo Supabase: https://mjsetrszcgjohsewaevf.supabase.co

echo.
echo 4. LOCAL DEVELOPMENT OPTION...
echo.
echo You can develop locally while waiting:
echo cd "C:\Users\L16100278\Desktop\HERMES WORKSPACE\seruntul-advanced"
echo npm install
echo npm run dev
echo.
echo Then open: http://localhost:3000

echo.
echo ================================
echo RECOMMENDATION:
echo.
echo 1. Wait 15 minutes
echo 2. Check Vercel status page
echo 3. Try redeploy
echo 4. Or create new project
echo.
pause
