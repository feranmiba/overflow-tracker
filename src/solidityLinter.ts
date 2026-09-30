import * as vscode from 'vscode';

export interface ScanOptions {
  warnUncheckedBlocks: boolean;
  warnPre080WithoutSafeMath: boolean;
  warnDowncasting: boolean;
}

export interface LinkedMiscalculationPair {
  id: string;
  primaryEmoji: string;
  secondaryEmoji: string;
  primaryLine: number;
  secondaryLine: number;
  primaryLabel: string;
  secondaryLabel: string;
  primaryMessage: string;
  secondaryMessage: string;
  riskType: 'CEI_CALL_BEFORE_DEDUCTION' | 'CROSS_FUNCTION_BALANCE_FLOW';
}

export class SolidityOverflowLinter {
  /**
   * Scans a Solidity document and generates diagnostics for arithmetic overflow risks,
   * downcasting truncation, and cross-line/cross-function balance miscalculation pairs.
   */
  public analyzeDocument(document: vscode.TextDocument, options: ScanOptions): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // 1. Detect pragma solidity version
    const pragmaRegex = /pragma\s+solidity\s+([^;]+);/;
    const pragmaMatch = text.match(pragmaRegex);
    let isVersionLessThan080 = false;
    let versionStr = '';

    if (pragmaMatch) {
      versionStr = pragmaMatch[1].trim();
      if (
        versionStr.includes('0.4.') ||
        versionStr.includes('0.5.') ||
        versionStr.includes('0.6.') ||
        versionStr.includes('0.7.')
      ) {
        isVersionLessThan080 = true;
      }
    }

    const usesSafeMath = /using\s+SafeMath\s+for/i.test(text);

    // Track unchecked block depth
    let uncheckedDepth = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineText = lines[lineIndex];

      // Check if line or preceding line contains ignore comments
      if (this.isLineIgnored(lines, lineIndex)) {
        continue;
      }

      // Strip comments
      const commentIndex = lineText.indexOf('//');
      const cleanLine = commentIndex !== -1 ? lineText.substring(0, commentIndex) : lineText;

      if (/\bunchecked\s*\{/.test(cleanLine)) {
        uncheckedDepth++;
      }

      if (uncheckedDepth > 0) {
        const openBraces = (cleanLine.match(/\{/g) || []).length;
        const closeBraces = (cleanLine.match(/\}/g) || []).length;
        if (closeBraces > openBraces && uncheckedDepth > 0) {
          uncheckedDepth = Math.max(0, uncheckedDepth - (closeBraces - openBraces));
        }
      }

      if (cleanLine.trim().length === 0) {
        continue;
      }

      // Scan for unchecked block arithmetic (Solidity >= 0.8.0)
      if (options.warnUncheckedBlocks && uncheckedDepth > 0) {
        this.checkArithmeticInLine(
          lineIndex,
          cleanLine,
          diagnostics,
          'Unchecked Math Risk: Arithmetic operation inside `unchecked` block bypasses Solidity 0.8+ overflow/underflow checks.',
          vscode.DiagnosticSeverity.Warning,
          'OVERFLOW_UNCHECKED_BLOCK'
        );
      }

      // Scan for pre-0.8.0 arithmetic without SafeMath
      if (options.warnPre080WithoutSafeMath && isVersionLessThan080 && !usesSafeMath) {
        this.checkArithmeticInLine(
          lineIndex,
          cleanLine,
          diagnostics,
          `Missing SafeMath Shield: Solidity ${versionStr || '<0.8.0'} does not perform automatic overflow checks.`,
          vscode.DiagnosticSeverity.Warning,
          'OVERFLOW_PRE_080_NO_SAFEMATH'
        );
      }

      // Scan for downcasting risks
      if (options.warnDowncasting) {
        this.checkDowncastingInLine(lineIndex, cleanLine, diagnostics);
      }
    }

