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

		const headerContainer = contentEl.createDiv({ cls: 'sync-modal-header' });

		const titleGroup = headerContainer.createDiv({ cls: 'sync-modal-title-group' });
		titleGroup.createEl('p', { text: 'Git plugin', cls: 'sync-modal-eyebrow' });
		titleGroup.createEl('h2', {
			text: 'Git sync history',
			cls: 'sync-modal-title'
		});

		const syncBtn = headerContainer.createEl('button', { text: 'Sync now', cls: 'mod-cta sync-primary-action' });
		syncBtn.onclick = async () => {
			this.close();
			await this.plugin.runSync();
		};

		const content = contentEl.createDiv({
			cls: 'sync-modal-content'
		});
		
		// Render pending changes and conflicts first so users can act before committing
		await this.renderPendingAndConflicts(content);
		
		await this.renderHistory(content);
	}
	
	private async renderHistory(container: HTMLElement) {
		const lastSyncTime = this.plugin.settings.lastSyncTime;
		const syncStatusDiv = container.createDiv({
			cls: 'sync-status-card'
		});

		const timeText = lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never';
		syncStatusDiv.createEl('h4', {
			text: 'Last successful sync',
			cls: 'sync-status-title'
		});
		syncStatusDiv.createEl('p', {
			text: timeText,
			cls: 'sync-status-time'
		});

		container.createEl('h3', { text: 'Recent sync activity' });
		container.createEl('p', { text: 'Loading history...' });

		try {
			const history = await this.plugin.gitManager.getHistory(20);
			container.lastElementChild?.remove();

			if (history.length === 0) {
				container.createEl('p', { text: 'No sync history found.' });
				return;
			}

			const listEl = container.createEl('ul', {
				cls: 'sync-history-list'
			});

			for (const commit of history) {
				const li = listEl.createEl('li', {
					cls: 'sync-history-item'
				});

				const headerObj = li.createDiv({ cls: 'sync-history-item-header' });

				const dateText = new Date(commit.commit.author.timestamp * 1000).toLocaleString();
				headerObj.createSpan({ text: dateText, cls: 'sync-history-date' });

				const hash = commit.oid.substring(0, 7);
				headerObj.createSpan({
					text: hash,
					cls: 'sync-history-hash'
				});

				li.createEl('div', {
					text: commit.commit.message,
					cls: 'sync-history-message'
				});
			}
		} catch (e) {
			container.lastElementChild?.remove();
			container.createEl('p', { text: 'Error loading history: ' + (e as Error).message });
		}
	}

	private async renderPendingAndConflicts(container: HTMLElement) {
		const pendingSection = container.createDiv({ cls: 'sync-section' });
		pendingSection.createEl('h3', { text: 'Pending changes' });
		const pendingList = pendingSection.createDiv({ cls: 'sync-list' });

		try {
			const pending = await this.plugin.gitManager.getPendingFiles();
			if (pending.length === 0) {
				pendingList.createEl('p', { text: 'No pending changes.' });
			} else {
				for (const file of pending) {
					const row = pendingList.createDiv({ cls: 'sync-file-row' });
					row.createDiv({ text: file, cls: 'sync-file-path' });

					const actions = row.createDiv({ cls: 'sync-file-actions' });
					const saveBtn = actions.createEl('button', { text: 'Save', cls: 'mod-cta sync-save-action' });
					saveBtn.onclick = async () => {
						await this.plugin.gitManager.stageFile(file);
						await this.refreshContent(container);
					};

					const discardBtn = actions.createEl('button', { text: 'Discard', cls: 'sync-discard-action' });
					discardBtn.onclick = async () => {
						const confirmed = await confirmDialog(this.app, `Discard local changes to "${file}"?`);
						if (!confirmed) return;
						await this.plugin.gitManager.discardLocalChanges(file);
						await this.refreshContent(container);
					};

					const openBtn = actions.createEl('button', { text: 'Open', cls: 'sync-secondary-action' });
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
		const conflictsSection = container.createDiv({ cls: 'sync-section' });
		conflictsSection.createEl('h3', { text: 'Conflicted files' });
		const conflictsList = conflictsSection.createDiv({ cls: 'sync-list' });

		try {
			const copies = await this.plugin.gitManager.getConflictCopies();
			if (copies.length === 0) {
				conflictsList.createEl('p', { text: 'No conflicts detected.' });
			} else {
				for (const p of copies) {
					const row = conflictsList.createDiv({ cls: 'sync-file-row conflict-row' });
					const info = row.createDiv({ cls: 'sync-conflict-info' });
					info.createDiv({ text: `Original: ${p.original}` });
					info.createDiv({ text: `Remote copy: ${p.copy}`, cls: 'sync-conflict-copy' });

					const actions = row.createDiv({ cls: 'sync-file-actions' });
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

					const openOrig = actions.createEl('button', { text: 'Open local', cls: 'sync-secondary-action' });
					openOrig.onclick = async () => {
						const af = this.app.vault.getAbstractFileByPath(p.original);
						if (af instanceof TFile) await this.app.workspace.getLeaf().openFile(af);
						else new Notice('File not found: ' + p.original);
					};

					const openCopy = actions.createEl('button', { text: 'Open remote copy', cls: 'sync-secondary-action' });
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
		const btnRow = modal.contentEl.createDiv({ cls: 'sync-confirm-actions' });
		const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => { modal.close(); resolve(false); };
		const confirmBtn = btnRow.createEl('button', { text: 'Confirm', cls: 'mod-warning' });
		confirmBtn.onclick = () => { modal.close(); resolve(true); };
		modal.open();
	});
}
