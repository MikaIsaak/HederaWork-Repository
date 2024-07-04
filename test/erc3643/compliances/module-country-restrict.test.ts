import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

describe('CountryRestrictModule', () => {
  async function deployComplianceWithCountryRestrictModule() {
    const context = await loadFixture(deployComplianceFixture);
    const { compliance } = context.suite;

    const countryRestrictModule = await ethers.deployContract('CountryRestrictModule');
    await compliance.addModule(await countryRestrictModule.getAddress());

    return { ...context, suite: { ...context.suite, countryRestrictModule } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { countryRestrictModule },
      } = await loadFixture(deployComplianceWithCountryRestrictModule);

      expect(await countryRestrictModule.name()).to.equal('CountryRestrictModule');
    });
  });

  describe('.isPlugAndPlay()', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployComplianceWithCountryRestrictModule);
      expect(await context.suite.countryRestrictModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind()', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployComplianceWithCountryRestrictModule);
      expect(await context.suite.countryRestrictModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
    });
  });

  describe('.addCountryRestriction()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(anotherWallet).addCountryRestriction(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(deployer).addCountryRestriction(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when called via the compliance', () => {
      describe('when country is already restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData('addCountryRestriction', [42]),
              await countryRestrictModule.getAddress(),
            );

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData('addCountryRestriction', [42]),
                await countryRestrictModule.getAddress(),
              ),
          ).to.be.revertedWith('country already restricted');
        });
      });

      describe('when country is not restricted', () => {
        it('should add the country restriction', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData('addCountryRestriction', [42]),
              await countryRestrictModule.getAddress(),
            );

          await expect(tx).to.emit(countryRestrictModule, 'AddedRestrictedCountry').withArgs(await compliance.getAddress(), 42);

          expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 42)).to.be.true;
        });
      });
    });
  });

  describe('.removeCountryRestriction()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(anotherWallet).removeCountryRestriction(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(deployer).removeCountryRestriction(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when called via the compliance', () => {
      describe('when country is not restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function removeCountryRestriction(uint16 country)']).encodeFunctionData('removeCountryRestriction', [
                  42,
                ]),
                await countryRestrictModule.getAddress(),
              ),
          ).to.be.revertedWith('country not restricted');
        });
      });

      describe('when country is restricted', () => {
        it('should remove the country restriction', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData('addCountryRestriction', [42]),
              await countryRestrictModule.getAddress(),
            );

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function removeCountryRestriction(uint16 country)']).encodeFunctionData('removeCountryRestriction', [42]),
              await countryRestrictModule.getAddress(),
            );

          await expect(tx).to.emit(countryRestrictModule, 'RemovedRestrictedCountry').withArgs(await compliance.getAddress(), 42);

          expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 42)).to.be.false;
        });
      });
    });
  });

  describe('.batchRestrictCountries()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(anotherWallet).batchRestrictCountries([42])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(deployer).batchRestrictCountries([42])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when called via the compliance', () => {
      describe('when attempting to restrict more than 195 countries at once', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData(
                  'batchRestrictCountries',
                  [Array.from({ length: 195 }, (_, i) => i)],
                ),
                await countryRestrictModule.getAddress(),
              ),
          ).to.be.revertedWith('maximum 195 can be restricted in one batch');
        });
      });

      describe('when a country is already restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addCountryRestriction(uint16 country)']).encodeFunctionData('addCountryRestriction', [42]),
              await countryRestrictModule.getAddress(),
            );

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData(
                  'batchRestrictCountries',
                  [[12, 42, 67]],
                ),
                await countryRestrictModule.getAddress(),
              ),
          ).to.be.revertedWith('country already restricted');
        });
      });

      it('should add the country restriction', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData('batchRestrictCountries', [
              [42, 66],
            ]),
            await countryRestrictModule.getAddress(),
          );

        await expect(tx).to.emit(countryRestrictModule, 'AddedRestrictedCountry').withArgs(await compliance.getAddress(), 42);
        await expect(tx).to.emit(countryRestrictModule, 'AddedRestrictedCountry').withArgs(await compliance.getAddress(), 66);

        expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 42)).to.be.true;
        expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 66)).to.be.true;
      });
    });
  });

  describe('.batchUnrestrictCountries()', () => {
    describe('when the sender is a random wallet', () => {
      it('should reverts', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(anotherWallet).batchUnrestrictCountries([42])).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when the sender is the deployer', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(deployer).batchUnrestrictCountries([42])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when called via the compliance', () => {
      describe('when attempting to unrestrict more than 195 countries at once', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function batchUnrestrictCountries(uint16[] memory countries)']).encodeFunctionData(
                  'batchUnrestrictCountries',
                  [Array.from({ length: 195 }, (_, i) => i)],
                ),
                await countryRestrictModule.getAddress(),
              ),
          ).to.be.revertedWith('maximum 195 can be unrestricted in one batch');
        });
      });

      describe('when a country is not restricted', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryRestrictModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryRestrictModule);

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function batchUnrestrictCountries(uint16[] memory countries)']).encodeFunctionData(
                  'batchUnrestrictCountries',
                  [[12, 42, 67]],
                ),
                await countryRestrictModule.getAddress(),
              ),
          ).to.be.revertedWith('country not restricted');
        });
      });

      it('should remove the country restriction', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchRestrictCountries(uint16[] memory countries)']).encodeFunctionData('batchRestrictCountries', [
              [42, 66],
            ]),
            await countryRestrictModule.getAddress(),
          );

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchUnrestrictCountries(uint16[] memory countries)']).encodeFunctionData(
              'batchUnrestrictCountries',
              [[42, 66]],
            ),
            await countryRestrictModule.getAddress(),
          );

        await expect(tx).to.emit(countryRestrictModule, 'RemovedRestrictedCountry').withArgs(await compliance.getAddress(), 42);
        await expect(tx).to.emit(countryRestrictModule, 'RemovedRestrictedCountry').withArgs(await compliance.getAddress(), 66);

        expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 42)).to.be.false;
        expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 66)).to.be.false;
      });
    });
  });

  describe('.moduleTransferAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet, aliceWallet, bobWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(
          countryRestrictModule.connect(anotherWallet).moduleTransferAction(aliceWallet.address, bobWallet.address, 10),
        ).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleTransferAction(address, address, uint256)']).encodeFunctionData('moduleTransferAction', [
                aliceWallet.address,
                bobWallet.address,
                10,
              ]),
              await countryRestrictModule.getAddress(),
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleMintAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(anotherWallet).moduleMintAction(anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleMintAction(address, uint256)']).encodeFunctionData('moduleMintAction', [
                anotherWallet.address,
                10,
              ]),
              await countryRestrictModule.getAddress(),
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleBurnAction()', () => {
    describe('when calling from a random wallet', () => {
      it('should revert', async () => {
        const {
          suite: { countryRestrictModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(countryRestrictModule.connect(anotherWallet).moduleBurnAction(anotherWallet.address, 10)).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });

    describe('when calling as the compliance', () => {
      it('should do nothing', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, anotherWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);

        await expect(
          compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function moduleBurnAction(address, uint256)']).encodeFunctionData('moduleBurnAction', [
                anotherWallet.address,
                10,
              ]),
              await countryRestrictModule.getAddress(),
            ),
        ).to.eventually.be.fulfilled;
      });
    });
  });

  describe('.moduleCheck', () => {
    describe('when identity country is restricted', () => {
      it('should return false', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);
        const contract = await ethers.deployContract('MockContract');
        await compliance.bindToken(await contract.getAddress());

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchRestrictCountries(uint16[] calldata countries)']).encodeFunctionData(
              'batchRestrictCountries',
              [[42, 66]],
            ),
            await countryRestrictModule.getAddress(),
          );

        await contract.setInvestorCountry(42);

        await expect(countryRestrictModule.moduleCheck(aliceWallet.address, bobWallet.address, 16, await compliance.getAddress())).to.be.eventually.false;
      });
    });

    describe('when identity country is not restricted', () => {
      it('should return true', async () => {
        const {
          suite: { compliance, countryRestrictModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await loadFixture(deployComplianceWithCountryRestrictModule);
        const contract = await ethers.deployContract('MockContract');
        await compliance.bindToken(await contract.getAddress());

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchRestrictCountries(uint16[] calldata countries)']).encodeFunctionData(
              'batchRestrictCountries',
              [[42, 66]],
            ),
            await countryRestrictModule.getAddress(),
          );

        await contract.setInvestorCountry(10);

        await expect(countryRestrictModule.moduleCheck(aliceWallet.address, bobWallet.address, 16, await compliance.getAddress())).to.be.eventually.true;
      });
    });
  });
});
