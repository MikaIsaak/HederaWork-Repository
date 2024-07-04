import { ethers } from "hardhat";
import Deployments from '../data/deployments/chain-296.json';

async function addRequireNftCompliance() {
  const MODULAR_COMPLIANCE_ADDRESS = "0x36Eebe1f7e7a9827F384fFcBFdd8525458D6020F";
  const NFT_ADDRESS = "0x000000000000000000000000000000000039b3c6";
  
  const compliance = await ethers.getContractAt('ModularCompliance', MODULAR_COMPLIANCE_ADDRESS);
  const requiresNftModuleAddress = Deployments.compliance.RequiresNFTModule;

  await compliance.addModule(requiresNftModuleAddress);

  await compliance.callModuleFunction(
    new ethers.Interface(['function requireNFT(address _nftAddress)']).encodeFunctionData('requireNFT', [NFT_ADDRESS]),
    requiresNftModuleAddress,
  );

  console.log("- RequiresNFTModule compliance module added!");
}

addRequireNftCompliance()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