    // 2. Perform Cross-Function / Cross-Line Balance & Miscalculation Flow Analysis
    const linkedPairs = this.analyzeBalanceMiscalculationPairs(lines);
    for (const pair of linkedPairs) {
      const primaryIgnored = this.isLineIgnored(lines, pair.primaryLine);
      const secondaryIgnored = this.isLineIgnored(lines, pair.secondaryLine);

      if (!primaryIgnored) {
        const rangeA = this.getLineRange(lines[pair.primaryLine]);
        const diagA = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(pair.primaryLine, rangeA.startCol), new vscode.Position(pair.primaryLine, rangeA.endCol)),
          `${pair.primaryEmoji} ${pair.primaryMessage}`,
          vscode.DiagnosticSeverity.Error
        );
        diagA.code = `LINKED_${pair.riskType}_PRIMARY`;
        diagA.source = 'Overflow Tracker';
        diagnostics.push(diagA);
      }

      if (!secondaryIgnored) {
        const rangeB = this.getLineRange(lines[pair.secondaryLine]);
        const diagB = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(pair.secondaryLine, rangeB.startCol), new vscode.Position(pair.secondaryLine, rangeB.endCol)),
          `${pair.secondaryEmoji} ${pair.secondaryMessage}`,
          vscode.DiagnosticSeverity.Error
        );
        diagB.code = `LINKED_${pair.riskType}_SECONDARY`;
        diagB.source = 'Overflow Tracker';
        diagnostics.push(diagB);
      }
    }

    return diagnostics;
  }

  /**
   * Checks if line or preceding line has ignore directive
   */
  private isLineIgnored(lines: string[], lineIndex: number): boolean {
    const currentLine = lines[lineIndex];
    if (/overflow-tracker-ignore|overflow-tracker-disable/i.test(currentLine)) {
      return true;
    }
    if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1];
      if (/overflow-tracker-ignore|overflow-tracker-disable-next-line/i.test(prevLine)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scans lines for paired balance removal / balance addition / state mutation before deduction across functions.
   */
  public analyzeBalanceMiscalculationPairs(lines: string[]): LinkedMiscalculationPair[] {
    const pairs: LinkedMiscalculationPair[] = [];

    interface LineEvent {
      lineIndex: number;
      functionName: string;
      type: 'BALANCE_REMOVE' | 'BALANCE_ADD' | 'EXTERNAL_TRANSFER';
      varName: string;
      rawText: string;
    }

    const events: LineEvent[] = [];
    let currentFunction = 'global';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentIdx = line.indexOf('//');
      const clean = commentIdx !== -1 ? line.substring(0, commentIdx) : line;

      const funcMatch = clean.match(/function\s+([a-zA-Z0-9_]+)/);
      if (funcMatch) {
        currentFunction = funcMatch[1];
      }

      const removeMatch = clean.match(/([a-zA-Z0-9_]+(?:\[[^\]]+\])?)\s*(-=|\s*=\s*.*-)/);
      if (removeMatch && /balance|shares|amount|value|allowance/i.test(removeMatch[1])) {
        events.push({
          lineIndex: i,
          functionName: currentFunction,
          type: 'BALANCE_REMOVE',
          varName: removeMatch[1].trim(),
          rawText: clean,
        });
        continue;
      }

      const addMatch = clean.match(/([a-zA-Z0-9_]+(?:\[[^\]]+\])?)\s*(\+=|\s*=\s*.*\+)/);
      if (addMatch && /balance|shares|amount|value|allowance/i.test(addMatch[1])) {
        events.push({
          lineIndex: i,
          functionName: currentFunction,
          type: 'BALANCE_ADD',
          varName: addMatch[1].trim(),
          rawText: clean,
        });
        continue;
      }

      if (/\.(call|transfer|send)\s*\{|\.(transfer|send)\s*\(/.test(clean)) {
        events.push({
          lineIndex: i,
          functionName: currentFunction,
          type: 'EXTERNAL_TRANSFER',
          varName: 'msg.sender',
          rawText: clean,
        });
      }
    }

    const transferEvents = events.filter((e) => e.type === 'EXTERNAL_TRANSFER');
    const removeEvents = events.filter((e) => e.type === 'BALANCE_REMOVE');

    for (const tEvent of transferEvents) {
      const lateRemove = removeEvents.find(
        (r) => r.functionName === tEvent.functionName && r.lineIndex > tEvent.lineIndex
      );

      if (lateRemove) {
        const primaryLineNum = tEvent.lineIndex + 1;
        const secondaryLineNum = lateRemove.lineIndex + 1;

        pairs.push({
          id: `CEI_${tEvent.lineIndex}_${lateRemove.lineIndex}`,
          primaryEmoji: '🚨',
          secondaryEmoji: '🔁',
          primaryLine: tEvent.lineIndex,
          secondaryLine: lateRemove.lineIndex,
          primaryLabel: `🚨 [CEI Violation] External Call executed BEFORE state deduction on line ${secondaryLineNum}`,
          secondaryLabel: `🔁 [CEI Violation] Balance Deduction delayed AFTER external call on line ${primaryLineNum}`,
          primaryMessage: `Reentrancy / CEI Violation: External ETH transfer on line ${primaryLineNum} is executed BEFORE balance deduction on line ${secondaryLineNum}. If call reenters, contract state will be corrupted.`,
          secondaryMessage: `Reentrancy / CEI Violation: Balance deduction on line ${secondaryLineNum} is executed AFTER external call on line ${primaryLineNum}. State update was delayed out of order.`,
          riskType: 'CEI_CALL_BEFORE_DEDUCTION',
        });
      }
    }

    const addEvents = events.filter((e) => e.type === 'BALANCE_ADD');

    for (const rEvent of removeEvents) {
      const matchingAdd = addEvents.find(
        (a) => a.lineIndex !== rEvent.lineIndex && (a.functionName !== rEvent.functionName || a.lineIndex > rEvent.lineIndex)
      );

      if (matchingAdd) {
        const alreadyPaired = pairs.some(
          (p) =>
            (p.primaryLine === rEvent.lineIndex && p.secondaryLine === matchingAdd.lineIndex) ||
            (p.primaryLine === matchingAdd.lineIndex && p.secondaryLine === rEvent.lineIndex)
        );

        if (!alreadyPaired) {
          const lineR = rEvent.lineIndex + 1;
          const lineA = matchingAdd.lineIndex + 1;

          pairs.push({
            id: `BALANCE_FLOW_${rEvent.lineIndex}_${matchingAdd.lineIndex}`,
            primaryEmoji: '⚖️',
            secondaryEmoji: '💸',
            primaryLine: rEvent.lineIndex,
            secondaryLine: matchingAdd.lineIndex,
            primaryLabel: `⚖️ [Unmatched Removal] In '${rEvent.functionName}' ↔ Line ${lineA} in '${matchingAdd.functionName}'`,
            secondaryLabel: `💸 [Unmatched Addition] In '${matchingAdd.functionName}' ↔ Line ${lineR} in '${rEvent.functionName}'`,
            primaryMessage: `Asymmetric Balance Flow: Balance removal in function '${rEvent.functionName}' (line ${lineR}) is linked with balance addition in '${matchingAdd.functionName}' (line ${lineA}). Failure or revert desynchronizes contract balances.`,
            secondaryMessage: `Asymmetric Balance Flow: Balance addition in function '${matchingAdd.functionName}' (line ${lineA}) is linked with balance removal in '${rEvent.functionName}' (line ${lineR}).`,
            riskType: 'CROSS_FUNCTION_BALANCE_FLOW',
          });
        }
      }
    }

    return pairs;
  }

  private checkArithmeticInLine(
    lineIndex: number,
    lineText: string,
    diagnostics: vscode.Diagnostic[],
    message: string,
    severity: vscode.DiagnosticSeverity,
    code: string
  ): void {
    const arithRegex = /(?<![\+\-\*])(\+=|-=|\*=|\*\*|\+(?!\+)|\-(?!\-)|\*(?!\*))(?![\+\-\*])/g;
    let match: RegExpExecArray | null;

    while ((match = arithRegex.exec(lineText)) !== null) {
      const operator = match[1];
      const startCol = match.index;
      const endCol = startCol + operator.length;

      if (this.isInsideString(lineText, startCol)) {
        continue;
      }

      const range = new vscode.Range(
        new vscode.Position(lineIndex, startCol),
        new vscode.Position(lineIndex, endCol)
      );

      const diagnostic = new vscode.Diagnostic(range, `${message} (Operator: '${operator}')`, severity);
      diagnostic.code = code;
      diagnostic.source = 'Overflow Tracker';
      diagnostics.push(diagnostic);
    }
  }

  private checkDowncastingInLine(
    lineIndex: number,
    lineText: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const downcastRegex = /\b(u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240))\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = downcastRegex.exec(lineText)) !== null) {
      const typeName = match[1];
      const startCol = match.index;
      const endCol = startCol + typeName.length;

      const range = new vscode.Range(
        new vscode.Position(lineIndex, startCol),
        new vscode.Position(lineIndex, endCol)
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        `Downcast Truncation Risk: Explicit integer cast to smaller type '${typeName}' may truncate values and cause silent overflow.`,
        vscode.DiagnosticSeverity.Information
      );
      diagnostic.code = 'DOWNCAST_TRUNCATION_RISK';
      diagnostic.source = 'Overflow Tracker';
      diagnostics.push(diagnostic);
    }
  }

  private getLineRange(lineText: string): { startCol: number; endCol: number } {
    const firstNonSpace = lineText.search(/\S/);
    const startCol = firstNonSpace !== -1 ? firstNonSpace : 0;
    const endCol = lineText.length;
    return { startCol, endCol };
  }

  private isInsideString(line: string, index: number): boolean {
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < index; i++) {
      const char = line[i];
      if (char === '"' && !inSingle) {
        inDouble = !inDouble;
      } else if (char === "'" && !inDouble) {
        inSingle = !inSingle;
      }
    }

    return inSingle || inDouble;
  }
}
