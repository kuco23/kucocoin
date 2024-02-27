// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";


/**
 * @title IUniswapV2Pair
 * @notice Defines the methods needed for KucoCoin to interact with
 * @notice Inspired by Uniswap V2 Pair
 */
interface IUniswapV2Pair is IERC20 {
    function sync() external;
}