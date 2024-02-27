// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IWNat is IERC20 {

    function deposit() external payable;

    function depositTo(address) external payable;

    function withdraw(uint256) external;

    function withdrawTo(uint256, address) external;
}
