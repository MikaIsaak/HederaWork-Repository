import { ethers } from 'hardhat';
import Deployments from '../data/deployments/chain-296.json';

async function createIdentityThroughGateway(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  const identityGateway = await ethers.getContractAt('IdentityGateway', Deployments.factories.IdentityGateway, deployer);
  const IdFactory = await ethers.getContractAt('IdFactory', Deployments.factories.IdFactory, deployer);

  let identity = await IdFactory.getIdentity(deployer.address);

  if (identity === ethers.ZeroAddress) {
    const createTdentityTx = await identityGateway.deployIdentityForWallet(deployer.address);
    await createTdentityTx.wait();
    const event = (await IdFactory.queryFilter(IdFactory.filters.WalletLinked, -1))[0];
    identity = event.args[1];
  }
  
  console.log({ identity });
}

createIdentityThroughGateway()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
