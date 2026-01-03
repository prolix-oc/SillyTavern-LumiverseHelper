#!/bin/bash

# Ensure the script exits on errors
set -e

# check if manifest.json exists
if [ ! -f "manifest.json" ]; then
    echo "Error: manifest.json not found!"
    exit 1
fi

# 1. Ask for a commit message
read -p "Enter commit message: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    echo "Commit message cannot be empty."
    exit 1
fi

# 2. Ask for the update type
echo "Select update type:"
echo "  [M]ajor   (X.0.0)"
echo "  [F]eature (x.Y.0)"
echo "  [m]inor   (x.y.Z)"
read -n 1 -p "Choice: " UPDATE_TYPE
echo "" # Newline after input

# 3. Extract current version from manifest.json
# Uses sed to capture the string inside "version": "..."
CURRENT_VERSION=$(sed -n 's/.*"version": "\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/p' manifest.json)

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not find a valid version string (x.y.z) in manifest.json"
    exit 1
fi

echo "Current Version: $CURRENT_VERSION"

# Split version into parts (Major.Minor.Patch)
# We use '.' as the delimiter
IFS='.' read -r V_MAJOR V_FEATURE V_MINOR <<< "$CURRENT_VERSION"

# Logic to increment version based on input
case "$UPDATE_TYPE" in
    [Mm]* ) # Major update
        V_MAJOR=$((V_MAJOR + 1))
        V_FEATURE=0
        V_MINOR=0
        ;;
    [Ff]* ) # Feature update (SemVer Minor)
        V_FEATURE=$((V_FEATURE + 1))
        V_MINOR=0
        ;;
    [sS]*|[pP]*|[nN]* ) # Catch-all for small/patch/minor inputs if user types vaguely
        V_MINOR=$((V_MINOR + 1))
        ;;
    * ) # Default to Minor (Patch) update logic if specifically 'm' or anything else
        # The prompt asked for "Minor", which usually maps to the 3rd digit (Patch) in SemVer context
        V_MINOR=$((V_MINOR + 1))
        ;;
esac

NEW_VERSION="$V_MAJOR.$V_FEATURE.$V_MINOR"
echo "New Version:     $NEW_VERSION"

# Update manifest.json
# We use sed to replace the specific line containing the version
# Note: This regex assumes the file is standard JSON format.
sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json
rm manifest.json.bak # Remove backup file created by sed

# 4. Git commands
echo "Staging files..."
git add .

echo "Committing..."
git commit -m "$COMMIT_MSG"

echo "Pushing to remote..."
git push

echo "Success! Deployed version $NEW_VERSION."
