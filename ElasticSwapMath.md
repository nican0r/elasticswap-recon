# Elastic Swap v1 - Math Documentation

This document is created to explain the technical-mathematical terms and concepts behind ElasticSwap v1.

## Introduction

Elastic Swap is the first Automated Market Maker (AMM) to natively support tokens with elastic supply. It is heavily influenced by UniSwap's implementation and diverges from their design in the fact that the `quoteToken` in each `Exchange` can be a token with elastic or fixed supply.

The initial sheet from which the model was derived from can be found [here](https://docs.google.com/spreadsheets/d/1bAX4x2MQWlfI3c0x6QRzlxhODL0ut1dLrqabWDc98eM/edit?usp=sharing).

## Technical Terms

> Note: The usage of dash notation (`'`) & delta notation (`Δ`) is explained in subsequent examples in the following sections.

- `X` - The internal balance of `quoteToken`, for accounting purposes.
- `DeltaX (ΔX)` - The (incoming or outgoing) change in the value of `X`
- `XDash (X')` -> `X' = ΔX + X` - The new value of `X` (when there is presence of `DeltaX (ΔX)`)
- `Y` - The internal balance of `baseToken`, for accounting purposes.
- `DeltaY (ΔY)` - The (incoming or outgoing) change in the value of `Y`
- `YDash (Y')` -> `Y' = ΔY + Y` - The new value of `Y` (when there is presence of `DeltaY (ΔY)`)
- `Alpha (α)` - The balance of `quoteToken` currently in the exchange.
- `Beta (β)` - The balance of `baseToken` currently in the exchange.
- `Omega (ω)` - `X/Y` - The ratio of the internal balance of `quoteToken` to the internal balance of `baseToken`.
- `iOmega (iω) ` - `Y/X` - The ratio of the internal balance of `baseToken` to the internal balance of `quoteToken`.
- `K` - `X*Y` - The product of the internal balance of `quoteToken` and the internal balance of `baseToken`. It is used to price trades between `quoteToken` and `baseToken`.
- `Sigma (σ)` - `α/β` - The ratio of the balance of `quoteToken` currently in the exchange to the balance of `baseToken` currently in the exchange.
- `iSigma (iσ)` - `β/α` - The ratio of the balance of `baseToken` currently in the exchange to the balance of `quoteToken` currently in the exchange.
- `Epsilon (ε)` - `α*β` - The product of the balance of `quoteToken` currently in the exchange and the balance of `baseToken` currently in the exchange.
- `AlphaDecay (α^)` - `α-X` - The amount of `Alpha(α)` not contributing to the liquidity.
- `BetaDecay (β^)` - `β-Y` - The amount of `Beta(β)` not contributing to the liquidity.
- `Ro (ρ)` - The total supply of the `liquidityToken`.
- `Gamma (γ)` - `ΔY / Y / 2 * ( ΔX / α^ )` - Gamma is a multiplier term that is used to issue the correct amounts of `liquidityToken` when `alphaDecay(α^)` or `BetaDecay (β^)` exists in the system.

## Further explained: Presence of `AlphaDecay(α^)` and `BetaDecay(β^)`

It is the presence of `X`, `Y`, `Alpha(α)`, `Beta(β)` that allows the ElasticSwap v1 to support stable pricing on rebases for an elastic-non elastic supply token pair. This is done with the concept of `AlphaDecay(α^)` and `BetaDecay(β^)`.
Whenever there is a rebase event that occurs, which results in the increase or decrease in the supply of the `quoteToken`, decay is introduced. The presence (or absence) of which determines how much `Ro(ρ)` is issued to liquidity providers.

- When there is an increase in the supply of the `quoteToken`, essentially the value of `Alpha(α)` has increased, considering the situation where there was no decay prior to the rebase event, i.e initially `α = X` (and `β = Y`), implying `α^ = 0` (and `β^ = 0`). Post the rebase event: `α^ = α' - X` ( and `β^ = 0`, as there has been no change in `β` or `Y`)
  > Note: In the above scenario, initially `ω = σ`, post the rebase event, `ω' != σ'`
- When there is a contraction in the supply of the `quoteToken`, essentially the value of `Alpha(α)` has now decreased, considering the situation where there was no decay prior to the rebase event, i.e initially `α = X` (and `β = Y`), due to the contraction in supply, the `BetaDecay (β^)` is given by `β^ = (X - α') * iω`.
  > Note: In the above scenario, initially `ω = σ`, post the rebase event, `ω' != σ'`

## Issuance of liquidity Tokens `ΔRo`

Liquidity Tokens `Ro` are provided to liquidity providers.
There are multiple ways to provide liquidity: `singleAssetEntry`, `doubleAssetEntry` and a `partialSingleAndDoubleAssetEntry`.

1. **Double Asset Entry**: Double asset entry occurs when the liquidity provider provides both quoteToken and baseToken (in equivalent amounts, such that Omega stays constant) to the AMM. Double asset entry is only possible when there is **_NO_** `AlphaDecay (α^)` or `BetaDecay (β^)` present in the system. Double asset entry maintains the values of `Omega` and `Sigma`.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = (ΔY/Y) * Ro
   where,
   # ΔRo - The amount of tokens the liquidity provider recieves.
   # ΔY - The amount of baseTokens the liquidity provider wants to provide.
   # Y - The internal balance of baseToken.
   # Ro - The current total supply of the liquidityToken
   ```

   > Note: To understand the usage of Delta(`Δ`) and Dash(`'`) notation,
   > the above scenario initially(prior to Double Asset Entry) was:

   ```
   Y - The internal balance of the baseToken,
   Ro - The current total supply of the liquidityToken,
   ```

   > The "change" that the system is introduced to the AMM by the liquidity provider, providing quoteToken and baseToken is given by:

   ```
   ΔY - The amount of baseTokens the liquidity provider wants to provide.
   ΔX - The amount of quoteTokens the liquidity provider has to provide. Given by ΔX = K / ΔY

   Note: The vice versa also holds true, If the liquidity provider wanted to provide a specific amount of quoteTokens(ΔX), then the amount of baseTokens(ΔY) to be provided would be given by ΔY = K / ΔX
   ```

   > As a result of which a certain amount `ΔRo`(DeltaRo) is issued to the liquidity provider (refer above). Which results in the final state being:

   ```
   Y' = Y + ΔY  - The (new) internal balance of baseToken after this liquidity event
   X' = Y + ΔX  - The (new) internal balance of quoteToken after this liquidity event
   Ro' = Ro + ΔRo - The (new) current total of the liquidity tokens

   Note: Y', X', Ro' become Y, X, Ro respectively for the next following liquidity event(regardless of it being single or double asset entry).
   ```

   The function that does this is `addLiquidity` in [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol)

   ```solidity
   function addLiquidity(
     uint256 _quoteTokenQtyDesired,
     uint256 _baseTokenQtyDesired,
     uint256 _quoteTokenQtyMin,
     uint256 _baseTokenQtyMin,
     address _liquidityTokenRecipient,
     uint256 _expirationTimestamp
   ) external {
     isNotExpired(_expirationTimestamp);

     (uint256 quoteTokenQty, uint256 baseTokenQty, uint256 liquidityTokenQty) =
       MathLib.calculateAddLiquidityQuantities(
         _quoteTokenQtyDesired,
         _baseTokenQtyDesired,
         _quoteTokenQtyMin,
         _baseTokenQtyMin,
         IERC20(quoteToken).balanceOf(address(this)),
         IERC20(baseToken).balanceOf(address(this)),
         this.totalSupply(),
         internalBalances
       );

     if (quoteTokenQty != 0) {
       // transfer quote tokens to Exchange
       IERC20(quoteToken).safeTransferFrom(
         msg.sender,
         address(this),
         quoteTokenQty
       );
     }
     if (baseTokenQty != 0) {
       // transfer base tokens to Exchange
       IERC20(baseToken).safeTransferFrom(
         msg.sender,
         address(this),
         baseTokenQty
       );
     }
     _mint(_liquidityTokenRecipient, liquidityTokenQty); // mint liquidity tokens to recipient
   }

   ```

2. **Single Asset Entry**: Single asset entry is only possible when there exists decay (alpha or beta) in the system. When there is decay in the system it means that Omega != Sigma. With Single Asset Entry, the liquidity provider is "correcting" this with their liquidity, i.e bringing Sigma in line with Omega.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:
   When there is `alphaDecay`:

   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider recieves.
   # γ = ΔY / Y / 2 * ( ΔX / α^ )
   # ΔY = α^ / ω   - The amount of baseTokens required to completely offset alphaDecay.

   ```

   When there is `betaDecay`:

   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider recieves.
   # γ = ΔX / X / 2 * ( ΔX / β^ )
   # ΔX = α - X   - The amount of quoteTokens required to completely offset betaDecay(and be extension alphaDecay).
   # β^ = ΔX  / ω

   (dx = alpha - x => betaDecay = dx * iW)
   ///deltaX = betaDec
   ```

   The solidity functions that do this are:

   - `addQuoteTokenLiquidity` - when there is `BetaDecay (β^)`

     ```solidity
     function addQuoteTokenLiquidity(
       uint256 _quoteTokenQtyDesired,
       uint256 _quoteTokenQtyMin,
       address _liquidityTokenRecipient,
       uint256 _expirationTimestamp
     ) external {
       isNotExpired(_expirationTimestamp);
       // to calculate decay in base token, we need to see if we have less
       // quote token than we expect.  This would mean a rebase down has occurred.
       uint256 quoteTokenReserveQty =
         IERC20(quoteToken).balanceOf(address(this));

       require(
         internalBalances.quoteTokenReserveQty > quoteTokenReserveQty,
         "Exchange: NO_BASE_DECAY"
       );

       (uint256 quoteTokenQty, uint256 liquidityTokenQty) =
         MathLib.calculateAddQuoteTokenLiquidityQuantities(
           _quoteTokenQtyDesired,
           _quoteTokenQtyMin,
           quoteTokenReserveQty,
           this.totalSupply(),
           internalBalances
         );

       IERC20(quoteToken).safeTransferFrom(
         msg.sender,
         address(this),
         quoteTokenQty
       ); // transfer quote tokens to Exchange

       _mint(_liquidityTokenRecipient, liquidityTokenQty); // mint liquidity tokens to recipient
     }

     ```

   - `addBaseTokenLiquidity` - when there is `alphaDecay (α^)`

     ```solidity
     function addBaseTokenLiquidity(
       uint256 _baseTokenQtyDesired,
       uint256 _baseTokenQtyMin,
       address _liquidityTokenRecipient,
       uint256 _expirationTimestamp
     ) external {
       isNotExpired(_expirationTimestamp);

       uint256 quoteTokenReserveQty =
         IERC20(quoteToken).balanceOf(address(this));

       require(
         quoteTokenReserveQty > internalBalances.quoteTokenReserveQty,
         "Exchange: NO_QUOTE_DECAY"
       );

       (uint256 baseTokenQty, uint256 liquidityTokenQty) =
         MathLib.calculateAddBaseTokenLiquidityQuantities(
           _baseTokenQtyDesired,
           _baseTokenQtyMin,
           quoteTokenReserveQty,
           this.totalSupply(),
           internalBalances
         );

       IERC20(baseToken).safeTransferFrom(
         msg.sender,
         address(this),
         baseTokenQty
       ); // transfer base tokens to Exchange

       _mint(_liquidityTokenRecipient, liquidityTokenQty); // mint liquidity tokens to recipient
     }

     ```

   They can also be found at [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol)

3. **PartialSingleAndDoubleAssetEntry**: When the liquidityProvider wants to provide both `quoteToken` and `baseToken` when decay is present, it is called a `PartialSingleAndDoubleAssetEntry`. This is because firstly a `singleAssetEntry` occurs, and then a `doubleAssetEntry` occurs. The liquidity provider recieves `ΔRo`(liquidity tokens) that takes into account both the entires.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = ΔRo(SAE) + ΔRo(DAE)
   where,
   # ΔRo(SAE) - The liquidity tokens recieved due to the SingleAssetEntry
   # ΔRo(SAE) - The liquidity tokens recieved due to the DoubleAssetEntry
   ```

   > Note: In `PartialSingleAndDoubleAssetEntry` it is possible that the user might end up with a certain amount of unused `quoteToken` or `baseToken`, This is because in the presence of `AlphaDecay (α^)` the `SingleAssetEntry` uses up a certain amount of `baseToken` and then the remaining amount of which is used along with an equivalent amount of `quoteToken` for the `DoubleAssetEntry`, the value of which could be lower than the amount the liquidity provider wanted to provide.

## Redemption of liquidity Tokens `ΔRo`

Liquidity tokens increase in value due to accrual of trading fees, and can be exchanged for equivalent amounts of `quoteToken` and `baseToken`.
The amount of `quoteToken` and `baseToken` recieved is given by:

```
ΔX = α * ΔRo / Ro
ΔY = β * ΔRo / Ro

where,
# ΔRo - The amount of liquidity tokens the liquidity provider wants to exchange
# ΔX - The amount of quoteToken the liquidity provider receives
# ΔY - The amount of baseTokens the liquidity provider recieves
# α - The balance of quoteToken currently in the exchange
# β - The balance of baseToken currently in the exchange

```

The function that handles this is `removeLiquidity` in [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol).

```solidity
function removeLiquidity(
  uint256 _liquidityTokenQty,
  uint256 _quoteTokenQtyMin,
  uint256 _baseTokenQtyMin,
  address _tokenRecipient,
  uint256 _expirationTimestamp
) external {
  isNotExpired(_expirationTimestamp);
  require(this.totalSupply() > 0, "Exchange: INSUFFICIENT_LIQUIDITY");
  require(
    _quoteTokenQtyMin > 0 && _baseTokenQtyMin > 0,
    "Exchange: MINS_MUST_BE_GREATER_THAN_ZERO"
  );

  uint256 quoteTokenReserveQty = IERC20(quoteToken).balanceOf(address(this));
  uint256 baseTokenReserveQty = IERC20(baseToken).balanceOf(address(this));

  uint256 quoteTokenQtyToReturn =
    (_liquidityTokenQty * quoteTokenReserveQty) / this.totalSupply();
  uint256 baseTokenQtyToReturn =
    (_liquidityTokenQty * baseTokenReserveQty) / this.totalSupply();

  require(
    quoteTokenQtyToReturn >= _quoteTokenQtyMin,
    "Exchange: INSUFFICIENT_QUOTE_QTY"
  );

  require(
    baseTokenQtyToReturn >= _baseTokenQtyMin,
    "Exchange: INSUFFICIENT_BASE_QTY"
  );

  // we need to ensure no overflow here in the case when
  // we are removing assets when a decay is present.
  if (quoteTokenQtyToReturn > internalBalances.quoteTokenReserveQty) {
    internalBalances.quoteTokenReserveQty = 0;
  } else {
    internalBalances.quoteTokenReserveQty -= quoteTokenQtyToReturn;
  }

  if (baseTokenQtyToReturn > internalBalances.baseTokenReserveQty) {
    internalBalances.baseTokenReserveQty = 0;
  } else {
    internalBalances.baseTokenReserveQty -= baseTokenQtyToReturn;
  }

  _burn(msg.sender, _liquidityTokenQty);
  IERC20(quoteToken).safeTransfer(_tokenRecipient, quoteTokenQtyToReturn);
  IERC20(baseToken).safeTransfer(_tokenRecipient, baseTokenQtyToReturn);
}

```

> Note: It is possible to redeem `Ro` when there is decay (alpha or beta) present in the system.

## A complete example

This example is to illustrate all the concepts in one series of hyptothetical(but plausible) chain of events

```
  Liquidity provider #1 provides 1000000 quoteTokens and 1000000 baseTokens.
  Therefore,
    X = 1000000
    Alpha = 1000000
    Y = 1000000
    Beta = 1000000
    K = 1000000000000
    Omega = 1000000/1000000 = 1
    Sigma = 1000000/1000000 = 1
    AlphaDecay = 1000000 - 1000000 = 0
    BetaDecay = 1000000 - 1000000 = 0
    deltaRo = -1000000  (Negative sign indicates that it is going out of the system)
    Ro = 1000000 ( because deltaY/Y = 1 )
  Liquidity provider #1 has now recieved 1000000 Ro.
----------------------------------------------------------------------------------------------------------------
Now a participant(Swapper #1)comes along and wants to swap 10000 base tokens for quoteTokens.
Swapper #1 recieves deltaX quoteTokens, where:
  deltaY = 10000
  X'  = K / (Y + deltaY - (deltaY*liquidityFee))
  (Assuming liquidity fee is 30 Basis points)
  X' = 1000000000000 /(1000000 + 10000 -(10000*0.003)) = 990128.419656029387
  deltaX = 990128.419656029387 - 1000000 = -9871.580343970613 (The negative sign simply indicates that the quoteTokens are going to the   swapper )
  Y' = Y + deltaY = 1000000 + 10000 = 1010000
  alpha' = alpha + deltaAlpha = 1000000 + (-9871.580343970613) = 990128.419656029387 ( Note: deltaX = deltaAlpha for swap events)
  beta' = beta + betaDecay = 1000000 + 10000 = 1010000 ( Note: deltaY = deltaBeta for swap events)
  alphaDecay' = alpha' - X' = 990128.419656029387 - 990128.419656029387 = 0
  betaDecay' = beta' - Y' = 1010000 - 1010000 = 0
  K' = X' * Y' = 990128.419656029387 * 1010000 = 1000029703852.58968

Therefore, post 1st swap, the state of the AMM is:
  X = 990128.419656029387
  Alpha = 9990128.419656029387
  Y = 1010000
  Beta = 1010000
  Omega = 990128.419656029387/1010000 = 0.98032516797626672
  Sigma = 990128.419656029387/1010000 = 0.98032516797626672
  AlphaDecay = 990128.419656029387 - 990128.419656029387 = 0
  BetaDecay = 1010000 - 1010000 =  0
  K = X*Y = 990128.419656029387 * 1010000 = 1000029703852.58968
  Ro = 1000000
  (Note: Omega is equal to Sigma)
----------------------------------------------------------------------------------------------------------------
Now let's assume a positive rebase occurs such that there are now 25% more `quoteTokens`, as a result of which:
  Alpha = 1.25 * 9990128.419656029387 = 12487660.5245700367
  X = 990128.419656029387
  alphaDecay = alpha - X = 12487660.5245700367 - 990128.4196560293874 = 11497532.1049140073
  Beta = 1010000
  Y = 1010000
  K = X*Y = 990128.419656029387 * 1010000 = 1000029703852.58968
  betaDecay = beta - Y = 1010000 - 1010000 =  0
  Omega = X/Y = 990128.419656029387/1010000 = 0.98032516797626672
  Sigma = Alpha/Beta = 12487660.5245700367 / 1010000 = 12.364020321356472
  Ro = 1000000
  (Note: NOn zero alphaDecay and Omega is no longer equal to Sigma)
----------------------------------------------------------------------------------------------------------------
Now a another participant (Swapper #2) comes along and wants to swap 10000 base tokens for quoteTokens.
Swapper #2 recieves deltaX quoteTokens, where:
  deltaY = 10000
  X' = K / (Y + deltaY - (deltaY*liquidityFee))
  (Assuming liquidity fee is 30 Basis points)
  X' = 1000029703852.58968 / (1010000 + 10000 - (10000*0.003)) =  980450.115054942479
  deltaX = 980450.115054942479 - 990128.419656029387 = -9678.304601086908
  Y' = Y + deltaY = 1010000 + 10000 = 1020000
  alpha' = alpha + deltaAlpha = 12487660.5245700367 + (-9678.304601086908) = 12477982.2199689498
  alphaDecay' = alpha' - x' = 12477982.2199689498 - 980450.115054942479 = 11497532.1049140073
  beta' = 1010000 + 10000 = 1020000
  betaDecay' = 1020000 - 1020000 = 0
  K' = X' * Y' = 980450.115054942479 * 1020000 = 1000059117356.04133

Therefore, post 2nd swap, the state of the AMM is:
  X = 980450.115054942479
  Alpha = 12477982.2199689498
  Y = 1020000
  Beta = 1020000
  K = X * Y = 980450.115054942479 * 1020000 = 1000059117356.04133
  Omega = 980450.1150549424796 / 1020000 = 0.961225602995041647
  Sigma = 12477982.2199689498 / 1020000 = 12.2333159019303429
  AlphaDecay = 11497532.1049140073
  BetaDecay = 0
  Ro = 1000000
  (Note: The swap was unaffected by the occurence of a rebase event prior to the trade(resulting in the presence of non-zero decay))
-------------------------------------------------------------------------------------------------------------------
Now liquidity provider #2 comes along and wants to do a SingleAssetEntry(this is now possible due to presence of alphaDecay), in this case the amount of baseTokens required to be supplied to the AMM are deltaY, where:

  deltaY = alphaDecay / Omega = 11497532.1049140073 / 0.961225602995041647 = 11961325.2800272278

For which the liquidity tokens issued to liquidity provider #2 (deltaRo) are given by:
  deltaRo = (Ro/(1 - gamma)) * gamma
  where Gamma is given by,
    gamma = deltaY / Y / 2 * ( deltaX / alphaDecay ),
    where deltaX is given by,
      deltaX = deltaY * Omega,

  Therefore,
  deltaX =  11961325.2800272278 * 0.961225602995041647 = 11497532.1049140074
  gamma =  11961325.2800272278 / 1020000 / 2 * (11497532.1049140074 / 11497532.1049140073 ) = 5.86339474511138623
  deltaRo = (1000000 / ( 1- 5.86339474511138623) * 5.86339474511138623 = -1205617.69142946611 (Negative sign indicates that it is going out of the system)
  X' = X + deltaX = 980450.115054942479 + 11497532.1049140074 = 12477982.2199689495
  Y' = Y + deltaY = 1020000 + 11961325.2800272278 = 12981325.2800272278
  deltaAlpha = 0
  alpha' = alpha + deltaAlpha = 12477982.2199689498 + 0
  deltaBeta = 11961325.2800272278
  alphaDecay' = alpha' - X' = 12477982.2199689498 - 12477982.2199689495 = 0.0000000003 ~ 0 (Rounding)
  betaDecay = 0
  beta' = beta + deltaBeta = 1020000 + 11961325.2800272278 = 12981325.2800272278
  Sigma' = alpha' / beta' = 12477982.2199689498/12981325.2800272278 = 0.961225602995041639
  K' = X' * Y' = 12477982.2199689495 * 12981325.2800272278 = 161980746035813.193
  Omega' = X' / Y' = 12477982.2199689495/12981325.2800272278 = 0.961225602995041616
  Ro' = Ro + deltaRo = 1000000 + 1205617.69142946611 = 2205617.69142946611



Therefore at the end of the SingleAssetEntry the state of the AMM is:
  X = 12477982.2199689495
  Y = 12981325.2800272278
  K = 161980746035813.193
  Alpha = 12477982.219968949
  Beta = 12981325.2800272278
  Omega = 0.961225602995041616
  Sigma = 0.961225602995041639
  alphaDecay = 0
  betaDecay = 0
  Ro = 2205617.69142946611
  (Note: Omega ~= Sigma, which is expected behaviour)

-------------------------------------------------------------------------------------------------------------------
Now, liquidity provider #2 decides to withdraw all of his liquidity, he recieves a certain amount of quoteTokens and baseTokens, given by:

  deltaX = alpha * deltaRo / Ro
  deltaY = beta * deltaRo / Ro

  Where,
    deltaX - The amount of quoteTokens recieved
    deltaY - The amount of baseTokens received
    deltaRo - The number of liquidity tokens to be redeemed - here it is all that he had initialy recieved

  Hence we get,
    deltaRo = (-1) * 1205617.69142946611 = -1205617.69142946611
    deltaX = 12477982.219968949 * (-1205617.69142946611) / 2205617.69142946611 = -6820618.17702733711
    deltaY = 12981325.2800272278 * (-1205617.69142946611) / 2205617.691429466116 = -7095751.66930142707
    (Note: (-1) is because the  deltaRo is being redeemed for underlying values of deltaX and deltaY)
    deltaX = deltaAlpha
    deltaY = deltaBeta

    X' = X + deltaX = 12477982.2199689495 + (-6820618.17702733711) = 5657364.04294161239
    Y' = Y + deltaY = 12981325.2800272278 + (-7095751.669301427072) = 5885573.61072580073
    K' = X'* Y' = 5657364.04294161239 * 5885573.61072580073 = 33296832517406.1796
    Ro' = Ro + deltaRo = 2205617.69142946611 + (-1205617.69142946611) = 1000000
    alpha' = alpha + deltaAlpha = 12477982.219968949 + (-6820618.17702733711) = 5657364.04294161189
    beta' = beta + deltaBeta = 12981325.2800272278 + (-7095751.66930142707) = 5885573.61072580073
    Sigma' = alpha'/ beta' = 5657364.04294161189 / 5885573.61072580073 = 0.961225602995041573
    Omega' = X'/Y' = 5657364.04294161239/ 5885573.61072580073 = 0.961225602995041658
    alphaDecay' = alpha' - X' = 5657364.04294161189 - 5657364.04294161239 = -0.0000000005  = ~0 (rounding)
    betaDecay = beta' - Y' =  5885573.61072580073 - 5885573.61072580073 = 0
    (Note: Omega' = Omega = Sigma' = Sigma , this is expected behaviour)

  Therefore at the end of the redemption of liquidity tokens event the state of the AMM is:
    X = 5657364.04294161239
    Y = 5885573.61072580073
    K = 33296832517406.179
    alpha = 5657364.04294161189
    beta = 5885573.61072580073
    Omega = 0.961225602995041658
    Sigma =  0.961225602995041573
    alphaDecay = 0
    betaDecay = 0
    Ro = 1000000
  And LP #2 has recieved,
    quoteTokens = 6820618.17702733711
    baseTokens = 7095751.66930142707

-------------------------------------------------------------------------------------------------------------------
Now, liquidity provider #1 decides to withdraw all of his liquidity, he recieves a certain amount of quoteTokens and baseTokens, given by:

  deltaX = alpha * deltaRo / Ro
  deltaY = beta * deltaRo / Ro

  Where,
    deltaX - The amount of quoteTokens recieved
    deltaY - The amount of baseTokens received
    deltaRo - The number of liquidity tokens to be redeemed - here it is all that he had initialy recieved

  Hence we get,
    deltaRo = (-1) * 1000000 = -1000000
    deltaX = 5657364.04294161189 * (-1000000)/1000000 = -5657364.04294161189
    deltaY = 5885573.61072580073 * (-1000000)/1000000 = -5885573.61072580073
    (Note: (-1) is because the  deltaRo is being redeemed for underlying values of deltaX and deltaY)

  Hence LP#1 recieves 5657364.04294161189 amount of quoteTokens and 5885573.61072580073 amount of baseTokens, he has benefitted from the trades(accrual of fees) and the rebase event.

  LP#1 initial v final state:
  quoteTokens -> final - initial = 5657364.04294161189 - 1000000 = 4657364.04294161189
  baseTokens -> final - initial = 5885573.61072580073 - 100000 = 5785573.61072580073


```
