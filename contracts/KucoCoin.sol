// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "blazeswap/contracts/periphery/interfaces/IBlazeSwapRouter.sol";

struct MenstruationEntry {
    mapping(uint16 => uint32) entry;
    uint16 index;
}

contract KucoCoin is ERC20, Ownable {

    // constant vars :)
    address immutable public burnAddress = 0x7B1aFE2745533D852d6fD5A677F14c074210d896;
    address immutable public wNat;
    IBlazeSwapRouter immutable public blazeSwapRouter;

    // disables all token transactions
    bool public disabled = false;

    // tracking
    mapping(address => uint256) public invested;
    mapping(address => MenstruationEntry) private menstruation;

    constructor(
        address _wNat,
        IBlazeSwapRouter _blazeSwapRouter
    )
        ERC20("KucoCoin", "KUCO")
    {
        wNat = _wNat;
        blazeSwapRouter = _blazeSwapRouter;
        _mint(msg.sender, 100 ether);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // blazeswap integration for buying and investing

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(blazeSwapRouter), _amount);
        _;
        _approve(address(this), address(blazeSwapRouter), 0);
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

    function reportMenstruation()
        external
    {
        menstruation[msg.sender].entry[menstruation[msg.sender].index++] = uint32(block.timestamp);
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