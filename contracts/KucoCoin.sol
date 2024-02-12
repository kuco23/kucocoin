// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "blazeswap/contracts/periphery/interfaces/IBlazeSwapRouter.sol";

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
 * @notice Deployment of KucoCoin requires you to hold the amount of wrapped native token,
 *  that is equal to the initial NAT liquidity specified in the constructor.
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

    // constant addresses
    address immutable public burnAddress = 0x7B1aFE2745533D852d6fD5A677F14c074210d896;
    IBlazeSwapRouter immutable public uniswapV2; // uniswap-v2 router
    address immutable public wNat; // wrapped native token (AVAX / ETH / FLR / SGB)
    // distribution params
    uint256 immutable public investmentReturnBips;
    uint256 immutable public investmentDuration;
    uint256 immutable public retractFeeBips;
    uint256 immutable public retractDuration;
    // vars
    uint64 public startTradingAt;
    uint112 internal investedUnclaimed;
    bool internal endInvestmentLogged;
    ReserveSnapshot internal reserveSnapshot;
    bool public disabled = false;
    // investment and period tracking
    mapping(address => uint256) public investedBy;
    mapping(address => PeriodEntry) private periodOf;

    constructor(
        IBlazeSwapRouter _uniswapV2,
        uint256 _investmentReturnBips,
        uint256 _investmentDuration,
        uint256 _retractFeeBips,
        uint256 _retractDuration
    )
        ERC20("KucoCoin", "KUCO")
    {
        // set wrapped native and used dex addresses
        wNat = _uniswapV2.wNat();
        uniswapV2 = _uniswapV2;
        // distribution functionality params
        investmentReturnBips = _investmentReturnBips;
        investmentDuration = _investmentDuration;
        retractFeeBips = _retractFeeBips;
        retractDuration = _retractDuration;
        // this will be removed after testing
        _mint(msg.sender, 100 ether); // for tests
    }

    ////////////////////////////////////////////////////////////////////////////
    // modifiers

    modifier requireInvestmentPhase() {
        require(block.timestamp < startTradingAt,
            "KucoCoin: investment phase ended");
        _;
    }

    modifier requireTradingPhase() {
        require(block.timestamp >= startTradingAt,
            "KucoCoin: trading not yet started");
        if (!endInvestmentLogged) {
            (uint256 reserveKuco, uint256 reserveNat) =
                uniswapV2.getReserves(address(this), wNat);
            reserveSnapshot = ReserveSnapshot({
                reserveKuco: uint112(reserveKuco),
                reserveNat: uint112(reserveNat)
            });
            investedUnclaimed = uint112(reserveNat);
        }
        _;
    }

    modifier requireRetractPhase() {
        require(isRetractPhase(), "KucoCoin: retract period ended");
        _;
    }

    modifier enableDuringCall() {
        disabled = false;
        _;
        disabled = true;
    }

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(uniswapV2), _amount);
        _;
        _approve(address(this), address(uniswapV2), 0);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // uniswap v2 integration

    function buy(
        address _receiver,
        uint256 _minKuco,
        uint256 _deadline
    )
        external payable
        requireTradingPhase
    {
        uniswapV2.swapExactNATForTokens{value: msg.value}(
            _minKuco,
            _toPath(wNat, address(this)),
            _receiver,
            _deadline
        );
    }

    function sell(
        address _receiver,
        uint256 _amount,
        uint256 _minNat,
        uint256 _deadline
    )
        external
        requireTradingPhase
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
        requireTradingPhase
        dexApprove(_amountKucoDesired)
    {
        (,,uint256 _liquidity) = uniswapV2.addLiquidityNAT{value: msg.value}(
            address(this),
            _amountKucoDesired,
            _amountKucoMin,
            _amountNatMin,
            0,
            _receiver,
            _deadline
        );
        address pair = uniswapV2.pairFor(address(this), wNat);
        ERC20(pair).transfer(msg.sender, _liquidity);
    }

    function getPoolReserves()
        external view
        returns (uint256, uint256)
    {
        return uniswapV2.getReserves(
            address(this),
            address(wNat)
        );
    }

    function _toPath(
        address _tokenA,
        address _tokenB
    )
        internal pure
        returns (address[] memory path)
    {
        path = new address[](2);
        path[0] = _tokenA;
        path[1] = _tokenB;
    }

    function _getSwapAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    )
        internal pure
        returns (uint256 amountIn)
    {
        if (amountOut == 0) {
            return 0;
        }
        uint256 numerator = reserveIn * amountOut * DEX_MAX_BIPS;
        uint256 denominator = (reserveOut - amountOut) * DEX_FACTOR_BIPS;
        amountIn = numerator / denominator + 1;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // investing through the uniswap v2 pool

    /**
     * @dev Initialize the investment phase
     * @param _amountKuco: the amount of Kuco initially provided to LP
     *  along with the sent NAT
     * @notice May only be called by owner
     */
    function initialize(
        uint256 _amountKuco
    )
        external payable
        onlyOwner
        enableDuringCall
    {
        investedBy[msg.sender] = msg.value;
        startTradingAt = uint64(block.timestamp + investmentDuration);
        _mint(address(this), _amountKuco);
        _approve(address(this), address(uniswapV2), _amountKuco);
        uniswapV2.addLiquidityNAT{value: msg.value}(
            address(this),
            _amountKuco,
            _amountKuco,
            msg.value,
            0,
            address(this),
            block.timestamp
        );
    }

    /**
     * @dev Invest NAT into the pool
     * @notice Callable only during the investment phase
     */
    function invest()
        external payable
        requireInvestmentPhase
        enableDuringCall
    {
        uniswapV2.swapExactNATForTokens{value: msg.value}(
            0, // pre-trading phase - slippage not possible during here
            _toPath(wNat, address(this)),
            address(this),
            block.timestamp
        );
        investedBy[msg.sender] += msg.value;
    }

    /**
     * @dev Claim KUCO from your NAT investment
     * @notice Callable only after the trading phase has started
     */
    function claim()
        external
        requireTradingPhase
    {
        uint256 amountInvestedNat = investedBy[msg.sender];
        require(amountInvestedNat > 0, "KucoCoin: no investment to claim");
        uint256 amountClaimedKuco = getInvestmentReward(amountInvestedNat);
        _updateClaimed(msg.sender, amountInvestedNat);
        if (amountClaimedKuco > 0) {
            _mint(msg.sender, amountClaimedKuco);
        }
    }

    /**
     * @dev Retract the investment position and have your NAT returned to you
     * @notice Callable only after the trading phase has started and before
     *  the retract period has ended. So, `retract` can be called between
     *  `startTradingAt` and `startTradingAt + retractDuration`
     * @notice The amount of NAT returned is reduced by the `retractFeeBips`
     */
    function retract()
        external
        requireRetractPhase
    {
        uint256 amountInvestedNat = investedBy[msg.sender];
        uint256 amountInvestedNatWithFee = amountInvestedNat * (MAX_BIPS - retractFeeBips) / MAX_BIPS;
        require(amountInvestedNatWithFee > 0, "KucoCoin: investment too low to retract");
        _updateClaimed(msg.sender, amountInvestedNat);
        // get `amountInvestedNatWithFee` NAT from the pool
        (uint256 reserveKuco, uint256 reserveNat) = uniswapV2.getReserves(address(this), wNat);
        uint256 _auxAmountKuco = _getSwapAmountIn(amountInvestedNatWithFee, reserveKuco, reserveNat);
        _withdrawNatFromDex(_auxAmountKuco, msg.sender);
    }

    function getInvestmentReward(
        uint256 _amountInvestedNat
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

    function isRetractPhase()
        internal view
        returns (bool)
    {
        uint64 _startTradingAt = startTradingAt;
        return block.timestamp >= _startTradingAt &&
            block.timestamp < _startTradingAt + retractDuration;
    }

    function _withdrawNatFromDex(
        uint256 _amount,
        address _to
    )
        private
    {
        _mint(address(this), _amount);
        _approve(address(this), address(uniswapV2), _amount);
        uniswapV2.swapExactTokensForNAT(
            _amount,
            0, // irrelevant, as we artificially mint and burn KucoCoin
            _toPath(address(this), wNat),
            _to,
            block.timestamp // irrelevant, same reason as above
        );
        address pair = uniswapV2.pairFor(address(this), wNat);
        _burn(pair, _amount); // so price is not affected
    }

    function _updateInvested(
        address _investor,
        uint256 _invested
    )
        private
    {
        investedBy[_investor] += _invested;
        // don't need to update `investedUnclaimed`
        // as it is set at the start of trading
    }

    function _updateClaimed(
        address _claimer,
        uint256 _claimed
    )
        private
    {
        investedBy[_claimer] = 0;
        investedUnclaimed -= uint112(_claimed);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // disable token

    function _beforeTokenTransfer(
        address /* from */,
        address /* to */,
        uint256 /* amount */
    )
        internal override
        requireTradingPhase
    {
        require(!disabled, "KucoCoin: token transfers are temporarily disabled");
    }

    function _afterTokenTransfer(
        address from,
        address /* to */,
        uint256 /* amount */
    )
        internal view override
    {
        if (isRetractPhase()) {
            address _wNat = wNat;
            if (from == uniswapV2.pairFor(address(this), _wNat)) {
                (, uint256 reserveNat) = uniswapV2.getReserves(address(this), _wNat);
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
        periodOf[msg.sender].entry[periodOf[msg.sender].index++] = uint64(block.timestamp);
    }

    function getPeriodHistory()
        external view
        returns(uint64[] memory)
    {
        address receiver = msg.sender;
        uint16 end = periodOf[receiver].index;
        uint16 start = MAX_MENSTRUATION_LOOKBACK <= end ? end - MAX_MENSTRUATION_LOOKBACK : 0;
        uint64[] memory result = new uint64[](end - start);
        for (uint16 i = start; i < end; i++) {
            result[i-start] = periodOf[receiver].entry[i];
        }
        return result;
    }

    function nextPeriod()
        external view
        returns (uint64 lastPeriod)
    {
        address receiver = msg.sender;
        uint16 end = periodOf[receiver].index;
        require(end > 1, "KucoCoin Error: Not enough data to predict next period");
        lastPeriod = periodOf[receiver].entry[end-1];
        lastPeriod -= periodOf[receiver].entry[0];
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