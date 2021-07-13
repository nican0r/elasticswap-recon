const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("Exchange", () => {
  let exchange;
  let baseToken;
  let quoteToken;
  let accounts;
  let liquidityFee;
  let liquidityFeeInBasisPoints;
  let initialSupply;
  let mathLib;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    await deployments.fixture();
    const QuoteToken = await deployments.get("QuoteToken");
    quoteToken = new ethers.Contract(
      QuoteToken.address,
      QuoteToken.abi,
      accounts[0]
    );

    const BaseToken = await deployments.get("BaseToken");
    baseToken = new ethers.Contract(
      BaseToken.address,
      BaseToken.abi,
      accounts[0]
    );

    const Exchange = await deployments.get("EGT Exchange");
    exchange = new ethers.Contract(Exchange.address, Exchange.abi, accounts[0]);

    liquidityFeeInBasisPoints = await exchange.liquidityFee();
    liquidityFee = liquidityFeeInBasisPoints / 10000;
    initialSupply = await baseToken.totalSupply();

    const MathLib = await deployments.get("MathLib");
    mathLib = new ethers.Contract(MathLib.address, MathLib.abi, accounts[0]);
  });

  describe("constructor", () => {
    it("Should deploy with correct name, symbol and addresses", async () => {
      expect(await exchange.name()).to.equal("EGT LP Token");
      expect(await exchange.symbol()).to.equal("EGTLPS");
      expect(await exchange.baseToken()).to.equal(baseToken.address);
      expect(await exchange.quoteToken()).to.equal(quoteToken.address);
    });
  });

  describe("swapBaseTokenForQuoteToken", () => {
    it("Should price trades correctly before and after a rebase up", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);
      expect(await baseToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade, our pricing should be ~1:1 currently minus fees
      const swapAmount = 100000;
      const expectedFee = swapAmount * liquidityFee;

      const baseTokenReserveBalance = await baseToken.balanceOf(
        exchange.address
      );
      let pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveBalance.toNumber();
      const quoteTokenQtyReserveAfterTrade =
        pricingConstantK /
        (baseTokenReserveBalance.toNumber() + swapAmount - expectedFee);
      const quoteTokenQtyExpected =
        quoteTokenQtyReserveBeforeTrade - quoteTokenQtyReserveAfterTrade;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      // confirm trade occurred at expected
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.round(quoteTokenQtyExpected)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount
      );

      // simulate a 25% rebase by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the price is unchanged based on the rebase
      // to make accounting easier, we will clear all quote tokens out of our traders wallet now.
      await quoteToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await quoteToken.balanceOf(trader.address)
        );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);

      const swapAmount2 = 200000;
      const expectedFee2 = swapAmount2 * liquidityFee;
      const baseTokenReserveBalance2 = await baseToken.balanceOf(
        exchange.address
      );
      pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade2 =
        pricingConstantK / baseTokenReserveBalance2.toNumber();
      const quoteTokenQtyReserveAfterTrade2 =
        pricingConstantK /
        (baseTokenReserveBalance2.toNumber() + swapAmount2 - expectedFee2);
      const quoteTokenQtyExpected2 =
        quoteTokenQtyReserveBeforeTrade2 - quoteTokenQtyReserveAfterTrade2;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount2, 1, expiration);

      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.round(quoteTokenQtyExpected2)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount - swapAmount2
      );
    });

    it("Should price trades correctly after a rebase up and removing liquidity", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);
      expect(await baseToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade, our pricing should be ~1:1 currently minus fees
      const swapAmount = 100000;
      const expectedFee = swapAmount * liquidityFee;

      const baseTokenReserveBalance = await baseToken.balanceOf(
        exchange.address
      );
      let pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveBalance.toNumber();
      const quoteTokenQtyReserveAfterTrade =
        pricingConstantK /
        (baseTokenReserveBalance.toNumber() + swapAmount - expectedFee);
      const quoteTokenQtyExpected =
        quoteTokenQtyReserveBeforeTrade - quoteTokenQtyReserveAfterTrade;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      // confirm trade occurred at expected
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.round(quoteTokenQtyExpected)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount
      );

      // simulate a 25% rebase by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // remove half of our liquidity.
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          amountToAdd / 2,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the price is unchanged based on the rebase
      // to make accounting easier, we will clear all quote tokens out of our traders wallet now.
      await quoteToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await quoteToken.balanceOf(trader.address)
        );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);

      const swapAmount2 = 200000;
      const expectedFee2 = swapAmount2 * liquidityFee;
      const baseTokenReserveBalance2 = await baseToken.balanceOf(
        exchange.address
      );
      pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade2 =
        pricingConstantK / baseTokenReserveBalance2.toNumber();
      const quoteTokenQtyReserveAfterTrade2 =
        pricingConstantK /
        (baseTokenReserveBalance2.toNumber() + swapAmount2 - expectedFee2);
      const quoteTokenQtyExpected2 =
        quoteTokenQtyReserveBeforeTrade2 - quoteTokenQtyReserveAfterTrade2;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount2, 1, expiration);

      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.round(quoteTokenQtyExpected2)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount - swapAmount2
      );
    });

    it("Should price trades correctly before and after a rebase down", async () => {
      const amountToAdd = 10000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);
      expect(await baseToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade, our pricing should be ~1:1 currently minus fees
      const swapAmount = 100000;
      const expectedFee = swapAmount * liquidityFee;

      const baseTokenReserveBalance = await baseToken.balanceOf(
        exchange.address
      );

      const pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;

      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveBalance.toNumber();

      const quoteTokenQtyReserveAfterTrade =
        pricingConstantK /
        (baseTokenReserveBalance.toNumber() + swapAmount - expectedFee);

      const quoteTokenQtyExpected =
        quoteTokenQtyReserveBeforeTrade - quoteTokenQtyReserveAfterTrade;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      // confirm trade occurred at expected
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.floor(quoteTokenQtyExpected)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount
      );

      // establish pricing ratio before rebase
      const pricingRatio =
        (await exchange.internalBalances()).quoteTokenReserveQty /
        (await exchange.internalBalances()).baseTokenReserveQty;

      // simulate a 25% rebase by down
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the pricing ratio holds from before the rebase
      await quoteToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await quoteToken.balanceOf(trader.address)
        );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);

      const swapAmount2 = 100000;
      const expectedFee2 = swapAmount2 * liquidityFee;

      const exchangeQuoteTokenReserveBalance = await quoteToken.balanceOf(
        exchange.address
      );
      const impliedBaseTokenReserveQty =
        exchangeQuoteTokenReserveBalance / pricingRatio;

      const impliedK =
        exchangeQuoteTokenReserveBalance * impliedBaseTokenReserveQty;

      const impliedBaseTokenReserveQtyAfterTrade =
        impliedBaseTokenReserveQty + swapAmount2 - expectedFee2;
      const exchangeQuoteTokenReserveBalanceAfterTrade =
        impliedK / impliedBaseTokenReserveQtyAfterTrade;

      const quoteTokenQtyExpected2 =
        exchangeQuoteTokenReserveBalance -
        exchangeQuoteTokenReserveBalanceAfterTrade;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount2, 1, expiration);

      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.floor(quoteTokenQtyExpected2)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount - swapAmount2
      );
    });

    it("Should price trades correctly after a rebase down and removing liquidity", async () => {
      const amountToAdd = 10000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);
      expect(await baseToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade, our pricing should be ~1:1 currently minus fees
      const swapAmount = 100000;
      const expectedFee = swapAmount * liquidityFee;

      const baseTokenReserveBalance = await baseToken.balanceOf(
        exchange.address
      );

      const pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;

      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveBalance.toNumber();

      const quoteTokenQtyReserveAfterTrade =
        pricingConstantK /
        (baseTokenReserveBalance.toNumber() + swapAmount - expectedFee);

      const quoteTokenQtyExpected =
        quoteTokenQtyReserveBeforeTrade - quoteTokenQtyReserveAfterTrade;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      // confirm trade occurred at expected
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.floor(quoteTokenQtyExpected)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount
      );

      // establish pricing ratio before rebase
      const pricingRatio =
        (await exchange.internalBalances()).quoteTokenReserveQty /
        (await exchange.internalBalances()).baseTokenReserveQty;

      // simulate a 25% rebase by down
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // remove 1/2 off our liquidity which shouldn't affect our pricing ratio at all.
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          amountToAdd / 2,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the pricing ratio holds from before the rebase
      await quoteToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await quoteToken.balanceOf(trader.address)
        );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);

      const swapAmount2 = 200000;
      const expectedFee2 = swapAmount2 * liquidityFee;

      const exchangeQuoteTokenReserveBalance = await quoteToken.balanceOf(
        exchange.address
      );
      const impliedBaseTokenReserveQty =
        exchangeQuoteTokenReserveBalance / pricingRatio;

      const impliedK =
        exchangeQuoteTokenReserveBalance * impliedBaseTokenReserveQty;

      const impliedBaseTokenReserveQtyAfterTrade =
        impliedBaseTokenReserveQty + swapAmount2 - expectedFee2;
      const exchangeQuoteTokenReserveBalanceAfterTrade =
        impliedK / impliedBaseTokenReserveQtyAfterTrade;

      const quoteTokenQtyExpected2 =
        exchangeQuoteTokenReserveBalance -
        exchangeQuoteTokenReserveBalanceAfterTrade;

      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount2, 1, expiration);

      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        Math.floor(quoteTokenQtyExpected2)
      );
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        amountToAdd - swapAmount - swapAmount2
      );
    });

    it("Should revert when _expirationTimestamp is expired", async () => {
      const expiration = Math.round(new Date().getTime() / 1000 - 60 * 50); // 50 minutes in the past.
      const liquidityProvider = accounts[1];

      await expect(
        exchange
          .connect(liquidityProvider)
          .swapBaseTokenForQuoteToken(1, 1, expiration)
      ).to.be.revertedWith("Exchange: EXPIRED");
    });

    it("Should revert when no liquidity is available", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.

      // attempt a swap prior to any liquidity being added to the exchange. We should revert
      // with a intelligible error
      const swapAmount = 100000;
      await expect(
        exchange
          .connect(trader)
          .swapBaseTokenForQuoteToken(swapAmount, 1, expiration)
      ).to.be.revertedWith("Exchange: INSUFFICIENT_QUOTE_TOKEN_QTY");

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // confirm our trader has no quote token
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);

      // ensure a trade goes through
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      expect(await quoteToken.balanceOf(trader.address)).to.not.equal(0);

      // simulate a 25% rebase down by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // remove liquidity
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // attempt a trade now, which should fail gracefully.
      await expect(
        exchange
          .connect(trader)
          .swapBaseTokenForQuoteToken(swapAmount, 1, expiration)
      ).to.be.revertedWith("Exchange: INSUFFICIENT_QUOTE_TOKEN_QTY");
    });
  });

  describe("swapQuoteTokenForBaseToken", () => {
    it("Should price trades correctly before and after a rebase up", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader quote tokens
      await quoteToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await quoteToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);
      expect(await quoteToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade
      const quoteTokenQtyToTrade = 100000;
      const expectedFee = quoteTokenQtyToTrade * liquidityFee;

      const baseTokenReserveQtyBalance = await baseToken.balanceOf(
        exchange.address
      );
      let pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveQtyBalance.toNumber();
      const quoteTokenQtyReserveAfterTrade =
        quoteTokenQtyReserveBeforeTrade + quoteTokenQtyToTrade - expectedFee;
      const baseTokenReserveQtyAfterTrade =
        pricingConstantK / quoteTokenQtyReserveAfterTrade;
      const baseTokenQtyExpected =
        baseTokenReserveQtyBalance - baseTokenReserveQtyAfterTrade;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration);

      // confirm trade occurred at expected
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade
      );

      // simulate a 25% rebase by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the price is unchanged based on the rebase
      // to make accounting easier, we will clear all base tokens out of our traders wallet now.
      await baseToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await baseToken.balanceOf(trader.address)
        );
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);

      const quoteTokenQtyToTrade2 = 200000;
      const expectedFee2 = quoteTokenQtyToTrade2 * liquidityFee;
      const baseTokenReserveQtyBalance2 = await baseToken.balanceOf(
        exchange.address
      );

      pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade2 =
        pricingConstantK / baseTokenReserveQtyBalance2.toNumber();
      const quoteTokenQtyReserveAfterTrade2 =
        quoteTokenQtyReserveBeforeTrade2 + quoteTokenQtyToTrade2 - expectedFee2;
      const baseTokenReserveQtyAfterTrade2 =
        pricingConstantK / quoteTokenQtyReserveAfterTrade2;
      const baseTokenQtyExpected2 =
        baseTokenReserveQtyBalance2 - baseTokenReserveQtyAfterTrade2;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade2, 1, expiration);

      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected2)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade - quoteTokenQtyToTrade2
      );
    });

    it("Should price trades correctly before and after a rebase up and removing liquidity", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader quote tokens
      await quoteToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await quoteToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);
      expect(await quoteToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade
      const quoteTokenQtyToTrade = 100000;
      const expectedFee = quoteTokenQtyToTrade * liquidityFee;

      const baseTokenReserveQtyBalance = await baseToken.balanceOf(
        exchange.address
      );
      let pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveQtyBalance.toNumber();
      const quoteTokenQtyReserveAfterTrade =
        quoteTokenQtyReserveBeforeTrade + quoteTokenQtyToTrade - expectedFee;
      const baseTokenReserveQtyAfterTrade =
        pricingConstantK / quoteTokenQtyReserveAfterTrade;
      const baseTokenQtyExpected =
        baseTokenReserveQtyBalance - baseTokenReserveQtyAfterTrade;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration);

      // confirm trade occurred at expected
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade
      );

      // simulate a 25% rebase by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // remove liquidity
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          amountToAdd / 2,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the price is unchanged based on the rebase
      // to make accounting easier, we will clear all base tokens out of our traders wallet now.
      await baseToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await baseToken.balanceOf(trader.address)
        );
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);

      const quoteTokenQtyToTrade2 = 200000;
      const expectedFee2 = quoteTokenQtyToTrade2 * liquidityFee;
      const baseTokenReserveQtyBalance2 = await baseToken.balanceOf(
        exchange.address
      );

      pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade2 =
        pricingConstantK / baseTokenReserveQtyBalance2.toNumber();
      const quoteTokenQtyReserveAfterTrade2 =
        quoteTokenQtyReserveBeforeTrade2 + quoteTokenQtyToTrade2 - expectedFee2;
      const baseTokenReserveQtyAfterTrade2 =
        pricingConstantK / quoteTokenQtyReserveAfterTrade2;
      const baseTokenQtyExpected2 =
        baseTokenReserveQtyBalance2 - baseTokenReserveQtyAfterTrade2;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade2, 1, expiration);

      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected2)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade - quoteTokenQtyToTrade2
      );
    });

    it("Should price trades correctly before and after a rebase down", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader quote tokens
      await quoteToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await quoteToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);
      expect(await quoteToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade
      const quoteTokenQtyToTrade = 100000;
      const expectedFee = quoteTokenQtyToTrade * liquidityFee;

      const baseTokenReserveQtyBalance = await baseToken.balanceOf(
        exchange.address
      );
      let pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveQtyBalance.toNumber();
      const quoteTokenQtyReserveAfterTrade =
        quoteTokenQtyReserveBeforeTrade + quoteTokenQtyToTrade - expectedFee;
      const baseTokenReserveQtyAfterTrade =
        pricingConstantK / quoteTokenQtyReserveAfterTrade;
      const baseTokenQtyExpected =
        baseTokenReserveQtyBalance - baseTokenReserveQtyAfterTrade;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration);

      // confirm trade occurred at expected
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade
      );

      // simulate a 25% rebase down
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the price is unchanged based on the rebase
      // to make accounting easier, we will clear all base tokens out of our traders wallet now.
      await baseToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await baseToken.balanceOf(trader.address)
        );
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);

      const quoteTokenQtyToTrade2 = 200000;
      const expectedFee2 = quoteTokenQtyToTrade2 * liquidityFee;
      const baseTokenReserveQtyBalance2 = await baseToken.balanceOf(
        exchange.address
      );

      pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade2 =
        pricingConstantK / baseTokenReserveQtyBalance2.toNumber();
      const quoteTokenQtyReserveAfterTrade2 =
        quoteTokenQtyReserveBeforeTrade2 + quoteTokenQtyToTrade2 - expectedFee2;
      const baseTokenReserveQtyAfterTrade2 =
        pricingConstantK / quoteTokenQtyReserveAfterTrade2;
      const baseTokenQtyExpected2 =
        baseTokenReserveQtyBalance2 - baseTokenReserveQtyAfterTrade2;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade2, 1, expiration);

      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected2)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade - quoteTokenQtyToTrade2
      );
    });

    it("Should price trades correctly before and after a rebase down and removing liquidity", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // send trader quote tokens
      await quoteToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await quoteToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);
      expect(await quoteToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // trader executes the first trade
      const quoteTokenQtyToTrade = 100000;
      const expectedFee = quoteTokenQtyToTrade * liquidityFee;

      const baseTokenReserveQtyBalance = await baseToken.balanceOf(
        exchange.address
      );
      let pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade =
        pricingConstantK / baseTokenReserveQtyBalance.toNumber();
      const quoteTokenQtyReserveAfterTrade =
        quoteTokenQtyReserveBeforeTrade + quoteTokenQtyToTrade - expectedFee;
      const baseTokenReserveQtyAfterTrade =
        pricingConstantK / quoteTokenQtyReserveAfterTrade;
      const baseTokenQtyExpected =
        baseTokenReserveQtyBalance - baseTokenReserveQtyAfterTrade;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration);

      // confirm trade occurred at expected
      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade
      );

      // simulate a 25% rebase down
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // remove liquidity
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          amountToAdd / 2,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // we have now simulated a rebase in quote token, we can execute a second
      // trade and confirm the price is unchanged based on the rebase
      // to make accounting easier, we will clear all base tokens out of our traders wallet now.
      await baseToken
        .connect(trader)
        .transfer(
          accounts[0].address,
          await baseToken.balanceOf(trader.address)
        );
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);

      const quoteTokenQtyToTrade2 = 200000;
      const expectedFee2 = quoteTokenQtyToTrade2 * liquidityFee;
      const baseTokenReserveQtyBalance2 = await baseToken.balanceOf(
        exchange.address
      );

      pricingConstantK =
        (await exchange.internalBalances()).quoteTokenReserveQty *
        (await exchange.internalBalances()).baseTokenReserveQty;
      const quoteTokenQtyReserveBeforeTrade2 =
        pricingConstantK / baseTokenReserveQtyBalance2.toNumber();
      const quoteTokenQtyReserveAfterTrade2 =
        quoteTokenQtyReserveBeforeTrade2 + quoteTokenQtyToTrade2 - expectedFee2;
      const baseTokenReserveQtyAfterTrade2 =
        pricingConstantK / quoteTokenQtyReserveAfterTrade2;
      const baseTokenQtyExpected2 =
        baseTokenReserveQtyBalance2 - baseTokenReserveQtyAfterTrade2;

      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade2, 1, expiration);

      expect(await baseToken.balanceOf(trader.address)).to.equal(
        Math.round(baseTokenQtyExpected2)
      );
      expect(await quoteToken.balanceOf(trader.address)).to.equal(
        amountToAdd - quoteTokenQtyToTrade - quoteTokenQtyToTrade2
      );
    });

    it("Should revert when _expirationTimestamp is expired", async () => {
      const expiration = Math.round(new Date().getTime() / 1000 - 60 * 50); // 50 minutes in the past.
      const liquidityProvider = accounts[1];

      await expect(
        exchange
          .connect(liquidityProvider)
          .swapQuoteTokenForBaseToken(1, 1, expiration)
      ).to.be.revertedWith("Exchange: EXPIRED");
    });

    it("Should revert when no liquidity is available", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send a second user (liquidity provider) quote and base tokens.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      // send trader quote tokens
      await quoteToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await quoteToken.connect(trader).approve(exchange.address, amountToAdd);
      // confirm no balance before trade.
      expect(await baseToken.balanceOf(trader.address)).to.equal(0);
      expect(await quoteToken.balanceOf(trader.address)).to.equal(amountToAdd);

      // attempt a trade which should fail since our exchange has no liquidity.
      const quoteTokenQtyToTrade = 100000;
      await expect(
        exchange
          .connect(trader)
          .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration)
      ).to.be.revertedWith("Exchange: INSUFFICIENT_BASE_TOKEN_QTY");

      // create liquidity
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // trade should now work.
      await exchange
        .connect(trader)
        .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration);

      expect(await baseToken.balanceOf(trader.address)).to.not.equal(0);

      // simulate a 25% rebase down
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // remove all liquidity
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // attempt a trade which should also now fail with a revert.
      await expect(
        exchange
          .connect(trader)
          .swapQuoteTokenForBaseToken(quoteTokenQtyToTrade, 1, expiration)
      ).to.be.revertedWith("Exchange: INSUFFICIENT_BASE_TOKEN_QTY");
    });
  });

  describe("addLiquidity", () => {
    it("Should allow for adding base token liquidity (only) after a rebase up has occurred, and correct withdraw of re-based qty", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs base tokens for single asset entry.
      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 40;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the exchange now has the expected balance after rebase
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(50);

      // confirm that the exchange internal accounting of reserves is the amount
      // added by the first liquidity provider.
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        10
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        50
      );

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      // we should be able to now add base tokens in order to offset the quote tokens
      // that have been accumulated from the rebase but are not adding liquidity. This
      // should be able to be done using the `addLiquidity` function.
      await exchange.connect(liquidityProvider2).addLiquidity(
        0, // no quote tokens
        200, // base token desired alphaDecay / omega = 40 / .2 = 200
        0, // no quote tokens
        1, // base token min
        liquidityProvider2.address,
        expiration
      );

      // confirm that the decay has been mitigated completely.
      const quoteTokenDecayAfterSingleAssetEntry =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterSingleAssetEntry).to.equal(0);

      // confirm original LP can get correct amounts back.
      const liquidityProviderQuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - 10;
      const liquidityProviderBaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 50;

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance
      );

      // this should distribute 30 quote tokens and 150 base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance + 30
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance + 150
      );

      // confirm second LP can get an equivalent amount of both assets back (they only gave 1 asset)
      const liquidityProvider2QuoteTokenExpectedBalance = 0;
      const liquidityProvider2BaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 200;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // this should issue 20 quote and 100 base tokens
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance + 20
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance + 100
      );
    });

    it("Should allow for adding base and quote token liquidity after a rebase up has occurred, and correct withdraw of re-based qty", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );

      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 40;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the exchange now has the expected balance after rebase
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(50);

      // confirm that the exchange internal accounting of reserves is the amount
      // added by the first liquidity provider.
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        10
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        50
      );

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      // we should be able to now add base tokens in order to offset the quote tokens
      // that have been accumulated from the rebase but are not adding liquidity. Additionally,
      // we should be able to add more base and quote tokens in the correct ratio
      // after the decay has been depleted.

      // We want to add 200 base tokens to remove the decay (alphaDecay / omega = 40 / .2 = 200)
      // but we should be able to add another 100 base tokens (300 total) but this will
      // require we also add the complement of quote tokens in the above ratio 1/5.
      // So it will require 20 quote tokens to maintain the stable ratio

      await exchange.connect(liquidityProvider2).addLiquidity(
        20, // 20 quote tokens to maintain the 1/5 ratio of quote / base
        300, // 200 to remove decay, plus an additional 100
        20, // enforce the call has to take our quote tokens
        300, // enforce the call has to take our base tokens
        liquidityProvider2.address,
        expiration
      );

      // confirm that the decay has been mitigated completely.
      const quoteTokenDecayAfterSingleAssetEntry =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterSingleAssetEntry).to.equal(0);

      // confirm original LP can get correct amounts back.
      const liquidityProviderQuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - 10;
      const liquidityProviderBaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 50;

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance
      );

      // this should distribute 30 quote tokens and 150 base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance + 30
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance + 150
      );

      // confirm second LP can get an equivalent amount of both assets back
      const liquidityProvider2QuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - 20;
      const liquidityProvider2BaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 300;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // this should issue 40 quote and 200 base tokens
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance + 40
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance + 200
      );

      // confirm the exchange has no balances, and that a new LP could add balances
      // and set a new ratio.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(0);
      expect(await baseToken.balanceOf(exchange.address)).to.equal(0);

      const quoteTokenLiquidityToAdd2 = 100;
      const baseTokenLiquidityToAdd2 = 333;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd2, // quote token
        baseTokenLiquidityToAdd2, // base token
        quoteTokenLiquidityToAdd2,
        baseTokenLiquidityToAdd2,
        liquidityProvider.address,
        expiration
      );

      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        quoteTokenLiquidityToAdd2
      );
      expect(await baseToken.balanceOf(exchange.address)).to.equal(
        baseTokenLiquidityToAdd2
      );
    });

    it("Should allow for adding quote token liquidity (only) after a rebase down has occurred, and correct withdraw of re-based qty", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs quote tokens for single asset entry.
      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      const quoteTokenLiquidityToAdd = 10;
      const baseTokenLiquidityToAdd = 50;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd, // quote token
        baseTokenLiquidityToAdd, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.
      const quoteTokenRebaseDownAmount = 2;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      // this means we should have quoteTokenLiquidityToAdd - quoteTokenRebaseDownAmount
      // remaining in exchange, confirm this
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        quoteTokenLiquidityToAdd - quoteTokenRebaseDownAmount
      );

      // confirm internal accounting is unchanged.
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        quoteTokenLiquidityToAdd
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        baseTokenLiquidityToAdd
      );

      // confirm the "decay" is equal to the re-based amount times the previous iOmega (B/A). (this is betaDecay)
      const iOmega = baseTokenLiquidityToAdd / quoteTokenLiquidityToAdd;
      const baseTokenDecay =
        ((await exchange.internalBalances()).quoteTokenReserveQty -
          (await quoteToken.balanceOf(exchange.address))) *
        iOmega;

      expect(baseTokenDecay).to.equal(quoteTokenRebaseDownAmount * iOmega);

      // we should be able to now add quote tokens in order to offset the quote tokens
      // that have been "removed" during the rebase down.
      await exchange.connect(liquidityProvider2).addLiquidity(
        quoteTokenRebaseDownAmount,
        0, // no base tokens
        1,
        0, // no base tokens
        liquidityProvider2.address,
        expiration
      );

      // confirm lp2 has less quote tokens
      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount
      );

      // we should have no decay any longer.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        (await exchange.internalBalances()).quoteTokenReserveQty
      );

      // base token accounting should have not have changed
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        baseTokenLiquidityToAdd
      );
      expect(await baseToken.balanceOf(exchange.address)).to.equal(
        baseTokenLiquidityToAdd
      );

      // confirm original LP can get correct amounts back.
      const liquidityProviderQuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - quoteTokenLiquidityToAdd;
      const liquidityProviderBaseTokenExpectedBalance =
        liquidityProviderInitialBalances - baseTokenLiquidityToAdd;

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance
      );

      /**
       * some general sanity check math.
       * Token A = 10; 100$ -> Token A is worth 10$
       * Token B = 50; 100$ -> Token B is worth 2$
       * LP1 provided 200$ worth receives 50 LP tokens
       *
       * LP2 provides 2 Token A -> $20 worth or 1/10th of LP1 receives 5 LP tokens
       *
       * LP1 gets back 9 A and 45 B tokens (90+90 = 180$) - experienced a 20% rebase down on half of his position
       * LP2 gets back 1 A and 5 B tokens (10+10 = 20$) - contributed post rebase.
       *
       * This difference is due to the rebase. LP1 experienced the initial rebase while LP2 contributed post rebase.
       *
       */

      // this should distribute 9 quote tokens and 45 base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // confirm LP1 has expected balance
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance + 9
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance + 45
      );

      // confirm second LP can get an equivalent amount of both assets back (they only gave 1 asset)
      const liquidityProvider2QuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount;
      const liquidityProvider2BaseTokenExpectedBalance = 0;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // this should issue 1 quote and 5 base tokens
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance + 1
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance + 5
      );
    });

    it("Should allow for adding base and quote token liquidity after a rebase down has occurred, and correct withdraw of re-based qty", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );

      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      const quoteTokenLiquidityToAdd = 10;
      const baseTokenLiquidityToAdd = 50;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd, // quote token
        baseTokenLiquidityToAdd, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.
      const quoteTokenRebaseDownAmount = 2;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      // this means we should have quoteTokenLiquidityToAdd - quoteTokenRebaseDownAmount
      // remaining in exchange, confirm this
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        quoteTokenLiquidityToAdd - quoteTokenRebaseDownAmount
      );

      // confirm the "decay" is equal to the re-based amount times the previous iOmega (B/A). (this is betaDecay)
      const iOmega = baseTokenLiquidityToAdd / quoteTokenLiquidityToAdd;
      const baseTokenDecay =
        ((await exchange.internalBalances()).quoteTokenReserveQty -
          (await quoteToken.balanceOf(exchange.address))) *
        iOmega;

      expect(baseTokenDecay).to.equal(quoteTokenRebaseDownAmount * iOmega);

      // we should be able to now add quote tokens in order to offset the quote tokens
      // that have been "removed" during the rebase down.
      // and we should also be able to add additional tokens in the correct ratio.
      // if we are adding 10 quote tokens, we need to add 50 base tokens since
      // the current ratio is 1/5.
      await exchange
        .connect(liquidityProvider2)
        .addLiquidity(
          quoteTokenRebaseDownAmount + 10,
          50,
          quoteTokenRebaseDownAmount + 10,
          50,
          liquidityProvider2.address,
          expiration
        );

      // confirm lp2 has less quote tokens
      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount - 10
      );

      // we should have no decay any longer.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        (await exchange.internalBalances()).quoteTokenReserveQty
      );

      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        baseTokenLiquidityToAdd + 50
      );
      expect(await baseToken.balanceOf(exchange.address)).to.equal(
        baseTokenLiquidityToAdd + 50
      );

      // confirm original LP can get correct amounts back.
      const liquidityProviderQuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - quoteTokenLiquidityToAdd;
      const liquidityProviderBaseTokenExpectedBalance =
        liquidityProviderInitialBalances - baseTokenLiquidityToAdd;

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance
      );

      /**
       * some general sanity check math.
       * Token A = 10; 100$ -> Token A is worth 10$
       * Token B = 50; 100$ -> Token B is worth 2$
       * LP1 provided 200$ worth receives 50 LP tokens
       *
       * LP2 provides 2 Token A -> $20 worth or 1/10th of LP1 receives 5 LP tokens
       *
       * LP1 gets back 9 A and 45 B tokens (90+90 = 180$) - experienced a 20% rebase down on half of his position
       * LP2 gets back 1 A and 5 B tokens (10+10 = 20$) - contributed post rebase.
       *
       * This difference is due to the rebase. LP1 experienced the initial rebase while LP2 contributed post rebase.
       *
       */

      // this should distribute 9 quote tokens and 45 base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // confirm LP1 has expected balance
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance + 9
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance + 45
      );

      // confirm second LP can get an equivalent amount of both assets back (they only gave 1 asset)
      const liquidityProvider2QuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount - 10;
      const liquidityProvider2BaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 50;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // this should issue 1 quote and 5 base tokens, plus another 10 quote and 50 base tokens
      // resulting from the additional provided beyond the decay.
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance + 1 + 10
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance + 5 + 50
      );

      // confirm the exchange has no balances, and that a new LP could add balances
      // and set a new ratio.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(0);
      expect(await baseToken.balanceOf(exchange.address)).to.equal(0);

      const quoteTokenLiquidityToAdd2 = 100;
      const baseTokenLiquidityToAdd2 = 333;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd2, // quote token
        baseTokenLiquidityToAdd2, // base token
        quoteTokenLiquidityToAdd2,
        baseTokenLiquidityToAdd2,
        liquidityProvider.address,
        expiration
      );

      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        quoteTokenLiquidityToAdd2
      );
      expect(await baseToken.balanceOf(exchange.address)).to.equal(
        baseTokenLiquidityToAdd2
      );
    });

    it("Should handle adding new liquidity after removing liquidity when decay is present due to rebase up", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );

      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        1000, // quote token
        3333, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 500;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the exchange now has the expected balance after rebase
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(1500);

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      let quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      // with quote token decay present, remove all liquidity.
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderInitialBalances + rebaseAmount
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderInitialBalances
      );

      // confirm a second LP can now add both tokens, set a new ratio, and have no
      // decay present after doing so.
      await exchange.connect(liquidityProvider2).addLiquidity(
        3333, // quote token
        1000, // base token
        1,
        1,
        liquidityProvider2.address,
        expiration
      );

      const liquidityProvider2QuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - 3333;
      const liquidityProvider2BaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 1000;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // confirm the decay is 0
      quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(0);
    });

    it("Should handle adding new liquidity after removing liquidity when decay is present due to rebase down", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );

      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        1000, // quote token
        3333, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 500;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      // confirm the exchange now has the expected balance after rebase
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(500);

      let quoteTokenDiff =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDiff).to.equal(rebaseAmount * -1);

      // with quote token decay present, remove all liquidity.
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      expect(await quoteToken.balanceOf(exchange.address)).to.equal(0);
      expect(await baseToken.balanceOf(exchange.address)).to.equal(0);

      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        0
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        0
      );

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderInitialBalances - rebaseAmount
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderInitialBalances
      );

      // confirm a second LP can now add both tokens, set a new ratio, and have no
      // decay present after doing so.
      await exchange.connect(liquidityProvider2).addLiquidity(
        3333, // quote token
        1000, // base token
        1,
        1,
        liquidityProvider2.address,
        expiration
      );

      const liquidityProvider2QuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - 3333;
      const liquidityProvider2BaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 1000;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // confirm the decay is 0
      quoteTokenDiff =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDiff).to.equal(0);
    });

    it("Should handle trivial amounts of quote token decay properly (issue 1)", async () => {
      // Issue 1: we have quote token decay that has a fractional (1:6.6666) token amount
      // required to resolve it. We should allow a user to resolve it by providing the required amount
      // of base tokens (7) to fully resolve 1 unit.

      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 10000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        100000, // quote token
        666666, // base token
        100000,
        666666,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      // note this is a trivial amount to try and force us into a "bad" state
      const rebaseAmount = 1;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      await exchange
        .connect(liquidityProvider)
        .addLiquidity(0, 7, 0, 7, liquidityProvider2.address, expiration);

      // confirm that the decay is gone
      const quoteTokenDecayAfterSingleAssetEntry =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterSingleAssetEntry).to.equal(0);
      // confirm lp tokens got issued
      expect(await exchange.balanceOf(liquidityProvider2.address)).to.not.equal(
        0
      );
    });

    it("Should handle trivial amounts of quote token decay properly (issue 2)", async () => {
      // similar to the above test but with a omega that would round to zero instead of 1
      // (.3333 vs .6666)

      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 10000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        100000, // quote token
        333333, // base token
        100000,
        333333,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      // note this is a trivial amount to try and force us into a "bad" state
      const rebaseAmount = 1;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      await exchange
        .connect(liquidityProvider)
        .addLiquidity(0, 3, 0, 3, liquidityProvider2.address, expiration);

      // confirm that the decay is gone
      const quoteTokenDecayAfterSingleAssetEntry =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterSingleAssetEntry).to.equal(0);
      // confirm lp tokens got issued
      expect(await exchange.balanceOf(liquidityProvider2.address)).to.not.equal(
        0
      );
    });

    it("Should handle trivial amounts of quote token decay properly (issue 3)", async () => {
      // scenario where the quote token decay is less than a single unit
      // of our base token.  1 Quote:3.33 base and our decay is 2 units or 2/3.333 of a base
      // base token

      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 10000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        333333, // quote token
        100000, // base token
        333333,
        100000,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      // note this is a trivial amount to try and force us into a "bad" state
      const rebaseAmount = 1;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      // if we try and add a single asset if should fail since
      // the amount of decay is less than 1 base token worth.
      // We will try both ways.
      await expect(
        exchange
          .connect(liquidityProvider)
          .addLiquidity(0, 1, 0, 0, liquidityProvider2.address, expiration)
      ).to.be.revertedWith("MathLib: INSUFFICIENT_QTY");

      await expect(
        exchange.addBaseTokenLiquidity(
          1,
          1,
          liquidityProvider2.address,
          expiration
        )
      ).to.be.revertedWith("Exchange: INSUFFICIENT_DECAY");

      // we can do 2 more units, and should expect the same behavior since we are
      // still less than 1 full unit of decay in terms of our base tokens
      await quoteToken.transfer(exchange.address, 2);

      await expect(
        exchange
          .connect(liquidityProvider)
          .addLiquidity(0, 1, 0, 0, liquidityProvider2.address, expiration)
      ).to.be.revertedWith("MathLib: INSUFFICIENT_QTY");

      await expect(
        exchange.addBaseTokenLiquidity(
          1,
          1,
          liquidityProvider2.address,
          expiration
        )
      ).to.be.revertedWith("Exchange: INSUFFICIENT_DECAY");

      // if we rebase down 1 more quote unit, now we should be able to add 1 unit of base token
      await quoteToken.transfer(exchange.address, 1);
      expect(
        await exchange
          .connect(liquidityProvider)
          .addLiquidity(0, 1, 0, 0, liquidityProvider2.address, expiration)
      );

      // the above scenario ends up issuing less than 1 full unit of liquidity token
      // and therefore gets truncated to 0.
      expect(await exchange.balanceOf(liquidityProvider2.address)).to.equal(0);
    });

    it("Should handle trivial amounts of base token decay properly (issue 1)", async () => {
      // trivial amount of base token decay with our base token being a fractional amount ouf our quote
      // token... (ie omega < 1)

      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 10000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        100000, // quote token
        333333, // base token
        100000,
        333333,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      // note this is a trivial amount to try and force us into a "bad" state
      const rebaseAmount = 1;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      const quoteTokenDiff =
        (await exchange.internalBalances()).quoteTokenReserveQty -
        (await quoteToken.balanceOf(exchange.address));

      expect(quoteTokenDiff).to.equal(rebaseAmount);

      await exchange
        .connect(liquidityProvider)
        .addLiquidity(1, 0, 1, 0, liquidityProvider2.address, expiration);

      // confirm that the decay has been mitigated completely.
      const quoteTokenDecayAfterSingleAssetEntry =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterSingleAssetEntry).to.equal(0);

      expect(await exchange.balanceOf(liquidityProvider2.address)).to.not.equal(
        0
      );
    });

    it("Should handle trivial amounts of base token decay properly (issue 2)", async () => {
      // trivial amount of base token decay where omega > 1
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 10000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        333333, // quote token
        100000, // base token
        333333,
        100000,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      // note this is a trivial amount to try and force us into a "bad" state
      const rebaseAmount = 1;
      await quoteToken.simulateRebaseDown(exchange.address, rebaseAmount);

      const quoteTokenDiff =
        (await exchange.internalBalances()).quoteTokenReserveQty -
        (await quoteToken.balanceOf(exchange.address));

      expect(quoteTokenDiff).to.equal(rebaseAmount);
      await expect(
        exchange
          .connect(liquidityProvider)
          .addQuoteTokenLiquidity(1, 1, liquidityProvider2.address, expiration)
      ).to.be.revertedWith("Exchange: INSUFFICIENT_DECAY");

      // the below call will succeed, but only because due to truncation
      // we don't actually require any base token assets to be added.
      // the math looks like 1:.3333 and .33333 truncates to 0.
      // NOTE: should we revert in this scenario?
      await exchange
        .connect(liquidityProvider)
        .addLiquidity(1, 0, 1, 0, liquidityProvider2.address, expiration);
    });

    it("Should revert if minimum base token amount isn't satisfied", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs quote tokens for single asset entry.
      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      const quoteTokenLiquidityToAdd = 10;
      const baseTokenLiquidityToAdd = 50;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd, // quote token
        baseTokenLiquidityToAdd, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.
      const quoteTokenRebaseDownAmount = 2;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      await expect(
        exchange.connect(liquidityProvider2).addLiquidity(
          quoteTokenRebaseDownAmount,
          1, // no base tokens
          1,
          1, // expect this to revert since we will not be able to add any base tokens
          liquidityProvider2.address,
          expiration
        )
      ).to.be.revertedWith("Exchange: INSUFFICIENT_BASE_QTY");
    });

    it("Should revert if minimum quote token amount isn't satisfied", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs base tokens for single asset entry.
      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 40;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      await expect(
        exchange.connect(liquidityProvider2).addLiquidity(
          1, // no quote tokens
          200, // base token desired alphaDecay / omega = 40 / .2 = 200
          1, // no quote tokens - should revert
          1, // base token min
          liquidityProvider2.address,
          expiration
        )
      ).to.be.revertedWith("Exchange: INSUFFICIENT_QUOTE_QTY");
    });

    it("Should revert when _expirationTimestamp is expired", async () => {
      const expiration = Math.round(new Date().getTime() / 1000 - 60 * 50); // 50 minutes in the past.
      const liquidityProvider = accounts[1];

      await expect(
        exchange
          .connect(liquidityProvider)
          .addLiquidity(50, 100, 1, 1, liquidityProvider.address, expiration)
      ).to.be.revertedWith("Exchange: EXPIRED");
    });
  });

  describe("addQuoteTokenLiquidity", () => {
    it("Should allow for adding quote token liquidity (only) after a rebase down has occurred, and correct withdraw of re-based qty", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs quote tokens for single asset entry.
      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      const quoteTokenLiquidityToAdd = 10;
      const baseTokenLiquidityToAdd = 50;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd, // quote token
        baseTokenLiquidityToAdd, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.
      const quoteTokenRebaseDownAmount = 2;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      // this means we should have quoteTokenLiquidityToAdd - quoteTokenRebaseDownAmount
      // remaining in exchange, confirm this
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        quoteTokenLiquidityToAdd - quoteTokenRebaseDownAmount
      );

      // confirm internal accounting is unchanged.
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        quoteTokenLiquidityToAdd
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        baseTokenLiquidityToAdd
      );

      // confirm the "decay" is equal to the re-based amount times the previous iOmega (B/A). (this is betaDecay)
      const iOmega = baseTokenLiquidityToAdd / quoteTokenLiquidityToAdd;
      const baseTokenDecay =
        ((await exchange.internalBalances()).quoteTokenReserveQty -
          (await quoteToken.balanceOf(exchange.address))) *
        iOmega;

      expect(baseTokenDecay).to.equal(quoteTokenRebaseDownAmount * iOmega);

      // we should be able to now add quote tokens in order to offset the quote tokens
      // that have been "removed" during the rebase down.
      await exchange
        .connect(liquidityProvider2)
        .addQuoteTokenLiquidity(
          quoteTokenRebaseDownAmount,
          1,
          liquidityProvider2.address,
          expiration
        );

      // confirm lp2 has less quote tokens
      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount
      );

      // we should have no decay any longer.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        (await exchange.internalBalances()).quoteTokenReserveQty
      );

      // base token accounting should have not have changed
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        baseTokenLiquidityToAdd
      );
      expect(await baseToken.balanceOf(exchange.address)).to.equal(
        baseTokenLiquidityToAdd
      );

      // confirm original LP can get correct amounts back.
      const liquidityProviderQuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - quoteTokenLiquidityToAdd;
      const liquidityProviderBaseTokenExpectedBalance =
        liquidityProviderInitialBalances - baseTokenLiquidityToAdd;

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance
      );

      /**
       * some general sanity check math.
       * Token A = 10; 100$ -> Token A is worth 10$
       * Token B = 50; 100$ -> Token B is worth 2$
       * LP1 provided 200$ worth receives 50 LP tokens
       *
       * LP2 provides 2 Token A -> $20 worth or 1/10th of LP1 receives 5 LP tokens
       *
       * LP1 gets back 9 A and 45 B tokens (90+90 = 180$) - experienced a 20% rebase down on half of his position
       * LP2 gets back 1 A and 5 B tokens (10+10 = 20$) - contributed post rebase.
       *
       * This difference is due to the rebase. LP1 experienced the initial rebase while LP2 contributed post rebase.
       *
       */

      // this should distribute 9 quote tokens and 45 base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // confirm LP1 has expected balance
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance + 9
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance + 45
      );

      // confirm second LP can get an equivalent amount of both assets back (they only gave 1 asset)
      const liquidityProvider2QuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount;
      const liquidityProvider2BaseTokenExpectedBalance = 0;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // this should issue 1 quote and 5 base tokens
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance + 1
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance + 5
      );
    });

    it("Should revert addQuoteTokenLiquidity when _expirationTimestamp is expired", async () => {
      const expiration = Math.round(new Date().getTime() / 1000 - 60 * 50); // 50 minutes in the past.
      const liquidityProvider = accounts[1];

      await expect(
        exchange
          .connect(liquidityProvider)
          .addQuoteTokenLiquidity(
            400,
            205,
            liquidityProvider.address,
            expiration
          )
      ).to.be.revertedWith("Exchange: EXPIRED");
    });

    it("Should revert addQuoteTokenLiquidity when there is insufficient decay ", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs base tokens for single asset entry.
      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.
      const quoteTokenRebaseDownAmount = 2;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      // if we attempt to add a minimum of more than 2 quote tokens, this should revert
      await expect(
        exchange.connect(liquidityProvider2).addQuoteTokenLiquidity(
          10,
          5, // min 5 when we only have 2 tokens worth of decay.
          liquidityProvider2.address,
          expiration
        )
      ).to.be.revertedWith("Exchange: INSUFFICIENT_DECAY");
    });
  });

  describe("addBaseTokenLiquidity", () => {
    it("Should allow for adding base token liquidity (only) after a rebase up has occurred, and correct withdraw of re-based qty", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs base tokens for single asset entry.
      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 40;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the exchange now has the expected balance after rebase
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(50);

      // confirm that the exchange internal accounting of reserves is the amount
      // added by the first liquidity provider.
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        10
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        50
      );

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      // we should be able to now add base tokens in order to offset the quote tokens
      // that have been accumulated from the rebase but are not adding liquidity.
      await exchange.connect(liquidityProvider2).addBaseTokenLiquidity(
        200, // alphaDecay / omega = 40 / .2 = 200
        1,
        liquidityProvider2.address,
        expiration
      );

      // confirm that the decay has been mitigated completely.
      const quoteTokenDecayAfterSingleAssetEntry =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterSingleAssetEntry).to.equal(0);

      // confirm original LP can get correct amounts back.
      const liquidityProviderQuoteTokenExpectedBalance =
        liquidityProviderInitialBalances - 10;
      const liquidityProviderBaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 50;

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance
      );

      // this should distribute 30 quote tokens and 150 base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderQuoteTokenExpectedBalance + 30
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderBaseTokenExpectedBalance + 150
      );

      // confirm second LP can get an equivalent amount of both assets back (they only gave 1 asset)
      const liquidityProvider2QuoteTokenExpectedBalance = 0;
      const liquidityProvider2BaseTokenExpectedBalance =
        liquidityProviderInitialBalances - 200;

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance
      );

      // this should issue 20 quote and 100 base tokens
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await quoteToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2QuoteTokenExpectedBalance + 20
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        liquidityProvider2BaseTokenExpectedBalance + 100
      );
    });

    it("Should revert when adding base token liquidity (only) when no decay is present", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs base tokens for single asset entry.
      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // confirm that the exchange internal accounting of reserves is the amount
      // added by the first liquidity provider.
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        10
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        50
      );

      // confirm there is no "decay"
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(0);

      // the below transaction should revert.
      await expect(
        exchange
          .connect(liquidityProvider2)
          .addBaseTokenLiquidity(200, 1, liquidityProvider2.address, expiration)
      ).to.be.revertedWith("Exchange: NO_QUOTE_DECAY");
    });

    it("Should revert addBaseTokenLiquidity when there is insufficient decay ", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs base tokens for single asset entry.
      await baseToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        10, // quote token
        50, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      const rebaseAmount = 40;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // confirm the "decay" is equal to the rebase amount. (this is alphaDecay)
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecay).to.equal(rebaseAmount);

      // if we attempt to add a minimum of more than 200 base tokens, this should revert
      await expect(
        exchange.connect(liquidityProvider2).addBaseTokenLiquidity(
          400, // alphaDecay / omega = 40 / .2 = 200
          205,
          liquidityProvider2.address,
          expiration
        )
      ).to.be.revertedWith("Exchange: INSUFFICIENT_DECAY");
    });

    it("Should revert addBaseTokenLiquidity when _expirationTimestamp is expired", async () => {
      const expiration = Math.round(new Date().getTime() / 1000 - 60 * 50); // 50 minutes in the past.
      const liquidityProvider = accounts[1];

      await expect(
        exchange
          .connect(liquidityProvider)
          .addBaseTokenLiquidity(
            400,
            205,
            liquidityProvider.address,
            expiration
          )
      ).to.be.revertedWith("Exchange: EXPIRED");
    });
  });

  describe("removeLiquidity", () => {
    it("Should return correct amount to liquidity provider after rebase down", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const liquidityProvider2 = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialBalances = 1000000;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBalances
      );
      // lp2 only needs quote tokens for single asset entry.
      await quoteToken.transfer(
        liquidityProvider2.address,
        liquidityProviderInitialBalances
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBalances);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, liquidityProviderInitialBalances);

      const quoteTokenLiquidityToAdd = 10;
      const baseTokenLiquidityToAdd = 50;

      await exchange.connect(liquidityProvider).addLiquidity(
        quoteTokenLiquidityToAdd, // quote token
        baseTokenLiquidityToAdd, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.
      const quoteTokenRebaseDownAmount = 2;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      // this should distribute all quote tokens and all base tokens back to our liquidity provider
      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider.address),
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // confirm LP1 has expected balances (everything he started with minus rebase)
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderInitialBalances - quoteTokenRebaseDownAmount
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        liquidityProviderInitialBalances
      );
    });

    it("Should not allow a trade to drain all liquidity due to a rebase down", async () => {
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];
      const trader = accounts[2];

      // send users (liquidity provider) quote and base tokens for easy accounting.
      const liquidityProviderInitialQuoteBalances = 1000000;
      const liquidityProviderInitialBaseBalances = 500;
      await quoteToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialQuoteBalances
      );
      await baseToken.transfer(
        liquidityProvider.address,
        liquidityProviderInitialBaseBalances
      );

      // the trader needs base tokens to trade for quote tokens, in an attempt to drain all quote tokens
      // since we have excess base tokens in the system due to the rebase down that will occur.
      await baseToken.transfer(
        trader.address,
        liquidityProviderInitialBaseBalances
      );

      // add approvals
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialQuoteBalances);
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, liquidityProviderInitialBaseBalances);
      await baseToken
        .connect(trader)
        .approve(exchange.address, liquidityProviderInitialBaseBalances);

      await exchange.connect(liquidityProvider).addLiquidity(
        liquidityProviderInitialQuoteBalances, // quote token
        liquidityProviderInitialBaseBalances, // base token
        1,
        1,
        liquidityProvider.address,
        expiration
      );

      // simulate a rebase down by sending tokens from our exchange contract away.  90% rebase down.
      const quoteTokenRebaseDownAmount =
        liquidityProviderInitialQuoteBalances * 0.9;
      await quoteToken.simulateRebaseDown(
        exchange.address,
        quoteTokenRebaseDownAmount
      );

      // confirm the exchange now has the expected balance after rebase
      const quoteTokenExternalReserveQty =
        liquidityProviderInitialQuoteBalances - quoteTokenRebaseDownAmount;
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        quoteTokenExternalReserveQty
      );
      expect(await baseToken.balanceOf(exchange.address)).to.equal(
        liquidityProviderInitialBaseBalances
      );

      // execute a trade that could drain all remaining quote reserves;
      const internalPriceRatio =
        (await exchange.internalBalances()).quoteTokenReserveQty.toNumber() /
        (await exchange.internalBalances()).baseTokenReserveQty.toNumber(); // omega
      const baseTokenSwapQty = Math.floor(
        liquidityProviderInitialQuoteBalances / internalPriceRatio
      );

      const internalQuoteTokenReserve = (await exchange.internalBalances())
        .quoteTokenReserveQty;
      const internalBaseTokenReserve = (await exchange.internalBalances())
        .baseTokenReserveQty;

      // confirm that this qty would in fact remove all quote tokens from the exchange.
      const quoteTokenQtyToReturn = await mathLib.calculateQtyToReturnAfterFees(
        baseTokenSwapQty,
        internalBaseTokenReserve,
        internalQuoteTokenReserve,
        liquidityFeeInBasisPoints
      );

      // the qty this would return based on the the internal reserves (x and y) is more than the total balance in the exchange.
      expect(quoteTokenQtyToReturn.toNumber()).to.be.greaterThan(
        (await quoteToken.balanceOf(exchange.address)).toNumber()
      );

      // confirm that the trader has no quote token
      expect(await quoteToken.balanceOf(trader.address)).to.equal(0);

      // our internal math should prevent this from occurring by adjusting the qty curve correctly and the below transaction should not revert.
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(baseTokenSwapQty, 1, expiration);

      expect(
        (await quoteToken.balanceOf(trader.address)).toNumber()
      ).to.be.greaterThan(0);
    });

    it("Should revert when _expirationTimestamp is expired", async () => {
      const expiration = Math.round(new Date().getTime() / 1000 - 60 * 50); // 50 minutes in the past.
      const liquidityProvider = accounts[1];

      await expect(
        exchange
          .connect(liquidityProvider)
          .removeLiquidity(50, 50, 50, liquidityProvider.address, expiration)
      ).to.be.revertedWith("Exchange: EXPIRED");
    });

    it("Should return the correct amount of tokens and fees to each liquidity provider", async () => {
      const amountToAdd = 2000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider1 = accounts[1];
      const liquidityProvider2 = accounts[2];
      const trader = accounts[3];

      // send liquidity providers quote and base tokens.
      await quoteToken.transfer(liquidityProvider1.address, amountToAdd);
      await baseToken.transfer(liquidityProvider1.address, amountToAdd);
      await quoteToken.transfer(liquidityProvider2.address, amountToAdd);
      await baseToken.transfer(liquidityProvider2.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider1)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider1)
        .approve(exchange.address, amountToAdd);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, amountToAdd);

      const baseTokenQtyAddedByLp1 = amountToAdd / 2;
      // create liquidity from LP 1
      await exchange
        .connect(liquidityProvider1)
        .addLiquidity(
          baseTokenQtyAddedByLp1,
          baseTokenQtyAddedByLp1,
          1,
          1,
          liquidityProvider1.address,
          expiration
        );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);

      // trader executes a first trade
      const baseTokenSwapAmount = 100000;
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(baseTokenSwapAmount, 1, expiration);

      // lp #2 now adds liquidity
      // calculate current ratio for providing liquidity.
      // we want equal liquidity to what is already there so check the base balance
      // for how many base tokens LP2 will need to add.
      const baseTokenQtyAddedByLp2 = await baseToken.balanceOf(
        exchange.address
      );
      const quoteTokenQty = await quoteToken.balanceOf(exchange.address);
      const baseTokenQty = await baseToken.balanceOf(exchange.address);
      const ratio = quoteTokenQty.toNumber() / baseTokenQty.toNumber();

      const quoteTokenQtyToAdd = Math.round(baseTokenQtyAddedByLp2 * ratio);

      // have second liquidity provider add liquidity
      await exchange
        .connect(liquidityProvider2)
        .addLiquidity(
          quoteTokenQtyToAdd,
          baseTokenQtyAddedByLp2,
          quoteTokenQtyToAdd - 1,
          baseTokenQtyAddedByLp2 - 1,
          liquidityProvider2.address,
          expiration
        );

      // ensure both LPs have the same number of LP tokens
      expect(await exchange.balanceOf(liquidityProvider1.address)).to.equal(
        await exchange.balanceOf(liquidityProvider2.address)
      );

      // execute a second trade.
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(baseTokenSwapAmount, 1, expiration);

      // we now should be able to have both lp token holders remove their lp tokens and
      // ensure they received correct allocation of base tokens.
      // LP1 should receive all qty for trade #1 and half for trade #2
      // LP2 should receive qty for trade #2
      // for easy accounting we will clear out the balances of base token in the lp accounts.
      await baseToken
        .connect(liquidityProvider1)
        .transfer(
          baseToken.address,
          await baseToken.balanceOf(liquidityProvider1.address)
        );
      await baseToken
        .connect(liquidityProvider2)
        .transfer(
          baseToken.address,
          await baseToken.balanceOf(liquidityProvider2.address)
        );

      const lp1ExpectedBaseTokenBalance =
        baseTokenQtyAddedByLp1 +
        baseTokenSwapAmount +
        Math.floor(baseTokenSwapAmount / 2);
      const lp2ExpectedBaseTokenBalance =
        baseTokenQtyAddedByLp2.toNumber() + Math.floor(baseTokenSwapAmount / 2);

      await exchange
        .connect(liquidityProvider1)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider1.address),
          1,
          1,
          liquidityProvider1.address,
          expiration
        );

      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          liquidityProvider2.address,
          expiration
        );

      expect(await baseToken.balanceOf(liquidityProvider1.address)).to.equal(
        lp1ExpectedBaseTokenBalance
      );
      expect(await baseToken.balanceOf(liquidityProvider2.address)).to.equal(
        lp2ExpectedBaseTokenBalance
      );
    });

    it("Should return fees to correct liquidity provider", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider1 = accounts[1];
      const liquidityProvider2 = accounts[2];
      const trader = accounts[3];

      // send a liquidity providers quote and base tokens.
      await quoteToken.transfer(liquidityProvider1.address, amountToAdd);
      await baseToken.transfer(liquidityProvider1.address, amountToAdd);
      await quoteToken.transfer(liquidityProvider2.address, amountToAdd);
      await baseToken.transfer(liquidityProvider2.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider1)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider1)
        .approve(exchange.address, amountToAdd);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, amountToAdd);

      // create liquidity from LP 1
      await exchange
        .connect(liquidityProvider1)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider1.address,
          expiration
        );

      // confirm that LP#1 has expected LP tokens
      expect(await exchange.balanceOf(liquidityProvider1.address)).to.equal(
        amountToAdd
      );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);

      // trader executes a first trade
      const swapAmount = 100000;
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      // simulate a 25% rebase by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // create a second trade.
      const swapAmount2 = 200000;
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount2, 1, expiration);

      // our second liquidity provider has to deal with the current decay prior to adding additional liquidity.
      // we currently have quote token decay (quote tokens that are not contributing to liquidity) to remedy this,
      // lp2 needs to add base tokens.
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;

      // omega
      const internalQuoteTokenToBaseTokenQty =
        (await exchange.internalBalances()).quoteTokenReserveQty.toNumber() /
        (await exchange.internalBalances()).baseTokenReserveQty.toNumber();

      // alphaDecay / omega
      const baseTokenQtyNeededToRemoveDecay = Math.floor(
        quoteTokenDecay / internalQuoteTokenToBaseTokenQty
      );

      // have second liquidity provider add liquidity
      await exchange
        .connect(liquidityProvider2)
        .addBaseTokenLiquidity(
          baseTokenQtyNeededToRemoveDecay,
          baseTokenQtyNeededToRemoveDecay - 1,
          liquidityProvider2.address,
          expiration
        );

      const quoteTokenDecayAfterLP2 =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterLP2).to.be.lessThanOrEqual(1);

      // confirm the LP#1 has no quote or base tokens
      expect(await quoteToken.balanceOf(liquidityProvider1.address)).to.equal(
        0
      );
      expect(await baseToken.balanceOf(liquidityProvider1.address)).to.equal(0);

      // withdraw all liquidity from the first provider,
      // and check their fees are correctly accounted for
      await exchange
        .connect(liquidityProvider1)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider1.address),
          1,
          1,
          liquidityProvider1.address,
          expiration
        );

      // check that LP#1 has no more LP token
      expect(await exchange.balanceOf(liquidityProvider1.address)).to.equal(0);

      const remainingQuoteTokens = (
        await quoteToken.balanceOf(exchange.address)
      ).toNumber();
      const remainingBaseTokens = (
        await baseToken.balanceOf(exchange.address)
      ).toNumber();

      const lp2ContributionValueInBaseTokenUnits =
        remainingQuoteTokens / internalQuoteTokenToBaseTokenQty +
        remainingBaseTokens;

      // we expect that Lp2 has the same "value" of tokens and doesn't get any fees that he wasn't a part of the pool during the trades occurring
      expect(lp2ContributionValueInBaseTokenUnits).to.be.approximately(
        baseTokenQtyNeededToRemoveDecay,
        10
      );

      // LP #2 should now be able to remove all his tokens
      // in equal amounts to what he put in (no fees to him or trades occurred).
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          remainingQuoteTokens,
          remainingBaseTokens,
          liquidityProvider2.address,
          expiration
        );

      // check that no more LP tokens are outstanding
      expect(await exchange.totalSupply()).to.equal(0);

      // check that exchange has no reserves left.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(0);
      expect(await baseToken.balanceOf(exchange.address)).to.equal(0);
    });

    it("Should not return fees to liquidity provider who didn't experience any trades", async () => {
      // Note: this is different from the "Should return fees to correct liquidity provider" test due to the order of the withdrawal of LP tokens
      // by the liquidity provider.  Basically, we want to ensure that order doesn't matter.  LP1 can withdraw before or after LP2 and the accounting still
      // is correct.

      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider1 = accounts[1];
      const liquidityProvider2 = accounts[2];
      const trader = accounts[3];

      // send a liquidity providers quote and base tokens.
      await quoteToken.transfer(liquidityProvider1.address, amountToAdd);
      await baseToken.transfer(liquidityProvider1.address, amountToAdd);
      await quoteToken.transfer(liquidityProvider2.address, amountToAdd);
      await baseToken.transfer(liquidityProvider2.address, amountToAdd);

      // add approvals
      await baseToken
        .connect(liquidityProvider1)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider1)
        .approve(exchange.address, amountToAdd);
      await baseToken
        .connect(liquidityProvider2)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider2)
        .approve(exchange.address, amountToAdd);

      // create liquidity from LP 1
      await exchange
        .connect(liquidityProvider1)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider1.address,
          expiration
        );

      // confirm that LP#1 has expected LP tokens
      expect(await exchange.balanceOf(liquidityProvider1.address)).to.equal(
        amountToAdd
      );

      // send trader base tokens
      await baseToken.transfer(trader.address, amountToAdd);
      // add approvals for exchange to trade their base tokens
      await baseToken.connect(trader).approve(exchange.address, amountToAdd);

      // trader executes a first trade
      const swapAmount = 100000;
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount, 1, expiration);

      // simulate a 25% rebase by sending more tokens to our exchange contract.
      const rebaseAmount = amountToAdd * 0.25;
      await quoteToken.transfer(exchange.address, rebaseAmount);

      // create a second trade.
      const swapAmount2 = 200000;
      await exchange
        .connect(trader)
        .swapBaseTokenForQuoteToken(swapAmount2, 1, expiration);

      // our second liquidity provider has to deal with the current decay prior to adding additional liquidity.
      // we currently have quote token decay (quote tokens that are not contributing to liquidity) to remedy this,
      // lp2 needs to add base tokens.
      const quoteTokenDecay =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;

      // omega
      const internalQuoteTokenToBaseTokenQty =
        (await exchange.internalBalances()).quoteTokenReserveQty.toNumber() /
        (await exchange.internalBalances()).baseTokenReserveQty.toNumber();

      // alphaDecay / omega
      const baseTokenQtyNeededToRemoveDecay = Math.floor(
        quoteTokenDecay / internalQuoteTokenToBaseTokenQty
      );

      // have second liquidity provider add liquidity
      await exchange
        .connect(liquidityProvider2)
        .addBaseTokenLiquidity(
          baseTokenQtyNeededToRemoveDecay,
          baseTokenQtyNeededToRemoveDecay - 1,
          liquidityProvider2.address,
          expiration
        );

      const quoteTokenDecayAfterLP2 =
        (await quoteToken.balanceOf(exchange.address)) -
        (await exchange.internalBalances()).quoteTokenReserveQty;
      expect(quoteTokenDecayAfterLP2).to.be.lessThanOrEqual(1);

      // to simplify the accounting we will send all quote and base tokens from the withdrawal to a "clean" address
      const cleanAddress = accounts[4].address;

      // confirm this address has no balances.
      expect(await quoteToken.balanceOf(cleanAddress)).to.equal(0);
      expect(await baseToken.balanceOf(cleanAddress)).to.equal(0);

      // withdraw all liquidity from the second provider,
      // and check that they have accrued no value / fees
      await exchange
        .connect(liquidityProvider2)
        .removeLiquidity(
          await exchange.balanceOf(liquidityProvider2.address),
          1,
          1,
          cleanAddress,
          expiration
        );

      // check that LP#2 has no more LP token
      expect(await exchange.balanceOf(liquidityProvider2.address)).to.equal(0);

      const quoteTokensWithdrawn = (
        await quoteToken.balanceOf(cleanAddress)
      ).toNumber();
      const baseTokensWithdrawn = (
        await baseToken.balanceOf(cleanAddress)
      ).toNumber();

      const lp2ContributionValueInBaseTokenUnits =
        quoteTokensWithdrawn / internalQuoteTokenToBaseTokenQty +
        baseTokensWithdrawn;

      // we expect that Lp2 has the same "value" of tokens and doesn't get any fees that he wasn't a part of the pool during the trades occurring
      // this is "approximately" due to integer rounding in several locations.
      expect(lp2ContributionValueInBaseTokenUnits).to.be.approximately(
        baseTokenQtyNeededToRemoveDecay,
        10
      );
    });

    it("Should allow for user to supply liquidity, a rebase to occur, and correct withdraw of re-based qty", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);
      const liquidityProvider = accounts[1];

      // send a second user (liquidity provider) quote and base tokens for easy accounting.
      await quoteToken.transfer(liquidityProvider.address, amountToAdd);
      await baseToken.transfer(liquidityProvider.address, amountToAdd);

      // check original balances
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        amountToAdd
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        amountToAdd
      );

      // add approvals
      await baseToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);
      await quoteToken
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      await exchange
        .connect(liquidityProvider)
        .addLiquidity(
          amountToAdd,
          amountToAdd,
          1,
          1,
          liquidityProvider.address,
          expiration
        );

      // check token balances after (should be reduced)
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(0);
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(0);
      expect(await exchange.balanceOf(liquidityProvider.address)).to.equal(
        amountToAdd
      );

      // ensure our internal accounting tracks
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        amountToAdd
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        amountToAdd
      );

      // simulate a rebase by sending more tokens to our exchange contract.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        amountToAdd
      );
      const rebaseAmount = 1000;
      await quoteToken.transfer(exchange.address, rebaseAmount);
      // confirm the exchange now has the expected balance after rebase
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(
        amountToAdd + rebaseAmount
      );

      // we should be able to now pull out more tokens than we originally put in due to the rebase
      const totalQuoteTokenQtyToWithdraw = amountToAdd + rebaseAmount;
      // add approval for the liquidity tokens.
      await exchange
        .connect(liquidityProvider)
        .approve(exchange.address, amountToAdd);

      await exchange
        .connect(liquidityProvider)
        .removeLiquidity(
          amountToAdd,
          totalQuoteTokenQtyToWithdraw,
          amountToAdd,
          liquidityProvider.address,
          expiration
        );

      // confirm expected balances after redemption
      expect(await quoteToken.balanceOf(liquidityProvider.address)).to.equal(
        totalQuoteTokenQtyToWithdraw
      );
      expect(await baseToken.balanceOf(liquidityProvider.address)).to.equal(
        amountToAdd
      );
      expect(await exchange.balanceOf(liquidityProvider.address)).to.equal(0);

      // ensure our internal accounting tracks
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        0
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        0
      );

      // ensure we have no balance left of quote or base tokens.
      expect(await quoteToken.balanceOf(exchange.address)).to.equal(0);
      expect(await baseToken.balanceOf(exchange.address)).to.equal(0);
    });

    it("Should allow for user to supply liquidity and immediately withdrawal equal amounts", async () => {
      const amountToAdd = 1000000;
      // create expiration 50 minutes from now.
      const expiration = Math.round(new Date().getTime() / 1000 + 60 * 50);

      // check original balances
      expect(await quoteToken.balanceOf(accounts[0].address)).to.equal(
        initialSupply
      );
      expect(await baseToken.balanceOf(accounts[0].address)).to.equal(
        initialSupply
      );

      // add approvals
      await baseToken.approve(exchange.address, amountToAdd);
      await quoteToken.approve(exchange.address, amountToAdd);

      await exchange.addLiquidity(
        amountToAdd,
        amountToAdd,
        1,
        1,
        accounts[0].address,
        expiration
      );

      // ensure our internal accounting tracks
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        amountToAdd
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        amountToAdd
      );

      // check token balances after (should be reduced)
      expect(await quoteToken.balanceOf(accounts[0].address)).to.equal(
        initialSupply - amountToAdd
      );
      expect(await baseToken.balanceOf(accounts[0].address)).to.equal(
        initialSupply - amountToAdd
      );
      expect(await exchange.balanceOf(accounts[0].address)).to.equal(
        amountToAdd
      );

      // add approval for the liquidity tokens we now have.
      const amountToRedeem = amountToAdd / 2;
      await exchange.approve(exchange.address, amountToRedeem);

      await exchange.removeLiquidity(
        amountToRedeem,
        amountToRedeem,
        amountToRedeem,
        accounts[0].address,
        expiration
      );

      // ensure our internal accounting tracks
      expect((await exchange.internalBalances()).quoteTokenReserveQty).to.equal(
        amountToAdd - amountToRedeem
      );
      expect((await exchange.internalBalances()).baseTokenReserveQty).to.equal(
        amountToAdd - amountToRedeem
      );

      // confirm expected balances after redemption
      expect(await quoteToken.balanceOf(accounts[0].address)).to.equal(
        initialSupply - amountToRedeem
      );
      expect(await baseToken.balanceOf(accounts[0].address)).to.equal(
        initialSupply - amountToRedeem
      );
      expect(await exchange.balanceOf(accounts[0].address)).to.equal(
        amountToRedeem
      );
    });
  });
});
