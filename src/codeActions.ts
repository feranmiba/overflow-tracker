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

      // 1. Universal Quick Fix: Dismiss / Ignore highlight on this line
      const ignoreAction = new vscode.CodeAction(
        '🚫 Ignore / Dismiss highlight on this line',
        vscode.CodeActionKind.QuickFix
      );
      ignoreAction.diagnostics = [diagnostic];
      const ignoreEdit = new vscode.WorkspaceEdit();
      const indentation = lineText.substring(0, lineText.search(/\S|$/));
      ignoreEdit.insert(document.uri, new vscode.Position(lineIndex, 0), `${indentation}// overflow-tracker-ignore\n`);
      ignoreAction.edit = ignoreEdit;
      actions.push(ignoreAction);

      // 2. Universal Quick Fix: Comment out / Remove highlighted line
      const removeLineAction = new vscode.CodeAction(
        '✂️ Comment out highlighted line',
        vscode.CodeActionKind.QuickFix
      );
      removeLineAction.diagnostics = [diagnostic];
      const removeEdit = new vscode.WorkspaceEdit();
      removeEdit.replace(document.uri, document.lineAt(lineIndex).range, `${indentation}// ${lineText.trim()}`);
      removeLineAction.edit = removeEdit;
      actions.push(removeLineAction);

      // 3. Quick Fix for CEI Reentrancy Violation (Move deduction before external call)
      const codeStr = typeof diagnostic.code === 'string' ? diagnostic.code : '';
      if (codeStr.includes('CEI_')) {
        const ceiAction = new vscode.CodeAction(
          '🔀 Fix CEI Pattern: Move balance deduction ABOVE external call',
          vscode.CodeActionKind.QuickFix
        );
        ceiAction.diagnostics = [diagnostic];
        ceiAction.isPreferred = true;
        
        // Find linked deduction line inside document
        for (let i = lineIndex + 1; i < Math.min(lineIndex + 15, document.lineCount); i++) {
          const lText = document.lineAt(i).text;
          if (/\s*(-=|\s*=\s*.*-)/.test(lText) && /balance|shares|amount/i.test(lText)) {
            const edit = new vscode.WorkspaceEdit();
            const callLineRange = document.lineAt(lineIndex).rangeIncludingLineBreak;
            const deductionLineRange = document.lineAt(i).rangeIncludingLineBreak;
            
            // Swap lines
            edit.delete(document.uri, deductionLineRange);
            edit.insert(document.uri, new vscode.Position(lineIndex, 0), lText + '\n');
            ceiAction.edit = edit;
            actions.push(ceiAction);
            break;
          }
        }
      }

      // 4. Quick Fix for Unchecked Block
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

      // 5. Quick Fix for Downcasting
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
      '🧹 Clear all highlights in current document',
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
