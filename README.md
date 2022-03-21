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

# Deployments (on testnet)
1. Copy .ev.example to .env and update needed credentials
1. `npx hardhat deploy --network goerli --export-all ./artifacts/deployments.json`
1. Verify on etherscan `npx hardhat --network goerli etherscan-verify --api-key <APIKEY>`
