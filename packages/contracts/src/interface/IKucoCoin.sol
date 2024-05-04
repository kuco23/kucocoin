// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IKucoCoin is IERC20 {
    enum Phase { Uninitialized, Investment, Trading }

    function burnAddress() external view returns (address);
    function tradingPhaseStart() external view returns (uint64);
    function investmentReturnBips() external view returns (uint256);
    function investmentDuration() external view returns (uint256);
    function retractFeeBips() external view returns (uint256);
    function retractDuration() external view returns (uint256);
    function getInvestedNatOf(address _receiver) external view returns (uint256);
    function phase() external view returns (Phase);

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

    function liquidityOf(address _owner) external view returns (uint256);

    function getPoolReserves() external view returns (uint256 reserveKuco, uint256 reserveNat);

    function initialize(uint256 _amountKuco) external payable;

    function invest(address _receiver) external payable;

    function claim(address _receiver) external;

    function retract(address _receiver) external;

    function burn(uint256 _amount) external;

    function stage() external view returns (string memory);

    function reportPeriod() external;

    function nextPeriod() external view returns (uint64);

    function makeTransAction(address _to, uint256 _amount) external;

}