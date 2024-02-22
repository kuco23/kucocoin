// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";


interface IUniswapV2Pair is IERC20 {
    function sync() external;
}