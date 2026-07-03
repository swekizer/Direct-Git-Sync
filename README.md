# Direct Git Sync

Direct Git Sync keeps your vault synced with a private Git repository on desktop and mobile without requiring a native Git installation.

It uses `isomorphic-git` for repository operations and native HTTP requests inside Obsidian so the same workflow can run across platforms.

## Features

- Complete sync flow in one action: stage, commit, fetch, merge, and push.
- Works on desktop and mobile.
- No separate Git installation required.
- Sync status modal for pending changes and recent history.
- Optional auto-sync interval.
- Connection validation before sync starts.
- Local-first conflict handling that preserves the local file and saves the remote version as a separate copy.

## Setup

1. Create a private Git repository on GitHub or another HTTP-accessible Git host.
2. Generate a personal access token with access to that repository.
3. Install and enable `Direct Git Sync` in Obsidian.
4. Open the plugin settings and enter your repository URL, personal access token, author name, and author email.
5. Optionally configure auto-sync and extra ignore rules.

## Usage

- Use the ribbon icon to start a manual sync.
- Use the command palette action `Direct Git Sync: Show pending changes` to inspect pending files and sync history.
- Enable auto-sync in settings to run background sync on an interval.

## Notes

- Authentication currently supports personal access tokens over HTTP.
- SSH keys are not supported.
- The token is stored in the plugin data file inside your vault, so keep your vault and backups private.
- The plugin automatically ignores its own `data.json`, workspace files, and `.trash/`.
