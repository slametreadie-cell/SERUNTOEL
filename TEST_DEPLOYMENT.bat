@echo off
echo 🚀 Vercel Deployment Diagnostic
echo ================================

cd /d "C:\Users\L16100278\Desktop\HERMES WORKSPACE\seruntul-advanced"

echo.
echo 1. Checking git status...
git status

echo.
echo 2. Creating test update...
echo "<!-- Test update at %time% -->" > test_update.html

echo.
echo 3. Committing test change...
git add test_update.html
git commit -m "Test: Verify deployment %date% %time%" 2>nul || echo No changes

echo.
echo 4. Pushing to GitHub...
git push

echo.
echo 5. Checking if push succeeded...
if errorlevel 1 (
  echo ❌ Push failed!
  echo.
  echo Try: git push --force
) else (
  echo ✅ Push successful!
  echo.
  echo Wait 2-3 minutes for Vercel auto-deploy
  echo Then check: https://seruntul-advanced-lime.vercel.app/test_update.html
)

echo.
del test_update.html 2>nul
echo.
pause
