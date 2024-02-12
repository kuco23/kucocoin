// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "blazeswap/contracts/core/test/WNAT.sol";


contract FakeWNat is WNAT {
    bool private _foo = true;

    function increaseAllowance(address /* spender */, uint256 /* addedValue */) external returns(bool) {
        _foo = false;
        assert(false);
        return false;
    }
    function decreaseAllowance(address /* spender */, uint256 /* addedValue */) external returns(bool) {
        _foo = false;
        assert(false);
        return false;
    }

    function mint(address _target, uint256 amount) external {
        balanceOf[_target] += amount;
    }
}