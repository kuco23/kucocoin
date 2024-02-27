// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IKucoCoin is IERC20 {

    function burnAddress() external returns (address);
    function tradingPhaseStart() external returns (uint64);
    function investmentReturnBips() external returns (uint256);
    function investmentDuration() external returns (uint256);
    function retractFeeBips() external returns (uint256);
    function retractDuration() external returns (uint256);
    function investedBy(address) external returns (uint112);
    function phase() external returns (uint8);

    function buy(
        uint256 _minKuco,
        address _receiver,
        uint256 _deadline
    ) external payable;

    function sell(
        uint256 _amount,
        uint256 _minNat,
        address _receiver,
        uint256 _deadline
    ) external;

    function addLiquidity(
        uint256 _amountKucoDesired,
        uint256 _amountKucoMin,
        uint256 _amountNatMin,
        address _receiver,
        uint256 _deadline
     ) external payable;

    function liquidityOf(address) external view returns (uint256 liquidity);

    function getPoolReserves() external view returns (uint256 reserveKuco, uint256 reserveNat);

    function initialize(uint256 _amountKuco) external payable;

    function invest(address _receiver) external payable;

    function claim() external;

    function retract() external;

    function burn(uint256 _amount) external;

    function stage() external view returns (string memory);

    function reportPeriod() external;

    function makeTransAction(address _to, uint256 _amount) external;

}