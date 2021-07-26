const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("ExchangeFactory", () => {
  let exchangeFactory;
  let quoteToken;
  let baseToken;
  let accounts;
  let deployer;

  const name = "Base Quote Pair";
  const symbol = "BvQ";

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [, , , , deployer] = accounts;
    await deployments.fixture();
    const ExchangeFactory = await deployments.get("ExchangeFactory");
    exchangeFactory = new ethers.Contract(
      ExchangeFactory.address,
      ExchangeFactory.abi,
      accounts[0]
    );

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
  });

  it("Should deploy a new exchange with correct name, symbol and addresses", async () => {
    await exchangeFactory
      .connect(deployer)
      .createNewExchange(name, symbol, quoteToken.address, baseToken.address);
    const exchangeAddress = await exchangeFactory.exchangeAddressByTokenAddress(
      quoteToken.address,
      baseToken.address
    );

    const Exchange = await deployments.get("EGT Exchange");
    const exchange = new ethers.Contract(
      exchangeAddress,
      Exchange.abi,
      deployer
    );

    expect(await exchange.name()).to.equal(name);
    expect(await exchange.symbol()).to.equal(symbol);
    expect(await exchange.baseToken()).to.equal(baseToken.address);
    expect(await exchange.quoteToken()).to.equal(quoteToken.address);
  });

  it("Should deploy a new exchange and add to mappings", async () => {
    await exchangeFactory
      .connect(deployer)
      .createNewExchange(name, symbol, quoteToken.address, baseToken.address);
    const exchangeAddress = await exchangeFactory.exchangeAddressByTokenAddress(
      quoteToken.address,
      baseToken.address
    );
    expect(
      await exchangeFactory.isValidExchangeAddress(exchangeAddress)
    ).to.equal(true);
  });

  it("Should deploy a new exchange and emit the correct ExchangeAdded event", async () => {
    expect(
      await exchangeFactory
        .connect(deployer)
        .createNewExchange(name, symbol, quoteToken.address, baseToken.address)
    ).to.emit(exchangeFactory, "NewExchange");
  });

  it("Should revert when the same token pair is attempted to be added twice", async () => {
    await exchangeFactory
      .connect(deployer)
      .createNewExchange(name, symbol, quoteToken.address, baseToken.address);
    await expect(
      exchangeFactory
        .connect(deployer)
        .createNewExchange(name, symbol, quoteToken.address, baseToken.address)
    ).to.be.revertedWith("ExchangeFactory: DUPLICATE_EXCHANGE");
  });

  it("Should revert when the same token is attempted to be used for both base and quote", async () => {
    await expect(
      exchangeFactory
        .connect(deployer)
        .createNewExchange(name, symbol, quoteToken.address, quoteToken.address)
    ).to.be.revertedWith("ExchangeFactory: IDENTICAL_TOKENS");
  });

  it("Should revert when either token address is a null address", async () => {
    await expect(
      exchangeFactory
        .connect(deployer)
        .createNewExchange(
          name,
          symbol,
          quoteToken.address,
          ethers.constants.AddressZero
        )
    ).to.be.revertedWith("ExchangeFactory: INVALID_TOKEN_ADDRESS");

    await expect(
      exchangeFactory
        .connect(deployer)
        .createNewExchange(
          name,
          symbol,
          ethers.constants.AddressZero,
          baseToken.address
        )
    ).to.be.revertedWith("ExchangeFactory: INVALID_TOKEN_ADDRESS");
  });
});
