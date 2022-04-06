# Elastic Swap v1 - Math Documentation

This document is created to explain the technical-mathematical terms and concepts behind ElasticSwap v1.

## Introduction

Elastic Swap is the first Automated Market Maker (AMM) to natively support tokens with elastic supply. It is heavily influenced by UniSwap's implementation and diverges from their design in the fact that the `baseToken` in each `Exchange` can be a token with elastic or fixed supply.

## Technical Terms

> Note: The usage of dash notation (`'`) & delta notation (`Δ`) is explained in subsequent examples in the following sections.

- `X` - The internal balance of `baseToken`, for accounting purposes.
- `DeltaX (ΔX)` - The (incoming or outgoing) change in the quantity of `X`
- `XDash (X')` -> `X' = ΔX + X` - The new quantity of `X` post the occurrence of a trade or a liquidity event
- `Y` - The internal balance of `quoteToken`, for accounting purposes.
- `DeltaY (ΔY)` - The (incoming or outgoing) change in the quantity of `Y`
- `YDash (Y')` -> `Y' = ΔY + Y` - The new quantity of `Y` post the occurrence of a trade or a liquidity event
- `Alpha (α)` - The ERC20 balance of `baseToken` currently in the exchange.
- `Beta (β)` - The ERC20 balance of `quoteToken` currently in the exchange.
- `Omega (ω)` - `X/Y` - The ratio of the internal balance of `baseToken` to the internal balance of `quoteToken`.
- `K` - `X*Y` - The product of the internal balance of `baseToken` and the internal balance of `quoteToken`. It is used to price trades between `baseToken` and `quoteToken`.
- `Sigma (σ)` - `α/β` - The ratio of the balance of `baseToken` currently in the exchange to the balance of `quoteToken` currently in the exchange.
- `AlphaDecay (α^)` - `α-X` - The amount of `Alpha(α)` not contributing to the liquidity due to an imbalance in the tokens caused by elastic supply (a rebase).
- `BetaDecay (β^)` - `β-Y` - The amount of `Beta(β)` not contributing to the liquidity due to an imbalance in the tokens caused by elastic supply (a rebase).
- `Ro (ρ)` - The total supply of the `liquidityToken`.
- `Gamma (γ)` - `ΔY / Y / 2 * ( ΔX / α^ )` - Gamma is a multiplier term that is used to issue the correct amounts of `liquidityToken` when `alphaDecay(α^)` or `BetaDecay (β^)` exists in the system.

## Further explained: Presence of `AlphaDecay(α^)` and `BetaDecay(β^)`

The presence of the terms `X`, `Y`, `Alpha(α)`, `Beta(β)` allows the ElasticSwap v1 to support stable pricing on rebase events for an elastic-non elastic supply token pair. This is done with the concept of `AlphaDecay(α^)` and `BetaDecay(β^)`.
Whenever there is a rebase event that occurs, which results in the increase or decrease in the supply of the `baseToken`, decay is introduced. The presence (or absence) of which determines how much `Ro(ρ)` is issued to liquidity providers.

- When there is an increase in the supply of the `baseToken`, essentially the quantity of `Alpha(α)` has increased, considering the situation where there was no decay prior to the rebase event, i.e initially `α = X` (and `β = Y`), implying `α^ = 0` (and `β^ = 0`). Post the rebase event: `α^ = α' - X` ( and `β^ = 0`, as there has been no change in `β` or `Y`)
  > Note: In the above scenario, initially `ω = σ`, post the rebase event, `ω' != σ'`
- When there is a contraction in the supply of the `baseToken`, essentially the quantity of `Alpha(α)` has now decreased, considering the situation where there was no decay prior to the rebase event, i.e initially `α = X` (and `β = Y`), due to the contraction in supply, the `BetaDecay (β^)` is given by `β^ = (X - α') * iω`.
  > Note: In the above scenario, initially `ω = σ`, post the rebase event, `ω' != σ'`

## Issuance of liquidity Tokens `ΔRo`

Liquidity Tokens, `Ro`, are provided to liquidity providers.
There are multiple ways to provide liquidity: creating an Elastic AMM pool, `singleAssetEntry`, `doubleAssetEntry` and a `partialSingleAndDoubleAssetEntry`.

