module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin } = namedAccounts;

  const deployResult = await deploy("SafeMetadata", {
    from: admin,
    contract: "SafeMetadata",
    args: [],
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract SafeMetadata deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["SafeMetadata"];
