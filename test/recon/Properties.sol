
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Asserts} from "@chimera/Asserts.sol";
import {Setup} from "./Setup.sol";
import "forge-std/console.sol";

abstract contract Properties is Setup, Asserts {
    function invariant_spot_price_doesnt_change() public returns (bool) {
        uint256 currentPrice = _getBaseSpotPrice();
        return currentPrice == initialBaseSpotPrice;
    }
}
