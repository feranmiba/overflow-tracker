import * as vscode from 'vscode';

export class OverflowStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'overflow-tracker.scanFile';
    this.statusBarItem.name = 'Solidity Overflow Tracker';
  }

  public updateStatusBar(count: number, hasSolidityFileOpen: boolean): void {
    if (!hasSolidityFileOpen) {
      this.statusBarItem.hide();
      return;
    }

    if (count === 0) {
      this.statusBarItem.text = '$(shield) Overflow Risks: 0';
      this.statusBarItem.tooltip = 'Solidity Overflow Tracker: Clean document';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = `$(warning) Overflow Risks: ${count}`;
      this.statusBarItem.tooltip = `Solidity Overflow Tracker: Detected ${count} potential overflow risk(s). Click to scan.`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    this.statusBarItem.show();
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
