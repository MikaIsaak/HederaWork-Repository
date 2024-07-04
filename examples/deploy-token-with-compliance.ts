import { ethers } from "hardhat";
import Deployments from '../data/deployments/chain-296.json';

async function createToken() {
  const TREX_FACTORY_ADDRESS = Deployments.factories.TREXFactory;
  const TREX_GATEWAY_ADDRESS = Deployments.factories.TREXGateway;
  
  const TOKEN_NAME = "RWA_R_US_6"; // unique per deployer
  const TOKEN_SYMBOL = "RWARUS";
  const TOKEN_DECIMALS = 8;

  const [deployer] = await ethers.getSigners();
  const trexFactory = await ethers.getContractAt('TREXFactory', TREX_FACTORY_ADDRESS);
  const trexGateway = await ethers.getContractAt('TREXGateway', TREX_GATEWAY_ADDRESS);

  const requiresNftModuleAddress = Deployments.compliance.RequiresNFTModule;
  const nftAddress = "0x000000000000000000000000000000000039b3c6";
  const requiresNftModuleCall = new ethers.Interface(['function requireNFT(address _nftAddress)']).encodeFunctionData('requireNFT', [nftAddress]);

  // admin should be able to select the desired compliance module to include in the token
  const compliance = {
    modules : [requiresNftModuleAddress],
    settings : [requiresNftModuleCall]
  }

  // claims are not needed right now
  const claims = {
    topics: [],
    issuers: [],
    issuerClaims: [],
  }

  const tx = await trexGateway.connect(deployer).deployTREXSuite(
    {
      owner: deployer.address,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      decimals: TOKEN_DECIMALS,
      irs: ethers.ZeroAddress, // IdentityRegistryStorage
      ONCHAINID: ethers.ZeroAddress, // Identity for the token
      irAgents: [deployer],
      tokenAgents: [deployer],
      complianceModules: compliance.modules,
      complianceSettings: compliance.settings,
    },
    {
      claimTopics: claims.topics,
      issuers: claims.issuers,
      issuerClaims: claims.issuerClaims,
    },
  );

  await tx.wait();

  const event = (await trexFactory.queryFilter(trexFactory.filters.TREXSuiteDeployed, -1))[0];
  
  const Token = event.args._token;
  const IdentityRegistry = event.args._ir;
  const IdentityRegistryStorage = event.args._irs;
  const TrustedIssuerRegistry = event.args._tir;
  const ClaimTopicsRegistry = event.args._ctr;
  const ModularCompliance = event.args._mc;

  console.log({
    Token, // Newly Created Token
    IdentityRegistry,
    IdentityRegistryStorage,
    TrustedIssuerRegistry,
    ClaimTopicsRegistry,
    ModularCompliance,
  });
}

createToken()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