1. **Creation of an Elastic AMM pool**:
   This case refers to the creation of an ELastic AMM pool( a pool which consists of both `baseToken` and `quoteToken`) on ElasticSwap, this differs from `doubleAssetEntry` because here there is no `Omega`, `Sigma`, until the pool has been created. The first batch of LP tokens `Ro` are also minted to the liquidity provider who bootstraps the pool.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
     ΔRo = sqrt(ΔY * ΔX)
     where,
     # sqrt - Stands for the square root of the numbers provided, ex: sqrt(4) = 2
     # ΔY - The amount of quoteTokens the liquidity provider wants to provide.
     # ΔX - The amount of baseTokens the liquidity provider wants to provide.

     Note: Initially, Ro = 0, hence after creation of the pool,
            Ro' = ΔRo + Ro =>  Ro' = ΔRo + 0
            (this becomes the Ro for other liquidity events, the dash and delta notation (Ro', ΔX, ΔY) is further explained in the Double Asset entry section)


   ```

2. **Double Asset Entry**: Double asset entry occurs when the liquidity provider provides both baseToken and quoteToken (in equivalent amounts, such that Omega stays constant) to the AMM. Double asset entry is only possible when there is **_NO_** `AlphaDecay (α^)` or `BetaDecay (β^)` present in the system. Double asset entry maintains the values of `Omega` and `Sigma`.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = (ΔY/Y) * Ro
   where,
   # ΔRo - The amount of tokens the liquidity provider receives.
   # ΔY - The amount of quoteTokens the liquidity provider wants to provide.
   # Y - The internal balance of quoteToken.
   # Ro - The current total supply of the liquidityToken
   ```

   > Note: To understand the usage of Delta(`Δ`) and Dash(`'`) notation,
   > the above scenario initially(prior to Double Asset Entry) was:

   ```
   Y - The internal balance of the quoteToken,
   Ro - The current total supply of the liquidityToken,
   ```

   > The "change" that the system is introduced to the AMM by the liquidity provider, providing baseToken and quoteToken is given by:

   ```
   ΔY - The amount of quoteTokens the liquidity provider wants to provide.
   ΔX - The amount of baseTokens the liquidity provider has to provide. Given by ΔX = K / ΔY

   Note: The vice versa also holds true, If the liquidity provider wanted to provide a specific amount of baseTokens(ΔX), then the amount of quoteTokens(ΔY) to be provided would be given by ΔY = K / ΔX
   ```

   > As a result of which a certain amount `ΔRo`(DeltaRo) is issued to the liquidity provider (refer above). Which results in the final state being:

   ```
   Y' = Y + ΔY  - The (new) internal balance of quoteToken after this liquidity event
   X' = Y + ΔX  - The (new) internal balance of baseToken after this liquidity event
   Ro' = Ro + ΔRo - The (new) current total of the liquidity tokens

   Note: Y', X', Ro' become Y, X, Ro respectively for the next following liquidity event(regardless of it being single or double asset entry).
   ```

   The function that does this is `addLiquidity` in [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol#L87)

3. **Single Asset Entry**: Single asset entry is only possible when there exists decay (alpha or beta) in the system. When there is decay in the system it means that Omega != Sigma. With Single Asset Entry, the liquidity provider is "correcting" this with their liquidity, i.e bringing Sigma in line with Omega.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:
   When there is `alphaDecay`:

   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider receives.
   # γ = ΔY / ( (Alpha/Omega) + Y' )
   # ΔY = α^ / ω   - The amount of quoteTokens required to completely offset alphaDecay.

   ```

   When there is `betaDecay`:

   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider receives.
   # γ = ΔX / ( X + (Alpha + ΔX) )
   # ΔX = α - X   - The amount of baseTokens required to completely offset betaDecay(and by extension alphaDecay).
   # β^ = ΔX  / ω

   ```

   The respective solidity functions can be found at [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol#L87)

4. **PartialSingleAndDoubleAssetEntry**: When the liquidityProvider wants to provide both `baseToken` and `quoteToken` when decay is present, it is called a `PartialSingleAndDoubleAssetEntry`. This is because firstly a `singleAssetEntry` occurs, and then a `doubleAssetEntry` occurs. The liquidity provider receives `ΔRo`(liquidity tokens) that takes into account both the entires.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = ΔRo(SAE) + ΔRo(DAE)
   where,
   # ΔRo(SAE) - The liquidity tokens received due to the SingleAssetEntry
   # ΔRo(SAE) - The liquidity tokens received due to the DoubleAssetEntry
   ```

   > Note: In `PartialSingleAndDoubleAssetEntry` it is possible that the user might end up with a certain amount of unused `baseToken` or `quoteToken`, This is because in the presence of `AlphaDecay (α^)` the `SingleAssetEntry` uses up a certain amount of `quoteToken` and then the remaining amount of which is used along with an equivalent amount of `baseToken` for the `DoubleAssetEntry`, the quantity of which could be lower than the amount the liquidity provider wanted to provide.

## Redemption of liquidity Tokens `ΔRo`

The underlying redemption value of liquidity tokens increases due to the accrual of trading fees. At any time, they can be redeemed for equivalent amounts of `baseToken` and `quoteToken`.
The amount of `baseToken` and `quoteToken` received is given by:

```
ΔX = α * ΔRo / Ro
ΔY = β * ΔRo / Ro

where,
# ΔRo - The amount of liquidity tokens the liquidity provider wants to exchange
# ΔX - The amount of baseToken the liquidity provider receives
# ΔY - The amount of quoteTokens the liquidity provider receives
# α - The balance of baseToken currently in the exchange
# β - The balance of quoteToken currently in the exchange

```

The function that handles this is `removeLiquidity` in [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol#L87).

> Note: It is possible to redeem `Ro` when there is decay (alpha or beta) present in the system.

## Fees:

As with any other AMM the incentive to provide liquidity is so that the LP tokens issued accrue fees.

There is a 50 Basis points(BP) fee for swaps. 25 BP goes to the LP providers, 20 BP to stakers in our MerklePools and 5 BP to the DAO. 

## Tokens supported by ElasticSwap:

For the rebasing token - `baseToken`, any ERC20 token which is Elastic in nature, i.e it's supply contracts and expands due to external factors can be used to create a pool with a standard ERC20 non elastic token - `quoteToken`.

> Note: Support for tokens that have Fee on transfer behavior will **not** supported in V1.

## Examples:

Example 1: This example is to illustrate all the concepts in one series of hypothetical (but plausible) chain of events

```
  Liquidity provider #1 provides 1000000 baseTokens and 1000000 quoteTokens.
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
    deltaRo = -1000000  (because sqrt(1000000*1000000) = 1000000, Negative sign indicates that it is going out of the system)
    Ro = 1000000
  Liquidity provider #1 has now received 1000000 Ro.
----------------------------------------------------------------------------------------------------------------
Now a participant(Swapper #1)comes along and wants to swap 10000 quote tokens for baseTokens.
Swapper #1 receives deltaX baseTokens, where:
  deltaY = 10000
  X'  = K / (Y + deltaY - (deltaY*liquidityFee))
  (Assuming liquidity fee is 50 Basis points)
  X' = 1000000000000 /(1000000 + 10000 -(10000*0.005)) = 990148.027130055943
  deltaX = 990148.027130055943 - 1000000 = -9851.972869944057 (The negative sign simply indicates that the baseTokens are going to the   swapper )
  Y' = Y + deltaY = 1000000 + 10000 = 1010000
  alpha' = alpha + deltaAlpha = 1000000 + (-9851.972869944057) = 990148.027130055943 ( Note: deltaX = deltaAlpha for swap events)
  beta' = beta + deltaBeta = 1000000 + 10000 = 1010000 ( Note: deltaY = deltaBeta for swap events)
  alphaDecay' = alpha' - X' = 990148.027130055943 - 990148.027130055943 = 0
  betaDecay' = beta' - Y' = 1010000 - 1010000 = 0
  K' = X' * Y' = 990148.027130055943 * 1010000 = 1000049507401.3565
  feeAddress(ElasticSwapDAO) receives: ((deltaY/Y)*(liquidityFee/10)*Ro) = (10000*0.005*1000000)/(1000000* 10) = 5

Therefore, post 1st swap, the state of the AMM is:
  X = 990148.027130055943
  Alpha = 990148.027130055943
  Y = 1010000
  Beta = 1010000
  Omega = X/Y = 990148.027130055943/1010000 = 0.980344581316887072
  Sigma = Alpha/Beta = 990148.027130055943/1010000 = 0.980344581316887072
  AlphaDecay = 990148.027130055943 - 990148.027130055943 = 0
  BetaDecay = 1010000 - 1010000 =  0
  K = X*Y = 990148.027130055943 * 1010000 = 1000049507401.3565
  Ro = 1000000
  feeAddress(ElasticDAO) receives: 5 Ro
   hence total Ro the feeAddress has 5 Ro

  (Note: Omega is equal to Sigma)
----------------------------------------------------------------------------------------------------------------
Now let's assume a positive rebase occurs such that there are now 25% more `baseTokens`, as a result of which:
  Alpha = 1.25 * 990148.027130055943 = 1237685.03391256993
  X = 990148.027130055943
  alphaDecay = alpha - X = 1237685.03391256993 - 990148.027130055943 = 247537.006782513987
  Beta = 1010000
  Y = 1010000
  K = X*Y = 990148.027130055943 * 1010000 = 1000049507401.3565
  betaDecay = beta - Y = 1010000 - 1010000 =  0
  Omega = X/Y = 990148.027130055943/1010000 = 0.980344581316887072
  Sigma = Alpha/Beta = 1237685.03391256993 / 1010000 = 1.22543072664610884
  Ro = 1000000
  (Note: Non zero alphaDecay and Omega is no longer equal to Sigma)
----------------------------------------------------------------------------------------------------------------
Now a another participant (Swapper #2) comes along and wants to swap 10000 quote tokens for baseTokens.
Swapper #2 receives deltaX baseTokens, where:
  deltaY = 10000
  X' = K / (Y + deltaY - (deltaY*liquidityFee))
  (Assuming liquidity fee is 50 Basis points)
  X' = 1000049507401.3565 / (1010000 + 10000 - (10000*0.005)) =  980488.756705089955
  deltaX = 980488.756705089955 - 990148.027130055943 = -9659.270424965988
  Y' = Y + deltaY = 1010000 + 10000 = 1020000
  alpha' = alpha + deltaAlpha = 1237685.03391256993 + (-9659.270424965988) = 1228025.76348760394
  alphaDecay' = alpha' - x' = 1228025.76348760394 - 980488.756705089955 = 247537.006782513985
  beta' = 1010000 + 10000 = 1020000
  betaDecay' = 1020000 - 1020000 = 0
  K' = X' * Y' = 980488.756705089955 * 1020000 = 1000098531839.19175
  feeAddress(ElasticDAO) receives: ((deltaY/Y)*(liquidityFee/10)*Ro): (10000 * 0.005 * 1000000)/(1010000 * 10) = 4.9504950495049505

Therefore, post 2nd swap, the state of the AMM is:
  X = 980488.756705089955
  Alpha = 1228025.76348760394
  Y = 1020000
  Beta = 1020000
  K = X * Y = 980488.756705089955 * 1020000 = 1000098531839.19175
  Omega = X/Y = 980488.756705089955 / 1020000 = 0.961263486965774466
  Sigma = Alpha/Beta = 1228025.76348760394 / 1020000 = 1.20394682694863131
  AlphaDecay = 247537.006782513985
  BetaDecay = 0
  Ro = 1000000
  feeAddress(ElasticDAO) receives: 4.9504950495049505 Ro,
    hence total Ro the feeAddress has 4.9504950495049505 + 5 = 9.9504950495049505 Ro
  (Note: The swap was unaffected by the occurrence of a rebase event prior to the trade(resulting in the presence of non-zero decay))
-------------------------------------------------------------------------------------------------------------------
Now liquidity provider #2 comes along and wants to do a SingleAssetEntry(this is now possible due to presence of alphaDecay), in this case the amount of quoteTokens required to be supplied to the AMM are deltaY, where:

  deltaY = alphaDecay / Omega = 247537.006782513985 / 0.961263486965774466 = 257512.128712871287

For which the liquidity tokens issued to liquidity provider #2 (deltaRo) are given by:
  deltaRo = (Ro/(1 - gamma)) * gamma
  where Gamma is given by,
    gamma = deltaY / ( (Alpha/Omega) + Y' )
    where Y' = Y + deltaY = 1020000 + 257512.128712871287 = 1277512.12871287129

  Therefore,
  gamma = deltaY / ( (Alpha/Omega) + Y' ) = 257512.128712871287 / ((1228025.76348760394 / 0.961263486965774466 ) + 1277512.12871287129) = 0.100786569037243451
  deltaRo = (Ro/(1 - γ)) * γ = (1000000 / ( 1- 0.100786569037243451) * 0.100786569037243451 = 112083.033423260567
  (Since the goal of this SAE is such that all of the decay is nullified, here deltaX = alphaDecay)
  X' = X + deltaX = X + AlphaDecay = 980488.756705089955 + 247537.006782513985 = 1228025.76348760394
  Y' = Y + deltaY = 1020000 + 257512.128712871287 = 1277512.12871287129
  deltaAlpha = 0
  alpha' = alpha + deltaAlpha = 1228025.76348760394 + 0 = 1228025.76348760394
  deltaBeta = deltaY = 257512.128712871287
  alphaDecay' = alpha' - X' = 1228025.76348760394 - 1228025.76348760394 = 0
  betaDecay = 0
  (here deltaBeta is deltaY)
  beta' = beta + deltaBeta = 1020000 + 257512.128712871287 = 1277512.12871287129
  Sigma' = alpha' / beta' = 1228025.76348760394/1277512.12871287129 = 0.961263486965774463
  K' = X' * Y' = 1228025.76348760394 * 1277512.12871287129 = 1568817807227.29792
  Omega' = X' / Y' = 1228025.76348760394/1277512.12871287129 = 0.961263486965774463
  Ro' = Ro + deltaRo = 1000000 + 112083.033423260567 = 1112083.03342326057



Therefore at the end of the SingleAssetEntry the state of the AMM is:
  X = 1228025.76348760394
  Y = 1277512.12871287129
  K = 1568817807227.29792
  Alpha = 1228025.76348760394
  Beta = 1277512.12871287129
  Omega = 0.961263486965774463
  Sigma = 0.961263486965774463
  alphaDecay = 0
  betaDecay = 0
  Ro = 1112083.03342326057
  (Note: Omega = Sigma, which is expected behavior)

-------------------------------------------------------------------------------------------------------------------
Now, liquidity provider #2 decides to withdraw all of his liquidity, he receives a certain amount of baseTokens and quoteTokens, given by:

  deltaX = alpha * deltaRo / Ro
  deltaY = beta * deltaRo / Ro

  Where,
    deltaX - The amount of baseTokens received
    deltaY - The amount of quoteTokens received
    deltaRo - The number of liquidity tokens to be redeemed - here it is all that he had initially received

  Hence we get,
    deltaRo = (-1) * 112083.033423260567 = -112083.033423260567
    deltaX = 1228025.76348760394 * (-112083.033423260567) / 1112083.03342326057 = -123768.503391256992
    deltaY = 1277512.12871287129 * (-112083.033423260567) / 1112083.03342326057 = -128756.064356435643
    (Note: (-1) is because the  deltaRo is being redeemed for underlying quantities of deltaX and deltaY)
    deltaX = deltaAlpha
    deltaY = deltaBeta

    X' = X + deltaX = 1228025.76348760394 + (-123768.503391256992) = 1104257.26009634695
    Y' = Y + deltaY = 1277512.12871287129 + (-128756.064356435643) = 1148756.06435643565
    K' = X'* Y' = 1104257.26009634695 * 1148756.06435643565 = 1268522224145.30044
    Ro' = Ro + deltaRo = 1112083.03342326057 + (-112083.033423260567) = 1000000
    alpha' = alpha + deltaAlpha = 1228025.76348760394 + ( -123768.503391256992) = 1104257.26009634695
    beta' = beta + deltaBeta = 1277512.12871287129 + (-128756.064356435643) = 1148756.06435643565
    Sigma' = alpha'/ beta' = 1104257.26009634695 / 1148756.06435643565 = 0.961263486965774462
    Omega' = X'/Y' = 1104257.26009634695 / 1148756.06435643565 = 0.961263486965774462
    alphaDecay' = alpha' - X' = 1104257.26009634695 - 1104257.26009634695 = 0
    betaDecay = beta' - Y' =  1148756.06435643565 - 1148756.06435643565 = 0
    //(Note: Omega' ~= Omega ~= Sigma' ~= Sigma , this is expected behavior)

  Therefore at the end of the redemption of liquidity tokens event the state of the AMM is:
    X = 1104257.26009634695
    Y = 1148756.06435643565
    K = 1268522224145.30044
    alpha = 1104257.26009634695
    beta = 1148756.06435643565
    Omega = 0.961263486965774462
    Sigma =  0.961263486965774462
    alphaDecay = 0
    betaDecay = 0
    Ro = 1000000
  And LP #2 has received,
    baseTokens = 123768.503391256992
    quoteTokens = 128756.064356435643

-------------------------------------------------------------------------------------------------------------------
Now, liquidity provider #1 decides to withdraw all of his liquidity, he receives a certain amount of baseTokens and quoteTokens, given by:

  deltaX = alpha * deltaRo / Ro
  deltaY = beta * deltaRo / Ro

  Where,
    deltaX - The amount of baseTokens received
    deltaY - The amount of quoteTokens received
    deltaRo - The number of liquidity tokens to be redeemed - here it is all that he had initially received

  Hence we get,
    deltaRo = (-1) * 1000000 = -1000000
    deltaX = 1104257.26009634695 * (-1000000)/1000000 = -1104257.26009634695
    deltaY = 1148756.06435643565 * (-1000000)/1000000 = -1148756.06435643565
    (Note: (-1) is because the  deltaRo is being redeemed for underlying quantities of deltaX and deltaY)

  Hence LP#1 receives 1104257.26009634695 amount of baseTokens and 1148756.06435643565 amount of quoteTokens, he has benefitted from the trades(accrual of fees) and the rebase event.

  LP#1 initial v final state:
  baseTokens -> final - initial = 1104257.26009634695 - 1000000 = 104257.26009634695
  quoteTokens -> final - initial = 1148756.06435643565 - 1000000 = 148756.06435643565
```
Example 2:  Rebase down -> SAE + DAE  -> exit  

```
LP #1 sets the pool with 10k baseTokens, 10k quoteToken, hence 10k Ro for LP1
Omega = 1
Rebase down of 5k happens
X = 10,000
Alpha = 5000
Y = 10,000
Beta = 10,000
Ro = 10,000 (all LP#1 owned )

LP#2 comes along and wants to do SAE+DAE
baseTokenAmountProvided = ((iOmega)*5000 + 10000
                        = 15,000
quoteTokenAmount provided = 10k

LP token LP#2 receives:
For SAE: (5000 baseTokens) -> 3333 LP tokens
  At this stage: X, Y, Alpha, Beta = 10k
Now DAE (10k baseTokens + 10k quoteTokens) => (10000/10000) * 13333  = 13333 LP tokens
Hence, the LP#2 gets = 3333 + 13333 = 16666 tokens
State of the pool: 
X: 20k
Alpha: 20k
Y: 20k
Beta 20k
LP outstanding = 26666 (10,000 -> LP#1, 16666 -> LP#2)

LP#1 exits their LP position:
BaseTokens received = (10000/26666) * 20000 = ~7500.18750468761719 (had put in 10k)
quoteToken received = (10000/26666) * 20000 = ~7500.18750468761719 (had put in 10k)

State of the pool: 
X, Alpha, Beta, Y: ~12500
LP#2 exits their LP position:
BaseToken received = 16666 / 16666 * 12500 = ~12500 (had put in 15k)
QuoteToken received = 16666 / 16666 * 12500 = ~12500 (had put in 10k)


```
