'use strict';

import * as vscode from 'vscode';
import { TaskTreeDataProvider, TreeTask } from './taskProvider'

export function activate(context: vscode.ExtensionContext) {

	const taskTreeDataProvider = new TaskTreeDataProvider(context);

	vscode.window.registerTreeDataProvider('forbeslindesay-taskrunner', taskTreeDataProvider);
	vscode.commands.registerCommand('forbeslindesay-taskrunner.refresh', () => taskTreeDataProvider.refresh());

	vscode.commands.registerCommand('forbeslindesay-taskrunner.start-task', (task: vscode.Task) => {
		vscode.tasks.executeTask(task);
	});
	vscode.commands.registerCommand('forbeslindesay-taskrunner.stop-task', (task: vscode.TaskExecution) => {
		task.terminate();
	});
	vscode.commands.registerCommand('forbeslindesay-taskrunner.show-task', (task: TreeTask) => {
		if (task.terminal) {
			task.terminal.show()
		}
	});
}

export function deactivate(): void {
	
}