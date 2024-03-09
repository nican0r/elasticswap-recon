
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {BeforeAfter} from "./BeforeAfter.sol";
import {Properties} from "./Properties.sol";
import {Test} from "forge-std/Test.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console.sol";

abstract contract TargetFunctions is BaseTargetFunctions, Properties, BeforeAfter {
  function eRC20_transfer(uint256 amount) public {
    usdMockToken.transfer(address(exchange), amount);
  }

  function exchange_addLiquidity(uint256 _baseTokenQtyDesired, uint256 _quoteTokenQtyDesired) public {
    exchange.addLiquidity(_baseTokenQtyDesired, _quoteTokenQtyDesired, 0, 0, address(this), block.timestamp + 1);
  }

  function exchange_removeLiquidity(uint256 _liquidityTokenQty, uint256 _baseTokenQtyMin, uint256 _quoteTokenQtyMin) public {
    exchange.removeLiquidity(_liquidityTokenQty, _baseTokenQtyMin, _quoteTokenQtyMin, address(this), block.timestamp + 1);
  }
  
}
