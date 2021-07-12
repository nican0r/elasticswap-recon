# Elastic Swap v1 - Math Documentation

This document is created to explain the technical-mathematical terms and concepts behind ElasticSwap v1.

## Introduction

Elastic Swap is the first Automated Market Maker (AMM) to natively support tokens with elastic supply. It is heavily influenced by UniSwap's implementation and diverges from their design in the fact that the `quoteToken` in each `Exchange` can be a token with elastic or fixed supply.

The initial sheet from which the model was derived from can be found [here](https://docs.google.com/spreadsheets/d/1bAX4x2MQWlfI3c0x6QRzlxhODL0ut1dLrqabWDc98eM/edit?usp=sharing).

## Technical Terms

> Note: The usage of dash notaion (`'`), delta notation (`Δ`) is explained in an example in following sections.

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

1. **Double Asset Entry**: Double asset entry occurs when the liquidity provider provides both quoteToken and baseToken (in equivalent amounts, such that Omega stays constant) to the AMM. Double asset entry is only possible when there is **_NO_** `AlphaDecay (α^)` or `BetaDecay (β^)` present in the system.
   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = (ΔY/Y) * ( Ro / (1 - (ΔY/Y))  or  (ΔY/Y) * Ro ?
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

2. **Single Asset Entry**: Single asset entry is only possible when there exists decay (alpha or beta) in the system. When there is decay in the system it means that Omega != Sigma. With Single Asset Entry, the liquidity provider is "correcting" this with their liquidity, i.e bringing Sigma in line with Omega.
   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:
   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider recieves.
   # γ = ΔY / Y / 2 * ( ΔX / α^ )
   # ΔY = α^ / ω   - The amount of baseTokens required to completely offset alphaDecay.TODO: Add BetaDecay version as well
   ```
3. **PartialSingleAndDoubleAssetEntry**: When the liquidityProvider wants to provide both `quoteToken` and `baseToken` when decay is present, it is called a `PartialSingleAndDoubleAssetEntry`. This is because firstly a `singleAssetEntry` occurs, and then a `doubleAssetEntry` occurs. The liquidity provider recieves `ΔRo`(liquidity tokens) that takes into account both the entires.
   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:
   ```
   ΔRo = ΔRo(SAE) + ΔRo(DAE)
   where,
   # ΔRo(SAE) - The liquidity tokens recieved due to the SingleAssetEntry
   # ΔRo(SAE) - The liquidity tokens recieved due to the DoubleAssetEntry
   ```
   > Note: In `PartialSingleAndDoubleAssetEntry` it is possible that the user might end up with a certain amount of unused `quoteToken` or `baseToken`, This is because in the presence of `AlphaDecay (α^)` the `SingleAssetEntry` uses up a certain amount of `baseToken` and then the remaining amount of which is used along with an equivalent amount of `quoteToken` for the `DoubleAssetEntry`, the value of which could be lower than the amount the liquidity provider wanted to provide.
