import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

async function deployTransferRestrictFullSuite() {
  const context = await loadFixture(deploySuiteWithModularCompliancesFixture);
  const complianceModule = await ethers.deployContract('RequiresNFTModule');
  await context.suite.compliance.bindToken(await context.suite.token.getAddress());
  await context.suite.compliance.addModule(await complianceModule.getAddress());

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

async function deployTransferRestrictFullSuiteWithNFT() {
  const context = await loadFixture(deployTransferRestrictFullSuite);
  const NFT = await ethers.deployContract('MockERC721');
  const NFTID = 1;
  await NFT.connect(context.accounts.deployer).safeMint(context.accounts.deployer.address, NFTID);

  return {
    ...context,
    suite: {
      ...context.suite,
      NFT,
      NFTID,
    },
  };
}

describe('Compliance Module: TransferRestrict', () => {
  it('should deploy the TransferRestrict contract and bind it to the compliance', async () => {
    const context = await loadFixture(deployTransferRestrictFullSuite);

    expect(await context.suite.complianceModule.getAddress()).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(await context.suite.complianceModule.getAddress())).to.be.true;
  });

  describe('.name', () => {
    it('should return the name of the module', async () => {
      const context = await loadFixture(deployTransferRestrictFullSuite);

      expect(await context.suite.complianceModule.name()).to.be.equal('RequiresNFTModule');
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployTransferRestrictFullSuite);
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployTransferRestrictFullSuite);
      const complianceModule = await ethers.deployContract('RequiresNFTModule');
      expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
    });
  });

  describe('.requireNFT', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(context.suite.complianceModule.requireNFT(context.accounts.aliceWallet.address)).to.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via compliance', () => {
      it('should require NFT', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);
        const NFT = ethers.Wallet.createRandom();
        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function requireNFT(address _nftAddress)']).encodeFunctionData('requireNFT', [NFT.address]),
          await context.suite.complianceModule.getAddress(),
        );

        await expect(tx)
          .to.emit(context.suite.complianceModule, 'NFTRequired')
          .withArgs(await context.suite.compliance.getAddress(), NFT.address);
      });
    });
  });

  describe('.unrequireNFT', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(context.suite.complianceModule.unrequireNFT()).to.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via compliance', () => {
      it('should unriquire NFT', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);
        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function unrequireNFT()']).encodeFunctionData('unrequireNFT', []),
          await context.suite.complianceModule.getAddress(),
        );

        await expect(tx)
          .to.emit(context.suite.complianceModule, 'NFTUnrequired')
          .withArgs(await context.suite.compliance.getAddress());
      });
    });
  });

  describe('.moduleCheck', () => {
    describe('when receiver does not have NFT', () => {
      it('should return false', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);
        const to = context.accounts.anotherWallet.address;
        const from = context.accounts.aliceWallet.address;
        const result = await context.suite.complianceModule.moduleCheck(from, to, 10, await context.suite.compliance.getAddress());
        expect(result).to.be.false;
      });
    });

    describe('when receiver has NFT', () => {
      it('should return true', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuiteWithNFT);
        const to = context.accounts.aliceWallet.address;
        const from = context.accounts.deployer.address;
        const NFTaddress = await context.suite.NFT.getAddress();
        const NFTID = context.suite.NFTID;       
        
        // require nft on compliance
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function requireNFT(address _nftAddress)']).encodeFunctionData('requireNFT', [NFTaddress]),
          await context.suite.complianceModule.getAddress(),
        );

        // on HEDERA blockchain it is required to associate token to alice first

        // transfer to alice
        await context.suite.NFT['safeTransferFrom(address,address,uint256)'](from, to, NFTID);

        const result = await context.suite.complianceModule.moduleCheck(from, to, 10, await context.suite.compliance.getAddress());
        expect(result).to.be.true;
      });
    });
  });

  describe('.moduleMintAction', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(context.suite.complianceModule.moduleMintAction(context.accounts.anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(
          context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleMintAction(address, uint256)']).encodeFunctionData('moduleMintAction', [
              context.accounts.anotherWallet.address,
              10,
            ]),
            await context.suite.complianceModule.getAddress(),
          ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleBurnAction', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(context.suite.complianceModule.moduleBurnAction(context.accounts.anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(
          context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleBurnAction(address, uint256)']).encodeFunctionData('moduleBurnAction', [
              context.accounts.anotherWallet.address,
              10,
            ]),
            await context.suite.complianceModule.getAddress(),
          ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleTransfer', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(
          context.suite.complianceModule.moduleTransferAction(context.accounts.aliceWallet.address, context.accounts.anotherWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await loadFixture(deployTransferRestrictFullSuite);

        await expect(
          context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [context.accounts.aliceWallet.address, context.accounts.anotherWallet.address, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          ),
        ).to.eventually.be.fulfilled;
      });
    });
  });
});
