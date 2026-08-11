import { App, Modal, Notice, TFile } from 'obsidian';
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
		
		// Render pending changes and conflicts first so users can act before committing
		await this.renderPendingAndConflicts(content);
		
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

	private async renderPendingAndConflicts(container: HTMLElement) {
		const pendingSection = container.createDiv({ attr: { style: 'margin-bottom: 1rem;' } });
		pendingSection.createEl('h3', { text: 'Pending changes', attr: { style: 'margin-bottom: 0.5rem;' } });
		const pendingList = pendingSection.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 6px;' } });

		try {
			const pending = await this.plugin.gitManager.getPendingFiles();
			if (pending.length === 0) {
				pendingList.createEl('p', { text: 'No pending changes.' });
			} else {
				for (const file of pending) {
					const row = pendingList.createDiv({ cls: 'sync-file-row' });
					row.createDiv({ text: file, attr: { style: 'flex: 1; word-break: break-all;' } });

					const actions = row.createDiv({ attr: { style: 'display:flex; gap: 6px; align-items: center;' } });
					const stageBtn = actions.createEl('button', { text: 'Stage', cls: 'mod-cta' });
					stageBtn.onclick = async () => {
						await this.plugin.gitManager.stageFile(file);
						await this.refreshContent(container);
					};

					const discardBtn = actions.createEl('button', { text: 'Discard', cls: 'mod-warning' });
					discardBtn.onclick = async () => {
						const confirmed = await confirmDialog(this.app, `Discard local changes to "${file}"?`);
						if (!confirmed) return;
						await this.plugin.gitManager.discardLocalChanges(file);
						await this.refreshContent(container);
					};

					const openBtn = actions.createEl('button', { text: 'Open' });
					openBtn.onclick = async () => {
						const af = this.app.vault.getAbstractFileByPath(file);
						if (af instanceof TFile) {
							// open in new leaf
							await this.app.workspace.getLeaf().openFile(af);
						} else {
							new Notice('File not found in vault: ' + file);
						}
					};
				}
			}
		} catch (e) {
			pendingList.createEl('p', { text: 'Error loading pending files: ' + (e as Error).message });
		}

		// Conflicts
		const conflictsSection = container.createDiv({ attr: { style: 'margin-bottom: 1rem;' } });
		conflictsSection.createEl('h3', { text: 'Conflicted files', attr: { style: 'margin-bottom: 0.5rem;' } });
		const conflictsList = conflictsSection.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 6px;' } });

		try {
			const copies = await this.plugin.gitManager.getConflictCopies();
			if (copies.length === 0) {
				conflictsList.createEl('p', { text: 'No conflicts detected.' });
			} else {
				for (const p of copies) {
					const row = conflictsList.createDiv({ cls: 'sync-file-row conflict-row' });
					const info = row.createDiv({ attr: { style: 'flex: 1; display:flex; flex-direction: column; gap:4px;' } });
					info.createDiv({ text: `Original: ${p.original}` });
					info.createDiv({ text: `Remote copy: ${p.copy}`, attr: { style: 'color: var(--text-muted); font-size: 0.9em;' } });

					const actions = row.createDiv({ attr: { style: 'display:flex; gap: 6px; align-items: center;' } });
					const acceptLocal = actions.createEl('button', { text: 'Keep local', cls: 'mod-cta' });
					acceptLocal.onclick = async () => {
						await this.plugin.gitManager.stageFile(p.original);
						await this.plugin.gitManager.removeConflictCopy(p.copy);
						await this.refreshContent(container);
					};

					const acceptRemote = actions.createEl('button', { text: 'Use remote', cls: 'mod-danger' });
					acceptRemote.onclick = async () => {
						const confirmed = await confirmDialog(this.app, `Replace local "${p.original}" with remote version?`);
						if (!confirmed) return;
						await this.plugin.gitManager.acceptRemoteCopy(p.original, p.copy);
						await this.refreshContent(container);
					};

					const openOrig = actions.createEl('button', { text: 'Open local' });
					openOrig.onclick = async () => {
						const af = this.app.vault.getAbstractFileByPath(p.original);
						if (af instanceof TFile) await this.app.workspace.getLeaf().openFile(af);
						else new Notice('File not found: ' + p.original);
					};

					const openCopy = actions.createEl('button', { text: 'Open remote copy' });
					openCopy.onclick = async () => {
						const af = this.app.vault.getAbstractFileByPath(p.copy);
						if (af instanceof TFile) await this.app.workspace.getLeaf().openFile(af);
						else new Notice('File not found: ' + p.copy);
					};
				}
			}
		} catch (e) {
			conflictsList.createEl('p', { text: 'Error loading conflicts: ' + (e as Error).message });
		}
	}

	private async refreshContent(container: HTMLElement) {
		// Remove all children and re-render pending/conflicts + history
		container.empty();
		await this.renderPendingAndConflicts(container);
		await this.renderHistory(container);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/** Shows a modal confirmation dialog and resolves to true if the user confirms. */
function confirmDialog(app: App, message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.contentEl.createEl('p', { text: message });
		const btnRow = modal.contentEl.createDiv({ attr: { style: 'display:flex; gap:8px; justify-content:flex-end; margin-top:1rem;' } });
		const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => { modal.close(); resolve(false); };
		const confirmBtn = btnRow.createEl('button', { text: 'Confirm', cls: 'mod-warning' });
		confirmBtn.onclick = () => { modal.close(); resolve(true); };
		modal.open();
	});
}
