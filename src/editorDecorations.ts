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

      if (codeStr.startsWith('LINKED_MISCALCULATION_')) {
        const parts = codeStr.split('::');
        const badgeLabel = parts.length > 1 ? parts[1] : diag.message;

        // Determine specific theme color based on icon type
        let badgeColor = '#ff4500';
        let bgColor = 'rgba(255, 69, 0, 0.18)';
        let borderColor = 'rgba(255, 69, 0, 0.6)';

        if (badgeLabel.includes('🚨')) {
          badgeColor = '#ff0033';
          bgColor = 'rgba(255, 0, 51, 0.2)';
          borderColor = 'rgba(255, 0, 51, 0.7)';
        } else if (badgeLabel.includes('🔁')) {
          badgeColor = '#ff4500';
          bgColor = 'rgba(255, 69, 0, 0.18)';
          borderColor = 'rgba(255, 69, 0, 0.6)';
        } else if (badgeLabel.includes('⚖️')) {
          badgeColor = '#ff8c00';
          bgColor = 'rgba(255, 140, 0, 0.18)';
          borderColor = 'rgba(255, 140, 0, 0.6)';
        } else if (badgeLabel.includes('💸')) {
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
