// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TransferHelper} from "./lib/TransferHelper.sol";
import {IUniswapV2Router} from "./uniswapV2/interfaces/IUniswapV2Router.sol";
import {IUniswapV2Factory} from "./uniswapV2/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Pair} from "./uniswapV2/interfaces/IUniswapV2Pair.sol";
import {IKucoCoin} from "./interface/IKucoCoin.sol";

// config
uint256 constant TRANS_ACTION_FEE = 1 ether;
uint256 constant REPORT_PERIOD_FEE = 1 ether;
uint16 constant MAX_PERIOD_LOOKUP = 20;
uint16 constant MAX_BIPS = 10000;
// dex config (0.3% fee as hardcoded in uniswap v2)
uint256 constant DEX_MAX_BIPS = 1000;
uint256 constant DEX_FEE_BIPS = 3;
uint256 constant DEX_FACTOR_BIPS = DEX_MAX_BIPS - DEX_FEE_BIPS;

/**
 * @title KucoCoin
 * @author kuco23
 *
 * Assumptions:
 * - Trading phase start is at investment phase end,
 * - During the investment phase, all KUCO is locked in the dex.
 * Implications:
 * - The first tradable KUCO is obtained via `claim` or through dex swap.
 */
contract KucoCoin is IKucoCoin, ERC20, Ownable {

    struct PeriodEntry {
        mapping(uint16 => uint64) entry;
        uint16 index;
    }
    struct ReserveSnapshot {
        uint112 reserveKuco;
        uint112 reserveNat;
    }

    // constant addresses
    address immutable public burnAddress = 0x7B1aFE2745533D852d6fD5A677F14c074210d896;
    IUniswapV2Router immutable public uniswapV2Router;
    address immutable public wNat; // wrapped native token (AVAX / ETH / FLR / SGB)
    // distribution params
    uint256 immutable public investmentReturnBips;
    uint256 immutable public investmentDuration;
    uint256 immutable public retractFeeBips;
    uint256 immutable public retractDuration;
    // vars
    uint64 public tradingPhaseStart;
    uint112 internal investedUnclaimed;
    IKucoCoin.Phase public phase = Phase.Uninitialized; // logged phases
    IUniswapV2Pair public uniswapV2Pair; // Kuco/wNat pair on dex
    // investment and period tracking
    mapping(address => uint112) private _investedBy;
    mapping(address => PeriodEntry) private _periodOf;

    constructor(
        IUniswapV2Router _uniswapV2,
        uint256 _investmentReturnBips,
        uint256 _investmentDuration,
        uint256 _retractFeeBips,
        uint256 _retractDuration
    )
        ERC20("KucoCoin", "KUCO")
    {
        // set wrapped native and used dex addresses
        uniswapV2Router = _uniswapV2;
        wNat = _uniswapV2.WETH();
        // distribution functionality params
        investmentReturnBips = _investmentReturnBips;
        investmentDuration = _investmentDuration;
        retractFeeBips = _retractFeeBips;
        retractDuration = _retractDuration;
    }

    receive() external payable {}

    ////////////////////////////////////////////////////////////////////////////
    // modifiers

    modifier requireInvestmentPhase() {
        require(isInvestmentPhase(), "KucoCoin: not inside investment phase");
        _;
    }

    modifier requireRetractPhase() {
        require(isRetractPhase(), "KucoCoin: retract not allowed during this time");
        _;
    }

    modifier requireTradingPhase() {
        require(isTradingPhase(), "KucoCoin: trading not yet allowed");
        _;
    }

    modifier enableTradingDuringCall() {
        Phase _phase = phase;
        phase = Phase.Trading;
        _;
        phase = _phase;
    }

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(uniswapV2Router), _amount);
        _;
        _approve(address(this), address(uniswapV2Router), 0);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // uniswap-v2 integration

    function buy(
        uint256 _minKuco,
        address _receiver,
        uint256 _deadline
    )
        external payable
    {
        uniswapV2Router.swapExactETHForTokens{value: msg.value}(
            _minKuco,
            _toPath(wNat, address(this)),
            _receiver,
            _deadline
        );
    }

    function sell(
        uint256 _amount,
        uint256 _minNat,
        address _receiver,
        uint256 _deadline
    )
        external
        dexApprove(_amount)
    {
        uniswapV2Router.swapExactTokensForETH(
            _amount,
            _minNat,
            _toPath(address(this), wNat),
            _receiver,
            _deadline
        );
    }

    function addLiquidity(
        uint256 _amountKucoDesired,
        uint256 _amountKucoMin,
        uint256 _amountNatMin,
        address _receiver,
        uint256 _deadline
    )
        external payable
        dexApprove(_amountKucoDesired)
    {
        uniswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            _amountKucoDesired,
            _amountKucoMin,
            _amountNatMin,
            _receiver,
            _deadline
        );
    }

    function liquidityOf(
        address _provider
    )
        external view
        returns (uint256)
    {
        return uniswapV2Pair.balanceOf(_provider);
    }

    function getPoolReserves()
        public view
        returns (uint256 reserveKuco, uint256 reserveNat)
    {
        (reserveKuco, reserveNat,) = uniswapV2Pair.getReserves();
        if (address(this) != uniswapV2Pair.token0()) {
            (reserveKuco, reserveNat) = (reserveNat, reserveKuco);
        }
    }

    function _toPath(
        address _tokenA,
        address _tokenB
    )
        private pure
        returns (address[] memory path)
    {
        path = new address[](2);
        path[0] = _tokenA;
        path[1] = _tokenB;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // investing through the uniswap v2 pool

    /**
     * @dev Initialize the investment phase
     * @param _amountKuco: the amount of Kuco initially provided to LP
     *  along with the sent NAT
     * @notice May only be called once and by contract owner
     * @notice Before calling this function, no KUCO should be minted
     */
    function initialize(
        uint256 _amountKuco
    )
        external payable
        onlyOwner
    {
        require(phase == Phase.Uninitialized, "KucoCoin: already initialized");
        // determine start of trading phase
        tradingPhaseStart = uint64(block.timestamp + investmentDuration);
        //  add WNat / KUCO liquidity to the pool
        _approve(address(this), address(uniswapV2Router), _amountKuco);
        _mint(address(this), _amountKuco);
        uniswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            _amountKuco,
            _amountKuco,
            msg.value,
            address(this),
            block.timestamp
        );
        // mark investment phase
        phase = Phase.Investment;
        // store uniswap v2 pair contract address
        IUniswapV2Factory uniswapV2Factory = IUniswapV2Factory(uniswapV2Router.factory());
        uniswapV2Pair = IUniswapV2Pair(uniswapV2Factory.getPair(address(this), wNat));
    }

    /**
     * @dev Invest NAT into the pool
     * @param _receiver: the address to receive the reward
     * @notice Callable only during the investment phase
     */
    function invest(
        address _receiver
    )
        external payable
        requireInvestmentPhase
    {
        _addNatToDex(address(this));
        _updateInvested(_receiver, uint112(msg.value));
    }

    /**
     * @dev Claim KUCO from your NAT investment
     * @notice Callable only after the trading phase has started
     * @notice Before trading phase it reverts at `_beforeTokenTransfer`
     */
    function claim(
        address _receiver
    )
        external
        requireTradingPhase
    {
        _updatePhaseIfNecessary();
        require(phase == Phase.Trading, "KucoCoin: not inside trading phase");
        uint112 amountInvestedNat = _investedBy[msg.sender];
        require(amountInvestedNat > 0, "KucoCoin: no investment to claim");
        uint256 amountClaimedKuco = getInvestmentReward(amountInvestedNat);
        _updateClaimed(msg.sender, amountInvestedNat);
        if (amountClaimedKuco > 0) {
            _mint(_receiver, amountClaimedKuco);
        }
    }

    /**
     * @dev Retract the investment position and have invested NAT returned to you
     * @notice Callable only after the trading phase has started and before
     *  the retract period has ended.
     * @notice The amount of NAT returned is reduced by the `retractFeeBips`
     */
    function retract(
        address _receiver
    )
        external
        requireRetractPhase
    {
        _updatePhaseIfNecessary();
        uint112 amountInvestedNat = _investedBy[msg.sender];
        uint256 amountInvestedNatWithFee = amountInvestedNat * (MAX_BIPS - retractFeeBips) / MAX_BIPS;
        require(amountInvestedNatWithFee > 0, "KucoCoin: investment too low to retract");
        _updateClaimed(msg.sender, amountInvestedNat);
        _removeNatFromDex(amountInvestedNatWithFee, _receiver);
    }

    function getInvestedNatOf(
        address _investor
    )
        external view
        returns (uint256)
    {
        return _investedBy[_investor];
    }

    function getInvestmentReward(
        uint112 _amountInvestedNat
    )
        internal view
        returns (uint256)
    {
        (uint256 reserveKuco, uint256 reserveNat) = getPoolReserves();
        return investmentReturnBips
            * _amountInvestedNat
            * reserveKuco
            / reserveNat
            / MAX_BIPS;
    }

    function isInvestmentPhase()
        internal view
        returns (bool)
    {
        return tradingPhaseStart > block.timestamp;
    }

    function isRetractPhase()
        internal view
        returns (bool)
    {
        uint64 _tradingPhaseStart = tradingPhaseStart;
        return
            _tradingPhaseStart > 0 &&
            _tradingPhaseStart <= block.timestamp &&
            _tradingPhaseStart + retractDuration > block.timestamp;
    }

    // can also be before investment phase
    function isTradingPhase()
        internal view
        returns (bool)
    {
        uint64 _tradingPhaseStart = tradingPhaseStart;
        return
            _tradingPhaseStart > 0 &&
            _tradingPhaseStart <= block.timestamp;
    }

    // should be called at the end of the investment phase
    function _updatePhaseIfNecessary()
        private
     {
        if (isTradingPhase() && phase == Phase.Investment) {
            phase = Phase.Trading;
        }
    }

    function _addNatToDex(
        address _to
    )
        private
        enableTradingDuringCall
    {
        (uint256 reserveKuco, uint256 reserveNat) = getPoolReserves();
        uint256 tempKuco = msg.value * reserveKuco / reserveNat;
        _mint(address(this), tempKuco);
        _approve(address(this), address(uniswapV2Router), tempKuco);
        (uint256 addedKuco, uint256 addedNat,) = uniswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            tempKuco,
            0, // is ok
            0, // is ok - return non-used NAT to msg.sender
            _to,
            block.timestamp
        );
        // sync called right after _burn!
        IUniswapV2Pair _pair = uniswapV2Pair;
        _burn(address(_pair), addedKuco);
        _pair.sync();
        // in case not all KUCO/NAT liquidity was added (numeric errors or unusual dex impl)
        if (addedKuco < tempKuco) _burn(address(this), tempKuco - addedKuco);
        if (addedNat < msg.value) TransferHelper.safeTransferNAT(_to, msg.value - addedNat);
    }

    // notice that this method is vulnerable to reentrancy through the
    // uniswapV2 NAT transfer to arbitrary `_to` address.
    // Though the only way this can reenter is through `retract`,
    // which updates the state safely before calling this function.
    function _removeNatFromDex(
        uint256 _amountNat,
        address _to
    )
        private
        enableTradingDuringCall
    {
        IUniswapV2Pair _pair = uniswapV2Pair;
        uint256 totalLiquidity = _pair.totalSupply();
        (, uint256 reserveNat) = getPoolReserves();
        uint256 liquidity = totalLiquidity * _amountNat / reserveNat;
        _pair.approve(address(uniswapV2Router), liquidity);
        (uint256 _amountKuco,) = uniswapV2Router.removeLiquidityETH(
            address(this),
            liquidity,
            0, // is ok
            _amountNat - 1, // numeric error
            _to,
            block.timestamp
        );
        _pair.approve(address(uniswapV2Router), 0);
        // sync called right after forced transfer
        _transfer(_to, address(_pair), _amountKuco);
        _pair.sync();
    }

    function _updateInvested(
        address _investor,
        uint112 _invested
    )
        private
    {
        _investedBy[_investor] += _invested;
        investedUnclaimed += _invested;
    }

    function _updateClaimed(
        address _claimer,
        uint112 _claimed
    )
        private
    {
        _investedBy[_claimer] = 0;
        investedUnclaimed -= _claimed;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // disable token

    function _beforeTokenTransfer(
        address /* from */,
        address /* to */,
        uint256 /* amount */
    )
        internal override
    {
        _updatePhaseIfNecessary();
        Phase _phase = phase;
        // this handles the situation where we force the trading phase
        require(isTradingPhase() || _phase == Phase.Trading || _phase == Phase.Uninitialized,
            "KucoCoin: token transfers are only allowed during the trading phase");
        require(!locked(), "KucoCoin: token transfers are locked at this hour every day");
    }

    function _afterTokenTransfer(
        address /* from */,
        address to,
        uint256 /* amount */
    )
        internal view override
    {
        if (isRetractPhase()) {
            if (to == address(uniswapV2Pair)) {
                (, uint256 reserveNat) = getPoolReserves();
                require(reserveNat >= investedUnclaimed,
                    "KucoCoin: trying to withdraw too much NAT from pool during the retract phase");
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // methods that make kucocoin the best token

    function burn(uint256 _amount)
        external
    {
        _transfer(msg.sender, burnAddress, _amount);
    }

    function reportPeriod()
        external
    {
        _takeKucoCoinFeatureFee(REPORT_PERIOD_FEE);
        _periodOf[msg.sender].entry[_periodOf[msg.sender].index++] = uint64(block.timestamp);
    }

    function getPeriodHistory()
        external view
        returns(uint64[] memory)
    {
        address receiver = msg.sender;
        uint16 end = _periodOf[receiver].index;
        uint16 start = MAX_PERIOD_LOOKUP <= end ? end - MAX_PERIOD_LOOKUP : 0;
        uint64[] memory result = new uint64[](end - start);
        for (uint16 i = start; i < end; i++) {
            result[i-start] = _periodOf[receiver].entry[i];
        }
        return result;
    }

    function nextPeriod()
        external view
        returns (uint64)
    {
        address receiver = msg.sender;
        uint16 end = _periodOf[receiver].index;
        require(end > 1, "KucoCoin Error: Not enough data to predict next period");
        uint64 lastPeriod = _periodOf[receiver].entry[end-1];
        uint64 firstPeriod = _periodOf[receiver].entry[0];
        uint64 duration = (lastPeriod - firstPeriod) / (end - 1);
        return lastPeriod + duration;
    }

    function makeTransAction(
        address _to,
        uint256 _amount
    )
        external
    {
        _takeKucoCoinFeatureFee(TRANS_ACTION_FEE);
        _transfer(msg.sender, _to, _amount);
    }

    function _takeKucoCoinFeatureFee(
        uint256 _amount
    )
        internal
    {
        if (isTradingPhase()) {
            _burn(msg.sender, _amount);
        }
    }

    function locked()
        public view
        returns (bool)
    {
        return (block.timestamp - 1722117600) / (3600 * 24) % 7 == 0;
    }

}