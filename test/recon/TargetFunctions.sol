
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {BeforeAfter} from "./BeforeAfter.sol";
import {Properties} from "./Properties.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console.sol";

abstract contract TargetFunctions is BaseTargetFunctions, Properties, BeforeAfter {

  function eRC20_approve(address spender, uint256 amount) public {
    usdMockToken.approve(spender, amount);
  }
  
  function eRC20_transfer(address to, uint256 amount) public {
    usdMockToken.transfer(to, amount);
  }

  function eRC20_transferFrom(address from, address to, uint256 amount) public {
    usdMockToken.transferFrom(from, to, amount);
  }

  // all _expirationTimestamp parameters have been replaced with block.timestamp + 1 to reduce fuzz runs being wasted on different values of this parameter
  function exchange_addLiquidity(uint256 _baseTokenQtyDesired, uint256 _quoteTokenQtyDesired, uint256 _baseTokenQtyMin, uint256 _quoteTokenQtyMin, address _liquidityTokenRecipient) public {
    exchange.addLiquidity(_baseTokenQtyDesired, _quoteTokenQtyDesired, _baseTokenQtyMin, _quoteTokenQtyMin, _liquidityTokenRecipient, block.timestamp + 1);
  }

  function exchange_removeLiquidity(uint256 _liquidityTokenQty, uint256 _baseTokenQtyMin, uint256 _quoteTokenQtyMin, address _tokenRecipient) public {
    exchange.removeLiquidity(_liquidityTokenQty, _baseTokenQtyMin, _quoteTokenQtyMin, _tokenRecipient, block.timestamp + 1);
  }

  function exchange_swapBaseTokenForQuoteToken(uint256 _baseTokenQty, uint256 _minQuoteTokenQty) public {
    exchange.swapBaseTokenForQuoteToken(_baseTokenQty, _minQuoteTokenQty, block.timestamp + 1);
  }

  function exchange_swapQuoteTokenForBaseToken(uint256 _quoteTokenQty, uint256 _minBaseTokenQty) public {
    exchange.swapQuoteTokenForBaseToken(_quoteTokenQty, _minBaseTokenQty, block.timestamp + 1);
  }
}
