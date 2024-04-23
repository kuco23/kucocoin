// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IWNat is IERC20 {
    function deposit() external payable;
    function depositTo(address) external payable;
    function withdraw(uint256) external;
    function withdrawTo(uint256, address) external;
}

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