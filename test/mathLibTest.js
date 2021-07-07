const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("MathLib", () => {
  let mathLib;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    await deployments.fixture();
    const MathLib = await deployments.get("MathLib");
    mathLib = new ethers.Contract(MathLib.address, MathLib.abi, accounts[0]);
  });

  it("Should return expected results from WAD Division", async () => {
    const a = 25;
    const b = 100;
    expect(await mathLib.wDiv(a, b)).to.equal(
      ethers.BigNumber.from(10).pow(18).mul(a).div(b)
    );

    const c = 100;
    const d = 25;
    expect(await mathLib.wDiv(c, d)).to.equal(
      ethers.BigNumber.from(10).pow(18).mul(c).div(d)
    );

    const e = 0;
    const f = 2;
    expect(await mathLib.wDiv(e, f)).to.equal(
      ethers.BigNumber.from(10).pow(18).mul(e).div(f)
    );
  });

  it("Should return expected results from WAD Multiplication", async () => {
    const a = 25;
    const b = 100;
    const wadAB = ethers.BigNumber.from(10).pow(18).mul(a).div(b);
    const c = 3;
    expect(await mathLib.wMul(wadAB, c)).to.equal(wadAB.mul(c));
  });

  it("Should return expected results from WAD Multiplication when zero", async () => {
    const a = 0;
    const b = 100;
    const wadAB = ethers.BigNumber.from(10).pow(18).mul(a).div(b);
    const c = 3;
    expect(await mathLib.wMul(wadAB, c)).to.equal(wadAB.mul(c));
  });

  it("Should return the correct calculateQty", async () => {
    expect(await mathLib.calculateQty(500, 100, 5000)).to.equal(25000);
  });

  it("Should return the correct calculateQtyToReturnAfterFees", async () => {
    const tokenSwapQty = 50;
    const feeInBasisPoints = 30;
    const expectedFeeAmount = (tokenSwapQty * 30) / 10000;
    const tokenAReserveQtyBeforeTrade = 100;
    const tokenAReserveQtyAfterTrade =
      tokenAReserveQtyBeforeTrade + tokenSwapQty - expectedFeeAmount;
    const tokenBReserveQtyBeforeTrade = 5000;
    const pricingConstantK =
      tokenAReserveQtyBeforeTrade * tokenBReserveQtyBeforeTrade;

    const tokenBReserveQtyBeforeTradeAfterTrade =
      pricingConstantK / tokenAReserveQtyAfterTrade;
    const tokenBQtyExpected = Math.floor(
      tokenBReserveQtyBeforeTrade - tokenBReserveQtyBeforeTradeAfterTrade
    );

    expect(
      await mathLib.calculateQtyToReturnAfterFees(
        tokenSwapQty,
        tokenAReserveQtyBeforeTrade,
        tokenBReserveQtyBeforeTrade,
        feeInBasisPoints
      )
    ).to.equal(tokenBQtyExpected);
  });

  it("Should return the correct calculateQtyToReturnAfterFees when fees are zero", async () => {
    const tokenSwapQty = 15;
    const tokenAReserveQtyBeforeTrade = 2000;
    const tokenAReserveQtyAfterTrade =
      tokenAReserveQtyBeforeTrade + tokenSwapQty;
    const tokenBReserveQtyBeforeTrade = 3000;
    const pricingConstantK =
      tokenAReserveQtyBeforeTrade * tokenBReserveQtyBeforeTrade;

    const tokenBReserveQtyBeforeTradeAfterTrade =
      pricingConstantK / tokenAReserveQtyAfterTrade;
    const tokenBQtyExpected = Math.floor(
      tokenBReserveQtyBeforeTrade - tokenBReserveQtyBeforeTradeAfterTrade
    );

    expect(
      await mathLib.calculateQtyToReturnAfterFees(
        tokenSwapQty,
        tokenAReserveQtyBeforeTrade,
        tokenBReserveQtyBeforeTrade,
        0
      )
    ).to.equal(tokenBQtyExpected);
  });

  describe("calculateLiquidityTokenQtyForDoubleAssetEntry", () => {
    it("Should return the correct qty of liquidity tokens", async () => {
      const totalSupplyOfLiquidityTokens = 50;
      const baseTokenBalance = 50;
      const baseTokenQtyToAdd = 15;

      expect(
        await mathLib.calculateLiquidityTokenQtyForDoubleAssetEntry(
          totalSupplyOfLiquidityTokens,
          baseTokenQtyToAdd,
          baseTokenBalance
        )
      ).to.equal(15);
    });
  });

  describe("roundToNearest", () => {
    it("Should round up correctly", async () => {
      expect(await mathLib.roundToNearest(10000005, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000006, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000007, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000008, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000009, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000010, 10)).to.equal(10000010);

      expect(await mathLib.roundToNearest(333335000, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333335001, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333335999, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333336999, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333339999, 10000)).to.equal(
        333340000
      );
    });

    it("Should round down correctly", async () => {
      expect(await mathLib.roundToNearest(10000000, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000001, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000002, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000003, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000004, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000499, 1000)).to.equal(10000000);

      expect(await mathLib.roundToNearest(333330000, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333330001, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333331999, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333332999, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333332999, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333334999, 10000)).to.equal(
        333330000
      );
    });

    it("Should handle 0 correctly", async () => {
      expect(await mathLib.roundToNearest(0, 10)).to.equal(0);
    });
  });

  describe("diff", () => {
    it("Should handle a > b correctly", async () => {
      expect(await mathLib.diff(2000, 200)).to.equal(2000 - 200);
      expect(await mathLib.diff(5555, 333)).to.equal(5555 - 333);
    });

    it("Should handle a < b correctly", async () => {
      expect(await mathLib.diff(200, 2000)).to.equal(2000 - 200);
      expect(await mathLib.diff(333, 5555)).to.equal(5555 - 333);
    });

    it("Should handle a == b correctly", async () => {
      expect(await mathLib.diff(100, 100)).to.equal(0);
    });

    it("Should handle 0's correctly", async () => {
      expect(await mathLib.diff(0, 10)).to.equal(10);
      expect(await mathLib.diff(10, 0)).to.equal(10);
    });
  });
});
