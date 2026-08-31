import {App, PluginSettingTab, Setting} from "obsidian";
import type GithubSyncPlugin from "./main";

export interface GithubSyncSettings {
	githubRepoUrl: string;
	githubPat: string;
	authorName: string;
	authorEmail: string;
	autoSyncEnabled: boolean;
	autoSyncInterval: number; // in minutes
	ignoredPaths: string;
	lastSyncTime?: number;
}

export const DEFAULT_SETTINGS: GithubSyncSettings = {
	githubRepoUrl: '',
	githubPat: '',
	authorName: '',
	authorEmail: '',
	autoSyncEnabled: false,
	autoSyncInterval: 5,
	ignoredPaths: ''
}

interface SettingDefinition {
	name: string;
	desc: string;
	// Obsidian sets name/desc itself, then treats a truthy return as a teardown callback.
	render: (setting: Setting) => void;
}

interface SettingGroupDefinition {
	type: 'group';
	heading?: string;
	items: SettingDefinition[];
}

export class GithubSyncSettingTab extends PluginSettingTab {
	plugin: GithubSyncPlugin;

	constructor(app: App, plugin: GithubSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// A non-empty return makes Obsidian 1.13+ render the tab from these
	// definitions instead of calling display().
	getSettingDefinitions(): SettingGroupDefinition[] {
		return [
			{
				type: 'group',
				items: [
					{
						name: 'GitHub repository URL',
						desc: 'Full URL to the repository (e.g., https://github.com/user/repo)',
						render: (setting) => {
							setting.addText(text => text
								.setPlaceholder('https://github.com/...')
								.setValue(this.plugin.settings.githubRepoUrl)
								.onChange(async (value) => {
									this.plugin.settings.githubRepoUrl = value;
									await this.plugin.saveSettings();
								}));
						},
					},
					{
						name: 'Personal access token',
						desc: 'A GitHub token with repo permissions',
						render: (setting) => {
							setting.addText(text => {
								text.inputEl.type = 'password';
								text
									.setPlaceholder('Ghp_xxxx')
									.setValue(this.plugin.settings.githubPat)
									.onChange(async (value) => {
										this.plugin.settings.githubPat = value;
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Author name',
						desc: 'Name to use for Git commits',
						render: (setting) => {
							setting.addText(text => text
								.setPlaceholder('Your name')
								.setValue(this.plugin.settings.authorName)
								.onChange(async (value) => {
									this.plugin.settings.authorName = value;
									await this.plugin.saveSettings();
								}));
						},
					},
					{
						name: 'Author email',
						desc: 'Email to use for Git commits',
						render: (setting) => {
							setting.addText(text => text
								.setPlaceholder('Name@example.com')
								.setValue(this.plugin.settings.authorEmail)
								.onChange(async (value) => {
									this.plugin.settings.authorEmail = value;
									await this.plugin.saveSettings();
								}));
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Auto sync',
				items: [
					{
						name: 'Enable auto sync',
						desc: 'Automatically sync your vault at a regular interval.',
						render: (setting) => {
							setting.addToggle(toggle => toggle
								.setValue(this.plugin.settings.autoSyncEnabled)
								.onChange(async (value) => {
									this.plugin.settings.autoSyncEnabled = value;
									await this.plugin.saveSettings();
									this.plugin.restartAutoSync();
								}));
						},
					},
					{
						name: 'Sync interval (minutes)',
						desc: 'How often to auto-sync. Minimum 5 minutes.',
						render: (setting) => {
							setting.addText(text => text
								.setPlaceholder('5')
								.setValue(String(this.plugin.settings.autoSyncInterval))
								.onChange(async (value) => {
									const num = parseInt(value, 10);
									if (!isNaN(num) && num >= 5) {
										this.plugin.settings.autoSyncInterval = num;
										await this.plugin.saveSettings();
										this.plugin.restartAutoSync();
									}
								}));
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Advanced',
				items: [
					{
						name: 'Files to ignore',
						desc: 'One path per line. These will be added to your vault\'s .gitignore file.',
						render: (setting) => {
							setting.addTextArea(text => text
								.setPlaceholder('my-folder/\nlarge-file.pdf\nnode_modules/')
								.setValue(this.plugin.settings.ignoredPaths)
								.onChange(async (value) => {
									this.plugin.settings.ignoredPaths = value;
									await this.plugin.saveSettings();
								}));
						},
					},
				],
			},
		];
	}

	// Used by Obsidian versions that predate the declarative API.
	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		for (const group of this.getSettingDefinitions()) {
			if (group.heading) {
				new Setting(containerEl).setName(group.heading).setHeading();
			}

			for (const item of group.items) {
				const setting = new Setting(containerEl)
					.setName(item.name)
					.setDesc(item.desc);
				item.render(setting);
			}
		}
	}
}
