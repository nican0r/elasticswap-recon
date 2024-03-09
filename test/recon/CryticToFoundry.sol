
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

    function test_breakInvariant() public {
        vm.startPrank(address(this));
        exchange_addLiquidity(247920512443508,724290160891);
        eRC20_transfer(1386619558024359);
        exchange_removeLiquidity(721537869293,1,1);
        vm.stopPrank();

        assertTrue(_getBaseSpotPrice() == initialBaseSpotPrice);
    }

    function test_priceInvariantWithDonation() public {
        uint256 halfOfTokenBalance = 1000000000000000000000000000 / 2 ;

        console.log("initial price: ", _getBaseSpotPrice());

        exchange_addLiquidity(halfOfTokenBalance, halfOfTokenBalance);
        _getBaseSpotPrice();
        console.log("price after CryticTester add: ", _getBaseSpotPrice());
        
        // @audit donation that causes the exploit
        eRC20_transfer(halfOfTokenBalance);
        _getBaseSpotPrice();

        // need to pass amount of user's liquidity tokens from their balance here 
        uint256 userLiquidityBalance = exchange.balanceOf(address(this));

        exchange_removeLiquidity(userLiquidityBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10);
        console.log("price after removing liquidity: ", _getBaseSpotPrice());

        // assertion that price doesn't change after adding/removing liquidity
        assertTrue(_getBaseSpotPrice() == initialBaseSpotPrice);
    }

    function test_setup() public {
        console.log("usd token balance 0x10000: ", usdMockToken.balanceOf(address(0x10000)));
        console.log("usd token balance CryticTester: ", usdMockToken.balanceOf(address(this)));
        
        console.log("elastic mock token balance 0x10000: ", elasticMockToken.balanceOf(address(0x10000)));
        console.log("elastic mock token balance CryticTester: ", elasticMockToken.balanceOf(address(this)));

        console.log("initialBaseSpotPrice: ", initialBaseSpotPrice);
        console.log("initialUserBalance: ", initialUserBalance);

    }
}
