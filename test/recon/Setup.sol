
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseSetup} from "@chimera/BaseSetup.sol";
import {ElasticMock} from "src/contracts/mocks/ElasticMock.sol";
// import {Token_ERC20} from "lib/forge-std/test/mocks/MockERC20.t.sol";
import {MockERC20} from "src/contracts/mocks/MockERC20.sol";
import {Exchange} from "src/contracts/Exchange.sol";
import {ExchangeFactory} from "src/contracts/ExchangeFactory.sol";
import "forge-std/console.sol";
import "lib/chimera/src/Hevm.sol";

// inheriting from Test to expose targetContracts function
abstract contract Setup is BaseSetup {

    ElasticMock elasticMockToken; // base token
    MockERC20 usdMockToken; // quote token
    ExchangeFactory exchangeFactory; 
    Exchange exchange; 

    uint256 previousBaseSpotPrice;

    uint256 initialUserBalance;

    function setup() internal virtual override {
      uint256 initialTokenBalance = 1000000000000000000000000000;
      // initial supply of ETM is minted to 0x10000 address
      elasticMockToken = new ElasticMock("ElasticTokenMock", "ETM", 3 * initialTokenBalance, address(0x10000));
      
      // transfer elasticMockToken to other addresses since it has fixed supply
      vm.prank(address(0x10000));
      elasticMockToken.transfer(address(0x20000), initialTokenBalance);
      vm.prank(address(0x10000));
      elasticMockToken.transfer(address(0x30000), initialTokenBalance);

      usdMockToken = new MockERC20("Fake-USD", "FUSD");
      // initialize the token and mint the initial supply to 0x10000 which is one of the senders so it can make donation to pool
      usdMockToken.mint(address(0x10000), initialTokenBalance);
      usdMockToken.mint(address(0x20000), initialTokenBalance);
      usdMockToken.mint(address(0x30000), initialTokenBalance);

      exchangeFactory = new ExchangeFactory(address(0x456));
      exchange = new Exchange("EGT LP Token", "EGTLPS", address(elasticMockToken), address(usdMockToken), address(exchangeFactory));
    
      // grant exchange permissions for sender's tokens
      vm.prank(address(0x10000));
      usdMockToken.approve(address(exchange), type(uint256).max);
      vm.prank(address(0x10000));
      elasticMockToken.approve(address(exchange), type(uint256).max);

      vm.prank(address(0x20000));
      usdMockToken.approve(address(exchange), type(uint256).max);
      vm.prank(address(0x20000));
      elasticMockToken.approve(address(exchange), type(uint256).max);

      vm.prank(address(0x30000));
      usdMockToken.approve(address(exchange), type(uint256).max);
      vm.prank(address(0x30000));
      elasticMockToken.approve(address(exchange), type(uint256).max);

      // seed exchange with tokens
      uint256 halfOfTokenBalance = initialTokenBalance / 2;
      vm.prank(address(0x20000));
      exchange.addLiquidity(halfOfTokenBalance, halfOfTokenBalance, halfOfTokenBalance - 10, halfOfTokenBalance - 10, address(0x20000), block.timestamp + 1);
      
      initialUserBalance = _getBalanceSum();

      // user adds liquidity
      vm.prank(address(0x30000));
      exchange.addLiquidity(initialTokenBalance, initialTokenBalance, initialTokenBalance, initialTokenBalance, address(0x30000), block.timestamp + 1);
      
      // spot price is just the ratio of the two quantities of tokens in the pool
      // this is initially set here then set after all function calls by the invariant
      // (uint256 baseTokenReserveQty, uint256 quoteTokenReserveQty,) = exchange.internalBalances();
      // previousBaseSpotPrice = quoteTokenReserveQty / baseTokenReserveQty;

      // required for foundry invariant testing
      // targetContract(address(exchange));
      // address[] memory targetContracts =  targetContracts();
      // address targetContracts0 = targetContracts[0];
      // console.log("targetContracts: ", targetContracts0);
    }

    function _getBalanceSum() internal returns (uint256) {
      return elasticMockToken.balanceOf(address(0x30000)) + usdMockToken.balanceOf(address(0x30000));
    }
}
