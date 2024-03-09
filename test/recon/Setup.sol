
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

    uint256 initialBaseSpotPrice;

    function setup() internal virtual override {
      uint256 initialTokenBalance = 1000000000000000000000000000;

      // mints elasticMockToken to 0x10000 and CryticTester
      _mintAndDistributeElasticMockToken(initialTokenBalance);

      // mints usdMockToken to 0x10000 and CryticTester
      _mintUsdMockToken(initialTokenBalance);

      exchangeFactory = new ExchangeFactory(address(0x456));
      exchange = new Exchange("EGT LP Token", "EGTLPS", address(elasticMockToken), address(usdMockToken), address(exchangeFactory));

      _grantExchangePermissions();

      // seed exchange with all of 0x10000 tokens
      vm.prank(address(0x10000));
      exchange.addLiquidity(initialTokenBalance, initialTokenBalance, 0, 0, address(0x10000), block.timestamp + 1);
    
      initialBaseSpotPrice = _getBaseSpotPrice();
    }

    function _mintAndDistributeElasticMockToken(uint256 _initiaTokenBalance) internal {
      // initial supply of ETM is minted to 0x10000 address
      elasticMockToken = new ElasticMock("ElasticTokenMock", "ETM",  2 * _initiaTokenBalance, address(0x10000));
      
      vm.prank(address(0x10000));
      elasticMockToken.transfer(address(this), _initiaTokenBalance);
    }

    function _mintUsdMockToken(uint256 _initiaTokenBalance) internal {
      usdMockToken = new MockERC20("Fake-USD", "FUSD");

      usdMockToken.mint(address(0x10000), _initiaTokenBalance);
      usdMockToken.mint(address(this), _initiaTokenBalance);
    }

    function _grantExchangePermissions() internal {
      vm.prank(address(0x10000));
      usdMockToken.approve(address(exchange), type(uint256).max);
      vm.prank(address(0x10000));
      elasticMockToken.approve(address(exchange), type(uint256).max);

       // approving from this contract
       usdMockToken.approve(address(exchange), type(uint256).max);
       elasticMockToken.approve(address(exchange), type(uint256).max);

      // vm.prank(address(0x20000));
      // usdMockToken.approve(address(exchange), type(uint256).max);
      // vm.prank(address(0x20000));
      // elasticMockToken.approve(address(exchange), type(uint256).max);

      // vm.prank(address(0x30000));
      // usdMockToken.approve(address(exchange), type(uint256).max);
      // vm.prank(address(0x30000));
      // elasticMockToken.approve(address(exchange), type(uint256).max);

    }

    function _getBaseSpotPrice() internal returns (uint256) {
      (uint256 baseTokenReserveQty, uint256 quoteTokenReserveQty,) = exchange.internalBalances();
      return quoteTokenReserveQty / baseTokenReserveQty;
    }
}
