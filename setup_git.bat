@echo off
echo 🚀 Git Setup for Seruntul Advanced
echo ==========================================

echo Step 1: Initialize Git Repository
if exist ".git" (
    echo ✓ Git repository already initialized
) else (
    git init
    echo ✓ Git repository initialized
)

echo.
echo Step 2: Add all files
git add .
echo ✓ All files added to staging

echo.
echo Step 3: Create initial commit
git commit -m "Initial commit: Seruntul Advanced v1.0"
echo ✓ Initial commit created

echo.
echo Step 4: Add GitHub remote
git remote add origin https://github.com/slametreadie-cell/SERUNTUL.git
echo ✓ GitHub remote added

echo.
echo Step 5: Push to GitHub
echo Note: If repository exists with different content, you may need to force push.
echo Choose one:
echo 1. Standard push ^(if empty repo^): git push -u origin main
echo 2. Force push ^(if conflicts^): git push -u origin main --force
echo.
echo Warning: Force push will overwrite existing content!

echo.
echo Step 6: Verify setup
echo Check repository at: https://github.com/slametreadie-cell/SERUNTUL

pause
