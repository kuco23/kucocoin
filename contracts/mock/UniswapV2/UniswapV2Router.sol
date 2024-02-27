// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWNat} from "../../interface/IWNat.sol";
import {IUniswapV2Router} from "../../interface/IUniswapV2/IUniswapV2Router.sol";
import {TransferHelper} from "./lib/TransferHelper.sol";
import {UniswapV2Pair} from "./UniswapV2Pair.sol";


contract UniswapV2Router is IUniswapV2Router, Ownable {

    address public immutable wNat;
    mapping(address => mapping(address => address)) private _poolFromPair;

    constructor(
        address _wNat
    ) {
        wNat = _wNat;
    }

    receive() external payable {
        assert(msg.sender == wNat); // only accept NAT via fallback from the WNAT contract
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, 'UniswapV2: EXPIRED');
        _;
    }

    function addLiquidityNAT(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountNATMin,
        uint256 feeBipsToken,
        address to,
        uint256 deadline
    )
        external payable
        ensure(deadline)
        returns (uint256 amountToken, uint256 amountNAT, uint256 liquidity)
    {
        (amountToken, amountNAT) = _addLiquidity(
            token,
            wNat,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountNATMin,
            feeBipsToken,
            0
        );
        address pair = pairFor(token, wNat);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWNat(wNat).depositTo{value: amountNAT}(pair);
        liquidity = UniswapV2Pair(pair).mint(to);
        // refund dust nat, if any
        if (msg.value > amountNAT)
            TransferHelper.safeTransferNAT(msg.sender, msg.value - amountNAT);
    }

    function removeLiquidityNAT(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountNATMin,
        address to,
        uint256 deadline
    )
        public ensure(deadline)
        returns (uint256 amountToken, uint256 amountNAT)
    {
        (amountToken, amountNAT) = removeLiquidity(
            token,
            wNat,
            liquidity,
            amountTokenMin,
            amountNATMin,
            address(this),
            deadline
        );
        // handle fee-on-transfer tokens (double transfer, but same pair interface)
        TransferHelper.safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        IWNat(wNat).withdraw(amountNAT);
        TransferHelper.safeTransferNAT(to, amountNAT);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 feeBipsA,
        uint256 feeBipsB,
        address to,
        uint256 deadline
    )
        external ensure(deadline)
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        (amountA, amountB) = _addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            feeBipsA,
            feeBipsB
        );
        address pair = pairFor(tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = UniswapV2Pair(pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        public ensure(deadline)
        returns (uint256 amountA, uint256 amountB)
    {
        address pair = pairFor(tokenA, tokenB);
        UniswapV2Pair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint256 amount0, uint256 amount1) = UniswapV2Pair(pair).burn(to);
        (address token0, ) = _sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'BlazeSwapRouter: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'BlazeSwapRouter: INSUFFICIENT_B_AMOUNT');
    }

    function swapExactNATForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external payable ensure(deadline)
        returns (uint256[] memory amountsSent, uint256[] memory amountsRecv)
    {
        require(path[0] == wNat, 'UniswapV2: INVALID_PATH');
        uint256 amountIn = msg.value;
        IWNat(wNat).depositTo{value: amountIn}(pairFor(path[0], path[1]));
        uint256 lastIndex = path.length - 1;
        uint256 balanceBefore = IERC20(path[lastIndex]).balanceOf(to);
        (amountsSent, amountsRecv) = _swap(path, to);
        amountsSent[0] = amountIn;
        uint256 amountOut = IERC20(path[lastIndex]).balanceOf(to) - balanceBefore;
        require(amountOut >= amountOutMin, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        amountsRecv[lastIndex] = amountOut;
    }

    function swapExactTokensForNAT(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external ensure(deadline)
        returns (uint256[] memory amountsSent, uint256[] memory amountsRecv)
    {
        uint256 lastIndex = path.length - 1;
        require(path[lastIndex] == wNat, 'BlazeSwapRouter: INVALID_PATH');
        TransferHelper.safeTransferFrom(path[0], msg.sender, pairFor(path[0], path[1]), amountIn);
        (amountsSent, amountsRecv) = _swap(path, address(this));
        amountsSent[0] = amountIn;
        uint256 amountOut = IERC20(wNat).balanceOf(address(this));
        require(amountOut >= amountOutMin, 'BlazeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        amountsRecv[lastIndex] = amountOut;
        IWNat(wNat).withdraw(amountOut);
        TransferHelper.safeTransferNAT(to, amountOut);
    }

    function getReserves(
        address tokenA,
        address tokenB
    )
        public view
        returns (uint256, uint256)
    {
        UniswapV2Pair pair = UniswapV2Pair(pairFor(tokenA, tokenB));
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        if (_isOrdered(tokenA, tokenB)) {
            return (reserve0, reserve1);
        } else {
            return (reserve1, reserve0);
        }
    }

    function pairFor(
        address _tokenA,
        address _tokenB
    )
        public view
        returns (address)
    {
        return _isOrdered(_tokenA, _tokenB)
            ? _poolFromPair[_tokenA][_tokenB]
            : _poolFromPair[_tokenB][_tokenA];
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 feeBipsA,
        uint256 feeBipsB
    )
        internal
        returns (uint256 amountA, uint256 amountB)
    {
        require(feeBipsA == 0, 'UniswapV2RouterMock: ILLEGAL_A_FEE');
        require(feeBipsB == 0, 'UniswapV2RouterMock: ILLEGAL_B_FEE');
        // create the pair if it doesn't exist yet
        if (pairFor(tokenA, tokenB) == address(0)) {
            _createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = optimalAddedLiquidity(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'UniswapV2: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = optimalAddedLiquidity(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'UniswapV2: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function _swap(
        address[] memory path,
        address _to
    )
        internal
        returns (uint256[] memory amountsSent, uint256[] memory amountsRecv)
    {
        amountsSent = new uint256[](path.length);
        amountsRecv = new uint256[](path.length);
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = _sortTokens(input, output);
            UniswapV2Pair pair = UniswapV2Pair(pairFor(input, output));
            uint256 amountInput;
            uint256 amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
                (uint256 reserveInput, uint256 reserveOutput) = input == token0
                    ? (reserve0, reserve1)
                    : (reserve1, reserve0);
                amountInput = IERC20(input).balanceOf(address(pair)) - reserveInput;
                amountOutput = getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOutput)
                : (amountOutput, uint256(0));
            address to = i < path.length - 2 ? pairFor(output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
            amountsRecv[i] = amountInput;
            amountsSent[i + 1] = amountOutput;
        }
    }

    function _createPair(
        address tokenA,
        address tokenB
    )
        internal
        returns (address _pair)
    {
        require(tokenA != tokenB, 'UniswapV2RouterMock: IDENTICAL_ADDRESSES');
        if (!_isOrdered(tokenA, tokenB)) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }
        require(_poolFromPair[tokenA][tokenB] == address(0), 'UniswapV2RouterMock: PAIR_EXISTS');
        _pair = address(new UniswapV2Pair(tokenA, tokenB));
        _poolFromPair[tokenA][tokenB] = _pair;
    }

    function _sortTokens(
        address _tokenA,
        address _tokenB
    )
        private pure
        returns (address, address)
    {
        if (_isOrdered(_tokenA, _tokenB)) {
            return (_tokenA, _tokenB);
        } else {
            return (_tokenB, _tokenA);
        }
    }

    function _isOrdered(
        address _tokenA,
        address _tokenB
    )
        private pure
        returns (bool)
    {
        return _tokenA < _tokenB;
    }

    //////////////////////////// Uniswap V2 Math ////////////////////////////

    function optimalAddedLiquidity(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    )
        internal pure
        returns (uint256)
    {
        require(amountA > 0, 'UniswapV2: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY');
        return (amountA * reserveB) / reserveA;
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    )
        internal pure
        returns (uint256 amountOut)
    {
        require(amountIn > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY');
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    )
        internal pure
        returns (uint256 amountIn)
    {
        require(amountOut > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY');
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = numerator / denominator + 1;
    }
}