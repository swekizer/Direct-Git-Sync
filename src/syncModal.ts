import { App, Modal } from 'obsidian';
import GithubSyncPlugin from './main';

export class SyncModal extends Modal {
	plugin: GithubSyncPlugin;

	constructor(app: App, plugin: GithubSyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('github-sync-modal');

		const headerContainer = contentEl.createDiv({
			cls: 'sync-modal-header',
			attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;' }
		});

		headerContainer.createEl('h2', {
			text: 'Git sync history',
			cls: 'sync-modal-title',
			attr: { style: 'margin: 0;' }
		});

		const syncBtn = headerContainer.createEl('button', { text: 'Sync now', cls: 'mod-cta' });
		syncBtn.onclick = async () => {
			this.close();
			await this.plugin.runSync();
		};

		const content = contentEl.createDiv({
			cls: 'sync-modal-content',
			attr: { style: 'max-height: 60vh; overflow-y: auto; padding-right: 10px;' }
		});

		await this.renderHistory(content);
	}

	private async renderHistory(container: HTMLElement) {
		const lastSyncTime = this.plugin.settings.lastSyncTime;
		const syncStatusDiv = container.createDiv({
			attr: { style: 'padding: 1rem; background-color: var(--background-secondary); border-radius: 8px; margin-bottom: 1rem;' }
		});

		const timeText = lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never';
		syncStatusDiv.createEl('h4', {
			text: 'Last successful sync',
			attr: { style: 'margin-top: 0; margin-bottom: 0.5rem;' }
		});
		syncStatusDiv.createEl('p', {
			text: timeText,
			attr: { style: 'margin: 0; color: var(--text-muted);' }
		});

		container.createEl('h3', { text: 'Recent sync activity', attr: { style: 'margin-bottom: 1rem;' } });
		container.createEl('p', { text: 'Loading history...' });

		try {
			const history = await this.plugin.gitManager.getHistory(20);
			container.lastElementChild?.remove();

			if (history.length === 0) {
				container.createEl('p', { text: 'No sync history found.' });
				return;
			}

			const listEl = container.createEl('ul', {
				attr: { style: 'list-style-type: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;' }
			});

			for (const commit of history) {
				const li = listEl.createEl('li', {
					attr: { style: 'padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background-color: var(--background-primary);' }
				});

				const headerObj = li.createDiv({ attr: { style: 'display: flex; justify-content: space-between; margin-bottom: 4px;' } });

				const dateText = new Date(commit.commit.author.timestamp * 1000).toLocaleString();
				headerObj.createSpan({ text: dateText, attr: { style: 'font-weight: 500; font-size: 0.9em;' } });

				const hash = commit.oid.substring(0, 7);
				headerObj.createSpan({
					text: hash,
					attr: { style: 'font-family: var(--font-monospace); font-size: 0.8em; color: var(--text-muted);' }
				});

				li.createEl('div', {
					text: commit.commit.message,
					attr: { style: 'font-size: 0.9em; color: var(--text-normal); white-space: pre-wrap;' }
				});
			}
		} catch (e) {
			container.lastElementChild?.remove();
			container.createEl('p', { text: 'Error loading history: ' + (e as Error).message });
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
