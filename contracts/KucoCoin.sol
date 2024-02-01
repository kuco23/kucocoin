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
    uint256 immutable public startTradingTime;
    uint256 immutable public investmentReturnBips;
    uint256 immutable public initialLiquidity;
    // disables all token transactions
    bool public disabled = false;
    // tracking
    mapping(address => uint256) public invested;
    mapping(address => MenstruationEntry) private menstruation;

    constructor(
        IBlazeSwapRouter _blazeSwapRouter,
        uint256 _initialLiquidity,
        uint256 _startTradingTime,
        uint256 _investmentReturnBips
    )
        ERC20("KucoCoin", "KUCO")
    {
        wNat = _blazeSwapRouter.wNat();
        blazeSwapRouter = _blazeSwapRouter;
        initialLiquidity = _initialLiquidity;
        startTradingTime = _startTradingTime;
        investmentReturnBips = _investmentReturnBips;
        _mint(msg.sender, 100 ether); // for tests
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // blazeswap integration for buying and investing

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(blazeSwapRouter), _amount);
        _;
        _approve(address(this), address(blazeSwapRouter), 0);
    }

    function depositInitialLiquidity()
        external payable
        onlyOwner
    {
        _mint(address(this), initialLiquidity);
        _approve(address(this), address(blazeSwapRouter), initialLiquidity);
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this), initialLiquidity,
            0, 0, 0,
            address(this), block.timestamp
        );
    }

    function addLiquidity(
        uint256 _amount,
        address _receiver
    )
        external payable
        dexApprove(_amount)
    {
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this), _amount, 0, 0, 0, _receiver, block.timestamp
        );
    }

    function buy(
        address _receiver,
        uint256 _minKuco
    )
        external payable
    {
        address[] memory path = new address[](2);
        path[0] = wNat;
        path[1] = address(this);
        blazeSwapRouter.swapExactNATForTokens{value: msg.value}(
            _minKuco, path, _receiver, block.timestamp
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
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = wNat;
        blazeSwapRouter.swapExactTokensForNAT(_amount, _minNat, path, _receiver, block.timestamp);
    }

    function getPoolReserves()
        external view
        returns (uint256, uint256)
    {
        return blazeSwapRouter.getReserves(address(this), address(wNat));
    }

    // invest in kucocoin to claim the distribution
    function invest(
        address _receiver,
        uint256 _amount
    )
        external payable
    {
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this), _amount, 0, 0, 0, address(0), block.timestamp
        );
        invested[_receiver] += _amount;
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

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // distribution

    function invest() external payable {
        require(block.timestamp < startTradingTime, "KucoCoin: trading has started, investment phase is over");
        blazeSwapRouter.addLiquidityNAT(address(this), 0, 0, msg.value, 0, address(this), block.timestamp);
        invested[msg.sender] += msg.value;
    }

    function claim() external payable {
        require(block.timestamp >= startTradingTime, "KucoCoin: trading has not started yet");
        uint256 amountNat = invested[msg.sender];
        (uint256 reserveKuco, uint256 reserveNat) = blazeSwapRouter.getReserves(address(this), address(wNat));
        uint256 amountKuco = investmentReturnBips * amountNat * reserveKuco / reserveNat / MAX_BIPS;
        require(amountKuco > 0, "KucoCoin: you have not invested");
        invested[msg.sender] = 0;
        _mint(msg.sender, amountKuco);
    }
}