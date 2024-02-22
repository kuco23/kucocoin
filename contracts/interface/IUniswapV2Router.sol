// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;


interface IUniswapV2Router {

    function wNat() external view returns (address);
    function pairFor(address tokenA, address tokenB) external view returns (address);
    function getReserves(address tokenA, address tokenB) external view returns (uint256, uint256);

    function addLiquidityNAT(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountNATMin,
        uint256 feeBipsToken,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountNAT, uint256 liquidity);

    function removeLiquidityNAT(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountNATMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountNAT);

    function swapExactNATForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amountsSent, uint256[] memory amountsRecv);

    function swapExactTokensForNAT(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amountsSent, uint256[] memory amountsRecv);
}
