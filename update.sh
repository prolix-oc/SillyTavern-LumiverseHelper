#!/bin/bash

# Ensure the script exits on errors
set -e

MANIFEST="manifest.json"

# Check if manifest.json exists
if [ ! -f "$MANIFEST" ]; then
    echo "Error: $MANIFEST not found!"
    exit 1
fi

# Check for jq availability
if command -v jq >/dev/null 2>&1; then
    USE_JQ=true
else
    USE_JQ=false
    echo "Notice: 'jq' not found. Falling back to 'sed' for file editing."
fi

# 1. Ask for a commit message
read -p "Enter commit message: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    echo "Error: Commit message cannot be empty."
    exit 1
fi

# 2. Ask for the update type
# We use [P]atch for the 3rd digit to avoid collision with [M]ajor
echo "Select update type:"
echo "  [M]ajor   (X.0.0)"
echo "  [F]eature (x.Y.0)"
echo "  [P]atch   (x.y.Z) - (Minor update)"
read -n 1 -p "Choice: " UPDATE_TYPE
echo "" # Newline after input

# 3. Extract current version
if [ "$USE_JQ" = true ]; then
    CURRENT_VERSION=$(jq -r '.version' "$MANIFEST")
else
    # Fallback: Uses sed to capture the string inside "version": "..."
    CURRENT_VERSION=$(sed -n 's/.*"version": "\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/p' "$MANIFEST")
fi

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not find a valid version string (x.y.z) in $MANIFEST"
    exit 1
fi

echo "Current Version: $CURRENT_VERSION"

# Split version into parts (Major.Feature.Minor)
IFS='.' read -r V_MAJOR V_FEATURE V_MINOR <<< "$CURRENT_VERSION"

# Logic to increment version based on input
case "$UPDATE_TYPE" in
    [Mm]* ) # Major
        V_MAJOR=$((V_MAJOR + 1))
        V_FEATURE=0
        V_MINOR=0
        ;;
    [Ff]* ) # Feature
        V_FEATURE=$((V_FEATURE + 1))
        V_MINOR=0
        ;;
    [Pp]* ) # Patch (User's "Minor" increment)
        V_MINOR=$((V_MINOR + 1))
        ;;
    * ) 
        echo "Invalid choice. Aborting."
        exit 1
        ;;
esac

NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_MINOR"
echo "New Version:     $NEW_VERSION"

# Write the new version to manifest.json
if [ "$USE_JQ" = true ]; then
    # Use jq to update the file safely
    # We write to a temp file first, then move it back
    tmp=$(mktemp)
    jq --arg v "$NEW_VERSION" '.version = $v' "$MANIFEST" > "$tmp" && mv "$tmp" "$MANIFEST"
else
    # Fallback: Use sed to replace the specific line
    # -i.bak creates a backup to ensure compatibility with both GNU and BSD/MacOS sed
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
    rm "$MANIFEST.bak" # Remove the backup file
fi

# 4. Git commands
echo "Staging files..."
git add .

echo "Committing..."
git commit -m "$COMMIT_MSG"

echo "Pushing to remote..."
git push

echo "Success! Deployed version $NEW_VERSION."
