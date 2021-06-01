## Elastic Swap v1
This document created for discussion purposes with Elastic DAO members and is open to changes.

### Introduction
Elastic Swap is the first Automated Market Maker (AMM) to natively support tokens with elastic supply. It is heavily influenced by UniSwap's implementation and diverges from their design in the fact that the `quoteToken` in each `Exchange` can be a token with elastic or fixed supply. We believe this to be a step forward in the DEFI ecosystem by freeing token creators from the constraints of fixed supply.  It is the first step in a fuller ecosystem of elastic primitives.

Positive and negative changes in the total supply (rebases) of `quoteToken` supply will not require any interaction with the Elastic Swap contracts nor affect the pricing curve of trading pairs.  Market participants will be expected to drive the price towards equilibrium on rebase events.

### Implementation
Elastic DAO will develop, test, and ultimately deploy the ElasticSwap v1 smart contracts to the ethereum blockchain. Elastic DAO's governance token (EGT) will be the first elastic token that will be enabled for trading. Elastic DAO will also develop and deploy a dApp that allows users the ability to easily interact with the smart contracts and eventually the multiple trading pairs endabled by Elastic Swap. 

Similarly to UniSwap, liquidity providers (LPs) will deposit both `quoteToken` and `basToken` into the `Exchange` contract.  The initial LP will determine the correct ratio of tokens to deposit and set the initial swap prices. Trading participants who swap `quoteToken` for `baseToken` (or visa-versa) will continually drive the price towards market equilibrium.  Additional liqudity providers can also participate by depositing tokens in the current ratio of the `Exchange` token reserves.

LP providers will be rewarded for their participation in the ecosystem by earning fees that are paid by traders on each swap. When a LP initial deposits quote and base tokens, they will be issues a commensurate amount of `liquidityToken`.  These tokens represent their deposit reciept and their claim to applicable fees generate on the platform.  Additionally, liquidityTokens are ERC20 and can be freely exchanged by liquidity providers in any manner they choose. For trading pairs in which the `quoteToken` represents a token with elastic supply, liquidity providers can be assured that the underlying reserves backing their `liquidityTokens` will represent the correct balances after a change in the total supply, a rebase, of the `quoteToken`

In addition to the fees paid to LPs, a portion of fees will also be reserved for the Elastic DAO trasury and used for continued development of the Elastic ecosystem, guided by voting members of the Elastic DAO. 

### Proposed Fee structure
Traders calling the swap functions will be pay a 30 basis point (.003%) fee denominated in the token they are providing as the input into the swap. This fee will be transparent to users of the Elastic Swap UI and all expected outputs of the swap will be post fee deductions to ensure a simplistic user experience. 

### Expansion of trading pairs
Each `Exchange` contract will represent a single ERC20 trading pair of tokens compromised of a `quoteToken` and a `baseToken`. The `baseToken` is expected to have a fixed supply, while the `quoteToken` can be fixed or and elastic supply token. `Exchange` contracts will be deployed by the `ExchangeFactory` that will keep a registry of all deployed and tradeable pairs to ensure users that they are interacting with the correct smart contracts addresses and known source code.

The `ExchangeFactory` will be governed by the Elastic DAO, with members voting on the addition (and possible removal) of trading pairs through the deployment of new `Exchange` contracts.

### Roadmap and timeline
- Milestone 1: Completion of core `Exchange` functionality - Q3 '21
- Milestone 2: ElasticSwap UI - Q3 '21
- Milestone 3: Solidity code freeze and security Audit - Q3 '21
- Milestone 4: v1 mainnet launch - Early Q4 '21
- Milestone 5: Expansion of Trading Pairs - Q4 '21