import * as vscode from 'vscode';

export class SolidityOverflowCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'Overflow Tracker') {
        continue;
      }

      const lineIndex = diagnostic.range.start.line;
      const lineText = document.lineAt(lineIndex).text;

      // 1. Dismiss / Ignore highlight on this line
      const ignoreAction = new vscode.CodeAction(
        'Ignore / Dismiss highlight on this line',
        vscode.CodeActionKind.QuickFix
      );
      ignoreAction.diagnostics = [diagnostic];
      const ignoreEdit = new vscode.WorkspaceEdit();
      const indentation = lineText.substring(0, lineText.search(/\S|$/));
      ignoreEdit.insert(document.uri, new vscode.Position(lineIndex, 0), `${indentation}// overflow-tracker-ignore\n`);
      ignoreAction.edit = ignoreEdit;
      actions.push(ignoreAction);

      // 2. Comment out highlighted line
      const removeLineAction = new vscode.CodeAction(
        'Comment out highlighted line',
        vscode.CodeActionKind.QuickFix
      );
      removeLineAction.diagnostics = [diagnostic];
      const removeEdit = new vscode.WorkspaceEdit();
      removeEdit.replace(document.uri, document.lineAt(lineIndex).range, `${indentation}// ${lineText.trim()}`);
      removeLineAction.edit = removeEdit;
      actions.push(removeLineAction);

      // 3. Quick Fix for Unchecked Block
      if (diagnostic.code === 'OVERFLOW_UNCHECKED_BLOCK') {
        const action = new vscode.CodeAction(
          'Remove unchecked block wrapper for checked math',
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        const edit = new vscode.WorkspaceEdit();
        if (lineText.includes('unchecked {')) {
          edit.replace(
            document.uri,
            document.lineAt(lineIndex).range,
            lineText.replace('unchecked {', '/* checked */ {')
          );
          action.edit = edit;
          actions.push(action);
        }
      }

      // 4. Quick Fix for Downcasting
      if (diagnostic.code === 'DOWNCAST_TRUNCATION_RISK') {
        const wordRange = document.getWordRangeAtPosition(diagnostic.range.start);
        if (wordRange) {
          const typeName = document.getText(wordRange);
          const capitalizedType = typeName.charAt(0).toUpperCase() + typeName.slice(1);
          const action = new vscode.CodeAction(
            `Replace raw cast with SafeCast.to${capitalizedType}(...)`,
            vscode.CodeActionKind.QuickFix
          );
          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }
    }

    // Clear all diagnostics quick action
    const clearAllAction = new vscode.CodeAction(
      'Clear all highlights in current document',
      vscode.CodeActionKind.QuickFix
    );
    clearAllAction.command = {
      command: 'overflow-tracker.clearDiagnostics',
      title: 'Clear Overflow Diagnostics',
    };
    actions.push(clearAllAction);

    return actions;
  }
}
