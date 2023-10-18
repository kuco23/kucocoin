// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "blazeswap/contracts/periphery/interfaces/IBlazeSwapRouter.sol";

import "hardhat/console.sol";


contract KucoCoin is ERC20, Ownable {
    struct Secret {
        bytes32 hashed;
        uint32 timestamp;
    }
    // constant vars :)
    address immutable public feePool = address(0xdeadaf);
    uint32 immutable public secretPublishIntervalSeconds = 1 days;
    // constants set on deploy
    address public wNat;
    IBlazeSwapRouter public blazeSwapRouter;
    // secrets
    mapping (uint32 => Secret) public secrets;
    uint32 public lastPublishedIndex;

    constructor(address _wNat, IBlazeSwapRouter _blazeSwapRouter) ERC20("KucoCoin", "KUCO") {
        wNat = _wNat;
        blazeSwapRouter = _blazeSwapRouter;
        _mint(msg.sender, 100 ether);
    }

    modifier dexApprove(uint256 _amount) {
        _transfer(msg.sender, address(this), _amount);
        _approve(address(this), address(blazeSwapRouter), _amount);
        _;
        _approve(address(this), address(blazeSwapRouter), 0);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // secret functionality

    function registerSecret(bytes32 hashed) external onlyOwner {
        uint32 index = lastPublishedIndex; // gas optimization
        Secret memory secret = secrets[index];
        require(secret.timestamp + secretPublishIntervalSeconds < block.timestamp,
            "Kucocoin: register too early");
        secrets[index+1] = Secret(hashed, uint32(block.timestamp));
        lastPublishedIndex++;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // blazeswap integration

    function addLiquidity(uint256 _amount) external payable dexApprove(_amount) {
        blazeSwapRouter.addLiquidityNAT{value: msg.value}(
            address(this), _amount, 0, 0, 0, msg.sender, block.timestamp
        );
    }

    function buy(address _receiver) external payable {
        address[] memory path = new address[](2);
        path[0] = wNat;
        path[1] = address(this);
        blazeSwapRouter.swapExactNATForTokens{value: msg.value}(
            0, path, _receiver, block.timestamp
        );
    }

    function sell(uint256 _amount, address _receiver) external dexApprove(_amount) {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = wNat;
        blazeSwapRouter.swapExactTokensForNAT(
            _amount, 0, path, _receiver, block.timestamp
        );
    }

    function getPoolReserves() external view returns (uint256, uint256) {
        return blazeSwapRouter.getReserves(address(this), address(wNat));
    }
}