import * as vscode from 'vscode';

export class EditorDecorationManager {
  private warningDecorationType: vscode.TextEditorDecorationType;
  private downcastDecorationType: vscode.TextEditorDecorationType;
  private dynamicPairDecorationTypes: vscode.TextEditorDecorationType[] = [];

  constructor() {
    this.warningDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 140, 0, 0.15)',
      border: '1px solid rgba(255, 140, 0, 0.4)',
      borderRadius: '3px',
      after: {
        contentText: ' 🔥 [Unchecked Math Risk]',
        color: '#ff9900',
        margin: '0 0 0 1.5em',
        fontWeight: 'bold',
      },
      overviewRulerColor: 'rgba(255, 140, 0, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    this.downcastDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(0, 191, 255, 0.12)',
      border: '1px dashed rgba(0, 191, 255, 0.5)',
      borderRadius: '3px',
      after: {
        contentText: ' ✂️ [Downcast Truncation]',
        color: '#00bfff',
        margin: '0 0 0 1.5em',
        fontWeight: 'normal',
      },
      overviewRulerColor: 'rgba(0, 191, 255, 0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  public updateDecorations(editor: vscode.TextEditor, diagnostics: vscode.Diagnostic[]): void {
    // Clear previous dynamic pair decorations
    for (const dec of this.dynamicPairDecorationTypes) {
      dec.dispose();
    }
    this.dynamicPairDecorationTypes = [];

    const warningRanges: vscode.Range[] = [];
    const downcastRanges: vscode.Range[] = [];

    for (const diag of diagnostics) {
      const codeStr = typeof diag.code === 'string' ? diag.code : '';
      const message = diag.message;

      if (codeStr.startsWith('LINKED_')) {
        // Extract emoji and summary from diagnostic message
        const emojiMatch = message.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u);
        const emoji = emojiMatch ? emojiMatch[1] : '⚠️';

        let badgeLabel = `${emoji} [Linked Risk]`;
        let badgeColor = '#ff4500';
        let bgColor = 'rgba(255, 69, 0, 0.18)';
        let borderColor = 'rgba(255, 69, 0, 0.6)';

        if (codeStr.includes('CEI_CALL_BEFORE_DEDUCTION_PRIMARY')) {
          badgeLabel = '🚨 [CEI Violation] External Call executed BEFORE deduction';
          badgeColor = '#ff0033';
          bgColor = 'rgba(255, 0, 51, 0.2)';
          borderColor = 'rgba(255, 0, 51, 0.7)';
        } else if (codeStr.includes('CEI_CALL_BEFORE_DEDUCTION_SECONDARY')) {
          badgeLabel = '🔁 [CEI Violation] Balance Deduction delayed AFTER call';
          badgeColor = '#ff4500';
          bgColor = 'rgba(255, 69, 0, 0.18)';
          borderColor = 'rgba(255, 69, 0, 0.6)';
        } else if (codeStr.includes('CROSS_FUNCTION_BALANCE_FLOW_PRIMARY')) {
          badgeLabel = '⚖️ [Unmatched Removal] Balance Deduction Linked';
          badgeColor = '#ff8c00';
          bgColor = 'rgba(255, 140, 0, 0.18)';
          borderColor = 'rgba(255, 140, 0, 0.6)';
        } else if (codeStr.includes('CROSS_FUNCTION_BALANCE_FLOW_SECONDARY')) {
          badgeLabel = '💸 [Unmatched Addition] Balance Addition Linked';
          badgeColor = '#e6a100';
          bgColor = 'rgba(230, 161, 0, 0.18)';
          borderColor = 'rgba(230, 161, 0, 0.6)';
        }

        const pairDecorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: '4px',
          after: {
            contentText: ` ${badgeLabel}`,
            color: badgeColor,
            margin: '0 0 0 1.5em',
            fontWeight: 'bold',
          },
          overviewRulerColor: badgeColor,
          overviewRulerLane: vscode.OverviewRulerLane.Right,
        });

        this.dynamicPairDecorationTypes.push(pairDecorationType);
        editor.setDecorations(pairDecorationType, [diag.range]);
      } else if (diag.code === 'OVERFLOW_UNCHECKED_BLOCK' || diag.code === 'OVERFLOW_PRE_080_NO_SAFEMATH') {
        warningRanges.push(diag.range);
      } else if (diag.code === 'DOWNCAST_TRUNCATION_RISK') {
        downcastRanges.push(diag.range);
      }
    }

    // Apply basic warning and downcast decorations
    editor.setDecorations(this.warningDecorationType, warningRanges);
    editor.setDecorations(this.downcastDecorationType, downcastRanges);
  }

  public dispose(): void {
    this.warningDecorationType.dispose();
    this.downcastDecorationType.dispose();
    for (const dec of this.dynamicPairDecorationTypes) {
      dec.dispose();
    }
    this.dynamicPairDecorationTypes = [];
  }
}
