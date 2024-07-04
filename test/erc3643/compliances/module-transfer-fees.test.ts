import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

async function deployTransferFeesFullSuite() {
  const context = await loadFixture(deploySuiteWithModularCompliancesFixture);
  const complianceModule = await ethers.deployContract('TransferFeesModule');
  await context.suite.token.addAgent(await complianceModule.getAddress());
  await context.suite.compliance.bindToken(await context.suite.token.getAddress());
  await context.suite.compliance.addModule(await complianceModule.getAddress());

  const identity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);
  await context.suite.identityRegistry.connect(context.accounts.tokenAgent).registerIdentity(context.accounts.charlieWallet.address, identity, 0);

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

describe('Compliance Module: TransferFees', () => {
  it('should deploy the TransferFees contract and bind it to the compliance', async () => {
    const context = await loadFixture(deployTransferFeesFullSuite);

    expect(await context.suite.complianceModule.getAddress()).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(await context.suite.complianceModule.getAddress())).to.be.true;
  });

  describe('.setFee', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferFeesFullSuite);
        const collector = context.accounts.anotherWallet.address;

        await expect(context.suite.complianceModule.connect(context.accounts.anotherWallet).setFee(1, collector)).to.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling via compliance', () => {
      describe('when rate is greater than the max', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.anotherWallet.address;

          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [10001, collector]),
              await context.suite.complianceModule.getAddress(),
            ),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `FeeRateIsOutOfRange`);
        });
      });

      describe('when collector address is not verified', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.anotherWallet.address;

          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1, collector]),
              await context.suite.complianceModule.getAddress(),
            ),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `CollectorAddressIsNotVerified`);
        });
      });

      describe('when collector address is verified', () => {
        it('should set the fee', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.aliceWallet.address;

          const tx = await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          await expect(tx).to.emit(context.suite.complianceModule, 'FeeUpdated').withArgs(await context.suite.compliance.getAddress(), 1, collector);

          const fee = await context.suite.complianceModule.getFee(await context.suite.compliance.getAddress());
          expect(fee.rate).to.be.eq(1);
          expect(fee.collector).to.be.eq(collector);
        });
      });
    });
  });

  describe('.getFee', () => {
    it('should return the fee', async () => {
      const context = await loadFixture(deployTransferFeesFullSuite);
      const collector = context.accounts.aliceWallet.address;
      await context.suite.compliance.callModuleFunction(
        new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1, collector]),
        await context.suite.complianceModule.getAddress(),
      );

      const fee = await context.suite.complianceModule.getFee(await context.suite.compliance.getAddress());
      expect(fee.rate).to.be.eq(1);
      expect(fee.collector).to.be.eq(collector);
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return false', async () => {
      const context = await loadFixture(deployTransferFeesFullSuite);
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.false;
    });
  });

  describe('.canComplianceBind', () => {
    describe('when the module is not registered as a token agent', () => {
      it('should return false', async () => {
        const context = await loadFixture(deploySuiteWithModularCompliancesFixture);
        await context.suite.compliance.bindToken(await context.suite.token.getAddress());
        const complianceModule = await ethers.deployContract('TransferFeesModule');

        const result = await complianceModule.canComplianceBind(await context.suite.compliance.getAddress());
        expect(result).to.be.false;
      });
    });

    describe('when the module is registered as a token agent', () => {
      it('should return true', async () => {
        const context = await loadFixture(deployTransferFeesFullSuite);
        const result = await context.suite.complianceModule.canComplianceBind(await context.suite.compliance.getAddress());
        expect(result).to.be.true;
      });
    });
  });

  describe('.moduleTransferAction', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferFeesFullSuite);
        const from = context.accounts.aliceWallet.address;
        const to = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleTransferAction(from, to, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      describe('when from and to belong to the same identity', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.charlieWallet.address;
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1000, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.anotherWallet.address;
          const identity = await context.suite.identityRegistry.identity(from);
          await context.suite.identityRegistry.connect(context.accounts.tokenAgent).registerIdentity(to, identity, 0);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const collectedAmount = await context.suite.token.balanceOf(collector);
          expect(collectedAmount).to.be.eq(0);
        });
      });

      describe('when fee is zero', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.charlieWallet.address;
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [0, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const collectedAmount = await context.suite.token.balanceOf(collector);
          expect(collectedAmount).to.be.eq(0);
        });
      });

      describe('when sender is the collector', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.charlieWallet.address;
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1000, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          const to = context.accounts.bobWallet.address;

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [collector, to, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const collectedAmount = await context.suite.token.balanceOf(collector);
          expect(collectedAmount).to.be.eq(0);
        });
      });

      describe('when receiver is the collector', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.charlieWallet.address;
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1000, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          const from = context.accounts.bobWallet.address;
          await context.suite.token.connect(context.accounts.tokenAgent).mint(collector, 5000);

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, collector, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const collectedAmount = await context.suite.token.balanceOf(collector);
          expect(collectedAmount).to.be.eq(5000);
        });
      });

      describe('when calculated fee amount is zero', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.charlieWallet.address;
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const collectedAmount = await context.suite.token.balanceOf(collector);
          expect(collectedAmount).to.be.eq(0);
        });
      });

      describe('when calculated fee amount is higher than zero', () => {
        it('should transfer the fee amount', async () => {
          const context = await loadFixture(deployTransferFeesFullSuite);
          const collector = context.accounts.charlieWallet.address;
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setFee(uint256 _rate, address _collector)']).encodeFunctionData('setFee', [1000, collector]),
            await context.suite.complianceModule.getAddress(),
          );

          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;

          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, 80],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const collectedAmount = await context.suite.token.balanceOf(collector);
          expect(collectedAmount).to.be.eq(8); // 10% of 80

          const toBalance = await context.suite.token.balanceOf(to);
          expect(toBalance).to.be.eq(492); // it had 500 tokens before
        });
      });
    });
  });

  describe('.moduleMintAction', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployTransferFeesFullSuite);

        await expect(context.suite.complianceModule.moduleMintAction(context.accounts.anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await loadFixture(deployTransferFeesFullSuite);

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
        const context = await loadFixture(deployTransferFeesFullSuite);

        await expect(context.suite.complianceModule.moduleBurnAction(context.accounts.anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const context = await loadFixture(deployTransferFeesFullSuite);

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

  describe('.moduleCheck', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployTransferFeesFullSuite);
      const from = context.accounts.aliceWallet.address;
      const to = context.accounts.bobWallet.address;
      expect(await context.suite.complianceModule.moduleCheck(from, to, 100, await context.suite.compliance.getAddress())).to.be.true;
    });
  });

  describe('.name', () => {
    it('should return the name of the module', async () => {
      const context = await loadFixture(deployTransferFeesFullSuite);
      expect(await context.suite.complianceModule.name()).to.be.equal('TransferFeesModule');
    });
  });
});
