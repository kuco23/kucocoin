// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IUniswapV2Router } from "./interface/IUniswapV2Router.sol";
import { IUniswapV2Pair } from "./interface/IUniswapV2Pair.sol";


// config
uint16 constant MAX_MENSTRUATION_LOOKBACK = 20;
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
contract KucoCoin is ERC20, Ownable {

    struct PeriodEntry {
        mapping(uint16 => uint64) entry;
        uint16 index;
    }
    struct ReserveSnapshot {
        uint112 reserveKuco;
        uint112 reserveNat;
    }
    enum Phase { Uninitialized, Investment, Trading }

    // constant addresses
    address immutable public burnAddress = 0x7B1aFE2745533D852d6fD5A677F14c074210d896;
    IUniswapV2Router immutable public uniswapV2; // uniswap-v2 router
    address immutable public wNat; // wrapped native token (AVAX / ETH / FLR / SGB)
    // distribution params
    uint256 immutable public investmentReturnBips;
    uint256 immutable public investmentDuration;
    uint256 immutable public retractFeeBips;
    uint256 immutable public retractDuration;
    // vars
    uint64 public tradingPhaseStart;
    uint112 internal investedUnclaimed;
    Phase public phase = Phase.Uninitialized; // logged phases
    ReserveSnapshot public reserveSnapshot;
    // investment and period tracking
    mapping(address => uint112) public investedBy;
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
        uniswapV2 = _uniswapV2;
        wNat = _uniswapV2.wNat();
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
        _approve(address(this), address(uniswapV2), _amount);
        _;
        _approve(address(this), address(uniswapV2), 0);
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
        uniswapV2.swapExactNATForTokens{value: msg.value}(
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
        uniswapV2.swapExactTokensForNAT(
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
        uniswapV2.addLiquidityNAT{value: msg.value}(
            address(this),
            _amountKucoDesired,
            _amountKucoMin,
            _amountNatMin,
            0,
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
        return getPair().balanceOf(_provider);
    }

    function getPoolReserves()
        public view
        returns (uint256 reserveKuco, uint256 reserveNat)
    {
        return uniswapV2.getReserves(address(this), wNat);
    }

    function getPair()
        public view
        returns (IUniswapV2Pair)
    {
        return IUniswapV2Pair(uniswapV2.pairFor(address(this), wNat));
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
        phase = Phase.Trading; // so that `_beforeTokenTransfer` doesn't block
        _approve(address(this), address(uniswapV2), _amountKuco);
        _mint(address(this), _amountKuco);
        uniswapV2.addLiquidityNAT{value: msg.value}(
            address(this),
            _amountKuco,
            _amountKuco,
            msg.value,
            0,
            address(this),
            block.timestamp
        );
        // mark investment phase
        phase = Phase.Investment;
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
    function claim()
        external
        requireTradingPhase
    {
        _updatePhaseIfNecessary();
        require(phase == Phase.Trading, "KucoCoin: not inside trading phase");
        uint112 amountInvestedNat = investedBy[msg.sender];
        require(amountInvestedNat > 0, "KucoCoin: no investment to claim");
        uint256 amountClaimedKuco = getInvestmentReward(amountInvestedNat);
        _updateClaimed(msg.sender, amountInvestedNat);
        if (amountClaimedKuco > 0) {
            _mint(msg.sender, amountClaimedKuco);
        }
    }

    /**
     * @dev Retract the investment position and have invested NAT returned to you
     * @notice Callable only after the trading phase has started and before
     *  the retract period has ended.
     * @notice The amount of NAT returned is reduced by the `retractFeeBips`
     */
    function retract()
        external
        requireRetractPhase
    {
        _updatePhaseIfNecessary();
        uint112 amountInvestedNat = investedBy[msg.sender];
        uint256 amountInvestedNatWithFee = amountInvestedNat * (MAX_BIPS - retractFeeBips) / MAX_BIPS;
        require(amountInvestedNatWithFee > 0, "KucoCoin: investment too low to retract");
        _updateClaimed(msg.sender, amountInvestedNat);
        _removeNatFromDex(amountInvestedNatWithFee, msg.sender);
    }

    function getInvestmentReward(
        uint112 _amountInvestedNat
    )
        internal view
        returns (uint256)
    {
        uint256 reserveKuco = reserveSnapshot.reserveKuco;
        uint256 reserveNat = reserveSnapshot.reserveNat;
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
            (uint256 reserveKuco, uint256 reserveNat) = getPoolReserves();
            reserveSnapshot = ReserveSnapshot({
                reserveKuco: uint112(reserveKuco),
                reserveNat: uint112(reserveNat)
            });
            phase = Phase.Trading;
            investedUnclaimed = uint112(reserveNat);
        }
    }

    function _addNatToDex(
        address _to
    )
        private
        enableTradingDuringCall
    {
        (uint256 reserveKuco, uint256 reserveNat) = getPoolReserves();
        uint256 amountKuco = msg.value * reserveKuco / reserveNat;
        _mint(address(this), amountKuco);
        _approve(address(this), address(uniswapV2), amountKuco);
        uniswapV2.addLiquidityNAT{value: msg.value}(
            address(this),
            amountKuco,
            amountKuco,
            msg.value,
            0, // doesn't matter
            _to,
            block.timestamp
        );
        IUniswapV2Pair pair = getPair();
        // beware of in-between `skim` calls
        _burn(address(pair), amountKuco);
        pair.sync();
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
        IUniswapV2Pair pair = getPair();
        uint256 totalLiquidity = pair.totalSupply();
        (, uint256 reserveNat) = getPoolReserves();
        uint256 liquidity = totalLiquidity * _amountNat / reserveNat;
        pair.approve(address(uniswapV2), liquidity);
        (uint256 _amountKuco,) = uniswapV2.removeLiquidityNAT(
            address(this),
            liquidity,
            0, // doesn't matter
            _amountNat,
            _to,
            block.timestamp
        );
        // beware of in-between `skim` calls
        _transfer(_to, address(pair), _amountKuco);
        pair.sync();
    }

    function _updateInvested(
        address _investor,
        uint112 _invested
    )
        private
    {
        investedBy[_investor] += _invested;
        // don't need to update `investedUnclaimed`
        // as it is set at the start of trading
    }

    function _updateClaimed(
        address _claimer,
        uint112 _claimed
    )
        private
    {
        investedBy[_claimer] = 0;
        investedUnclaimed -= _claimed;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // disable token

    function _beforeTokenTransfer(
        address /* from */,
        address /* to */,
        uint256 /* amount */
    )
        internal view override
    {
        // this handles the situation where we force the trading phase
        require(isTradingPhase() || phase == Phase.Trading,
            "KucoCoin: token transfers are only allowed during the trading phase");
    }

    function _afterTokenTransfer(
        address from,
        address /* to */,
        uint256 /* amount */
    )
        internal view override
    {
        if (isRetractPhase()) {
            if (from == address(getPair())) {
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

    function stage()
        external view
        returns (string memory)
    {
        uint256 balance = balanceOf(msg.sender);
        if (balance == 0) {
            return "Loser";
        } else if (balance < 10 ether) {
            return "Hope";
        } else if (balance < 1000 ether) {
            return "Computer";
        } else if (balance < 1000000 ether) {
            return "Chad";
        } else if (balance < 1000000000 ether) {
            return "Techsus";
        } else {
            return "God";
        }
    }

    function reportPeriod()
        external
    {
        _periodOf[msg.sender].entry[_periodOf[msg.sender].index++] = uint64(block.timestamp);
    }

    function getPeriodHistory()
        external view
        returns(uint64[] memory)
    {
        address receiver = msg.sender;
        uint16 end = _periodOf[receiver].index;
        uint16 start = MAX_MENSTRUATION_LOOKBACK <= end ? end - MAX_MENSTRUATION_LOOKBACK : 0;
        uint64[] memory result = new uint64[](end - start);
        for (uint16 i = start; i < end; i++) {
            result[i-start] = _periodOf[receiver].entry[i];
        }
        return result;
    }

    function nextPeriod()
        external view
        returns (uint64 lastPeriod)
    {
        address receiver = msg.sender;
        uint16 end = _periodOf[receiver].index;
        require(end > 1, "KucoCoin Error: Not enough data to predict next period");
        lastPeriod = _periodOf[receiver].entry[end-1];
        lastPeriod -= _periodOf[receiver].entry[0];
        lastPeriod /= (end - 1);
    }

    function makeTransAction(
        address _to,
        uint256 _amount
    )
        external
    {
        _transfer(msg.sender, _to, _amount);
    }

}