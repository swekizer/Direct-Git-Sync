# Direct Git Sync

Sync your Obsidian vault directly with a private GitHub repository on desktop and mobile.

End to end: open Settings, add your repository URL and token, save, and sync.

Direct Git Sync is built for people who want simple Git-based vault sync without installing Git on every device. It uses `isomorphic-git` for repository operations and Obsidian-friendly HTTP requests so the same flow can work inside desktop and mobile Obsidian.

## Why

Obsidian Sync is great when you want the official full-vault sync experience. Direct Git Sync is for the case where you want your vault backed by a GitHub repository instead:

- private notes backed up to GitHub
- a vault shared across desktop and mobile
- version history through Git commits
- a portable setup that does not require the Git CLI inside Obsidian

The plugin keeps the workflow intentionally small:

- enter a repository URL
- enter a personal access token
- sync from the ribbon button or on an interval

## What it does

- Complete sync flow in one action: stage, commit, fetch, merge, and push.
- Works on desktop and mobile.
- No separate Git installation required.
- Verifies your repository and token before sync starts.
- Supports automatic interval-based sync.
- Shows the last successful sync time and recent sync history in a dedicated modal.
- Handles merge conflicts by keeping the local file and saving the remote version as a separate conflict copy.

## Install

### From inside Obsidian

1. Open `Settings -> Community plugins -> Browse`.
2. Search for `Direct Git Sync`.
3. Click `Install`, then `Enable`.

![Screenshot placeholder: plugin search in Obsidian community plugins](docs/images/install-plugin-search.png)
Caption: Search for `Direct Git Sync` in Obsidian's Community Plugins browser, then install and enable it.

### Manual install

Download these files from the latest GitHub release into:

```text
<your vault>/.obsidian/plugins/direct-git-sync/
```

Files required:

- `main.js`
- `manifest.json`
- `styles.css`

Then enable the plugin in `Settings -> Community plugins`.

![Screenshot placeholder: GitHub release assets](docs/images/release-assets.png)
Caption: The GitHub release should include `main.js`, `manifest.json`, and `styles.css` for manual installation.

## Setup

### 1. Create a repository

Create a private GitHub repository for your vault. A typical URL looks like:

```text
https://github.com/your-username/your-repo.git
```

![Screenshot placeholder: GitHub repository URL](docs/images/github-repo-url.png)
Caption: Copy your repository URL from GitHub. This is the value you will paste into the plugin settings.

### 2. Create a personal access token

Create a GitHub token that can read and write the repository.

For a classic token, the `repo` scope is enough.

![Screenshot placeholder: GitHub personal access token setup](docs/images/github-token.png)
Caption: Create a GitHub personal access token with repository access, then copy it before leaving the page.

### 3. Configure the plugin

Open `Settings -> Direct Git Sync` and fill in:

- `GitHub repository URL`
- `Personal access token`
- `Author name`
- `Author email`

You can also enable auto-sync and add extra ignore rules there.

![Screenshot placeholder: Direct Git Sync settings](docs/images/plugin-settings.png)
Caption: Paste your repository URL and token into Direct Git Sync settings, then save your author details and optional sync preferences.

## How sync works

Each sync run follows the same sequence:

1. Verify repository access and credentials.
2. Initialize the local Git state if needed.
3. Stage all local changes that are not ignored.
4. Create a commit if there is anything new to save.
5. Fetch the latest remote changes.
6. Merge remote changes into the local vault.
7. Push the final result back to GitHub.

On first-time setup, if the remote already contains files that would overwrite local files, the plugin creates local backup copies before checkout.

![Screenshot placeholder: sync in progress or success notice](docs/images/sync-notice.png)
Caption: A sync run verifies the repository, stages local changes, fetches remote updates, merges them, and pushes the final result.

## Conflicts

If the same file changed locally and remotely, the plugin does not discard your local work.

Instead it:

- keeps your local version in place
- writes the remote version as a separate file
- commits the conflict result so the vault stays in a usable state

This is a local-first conflict strategy designed to avoid silent data loss.

## History

The plugin includes a sync history modal with:

- the last successful sync time
- recent sync commit messages
- short commit hashes for quick reference

Open it from the command palette:

```text
Direct Git Sync: Show sync history
```

![Screenshot placeholder: sync history modal](docs/images/sync-history.png)
Caption: The sync history modal shows the last successful sync time along with recent sync commits and short hashes.

## Auto sync

You can enable automatic sync in settings and choose an interval in minutes.

When enabled, the plugin periodically runs the same sync flow in the background.

![Screenshot placeholder: auto sync setting](docs/images/auto-sync.png)
Caption: Turn on auto-sync in settings to run Direct Git Sync on a recurring interval.

## Ignored files

The plugin automatically ignores a few vault-local paths such as workspace state and its own `data.json`.

You can add your own ignore rules in plugin settings, one path per line. These are written into the vault `.gitignore`.

![Screenshot placeholder: ignored paths setting](docs/images/ignored-paths.png)
Caption: Add extra ignored paths here when you do not want certain vault files or plugin folders committed to Git.

## Security and storage

- Authentication currently uses GitHub personal access tokens over HTTP.
- SSH keys are not supported.
- The token is stored in the plugin data file inside your vault.
- The plugin automatically ignores its own `data.json` so the token is not supposed to be committed by the plugin itself.

Because the token is stored locally, keep your vault and backups private.

## Limitations

- GitHub is the current target workflow described by this plugin.
- Authentication uses HTTP tokens, not SSH.
- Large or frequently changing files inside `.obsidian` may create noisy Git history if you choose to track them.
- Conflict handling is intentionally simple: local wins, remote is preserved as a separate copy.

## Build from source

```bash
npm install
npm run build
```

For development with automatic rebuilds:

```bash
npm run dev
```

The bundled plugin output is `main.js`.

## License

`0BSD`
