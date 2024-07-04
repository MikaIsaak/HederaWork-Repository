import { ethers } from 'hardhat';

async function registerIdentity() {
  const [deployer] = await ethers.getSigners();

  const IDENTITY_ADDRESS = "IDENTITY_ADDRESS";
  const IDENTITY_REGISTRY_ADDRESS = "IDENTITY_REGISTRY_ADDRESS";
  const COUNTRY = 840; // ISO United States country code (see: https://www.iso.org/obp/ui/#search)
  
  const identityRegistry = await ethers.getContractAt('IdentityRegistry', IDENTITY_REGISTRY_ADDRESS, deployer);

  await identityRegistry
    .connect(deployer)
    .registerIdentity(deployer.address, IDENTITY_ADDRESS, COUNTRY);
}

registerIdentity()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
