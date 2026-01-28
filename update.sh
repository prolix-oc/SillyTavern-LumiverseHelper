#!/bin/bash

# Ensure the script exits on errors
set -e

MANIFEST="manifest.json"

# --- Helper Functions ---

function print_usage {
    echo "Usage: ./deploy.sh [OPTIONS]"
    echo "Options:"
    echo "  -b, --branch   Create a new branch before bumping version"
    echo "  -m, --merge    Merge a specific branch into main"
    echo "  -r, --reset    Reset or Revert to a specific commit"
    echo "  (No args)      Standard version bump, commit, and push"
}

# --- 1. Parse Arguments ---

MODE="deploy" # Default mode
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -b|--branch) MODE="branch" ;;
        -m|--merge)  MODE="merge" ;;
        -r|--reset)  MODE="reset" ;;
        -h|--help)   print_usage; exit 0 ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# --- 2. Dependency Checks ---

# Check if manifest.json exists (only needed for deploy/branch modes)
if [[ "$MODE" == "deploy" || "$MODE" == "branch" ]]; then
    if [ ! -f "$MANIFEST" ]; then
        echo "Error: $MANIFEST not found!"
        exit 1
    fi
fi

# Check for jq availability
if command -v jq >/dev/null 2>&1; then
    USE_JQ=true
else
    USE_JQ=false
fi

# --- 3. Execute Modes ---

# === MERGE MODE ===
if [ "$MODE" == "merge" ]; then
    echo "--- Merge Mode ---"
    
    # Ensure we have the latest
    echo "Fetching origin..."
    git fetch origin

    # List local branches excluding main
    echo "Available branches:"
    git branch --format='%(refname:short)' | grep -v "main"
    
    echo ""
    read -p "Enter branch name to merge into main: " BRANCH_TO_MERGE

    if [ -z "$BRANCH_TO_MERGE" ]; then
        echo "Error: Branch name required."
        exit 1
    fi

    # Switch to main, pull, and merge
    echo "Switching to main and updating..."
    git checkout main
    git pull origin main

    echo "Merging $BRANCH_TO_MERGE into main..."
    # We use --no-commit so the user can verify, or remove it to auto-commit
    git merge --no-ff "$BRANCH_TO_MERGE" -m "Merge branch '$BRANCH_TO_MERGE'"

    echo "Merge successful (locally)."
    read -p "Push to remote main? (y/n): " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
        git push origin main
        echo "Pushed to main."
    else
        echo "Changes merged locally but NOT pushed."
    fi
    exit 0
fi

# === RESET MODE ===
if [ "$MODE" == "reset" ]; then
    echo "--- Reset/Revert Mode ---"
    
    echo "Last 10 commits:"
    git log --oneline -n 10
    echo ""
    
    read -p "Enter Commit Hash to target: " TARGET_HASH
    if [ -z "$TARGET_HASH" ]; then
        echo "Error: Hash required."
        exit 1
    fi

    echo ""
    echo "Choose action:"
    echo "  [1] Soft Reset (Move HEAD to commit, keep changes staged)"
    echo "  [2] Hard Reset (Move HEAD to commit, DESTROY changes)"
    echo "  [3] Revert     (Create NEW commit undoing changes - Safe)"
    read -n 1 -p "Choice: " R_ACTION
    echo ""

    case "$R_ACTION" in
        1)
            git reset --soft "$TARGET_HASH"
            echo "Soft reset complete."
            ;;
        2)
            read -p "Are you sure? This deletes data. (type 'yes'): " CONFIRM
            if [ "$CONFIRM" == "yes" ]; then
                git reset --hard "$TARGET_HASH"
                echo "Hard reset complete."
            else
                echo "Aborted."
            fi
            ;;
        3)
            git revert "$TARGET_HASH"
            echo "Revert commit created."
            ;;
        *)
            echo "Invalid choice."
            exit 1
            ;;
    esac
    exit 0
fi

# === DEPLOY / BRANCH MODE ===

# If -b was passed, create branch first
if [ "$MODE" == "branch" ]; then
    echo "--- Create Branch ---"
    read -p "Enter new branch name: " NEW_BRANCH
    if [ -z "$NEW_BRANCH" ]; then
        echo "Error: Branch name cannot be empty."
        exit 1
    fi
    git checkout -b "$NEW_BRANCH"
    echo "Switched to branch $NEW_BRANCH"
fi

# Standard Version Bump Logic
read -p "Enter commit message: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    echo "Error: Commit message cannot be empty."
    exit 1
fi

echo "Select update type:"
echo "  [M]ajor   (X.0.0)"
echo "  [F]eature (x.Y.0)"
echo "  [P]atch   (x.y.Z)"
read -n 1 -p "Choice: " UPDATE_TYPE
echo ""

# Extract Version
if [ "$USE_JQ" = true ]; then
    CURRENT_VERSION=$(jq -r '.version' "$MANIFEST")
else
    CURRENT_VERSION=$(sed -n 's/.*"version": "\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/p' "$MANIFEST")
fi

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not find valid version in $MANIFEST"
    exit 1
fi

IFS='.' read -r V_MAJOR V_FEATURE V_MINOR <<< "$CURRENT_VERSION"

case "$UPDATE_TYPE" in
    [Mm]* ) V_MAJOR=$((V_MAJOR + 1)); V_FEATURE=0; V_MINOR=0 ;;
    [Ff]* ) V_FEATURE=$((V_FEATURE + 1)); V_MINOR=0 ;;
    [Pp]* ) V_MINOR=$((V_MINOR + 1)) ;;
    * ) echo "Invalid choice"; exit 1 ;;
esac

NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_MINOR"
echo "Bumping version: $CURRENT_VERSION -> $NEW_VERSION"

# Write Version
if [ "$USE_JQ" = true ]; then
    tmp=$(mktemp)
    jq --arg v "$NEW_VERSION" '.version = $v' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
else
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
    rm "$MANIFEST.bak"
fi

# Git Operations
echo "Staging and Committing..."
git add .
git commit -m "$COMMIT_MSG"

echo "Pushing..."
# Get current branch name dynamically
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

# If we are on a new branch (or standard main), set upstream just in case
git push --set-upstream origin "$CURRENT_BRANCH"

echo "Success! Deployed version $NEW_VERSION to $CURRENT_BRANCH."
