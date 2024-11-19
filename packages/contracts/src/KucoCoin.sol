// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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

    // constant addresses
    address immutable public burnAddress = 0x7B1aFE2745533D852d6fD5A677F14c074210d896;
    address immutable public wNat; // wrapped native token (AVAX / ETH / FLR / SGB)
    IUniswapV2Router immutable public uniswapV2Router;
    // distribution params
    uint256 immutable public investmentFactorBips;
    uint256 immutable public retractFactorBips;
    uint64 immutable public tradingPhaseStart;
    uint64 immutable public retractPhaseEnd;
    // vars
    IUniswapV2Pair public uniswapV2Pair; // Kuco / wNat pair on dex
    bool private _forceTrading; // just for retracting on sundays
    uint112 internal investedUnclaimed;
    // investment and period tracking
    mapping(address => uint112) private _investedBy;
    mapping(address => PeriodEntry) private _periodOf;

    constructor(
        IUniswapV2Router _uniswapV2,
        uint256 _investmentInterestBips,
        uint64 _tradingPhaseStart,
        uint256 _retractFeeBips,
        uint64 _retractPhaseEnd
    )
        ERC20("KucoCoin", "KUCO")
    {
        // set wrapped nat and used dex addresses
        uniswapV2Router = _uniswapV2;
        wNat = _uniswapV2.WETH();
        // distribution functionality params
        investmentFactorBips = MAX_BIPS + _investmentInterestBips;
        tradingPhaseStart = _tradingPhaseStart;
        retractFactorBips = MAX_BIPS - _retractFeeBips;
        retractPhaseEnd = _retractPhaseEnd;
    }

    receive() external payable {}

    ////////////////////////////////////////////////////////////////////////////
    // modifiers

    modifier requireInvestmentPhase() {
        require(isInvestmentPhase(), "KucoCoin: investment no longer allowed");
        _;
    }

    modifier requireRetractPhase() {
        require(isRetractPhase(), "KucoCoin: retract not allowed at current time");
        _;
    }

    modifier requireTradingPhase() {
        require(isTradingPhase(), "KucoCoin: trading not yet allowed");
        _;
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
            _toSwapPath(wNat, address(this)),
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
    {
        _transfer(msg.sender, address(this), _amount);
        uniswapV2Router.swapExactTokensForETH(
            _amount,
            _minNat,
            _toSwapPath(address(this), wNat),
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
    {
        _transfer(msg.sender, address(this), _amountKucoDesired);
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

    function _toSwapPath(
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

    function _quote(
        uint256 _amountA,
        uint256 _reserveA,
        uint256 _reserveB
    )
        private pure
        returns (uint256)
    {
        return _amountA * _reserveB / _reserveA;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // investing through the uniswap v2 pool

    /**
     * @dev Initialize the investment phase
     * @param _amountKuco: the amount of kuco initially provided to the
     *  liquidity pool along with the sent nat
     * @notice May only be called once and by contract owner
     * @notice Before calling this function, no kuco should be minted
     */
    function initialize(
        uint256 _amountKuco
    )
        external payable
        onlyOwner
    {
        require(address(uniswapV2Pair) == address(0), "KucoCoin: already initialized");
        //  add wnat/kuco liquidity to the pool
        _mint(address(this), _amountKuco);
        _forceTrading = true;
        uniswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            _amountKuco,
            _amountKuco,
            msg.value,
            address(this),
            block.timestamp
        );
        _forceTrading = false;
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
        _addNatToPool(address(this));
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
        uint112 amountInvestedNat = _investedBy[msg.sender];
        uint256 amountInvestedNatWithFee = amountInvestedNat * retractFactorBips / MAX_BIPS;
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
        return investmentFactorBips
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
        return tradingPhaseStart <= block.timestamp &&
            retractPhaseEnd > block.timestamp;
    }

    // can also be before investment phase
    function isTradingPhase()
        internal view
        returns (bool)
    {
        return tradingPhaseStart <= block.timestamp;
    }

    function _addNatToPool(
        address _to
    )
        private
    {
        (uint256 reserveKuco, uint256 reserveNat) = getPoolReserves();
        uint256 mintedKuco = _quote(msg.value, reserveNat, reserveKuco);
        _mint(address(this), mintedKuco);
        _forceTrading = true;
        (uint256 addedKuco, uint256 addedNat,) = uniswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            mintedKuco,
            0, // the amount is burned eitherway
            0, // return overflow nat to msg.sender
            _to,
            block.timestamp
        );
        _forceTrading = false;
        IUniswapV2Pair pair = uniswapV2Pair; // save gas
        _burn(address(pair), addedKuco);
        pair.sync();
        // if not all kuco/nat liquidity was added due to numeric errors
        if (addedKuco < mintedKuco) {
            _burn(address(this), mintedKuco - addedKuco);
        }
        // call last
        _transferNat(msg.value - addedNat, _to);
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
    {
        IUniswapV2Pair pair = uniswapV2Pair;
        uint256 totalLiquidity = pair.totalSupply();
        (, uint256 reserveNat) = getPoolReserves();
        uint256 liquidity = totalLiquidity * _amountNat / reserveNat;
        pair.approve(address(uniswapV2Router), liquidity);
        _forceTrading = true;
        (uint256 _amountKuco,) = uniswapV2Router.removeLiquidityETH(
            address(this),
            liquidity,
            0, // gets returned to pool eitherway
            _amountNat - 5, // allow small numeric error
            address(this), // not secure to send to _to here
            block.timestamp
        );
        pair.approve(address(uniswapV2Router), 0);
        _transfer(address(this), address(pair), _amountKuco);
        pair.sync();
        _forceTrading = false;
        // transfer overflow contract nat to _to
        _transferNat(_amountNat, _to);
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

    function _transferNat(
        uint256 _amountNat,
        address _to
    )
        private
    {
        uint256 natBalance = address(this).balance;
        uint256 natReturn = natBalance >= _amountNat ? _amountNat : natBalance;
        if (natReturn > 0) {
            TransferHelper.safeTransferNAT(_to, natReturn);
        }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // erc20 override

    function allowance(
        address owner,
        address spender
    )
        public view override(ERC20, IERC20)
        returns (uint256)
    {
        if (msg.sender == address(uniswapV2Router)) {
            return type(uint256).max;
        } else {
            return super.allowance(owner, spender);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 /* amount */
    )
        internal view override
    {
        if (from == address(0) || to == address(0) || _forceTrading) return;
        require(isTradingPhase(), "KucoCoin: trading not yet allowed");
        require(!_isSunday(), "KucoCoin: token not working on Sundays");
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
                    "KucoCoin: withdrawn liquidity is protected during retract phase");
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

    function periodHistory()
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
        require(end > 0, "KucoCoin Error: Not enough data to predict next period");
        uint64 lastPeriod = _periodOf[receiver].entry[end-1];
        if (end == 1) return lastPeriod + 30 days;
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
            uint256 balance = balanceOf(msg.sender);
            require(balance >= _amount, "KucoCoin: not enough funds for feature fee");
            _burn(msg.sender, _amount);
        }
    }

    function _isSunday()
        internal view
        returns (bool)
    {
        return (block.timestamp - 1722117600) / 86400 % 7 == 0;
    }

}