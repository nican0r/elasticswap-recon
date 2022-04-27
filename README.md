# ElasticSwap

The first automated market maker (AMM) with native support for tokens with elastic supply

# Avalanche Mainnet deployment
[Commit hash of deployment](https://github.com/ElasticSwap/elasticswap/commit/1fe434e8d424c55175f0be3912b6c06e8d3ad621)

- [ExchangeFactory.sol](https://snowtrace.io/address/0x8B3D780Db8842593d8b61632A2F76c4D4f31D7C3)
- [MathLib.sol](https://snowtrace.io/address/0xE3C08c95aa81474f44Bee23f8C45d470ddaD37Be)
- [SafeMetaData.sol](https://snowtrace.io/address/0xe24953B2E641c9e026c49C925D9564cDb542606A)

# Ethereum Mainnet deployment

- [ExchangeFactory.sol](https://etherscan.io/address/0x8B3D780Db8842593d8b61632A2F76c4D4f31D7C3)
- [MathLib.sol](https://etherscan.io/address/0xe3c08c95aa81474f44bee23f8c45d470ddad37be)
- [SafeMetaData.sol](https://etherscan.io/address/0xe24953B2E641c9e026c49C925D9564cDb542606A)

# Code Audit
C4 completed a code audit as of commit hash: a90bb67e2817d892b517da6c1ba6fae5303e9867
https://code4rena.com/reports/2022-01-elasticswap/

All high and medium severity issues have been resolved. 

# Run Tests
1. `yarn install`
2. `yarn test`

# Coverage
1. `yarn coverage`

# Deployments (on testnet)
1. Copy .ev.example to .env and update needed credentials
1. `npx hardhat deploy --network goerli --export-all ./artifacts/deployments.json`
1. Verify on etherscan `npx hardhat --network goerli etherscan-verify --api-key <APIKEY>`