import { ethers } from 'hardhat';
import Deployments from '../data/deployments/chain-296.json';

async function createIdentity(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  const IMPLEMENTATION_AUTHORITY_ADDRESS = Deployments.implementations.ImplementationAuthority;

  const identity = await ethers.deployContract('IdentityProxy', [IMPLEMENTATION_AUTHORITY_ADDRESS, deployer.address], deployer);
  await identity.waitForDeployment();

  console.log({
    identity: await identity.getAddress(),
  })
}

createIdentity()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
