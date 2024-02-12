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
 * @author Nejc Ševerkar
 * @notice Deployment of KucoCoin requires you to hold the amount of wrapped native token,
 *  that is equal to the initial NAT liquidity specified in the constructor.
 */
contract KucoCoin is ERC20, Ownable {

    struct PeriodEntry {
        mapping(uint16 => uint64) entry;
        uint16 index;
    }

    struct EndInvestmentSnapshot {
        bool isLogged;
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
    // disables all token transactions
    bool public disabled = false;
    EndInvestmentSnapshot internal endInvestmentSnapshot;
    uint64 public tradingCommencment;
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

    modifier requireInvestmentPhase() {
        require(block.timestamp < tradingCommencment,
            "KucoCoin: investment phase ended");
        _;
    }

    modifier requireTradingPhase() {
        require(block.timestamp >= tradingCommencment,
            "KucoCoin: trading not yet started");
        if (!endInvestmentSnapshot.isLogged) {
            disabled = false;
            _logReserveSnapshot();
        }
        _;
    }

    modifier requireRetractPhase() {
        require(block.timestamp < tradingCommencment + retractDuration,
            "KucoCoin: retract period ended");
        _;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // uniswap v2 integration

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(uniswapV2), _amount);
        _;
        _approve(address(this), address(uniswapV2), 0);
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

    function poolReserves()
        external view
        returns (uint256, uint256)
    {
        return uniswapV2.getReserves(
            address(this),
            address(wNat)
        );
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
    {
        investedBy[msg.sender] = msg.value;
        tradingCommencment = uint64(block.timestamp + investmentDuration);
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
        uint256 amountClaimedKuco = _claimAmount(amountInvestedNat);
        investedBy[msg.sender] = 0;
        if (amountClaimedKuco > 0) {
            _mint(msg.sender, amountClaimedKuco);
        }
    }

    /**
     * @dev Retract the investment position and have your NAT returned to you
     * @notice Callable only after the trading phase has started and before
     *  the retract period has ended. So, `retract` can be called between
     *  `tradingCommencment` and `tradingCommencment + retractDuration`
     * @notice The amount of NAT returned is reduced by the `retractFeeBips`
     */
    function retract()
        external
        requireTradingPhase
        requireRetractPhase
    {
        uint256 amountInvestedNat = investedBy[msg.sender];
        uint256 amountInvestedNatWithFee = amountInvestedNat * (MAX_BIPS - retractFeeBips) / MAX_BIPS;
        require(amountInvestedNatWithFee > 0, "KucoCoin: investment too low to retract");
        investedBy[msg.sender] = 0;
        // get `amountInvestedNatWithFee` NAT from the pool
        (uint256 reserveKuco, uint256 reserveNat) = uniswapV2.getReserves(address(this), wNat);
        uint256 _auxAmountKuco = _swapAmountIn(amountInvestedNatWithFee, reserveKuco, reserveNat);
        _withdrawNatFromDex(_auxAmountKuco, msg.sender);
    }

    function _logReserveSnapshot()
        internal
    {
        (uint256 reserveKuco, uint256 reserveNat) = uniswapV2.getReserves(address(this), wNat);
        endInvestmentSnapshot = EndInvestmentSnapshot({
            isLogged: true,
            reserveKuco: uint112(reserveKuco),
            reserveNat: uint112(reserveNat)
        });
    }

    function _withdrawNatFromDex(
        uint256 _amount,
        address _to
    )
        internal
    {
        _mint(address(this), _amount);
        _approve(address(this), address(uniswapV2), _amount);
        uniswapV2.swapExactTokensForNAT(
            _amount,
            0, // technically irrelevant, as we burn the tokens
            _toPath(address(this), wNat),
            _to,
            block.timestamp
        );
        address pair = uniswapV2.pairFor(address(this), wNat);
        _burn(pair, _amount); // so price is not affected
    }

    function _claimAmount(
        uint256 _amountInvestedNat
    )
        internal view
        returns (uint256)
    {
        uint256 reserveKuco = endInvestmentSnapshot.reserveKuco;
        uint256 reserveNat = endInvestmentSnapshot.reserveNat;
        return investmentReturnBips
            * _amountInvestedNat
            * reserveKuco
            / reserveNat
            / MAX_BIPS;
    }

    function _swapAmountIn(
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

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // disable token

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal override
    {
        require(!disabled, "KucoCoin: token transfers are temporarily disabled");
        super._beforeTokenTransfer(from, to, amount);
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

    ////////////////////////////////////////////////////////////////////////
    // helpers

    function _toPath(address _tokenA, address _tokenB) internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = _tokenA;
        path[1] = _tokenB;
    }
}