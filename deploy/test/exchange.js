module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin } = namedAccounts;

  const BaseToken = await deployments.get("BaseToken");
  const QuoteToken = await deployments.get("QuoteToken");
  const name = "EGT LP Token";
  const symbol = "EGTLPS";
  const deployResult = await deploy("EGT Exchange", {
    from: admin,
    contract: "Exchange",
    args: [name, symbol, QuoteToken.address, BaseToken.address],
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract EGT Exchange deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["EGT Exchange"];
module.exports.dependencies = ["QuoteToken", "BaseToken"];
