
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Setup} from "./Setup.sol";

abstract contract BeforeAfter is Setup {

    struct InternalBalances {
        // x*y=k - we track these internally to compare to actual balances of the ERC20's
        // in order to calculate the "decay" or the amount of balances that are not
        // participating in the pricing curve and adding additional liquidity to swap.
        uint256 baseTokenReserveQty; // x
        uint256 quoteTokenReserveQty; // y
        uint256 kLast; // as of the last add / rem liquidity event
    }

    struct Vars {
        InternalBalances exchange_internalBalances;
    }

    Vars internal _before;
    Vars internal _after;

    function __before() internal {
        (
            _before.exchange_internalBalances.baseTokenReserveQty,
            _before.exchange_internalBalances.quoteTokenReserveQty,
            _before.exchange_internalBalances.kLast
        ) = exchange.internalBalances();
    }

    function __after() internal {
        (
            _after.exchange_internalBalances.baseTokenReserveQty,
            _after.exchange_internalBalances.quoteTokenReserveQty,
            _after.exchange_internalBalances.kLast
        ) = exchange.internalBalances();
    } 
}
