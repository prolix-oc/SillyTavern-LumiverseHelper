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

if [[ "$MODE" == "deploy" || "$MODE" == "branch" ]]; then
    if [ ! -f "$MANIFEST" ]; then
        echo "Error: $MANIFEST not found!"
        exit 1
    fi
fi

if command -v jq >/dev/null 2>&1; then
    USE_JQ=true
else
    USE_JQ=false
fi

# --- 3. Execute Modes ---

# === MERGE MODE ===
if [ "$MODE" == "merge" ]; then
    echo "--- Merge Mode ---"
    echo "Fetching origin..."
    git fetch origin
    echo "Available branches:"
    git branch --format='%(refname:short)' | grep -v "main"
    echo ""
    read -p "Enter branch name to merge into main: " BRANCH_TO_MERGE

    if [ -z "$BRANCH_TO_MERGE" ]; then echo "Error: Branch name required."; exit 1; fi

    echo "Switching to main and updating..."
    git checkout main
    git pull origin main

    echo "Merging $BRANCH_TO_MERGE into main..."
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
    git log --oneline -n 10
    echo ""
    read -p "Enter Commit Hash to target: " TARGET_HASH
    if [ -z "$TARGET_HASH" ]; then echo "Error: Hash required."; exit 1; fi

    echo ""
    echo "Choose action:"
    echo "  [1] Soft Reset (Keep changes staged)"
    echo "  [2] Hard Reset (DESTROY changes)"
    echo "  [3] Revert     (Safe undo commit)"
    read -n 1 -p "Choice: " R_ACTION
    echo ""

    case "$R_ACTION" in
        1) git reset --soft "$TARGET_HASH" ;;
        2) 
           read -p "Are you sure? (type 'yes'): " CONFIRM
           if [ "$CONFIRM" == "yes" ]; then git reset --hard "$TARGET_HASH"; else echo "Aborted."; exit 0; fi 
           ;;
        3) git revert "$TARGET_HASH" ;;
        *) echo "Invalid choice."; exit 1 ;;
    esac
    exit 0
fi

# === DEPLOY / BRANCH MODE ===

if [ "$MODE" == "branch" ]; then
    echo "--- Create Branch ---"
    read -p "Enter new branch name: " NEW_BRANCH
    if [ -z "$NEW_BRANCH" ]; then echo "Error: Branch name cannot be empty."; exit 1; fi
    git checkout -b "$NEW_BRANCH"
    echo "Switched to branch $NEW_BRANCH"
fi

read -p "Enter commit message: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then echo "Error: Commit message cannot be empty."; exit 1; fi

echo "Select update type:"
echo "  [M]ajor   (X.0.0)"
echo "  [F]eature (x.Y.0)"
echo "  [P]atch   (x.y.Z)"
echo "  [B]eta    (x.y.z-beta.N)"
echo "  [N]one    (No version change)"
read -n 1 -p "Choice: " UPDATE_TYPE
echo ""

# Extract Version
if [ "$USE_JQ" = true ]; then
    CURRENT_VERSION=$(jq -r '.version' "$MANIFEST")
else
    # Sed regex to capture anything inside the quotes to handle -beta tags
    CURRENT_VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$MANIFEST")
fi

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not find valid version in $MANIFEST"
    exit 1
fi

# --- Advanced Version Parsing ---
# Regex to match X.Y.Z and optional -beta.N
# Group 1: Major, 2: Feature, 3: Patch, 5: Beta Number (optional)
REGEX="^([0-9]+)\.([0-9]+)\.([0-9]+)(-beta\.([0-9]+))?$"

if [[ $CURRENT_VERSION =~ $REGEX ]]; then
    V_MAJOR="${BASH_REMATCH[1]}"
    V_FEATURE="${BASH_REMATCH[2]}"
    V_PATCH="${BASH_REMATCH[3]}"
    V_BETA="${BASH_REMATCH[5]}" # This will be empty if not a beta
else
    echo "Error: Current version ($CURRENT_VERSION) does not match SemVer format X.Y.Z or X.Y.Z-beta.N"
    exit 1
fi

SKIP_UPDATE=false

case "$UPDATE_TYPE" in
    [Mm]* ) 
        V_MAJOR=$((V_MAJOR + 1)); V_FEATURE=0; V_PATCH=0; NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_PATCH" 
        ;;
    [Ff]* ) 
        V_FEATURE=$((V_FEATURE + 1)); V_PATCH=0; NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_PATCH" 
        ;;
    [Pp]* ) 
        V_PATCH=$((V_PATCH + 1)); NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_PATCH" 
        ;;
    [Bb]* )
        # Beta Logic
        if [ -z "$V_BETA" ]; then
            # Not currently a beta, start at beta.1 (keeping current numbers)
            NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_PATCH-beta.1"
        else
            # Already a beta, increment the beta number
            NEW_BETA=$((V_BETA + 1))
            NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_PATCH-beta.$NEW_BETA"
        fi
        ;;
    [Nn]* )
        SKIP_UPDATE=true
        NEW_VERSION="$CURRENT_VERSION"
        echo "Skipping version update."
        ;;
    * ) echo "Invalid choice"; exit 1 ;;
esac

# Write Version if not skipping
if [ "$SKIP_UPDATE" = false ]; then
    echo "Bumping version: $CURRENT_VERSION -> $NEW_VERSION"
    if [ "$USE_JQ" = true ]; then
        tmp=$(mktemp)
        jq --arg v "$NEW_VERSION" '.version = $v' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
    else
        sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
        rm "$MANIFEST.bak"
    fi
fi

# Git Operations
echo "Staging and Committing..."
git add .
git commit -m "$COMMIT_MSG"

echo "Pushing..."
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
git push --set-upstream origin "$CURRENT_BRANCH"

if [ "$SKIP_UPDATE" = false ]; then
    echo "Success! Deployed version $NEW_VERSION to $CURRENT_BRANCH."
else
    echo "Success! Changes pushed to $CURRENT_BRANCH (Version remained $CURRENT_VERSION)."
fi
