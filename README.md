# ElasticSwap

The first automated market maker (AMM) with native support for tokens with elastic supply

# Run Tests
1. `yarn install`
2. `yarn test`

# Coverage
1. `yarn coverage`

# Code Audit
C4 completed a code audit as of commit hash: a90bb67e2817d892b517da6c1ba6fae5303e9867
https://code4rena.com/reports/2022-01-elasticswap/

All high and medium severity issues have been resolved. 

# Avalanche Mainnet deployment
[Commit hash of deployment](https://github.com/ElasticSwap/elasticswap/commit/4e6fb2c62dbfcb88534ec4cb160a8a8de09c0d1b)

- [ExchangeFactory.sol](https://snowtrace.io/address/0xca07326c7a669f937c70451c47083e09626077d0)
- [MathLib.sol](https://snowtrace.io/address/0x28e3f7d60369e734287e8201be94ea022b2ab32a)
- [SafeMetaData.sol](https://snowtrace.io/address/0x14470bff8ff76ef40ad693855a3704427655003f)



# Deployments (on testnet)
1. Copy .ev.example to .env and update needed credentials
1. `npx hardhat deploy --network goerli --export-all ./artifacts/deployments.json`
1. Verify on etherscan `npx hardhat --network goerli etherscan-verify --api-key <APIKEY>`
HU1PTUSIVBV2JWDSBCFHYQXP77G9VGTPCV