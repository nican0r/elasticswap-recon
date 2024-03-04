
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Asserts} from "@chimera/Asserts.sol";
import {Setup} from "./Setup.sol";

abstract contract Properties is Setup, Asserts {

    // need a property that allows calling both functions and price doesn't change
    // price starts at a value -> functions get called -> price stays at same value
    // function invariant_priceDoesntChange() public returns (bool) {
    //     // price before actions are executed is stored in setup as previousBaseSpotPrice
    //     // this reads from storage and updates after each call
    //     (uint256 baseTokenReserveQty, uint256 quoteTokenReserveQty,) = exchange.internalBalances();
    //     uint256 currentBaseSpotPrice =  quoteTokenReserveQty / baseTokenReserveQty;
        
    //     // may need to use a percentage here to deal with potential rounding errors
    //     eq(previousBaseSpotPrice, currentBaseSpotPrice, "prices differ after call sequence");
    //     // return previousBaseSpotPrice == currentBaseSpotPrice;
    // }

    function invariant_user_cant_gain_value() public returns (bool) {
        return _getBalanceSum() <= initialUserBalance;
    }

    function crytic_user_cant_gain_value() public returns (bool) {
        return _getBalanceSum() <= initialUserBalance;
    }
}
