import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

async function deploySupplyLimitFixture() {
  const context = await loadFixture(deployComplianceFixture);

  const complianceModule = await ethers.deployContract('SupplyLimitModule');
  await context.suite.compliance.addModule(await complianceModule.getAddress());

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

async function deploySupplyLimitFullSuite() {
  const context = await loadFixture(deploySuiteWithModularCompliancesFixture);
  const complianceModule = await ethers.deployContract('SupplyLimitModule');
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

describe('Compliance Module: SupplyLimit', () => {
  it('should deploy the SupplyLimit contract and bind it to the compliance', async () => {
    const context = await loadFixture(deploySupplyLimitFixture);

    expect(await context.suite.complianceModule.getAddress()).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(await context.suite.complianceModule.getAddress())).to.be.true;
  });

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const context = await loadFixture(deploySupplyLimitFixture);

      expect(await context.suite.complianceModule.name()).to.be.equal('SupplyLimitModule');
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return true', async () => {
      const context = await loadFixture(deploySupplyLimitFullSuite);
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind', () => {
    it('should return true', async () => {
      const context = await loadFixture(deploySupplyLimitFullSuite);
      expect(await context.suite.complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
    });
  });

  describe('.setSupplyLimit', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deploySupplyLimitFixture);

        await expect(context.suite.complianceModule.setSupplyLimit(100)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should set supply limit', async () => {
        const context = await loadFixture(deploySupplyLimitFixture);

        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setSupplyLimit(uint256 _limit)']).encodeFunctionData('setSupplyLimit', [100]),
          await context.suite.complianceModule.getAddress(),
        );

        await expect(tx).to.emit(context.suite.complianceModule, 'SupplyLimitSet').withArgs(await context.suite.compliance.getAddress(), 100);
      });
    });
  });

  describe('.getSupplyLimit', () => {
    describe('when calling directly', () => {
      it('should return', async () => {
        const context = await loadFixture(deploySupplyLimitFixture);
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setSupplyLimit(uint256 _limit)']).encodeFunctionData('setSupplyLimit', [1600]),
          await context.suite.complianceModule.getAddress(),
        );
        const supplyLimit = await context.suite.complianceModule.getSupplyLimit(await context.suite.compliance.getAddress());
        expect(supplyLimit).to.be.eq(1600);
      });
    });
  });

  describe('.moduleCheck', () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    describe('when value exceeds compliance supply limit', () => {
      it('should return false', async () => {
        const context = await loadFixture(deploySupplyLimitFullSuite);
        const to = context.accounts.aliceWallet.address;
        const from = zeroAddress;

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setSupplyLimit(uint256 _limit)']).encodeFunctionData('setSupplyLimit', [1600]),
          await context.suite.complianceModule.getAddress(),
        );

        const result = await context.suite.complianceModule.moduleCheck(from, to, 101, await context.suite.compliance.getAddress());
        expect(result).to.be.false;
      });
    });

    describe('when supply limit does not exceed compliance supply limit', () => {
      it('should return true', async () => {
        const context = await loadFixture(deploySupplyLimitFullSuite);
        const to = context.accounts.aliceWallet.address;
        const from = zeroAddress;

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setSupplyLimit(uint256 _limit)']).encodeFunctionData('setSupplyLimit', [1600]),
          await context.suite.complianceModule.getAddress(),
        );

        const result = await context.suite.complianceModule.moduleCheck(from, to, 100, await context.suite.compliance.getAddress());
        expect(result).to.be.true;
      });
    });

    describe('.moduleTransferAction', () => {
      describe('when calling from a random wallet', () => {
        it('should revert', async () => {
          const context = await loadFixture(deploySupplyLimitFullSuite);

          await expect(
            context.suite.complianceModule.moduleTransferAction(context.accounts.anotherWallet.address, context.accounts.anotherWallet.address, 10),
          ).to.be.revertedWith('only bound compliance can call');
        });
      });

      describe('when calling as the compliance', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deploySupplyLimitFullSuite);

          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
                'moduleTransferAction',
                [context.accounts.anotherWallet.address, context.accounts.anotherWallet.address, 10],
              ),
              await context.suite.complianceModule.getAddress(),
            ),
          ).to.eventually.be.fulfilled;
        });
      });
    });

    describe('.moduleMintAction', () => {
      describe('when calling from a random wallet', () => {
        it('should revert', async () => {
          const context = await loadFixture(deploySupplyLimitFullSuite);

          await expect(context.suite.complianceModule.moduleMintAction(context.accounts.anotherWallet.address, 10)).to.be.revertedWith(
            'only bound compliance can call',
          );
        });
      });

      describe('when calling as the compliance', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deploySupplyLimitFullSuite);

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
          const context = await loadFixture(deploySupplyLimitFullSuite);

          await expect(context.suite.complianceModule.moduleBurnAction(context.accounts.anotherWallet.address, 10)).to.be.revertedWith(
            'only bound compliance can call',
          );
        });
      });

      describe('when calling as the compliance', () => {
        it('should do nothing', async () => {
          const context = await loadFixture(deploySupplyLimitFullSuite);

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
  });
});
