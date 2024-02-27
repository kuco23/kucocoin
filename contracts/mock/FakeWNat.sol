// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IWNat} from "../interface/IWNat.sol";

contract FakeWNat is IWNat, ERC20 {

    constructor() ERC20("WrappedNative", "WNat") {}

    function deposit() external payable {
        depositTo(msg.sender);
    }

    function depositTo(address recipient) public payable {
        _mint(recipient, msg.value);
    }

    function withdraw(uint256 amount) external {
        withdrawTo(amount, msg.sender);
    }

    function withdrawTo(uint256 amount, address recipient) public {
        _burn(msg.sender, amount);
        payable(recipient).transfer(amount);
    }
}