module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin } = namedAccounts;

  const deployResult = await deploy("ExchangeFactory", {
    from: admin,
    contract: "ExchangeFactory",
    args: [],
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract ExchangeFactory deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["ExchangeFactory"];
