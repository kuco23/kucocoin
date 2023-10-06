// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract KucoCoin is ERC20 {

    constructor() ERC20("KucoCoin", "KUCO") {
        _mint(msg.sender, 100 ether);
    }
}