// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KucoCoin is ERC20 {
    address immutable public feePool = address(0xdeadaf);

    constructor() ERC20("KucoCoin", "KUCO") {
        _mint(msg.sender, 100 ether);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (from == address(0)) {
            // Mint
        } else if (to == address(0)) {
            // Burn
        } else {
            // Transfer
            // Take fee
            uint256 fee = 30 * amount / 1000;
            _transfer(from, feePool, fee);
        }
    }
}