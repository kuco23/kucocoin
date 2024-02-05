// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "blazeswap/contracts/periphery/interfaces/IBlazeSwapRouter.sol";

import "hardhat/console.sol";

uint16 constant MAX_MENSTRUATION_LOOKBACK = 20;
uint16 constant MAX_BIPS = 10000;

struct MenstruationEntry {
    mapping(uint16 => uint64) entry;
    uint16 index;
}

contract KucoCoin is ERC20, Ownable {

    // constant addresses
    address immutable public burnAddress = 0x7B1aFE2745533D852d6fD5A677F14c074210d896;
    address immutable public wNat;
    IBlazeSwapRouter immutable public blazeSwapRouter;
    // distribution params
    uint256 immutable public investmentReturnBips;
    uint256 immutable public initialLiquidity;
    // disables all token transactions
    uint112 public investedNat;
    uint64 public tradingStart;
    bool public disabled = false;
    // tracking
    mapping(address => uint256) public invested;
    mapping(address => MenstruationEntry) private menstruation;

    constructor(
        IBlazeSwapRouter _blazeSwapRouter,
        uint256 _initialLiquidity,
        uint256 _investmentReturnBips
    )
        ERC20("KucoCoin", "KUCO")
    {
        wNat = _blazeSwapRouter.wNat();
        blazeSwapRouter = _blazeSwapRouter;
        initialLiquidity = _initialLiquidity;
        investmentReturnBips = _investmentReturnBips;
        _mint(msg.sender, 100 ether); // for tests
        disabled = true;
    }

    modifier enableDuringCall() {
        disabled = false;
        _;
        disabled = true;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // blazeswap integration

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(blazeSwapRouter), _amount);
        _;
        _approve(address(this), address(blazeSwapRouter), 0);
    }

    function addLiquidity(
        uint256 _amountKucoDesired,
        uint256 _amountKucoMin,
        uint256 _amountNatMin,
        address _receiver
    )
        external payable
        dexApprove(_amountKucoDesired)
    {
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this),
            _amountKucoDesired,
            _amountKucoMin,
            _amountNatMin,
            0,
            _receiver,
            block.timestamp
        );
    }

    function buy(
        address _receiver,
        uint256 _minKuco
    )
        external payable
    {
        blazeSwapRouter.swapExactNATForTokens{value: msg.value}(
            _minKuco,
            _toPath(wNat, address(this)),
            _receiver,
            block.timestamp
        );
    }

    function sell(
        address _receiver,
        uint256 _amount,
        uint256 _minNat
    )
        external
        dexApprove(_amount)
    {
        blazeSwapRouter.swapExactTokensForNAT(
            _amount,
            _minNat,
            _toPath(address(this), wNat),
            _receiver,
            block.timestamp
        );
    }

    function getPoolReserves()
        external view
        returns (uint256, uint256)
    {
        return blazeSwapRouter.getReserves(
            address(this),
            address(wNat)
        );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    // investing through the uniswap v2 pool

    // initialize investment phase by adding liquidity to the pool
    function initializeInvestmentPhase(uint64 _investmentPhaseDuration)
        external payable
        onlyOwner
    {
        tradingStart = uint64(block.timestamp) + _investmentPhaseDuration;
        _mint(address(this), initialLiquidity);
        _approve(address(this), address(blazeSwapRouter), initialLiquidity);
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this),
            initialLiquidity,
            initialLiquidity,
            msg.value,
            0,
            address(this),
            block.timestamp
        );
    }

    function invest()
        external payable
        enableDuringCall
    {
        require(block.timestamp < tradingStart, "KucoCoin: trading has started, investment phase is over");
        blazeSwapRouter.swapExactNATForTokens{value: msg.value}(
            0,
            _toPath(wNat, address(this)),
            address(this),
            block.timestamp
        );
        invested[msg.sender] += msg.value;
        investedNat += uint112(msg.value);
    }

    function claim()
        external payable
    {
        require(block.timestamp >= tradingStart, "KucoCoin: trading has not started yet");
        if (disabled) {
            disabled = false;
        }
        uint256 amountNat = invested[msg.sender];
        (uint256 reserveKuco, uint256 reserveNat) = blazeSwapRouter.getReserves(address(this), address(wNat));
        uint256 amountKuco = investmentReturnBips * amountNat * reserveKuco / reserveNat / MAX_BIPS;
        require(amountKuco > 0, "KucoCoin: invested amount too low");
        invested[msg.sender] = 0;
        _mint(msg.sender, amountKuco);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // disable token

    // function disable()

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal override
    {
        require(!disabled, "KucoCoin: token transfers are disabled");
        super._beforeTokenTransfer(from, to, amount);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // methods that make kucocoin the best token

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
        address receiver = msg.sender;
        menstruation[receiver].entry[menstruation[receiver].index++] = uint64(block.timestamp);
    }

    function getPeriodHistory()
        external view
        returns(uint64[] memory)
    {
        address receiver = msg.sender;
        uint16 end = menstruation[receiver].index;
        uint16 start = MAX_MENSTRUATION_LOOKBACK <= end ? end - MAX_MENSTRUATION_LOOKBACK : 0;
        uint64[] memory result = new uint64[](end - start);
        for (uint16 i = start; i < end; i++) {
            result[i-start] = menstruation[receiver].entry[i];
        }
        return result;
    }

    function nextPeriod()
        external view
        returns (uint64 lastPeriod)
    {
        address receiver = msg.sender;
        uint16 end = menstruation[receiver].index;
        require(end > 1, "KucoCoin Error: Not enough data to predict next period");
        lastPeriod = menstruation[receiver].entry[end-1];
        lastPeriod -= menstruation[receiver].entry[0];
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