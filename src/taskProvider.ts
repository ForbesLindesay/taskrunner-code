import {join} from 'path'
import * as vscode from 'vscode';

export class TaskTreeDataProvider implements vscode.TreeDataProvider<TreeTask | TreeGroup> {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeTask | null> = new vscode.EventEmitter<TreeTask | null>();
	readonly onDidChangeTreeData: vscode.Event<TreeTask | null> = this._onDidChangeTreeData.event;

	private _source: string;
	private _prefix: string;
	private _separator: RegExp;
	private _autoExpandLimit: number;
	constructor(private context: vscode.ExtensionContext) {
		this._source = vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('source', '*');
		this._prefix = vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('prefix', '');
		this._separator = new RegExp(`(${vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('separator', `:| - |\\/|\\\\`)})`);
		this._autoExpandLimit = vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('auto-expand-limit', 5);
		vscode.tasks.onDidStartTask(() => {
			this._onDidChangeTreeData.fire();
		});
		vscode.tasks.onDidEndTask(() => {
			this._onDidChangeTreeData.fire();
		});
		vscode.workspace.onDidChangeConfiguration(() => {
			this.refresh()
		})
	}

	refresh(): void {
		this._source = vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('source', '*');
		this._prefix = vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('prefix', '');
		this._separator = new RegExp(`(${vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('separator', `:| - |\\/|\\\\`)})`);
		this._autoExpandLimit = vscode.workspace.getConfiguration('forbeslindesay-taskrunner').get('auto-expand-limit', 5);
		this._onDidChangeTreeData.fire();
	}

	private async _getChildren(index: number, tasks: readonly NamedTask[]): Promise<(TreeTask | TreeGroup)[]> {
		const outputTasks: TreeTask[] = [];
		const foldersByName = new Map<string, NamedTask[]>()
		for (const t of tasks) {
			if (t.name.length < index + 2) {
				outputTasks.push(new TreeTask(t.name.slice(index).join(''), t.task));
			} else {
				const existing = foldersByName.get(t.name[index]);
				if (existing) {
					existing.push(t);
				} else {
					foldersByName.set(t.name[index], [t]);
				}
			}
		}
		const folders = [...foldersByName]
			.filter(([_, tasks]) => {
				if (tasks.length === 1) {
					outputTasks.push(...tasks.map(t => new TreeTask(t.name.slice(index).join(''), t.task)));
					return false;
				}
				return true;
			})
			.map(([name, groupTasks], _i, foldersList) => new TreeGroup(index + 2, name, groupTasks, (foldersList.length + outputTasks.length) <= this._autoExpandLimit))
			.sort((a, b) => {
				if (a.label < b.label) return -1;
				if (a.label > b.label) return 1;
			})
		return [
			...folders
				,
			...outputTasks
				.sort((a, b) => {
						if (outputTasks.length > 10) {
							const aR = a.isRunning
							const bR = b.isRunning
							if (aR && !bR) return -1;
							if (!aR && bR) return 1;
						}
						if (a.label < b.label) return -1;
						if (a.label > b.label) return 1;
					}),
		];
	}
	public async getChildren(task?: TreeTask | TreeGroup): Promise<(TreeTask | TreeGroup)[]> {
		if (task instanceof TreeGroup) {
			return this._getChildren(task.index, task.tasks)
		}
		if (task) {
			return []
		}
	
		let tasks = await vscode.tasks.fetchTasks({version: "2.0.0"});
		const includedSources = new Set(this._source.split(','))
		const namedTasks = tasks
			.filter(t => t.name.startsWith(this._prefix) && (this._source === '*' || includedSources.has(t.source)))
			.map(t => new NamedTask(t.name.substr(this._prefix.length).trim().split(this._separator), t));
		if (this._source === '*') {
			const sources = [...(new Set(tasks.map(t => t.source)))].sort();
			return sources.map(s => new TreeGroup(0, s, namedTasks.filter(t => t.task.source === s), true));
		} else if (includedSources.size === 1) {
			return this._getChildren(0, namedTasks);
		} else {
			const sources = this._source.split(',')
			return sources.map(s => new TreeGroup(0, s, namedTasks.filter(t => t.task.source === s), true));
		}
	}

	getTreeItem(task: TreeTask): vscode.TreeItem {
		return task;
	}
}


export class TreeGroup extends vscode.TreeItem {
	iconPath: string
	constructor(
		public readonly index: number,
		label: string,
		public readonly tasks: NamedTask[],
		expanded: boolean,
	) {
		super(label.trim(), expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
	}
}
export class NamedTask {
	constructor(
		public readonly name: string[],
		public readonly task: vscode.Task,
	) {
	}
	 
}
export class TreeTask extends vscode.TreeItem {
	task: vscode.Task;
	iconPath: string
	terminal: vscode.Terminal | null
	description: string;
	isRunning: boolean;
	constructor(
		name: string,
		task: vscode.Task,
	) {
		super(name, vscode.TreeItemCollapsibleState.None);
		this.tooltip = `${name}-${task.definition.detail}`
		this.description = task.definition.detail
		this.task = task;
		this.terminal = vscode.window.terminals.find(t => t.name === `Task - ${task.name}`) || null;
		const taskExecution = vscode.tasks.taskExecutions.find(e => e.task.name === task.name)
		
		this.contextValue = this.terminal ? 'running' : 'stopped';
		this.isRunning = !!taskExecution
		this.command = this.isRunning 
			? { command: 'forbeslindesay-taskrunner.stop-task', title: "Stop", arguments: [taskExecution] }
			: { command: 'forbeslindesay-taskrunner.start-task', title: "Start", arguments: [task] };
		this.iconPath = this.isRunning
			? join(__dirname, '..', 'assets', 'button-stop.png')
			: join(__dirname, '..', 'assets', 'button-play.png');

	}
	 
}

