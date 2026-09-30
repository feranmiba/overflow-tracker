// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VaultOverflowTrackerDemo {
    mapping(address => uint256) public balances;
    uint256 public totalVaultBalance;

    // 1. Deposit: Adds balance to user mapping and contract total
    function deposit() public payable {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value; // Balance Addition Line
        totalVaultBalance += msg.value;
    }

    // 2. Unsafe Withdraw: External transfer happens BEFORE balance deduction
    // -> BOTH Line 18 (.call) and Line 19 (balances -= amount) receive the EXACT SAME EMOJI!
    function withdrawUnsafe(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient funds");
        
        (bool success, ) = msg.sender.call{value: amount}(""); // Line 18: External Transfer Call
        balances[msg.sender] -= amount;                        // Line 19: Balance Removal (Linked with Line 18!)
        totalVaultBalance -= amount;
    }

    // 3. Cross-Function Balance Transfer
    // -> BOTH Line 26 (removal) and Line 27 (addition) receive the EXACT SAME EMOJI!
    function transferSmall(address recipient, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient funds");
        
        balances[msg.sender] -= amount;                       // Line 26: Balance Removal
        balances[recipient] += amount;                        // Line 27: Balance Addition (Linked with Line 26!)
        
        uint8 smallAmount = uint8(amount);                     // Info: Downcasting truncation risk
    }
}
