#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const inquirer = require('inquirer');

// Define paths
const homeDir = require('os').homedir();
const scriptDir = path.join(homeDir, 'bin');
const scriptFile = path.join(scriptDir, 'git-user-fixer');

// Detect the shell being used
const shellType = process.env.SHELL.split('/').pop();

// Map shell type to configuration files
const shellConfigFiles = {
    bash: path.join(homeDir, '.bashrc'),
    zsh: path.join(homeDir, '.zshrc'),
    fish: path.join(homeDir, '.config', 'fish', 'config.fish'),
};

// Determine the appropriate config file based on the shell
const shellConfigFile = shellConfigFiles[shellType] || shellConfigFiles['bash']; // default to .bashrc if unknown

// Git user fixer script content
const gitUserFixerContent = `#!/bin/bash

# This script will rewrite the committer information for a specific commit
# It will replace it with the current git user configuration and propagate the change throughout the commit history

# Ensure a commit hash is provided
if [ -z "$1" ]; then
  echo "Usage: git-user-fixer <commit-hash>"
  exit 1
fi

COMMIT_HASH=$1

# Get current git user details
CURRENT_NAME=$(git config user.name 2>/dev/null)
CURRENT_EMAIL=$(git config user.email 2>/dev/null)

# Ensure the current user information is available
if [ -z "$CURRENT_NAME" ] || [ -z "$CURRENT_EMAIL" ]; then
  echo "Error: Failed to retrieve git user details. Please ensure your git user name and email are configured correctly."
  exit 1
fi

# Get the existing commit author and committer details
EXISTING_NAME=$(git show -s --format='%an' $COMMIT_HASH 2>/dev/null)
EXISTING_EMAIL=$(git show -s --format='%ae' $COMMIT_HASH 2>/dev/null)

# Ensure the commit exists
if [ -z "$EXISTING_NAME" ] || [ -z "$EXISTING_EMAIL" ]; then
  echo "Error: The provided commit hash does not exist or is invalid."
  exit 1
fi

# Check if the existing user is different from the current user
if [ "$EXISTING_NAME" == "$CURRENT_NAME" ] && [ "$EXISTING_EMAIL" == "$CURRENT_EMAIL" ]; then
  echo "The commit already has the current user as the author and committer. No changes needed."
  exit 0
fi

# Confirm with the user before rewriting history
echo "You are about to rewrite the commit history for commit $COMMIT_HASH and all subsequent commits. This can lead to serious issues if the changes have been pushed to a shared repository."
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" && "$CONFIRM" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

# Ask the user if they want to force the operation
read -p "This operation is recommended on a fresh clone. Do you want to proceed with force? (yes/no): " FORCE_CONFIRM
FORCE_FLAG=""
if [[ "$FORCE_CONFIRM" == "yes" || "$FORCE_CONFIRM" == "y" ]]; then
  FORCE_FLAG="--force"
fi

# Rewrite the commit with the new committer information and propagate the change
if ! command -v git-filter-repo &> /dev/null; then
  echo "git-filter-repo is not installed. Please install it for a safer rewrite: https://github.com/newren/git-filter-repo"
  exit 1
fi

git filter-repo $FORCE_FLAG --commit-callback 'if commit.original_id == b"'$COMMIT_HASH'":
    commit.committer_name = b"'$CURRENT_NAME'"
    commit.committer_email = b"'$CURRENT_EMAIL'"
    commit.author_name = b"'$CURRENT_NAME'"
    commit.author_email = b"'$CURRENT_EMAIL'"'

# Inform the user that the operation is complete
echo "Commit $COMMIT_HASH and all subsequent commits updated with current git user: $CURRENT_NAME <$CURRENT_EMAIL>"

# Run garbage collection and reflog expiration to fully remove old references
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Inform the user that the garbage collection is complete
echo "Garbage collection and reflog expiration completed."
`;

// Ensure the `bin` folder exists
if (!fs.existsSync(scriptDir)) {
    shell.mkdir('-p', scriptDir);
}

// Write the script file
fs.writeFileSync(scriptFile, gitUserFixerContent, { mode: 0o755 });
console.log('Script created at ' + scriptFile);

// Add script to the user's path via their shell config file
const exportCommand = 'export PATH="$HOME/bin:$PATH"';
if (!shell.grep(exportCommand, shellConfigFile)) {
    fs.appendFileSync(shellConfigFile, '\n# Add git-user-fixer script to PATH\n' + exportCommand + '\n');
    console.log('Added git-user-fixer to PATH via ' + shellConfigFile);
}

console.log("Installation complete. Source your " + shellConfigFile + " and then you can use the 'git-user-fixer' command.");
