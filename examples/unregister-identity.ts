import { ethers } from "hardhat";

async function unregisterIdentity() {
  const [deployer] = await ethers.getSigners();
  const IDENTITY_REGISTRY_ADDRESS = "IDENTITY_REGISTRY_ADDRESS";

  const identityRegistry = await ethers.getContractAt('IdentityRegistry', IDENTITY_REGISTRY_ADDRESS, deployer);

  const contains = await identityRegistry
    .connect(deployer)
    .contains(deployer.address);

  if (contains)
    await identityRegistry
      .connect(deployer)
      .deleteIdentity(deployer.address);
}

unregisterIdentity()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
