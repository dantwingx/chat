# Git Push Instructions

## Step 1: Create a GitHub Repository
1. Go to https://github.com/new
2. Name your repository (e.g., "multi-user-chat")
3. Choose public or private
4. Don't initialize with README (we already have one)
5. Click "Create repository"

## Step 2: Add Remote Origin
After creating the repository, GitHub will show you commands. Use these:

```bash
# Replace YOUR_USERNAME with your GitHub username
# Replace YOUR_REPO_NAME with your repository name
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Or if using SSH:
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

## Step 3: Push to GitHub
```bash
# Push to the main branch
git push -u origin main
```

## Alternative: If you want to rename branch to 'main'
```bash
# GitHub now uses 'main' as default branch name
git branch -M main
git push -u origin main
```

## Example Commands:
```bash
# For HTTPS:
git remote add origin https://github.com/yourusername/multi-user-chat.git
git branch -M main
git push -u origin main

# For SSH:
git remote add origin git@github.com:yourusername/multi-user-chat.git
git branch -M main
git push -u origin main
```

## After First Push:
Future pushes will be simpler:
```bash
git add .
git commit -m "Your commit message"
git push
```