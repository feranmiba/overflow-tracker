# Solidity Overflow Tracker (`overflow-tracker`)

A VS Code extension to detect, track, and highlight potential arithmetic overflow, underflow, and truncation risks in Solidity smart contracts.

## Features

- 🔍 **Unchecked Block Detection (Solidity ≥0.8.0)**: Flags raw arithmetic operations inside `unchecked { ... }` blocks where built-in overflow protection is disabled.
- ⚡ **Legacy Solidity Safeguard (Solidity <0.8.0)**: Detects contracts compiled for legacy Solidity versions missing automatic overflow checks when `SafeMath` is not imported or used.
- 📉 **Downcasting Warning**: Highlights explicit integer casting down to smaller bit widths (e.g. `uint256` to `uint8` or `uint128`) that risk silent value truncation.
- ⚡ **Real-time Diagnostics**: Continuously updates lint warnings and info diagnostics as you edit `.sol` files.

## Commands

- `Overflow Tracker: Scan Solidity File` (`overflow-tracker.scanFile`): Scans the active Solidity document and reports findings.
- `Overflow Tracker: Clear Overflow Diagnostics` (`overflow-tracker.clearDiagnostics`): Clears all current overflow warnings in the editor.

## Extension Settings

This extension contributes the following settings under `overflowTracker`:

- `overflowTracker.enableRealTimeScanning`: Enable/disable background scanning on document edit.
- `overflowTracker.warnUncheckedBlocks`: Enable/disable warnings for arithmetic inside `unchecked` blocks.
- `overflowTracker.warnPre080WithoutSafeMath`: Enable/disable warnings for legacy Solidity contracts without SafeMath.
- `overflowTracker.warnDowncasting`: Enable/disable downcasting truncation warnings.

## Getting Started & Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build extension:
   ```bash
   npm run build
   ```
3. Debug in VS Code:
   - Press `F5` in VS Code to launch an Extension Development Host window.
   - Open `sample.sol` to see real-time overflow diagnostics in action!
