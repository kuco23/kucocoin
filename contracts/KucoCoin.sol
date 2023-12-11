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

    // if token tranasctions are disabled
    bool public disabled = false;

    // menstruation tracking
    struct MenstruationEntry {
        mapping(uint16 => uint32) entry;
        uint16 index;
    }
    mapping(address => MenstruationEntry) private menstruation;

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

    // kucocoin specific functionality

    function description() external pure returns (string memory) {
        return "KucoCoin is the best token in the world!";
    }

    function reportMenstruation() external {
        menstruation[msg.sender].entry[menstruation[msg.sender].index++] = uint32(block.timestamp);
    }

    function makeTransAction(address _to, uint256 _amount) external {
        _transfer(msg.sender, _to, _amount);
    }
}