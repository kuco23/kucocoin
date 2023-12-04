// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "blazeswap/contracts/periphery/interfaces/IBlazeSwapRouter.sol";

contract KucoCoin is ERC20, Ownable {

    // constant vars :)
    address immutable public feePool = address(0xdeadaf);

    // constants set on deploy
    address public wNat;
    IBlazeSwapRouter public blazeSwapRouter;

    // vars
    bool public disabled = false; // if token tranasctions are disabled

    constructor(address _wNat, IBlazeSwapRouter _blazeSwapRouter) ERC20("KucoCoin", "KUCO") {
        wNat = _wNat;
        blazeSwapRouter = _blazeSwapRouter;
        _mint(msg.sender, 100 ether);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // blazeswap integration

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(blazeSwapRouter), _amount);
        _;
        _approve(address(this), address(blazeSwapRouter), 0);
    }

    function addLiquidity(uint256 _amount) external payable dexApprove(_amount) {
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this), _amount, 0, 0, 0, msg.sender, block.timestamp
        );
    }

    function buy(address _receiver, uint256 _minKuco) external payable {
        address[] memory path = new address[](2);
        path[0] = wNat;
        path[1] = address(this);
        blazeSwapRouter.swapExactNATForTokens{value: msg.value}(
            _minKuco, path, _receiver, block.timestamp
        );
    }

    function sell(address _receiver, uint256 _amount, uint256 _minNat) external dexApprove(_amount) {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = wNat;
        blazeSwapRouter.swapExactTokensForNAT(
            _amount, _minNat, path, _receiver, block.timestamp
        );
    }

    function getPoolReserves() external view returns (uint256, uint256) {
        return blazeSwapRouter.getReserves(address(this), address(wNat));
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // disable token

    // function disable()

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        require(!disabled, "KucoCoin: token transfers are disabled");
        super._beforeTokenTransfer(from, to, amount);
    }

    // menstrual cycle tracking

}