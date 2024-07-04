import { ethers } from 'hardhat';
import { AbiCoder } from 'ethers';

async function addKeyToIdentity() {
  const [deployer] = await ethers.getSigners();

  const IDENTITY_ADDRESS = "IDENTITY_ADDRESS";
  const PURPOSE = 2 //1 = MANAGEMENT, 2 = ACTION, 3 = CLAIM, 4 = ENCRYPTION
  const TYPE = 1 // 1 = ECDSA, 2 = RSA
  const KEY = ethers.keccak256(AbiCoder.defaultAbiCoder().encode(['address'], [deployer.address]))

  const identity = await ethers.getContractAt('Identity', IDENTITY_ADDRESS, deployer);

  await identity
    .connect(deployer)
    .addKey(KEY, PURPOSE, TYPE);
}

addKeyToIdentity()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
