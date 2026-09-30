# Solidity Overflow Tracker

Solidity Overflow Tracker is a Visual Studio Code extension designed for Solidity smart contract developers. It performs real-time static analysis to identify potential arithmetic overflow, underflow, integer truncation, and Checks-Effects-Interactions (CEI) order risks.

## Features

- **Unchecked Block Detection**: Highlights arithmetic operations performed inside `unchecked { ... }` blocks in Solidity 0.8.0+.
- **CEI Reentrancy Inspection**: Identifies external call operations performed before balance state deductions.
- **Downcasting Truncation Analysis**: Warns on explicit downcasting (e.g. `uint256` to `uint8`) that may truncate values.
- **Legacy Solidity Warnings**: Warns when raw arithmetic operators are used in pre-0.8.0 Solidity contracts without SafeMath.
- **Real-Time Editor Decorations**: Displays real-time visual badges and inline highlights directly inside the editor.

## Extension Commands

- `Overflow Tracker: Scan Solidity File` (`overflow-tracker.scanFile`): Manually triggers a full document scan.
- `Overflow Tracker: Clear Overflow Diagnostics` (`overflow-tracker.clearDiagnostics`): Clears all current diagnostics and highlights.
- `Overflow Tracker: Dismiss Highlight on Current Line` (`overflow-tracker.ignoreLine`): Suppresses highlights on the active line.

## Extension Settings

This extension contributes the following settings:

- `overflowTracker.enableRealTimeScanning`: Enables background document scanning on edit (default: `true`).
- `overflowTracker.warnUncheckedBlocks`: Controls warnings for arithmetic inside `unchecked` blocks (default: `true`).
- `overflowTracker.warnPre080WithoutSafeMath`: Controls warnings for legacy Solidity arithmetic without SafeMath (default: `true`).
- `overflowTracker.warnDowncasting`: Controls downcasting truncation warnings (default: `true`).

## License

MIT License. See LICENSE file for details.
