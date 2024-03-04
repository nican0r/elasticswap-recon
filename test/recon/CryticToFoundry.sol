
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {TargetFunctions} from "./TargetFunctions.sol";
import {FoundryAsserts} from "@chimera/FoundryAsserts.sol";
import "forge-std/console.sol";

contract CryticToFoundry is Test, TargetFunctions, FoundryAsserts {
    function setUp() public {
        setup();
    }

    function test_addLiquidity() public {
        uint256 halfOfTokenBalance = 1000000000000000000000000000 / 2 ;
        // TODO: Given any target function and foundry assert, test your results
        // console.log("balance of 0x20000: ", usdMockToken.balanceOf(address(0x20000)));
        // console.log("balance of 0x30000: ", usdMockToken.balanceOf(address(0x30000)));
        vm.prank(address(0x10000)); 
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
    }

    function test_breakInvariant() public {
        uint256 halfOfTokenBalance = 1000000000000000000000000000 / 2 ;

        vm.prank(address(0x20000));
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        (,, uint256 initialKLast) = exchange.internalBalances();
        // console.log("k after first add: ", initialKLast);

        __before();

        vm.startPrank(address(0x10000)); 
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        (,, uint256 secondKLast) = exchange.internalBalances();
        // console.log("k after second add: ",  secondKLast);
        
        // @audit donation that causes the exploit
        // usdMockToken.transfer(address(exchange), halfOfTokenBalance);

        // need to pass amount of user's liquidity tokens from their balance here 
        uint256 userLiquidityBalance = exchange.balanceOf(address(0x10000));
        uint256 exchangeBaseTokenBalance = elasticMockToken.balanceOf(address(exchange));
        uint256 exchangeQuoteTokenBalance = usdMockToken.balanceOf(address(exchange));
        console.log("0x1's liquidity balance: ", userLiquidityBalance);

        exchange.removeLiquidity(userLiquidityBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        vm.stopPrank();
        (,, uint256 postRemovalKLast) = exchange.internalBalances();

        __after();

        console.log("exchangeBaseTokenBalance: ", exchangeBaseTokenBalance);
        console.log("exchangeQuoteTokenBalance: ", exchangeQuoteTokenBalance);
        console.log("exchangeBaseTokenQty: ", _after.exchange_internalBalances.baseTokenReserveQty);
        console.log("exchangeQuoteTokenQty: ", _after.exchange_internalBalances.quoteTokenReserveQty);

        console.log("k value before: ", _before.exchange_internalBalances.kLast);
        console.log("k value after: ", _after.exchange_internalBalances.kLast);
        assertTrue(_before.exchange_internalBalances.kLast == _after.exchange_internalBalances.kLast, "k value has changed after removing liquidity");
    }

    function test_priceInvariantNoDonation() public {
        uint256 halfOfTokenBalance = 1000000000000000000000000000 / 2 ;

        // initial seeding of liquidity to the pool
        vm.prank(address(0x20000));
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        (uint256 baseTokenReserveQty1, uint256 quoteTokenReserveQty1,) = exchange.internalBalances();
        console.log("price after first add: ", quoteTokenReserveQty1 / baseTokenReserveQty1);

        __before();

        vm.startPrank(address(0x10000)); 
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        (uint256 baseTokenReserveQty2, uint256 quoteTokenReserveQty2,) = exchange.internalBalances();
        console.log("price after second add: ", quoteTokenReserveQty2 / baseTokenReserveQty2);

        uint256 userLiquidityBalance = exchange.balanceOf(address(0x10000));

        exchange.removeLiquidity(userLiquidityBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        vm.stopPrank();
        (uint256 baseTokenReserveQty3, uint256 quoteTokenReserveQty3,) = exchange.internalBalances();
        console.log("price after removing liquidity: ", quoteTokenReserveQty3 / baseTokenReserveQty3);

        __after();

        // assertion that price doesn't change after adding/removing liquidity
        uint256 spotPriceBaseBefore = _before.exchange_internalBalances.quoteTokenReserveQty / _before.exchange_internalBalances.baseTokenReserveQty;
        uint256 spotPriceBaseAfter = _after.exchange_internalBalances.quoteTokenReserveQty / _after.exchange_internalBalances.baseTokenReserveQty;
        console.log("spotPriceBaseBefore: ", spotPriceBaseBefore);
        console.log("spotPriceBaseAfter: ", spotPriceBaseAfter);
        assertTrue(spotPriceBaseBefore == spotPriceBaseAfter);
    }

    function test_priceInvariantWithDonation() public {
        uint256 halfOfTokenBalance = 1000000000000000000000000000 / 2 ;

        // initial seeding of liquidity to the pool
        vm.prank(address(0x20000));
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        (uint256 baseTokenReserveQty1, uint256 quoteTokenReserveQty1,) = exchange.internalBalances();
        console.log("price after first add: ", quoteTokenReserveQty1 / baseTokenReserveQty1);

        __before();

        vm.startPrank(address(0x10000)); 
        exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        (uint256 baseTokenReserveQty2, uint256 quoteTokenReserveQty2,) = exchange.internalBalances();
        console.log("price after second add: ", quoteTokenReserveQty2 / baseTokenReserveQty2);
        
        // @audit donation that causes the exploit
        usdMockToken.transfer(address(exchange), halfOfTokenBalance);

        // need to pass amount of user's liquidity tokens from their balance here 
        uint256 userLiquidityBalance = exchange.balanceOf(address(0x10000));

        exchange.removeLiquidity(userLiquidityBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x10000), block.timestamp + (5 * 16));
        vm.stopPrank();
        (uint256 baseTokenReserveQty3, uint256 quoteTokenReserveQty3,) = exchange.internalBalances();
        console.log("price after removing liquidity: ", quoteTokenReserveQty3 / baseTokenReserveQty3);

        __after();
        
        // assertion that price doesn't change after adding/removing liquidity
        uint256 spotPriceBaseBefore = _before.exchange_internalBalances.quoteTokenReserveQty / _before.exchange_internalBalances.baseTokenReserveQty;
        uint256 spotPriceBaseAfter = _after.exchange_internalBalances.quoteTokenReserveQty / _after.exchange_internalBalances.baseTokenReserveQty;
        console.log("spotPriceBaseBefore: ", spotPriceBaseBefore);
        console.log("spotPriceBaseAfter: ", spotPriceBaseAfter);
        assertTrue(spotPriceBaseBefore == spotPriceBaseAfter);
    }
}
