import * as vscode from 'vscode';

export class SolidityOverflowHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (document.languageId !== 'solidity' && !document.fileName.endsWith('.sol')) {
      return null;
    }

    const range = document.getWordRangeAtPosition(position, /(?:\+=|-=|\*=|\*\*|\+|-|\*|unchecked|call|transfer|send|uint\d+|int\d+)/);
    if (!range) {
      return null;
    }

    const word = document.getText(range);
    const lineText = document.lineAt(position.line).text;
    const lineNum = position.line + 1;

    // Hover logic for unchecked keyword or operators inside unchecked
    if (word === 'unchecked' || lineText.includes('unchecked')) {
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;
      markdown.appendMarkdown('### 🔥 Solidity Overflow Tracker: Unchecked Math Risk\n\n');
      markdown.appendMarkdown(
        'Wrapping code in `unchecked { ... }` explicitly **disables** Solidity 0.8+ overflow/underflow checks.\n\n'
      );
      markdown.appendMarkdown('**Quick Actions:**\n');
      markdown.appendMarkdown(`- [🚫 Ignore Highlight on Line ${lineNum}](command:overflow-tracker.ignoreLine?${encodeURIComponent(JSON.stringify([position.line]))})\n`);
      markdown.appendMarkdown('- [🧹 Clear All Highlights](command:overflow-tracker.clearDiagnostics)\n');
      return new vscode.Hover(markdown, range);
    }

    // Hover logic for external transfer / CEI
    if (['call', 'transfer', 'send'].includes(word)) {
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;
      markdown.appendMarkdown('### 🚨 Solidity Overflow Tracker: CEI / Reentrancy Risk\n\n');
      markdown.appendMarkdown(
        'External call executed before balance state mutation. Ensure balance update occurs **before** external calls.\n\n'
      );
      markdown.appendMarkdown('**Quick Actions:**\n');
      markdown.appendMarkdown(`- [🚫 Ignore Highlight on Line ${lineNum}](command:overflow-tracker.ignoreLine?${encodeURIComponent(JSON.stringify([position.line]))})\n`);
      markdown.appendMarkdown('- [🧹 Clear All Highlights](command:overflow-tracker.clearDiagnostics)\n');
      return new vscode.Hover(markdown, range);
    }

    // Hover logic for integer downcasting
    const downcastMatch = word.match(/^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240)$/);
    if (downcastMatch) {
      const typeName = downcastMatch[0];
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;
      markdown.appendMarkdown(`### ✂️ Explicit Downcasting (${typeName})\n\n`);
      markdown.appendMarkdown(
        `Casting a larger integer to \`${typeName}\` truncates higher-order bits without runtime checks.\n\n`
      );
      markdown.appendMarkdown('**Quick Actions:**\n');
      markdown.appendMarkdown(`- [🚫 Ignore Highlight on Line ${lineNum}](command:overflow-tracker.ignoreLine?${encodeURIComponent(JSON.stringify([position.line]))})\n`);
      return new vscode.Hover(markdown, range);
    }

    return null;
  }
}
