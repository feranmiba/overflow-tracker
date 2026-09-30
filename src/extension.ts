import * as vscode from 'vscode';
import { SolidityOverflowLinter, ScanOptions } from './solidityLinter';
import { EditorDecorationManager } from './editorDecorations';
import { SolidityOverflowHoverProvider } from './hoverProvider';
import { SolidityOverflowCodeActionProvider } from './codeActions';
import { OverflowStatusBarManager } from './statusBar';

let diagnosticCollection: vscode.DiagnosticCollection;
const linter = new SolidityOverflowLinter();
let decorationManager: EditorDecorationManager;
let statusBarManager: OverflowStatusBarManager;

const debounceTimers = new Map<string, NodeJS.Timeout>();

export function activate(context: vscode.ExtensionContext) {
  console.log('Solidity Overflow Tracker active with dismiss/ignore support!');

  diagnosticCollection = vscode.languages.createDiagnosticCollection('overflow-tracker');
  decorationManager = new EditorDecorationManager();
  statusBarManager = new OverflowStatusBarManager();

  context.subscriptions.push(diagnosticCollection, decorationManager, statusBarManager);

  // Register Hover Provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'solidity', scheme: 'file' }, new SolidityOverflowHoverProvider())
  );

  // Register Quick Fix Code Action Provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'solidity', scheme: 'file' },
      new SolidityOverflowCodeActionProvider(),
      { providedCodeActionKinds: SolidityOverflowCodeActionProvider.providedCodeActionKinds }
    )
  );

  const getScanOptions = (): ScanOptions => {
    const config = vscode.workspace.getConfiguration('overflowTracker');
    return {
      warnUncheckedBlocks: config.get<boolean>('warnUncheckedBlocks', true),
      warnPre080WithoutSafeMath: config.get<boolean>('warnPre080WithoutSafeMath', true),
      warnDowncasting: config.get<boolean>('warnDowncasting', true),
    };
  };

  const scanDocument = (document: vscode.TextDocument) => {
    const isSolidity = document.languageId === 'solidity' || document.fileName.endsWith('.sol');
    
    if (!isSolidity) {
      statusBarManager.updateStatusBar(0, false);
      return;
    }

    const options = getScanOptions();
    const diagnostics = linter.analyzeDocument(document, options);
    diagnosticCollection.set(document.uri, diagnostics);

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.toString() === document.uri.toString()) {
      decorationManager.updateDecorations(activeEditor, diagnostics);
      statusBarManager.updateStatusBar(diagnostics.length, true);
    }
  };

  const triggerLiveScan = (document: vscode.TextDocument, delayMs = 150) => {
    const uriStr = document.uri.toString();

    if (debounceTimers.has(uriStr)) {
      clearTimeout(debounceTimers.get(uriStr)!);
    }

    const timer = setTimeout(() => {
      scanDocument(document);
      debounceTimers.delete(uriStr);
    }, delayMs);

    debounceTimers.set(uriStr, timer);
  };

  // Command: Manual Scan
  const scanCommand = vscode.commands.registerCommand('overflow-tracker.scanFile', () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showInformationMessage('Overflow Tracker: No active editor found.');
      return;
    }

    const doc = activeEditor.document;
    if (doc.languageId !== 'solidity' && !doc.fileName.endsWith('.sol')) {
      vscode.window.showWarningMessage('Overflow Tracker: Active document is not a Solidity file.');
      return;
    }

    scanDocument(doc);
    const count = diagnosticCollection.get(doc.uri)?.length || 0;
    vscode.window.showInformationMessage(
      `Overflow Tracker: Scan completed. Found ${count} potential overflow risk(s).`
    );
  });

  // Command: Clear Diagnostics & Highlights
  const clearCommand = vscode.commands.registerCommand('overflow-tracker.clearDiagnostics', () => {
    diagnosticCollection.clear();
    if (vscode.window.activeTextEditor) {
      decorationManager.updateDecorations(vscode.window.activeTextEditor, []);
      statusBarManager.updateStatusBar(0, true);
    }
    vscode.window.showInformationMessage('Overflow Tracker: Cleared all line highlights.');
  });

  // Command: Ignore / Dismiss Line Highlight
  const ignoreLineCommand = vscode.commands.registerCommand('overflow-tracker.ignoreLine', async (lineIndex?: number) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const targetLine = lineIndex !== undefined ? lineIndex : activeEditor.selection.active.line;
    const document = activeEditor.document;
    const lineText = document.lineAt(targetLine).text;
    const indentation = lineText.substring(0, lineText.search(/\S|$/));

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(targetLine, 0), `${indentation}// overflow-tracker-ignore\n`);
    await vscode.workspace.applyEdit(edit);
    scanDocument(document);
    vscode.window.showInformationMessage(`Overflow Tracker: Highlight dismissed for line ${targetLine + 1}.`);
  });

  context.subscriptions.push(scanCommand, clearCommand, ignoreLineCommand);

  if (vscode.window.activeTextEditor) {
    scanDocument(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        scanDocument(editor.document);
      } else {
        statusBarManager.updateStatusBar(0, false);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      triggerLiveScan(event.document, 150);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      scanDocument(document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('overflowTracker')) {
        if (vscode.window.activeTextEditor) {
          scanDocument(vscode.window.activeTextEditor.document);
        }
      }
    })
  );
}

export function deactivate() {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();

  if (diagnosticCollection) {
    diagnosticCollection.clear();
    diagnosticCollection.dispose();
  }
}
