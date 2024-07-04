import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect, ethers } from '../setup';
// import OnchainID from '@onchain-id/solidity';
import { deployFullSuiteFixture } from './fixtures/deploy-full-suite.fixture';

describe('TREXFactory', () => {
  describe('.deployTREXSuite()', () => {
    describe('when called by not owner', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer, anotherWallet },
          factories: { trexFactory },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          trexFactory.connect(anotherWallet).deployTREXSuite(
            'salt',
            {
              owner: deployer.address,
              name: 'Token name',
              symbol: 'SYM',
              decimals: 8,
              irs: ethers.ZeroAddress,
              ONCHAINID: ethers.ZeroAddress,
              irAgents: [],
              tokenAgents: [],
              complianceModules: [],
              complianceSettings: [],
            },
            {
              claimTopics: [],
              issuers: [],
              issuerClaims: [],
            },
          ),
        ).to.be.revertedWithCustomError(trexFactory, 'OwnableUnauthorizedAccount');
        
      });
    });

    describe('when called by owner', () => {
      describe('when salt was already used', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await trexFactory.connect(deployer).deployTREXSuite(
            'salt',
            {
              owner: deployer.address,
              name: 'Token name',
              symbol: 'SYM',
              decimals: 8,
              irs: ethers.ZeroAddress,
              ONCHAINID: ethers.ZeroAddress,
              irAgents: [],
              tokenAgents: [],
              complianceModules: [],
              complianceSettings: [],
            },
            {
              claimTopics: [],
              issuers: [],
              issuerClaims: [],
            },
          );

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('token already deployed');
        });
      });

      describe('when claim pattern is not valid', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [ethers.ZeroAddress],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('claim pattern not valid');
        });
      });

      describe('when configuring more than 5 claim issuers', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: Array.from({ length: 6 }, () => ethers.ZeroAddress),
                issuerClaims: Array.from({ length: 6 }, () => []),
              },
            ),
          ).to.be.revertedWith('max 5 claim issuers at deployment');
        });
      });

      describe('when configuring more than 5 claim topics', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: Array.from({ length: 6 }, () => ethers.ZeroHash),
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('max 5 claim topics at deployment');
        });
      });

      describe('when configuring more than 5 agents', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: Array.from({ length: 6 }, () => ethers.ZeroAddress),
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('max 5 agents at deployment');
        });
      });

      describe('when configuring more than 30 compliance modules', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: Array.from({ length: 31 }, () => ethers.ZeroAddress),
                complianceSettings: [],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('max 30 module actions at deployment');
        });
      });

      describe('when compliance configuration is not valid', () => {
        it('should revert', async () => {
          const {
            accounts: { deployer },
            factories: { trexFactory },
          } = await loadFixture(deployFullSuiteFixture);

          await expect(
            trexFactory.connect(deployer).deployTREXSuite(
              'salt',
              {
                owner: deployer.address,
                name: 'Token name',
                symbol: 'SYM',
                decimals: 8,
                irs: ethers.ZeroAddress,
                ONCHAINID: ethers.ZeroAddress,
                irAgents: [],
                tokenAgents: [],
                complianceModules: [],
                complianceSettings: ['0x00'],
              },
              {
                claimTopics: [],
                issuers: [],
                issuerClaims: [],
              },
            ),
          ).to.be.revertedWith('invalid compliance pattern');
        });
      });

      describe('when configuration is valid', () => {
        it('should deploy a new suite', async () => {
          const {
            accounts: { deployer, aliceWallet, bobWallet },
            factories: { trexFactory, identityFactory },
            suite: { claimIssuerContract },
          } = await loadFixture(deployFullSuiteFixture);

          const countryAllowModule = await ethers.deployContract('CountryAllowModule');

          const tx = await trexFactory.connect(deployer).deployTREXSuite(
            'salt',
            {
              owner: deployer.address,
              name: 'Token name',
              symbol: 'SYM',
              decimals: 8,
              irs: ethers.ZeroAddress,
              ONCHAINID: ethers.ZeroAddress,
              irAgents: [aliceWallet.address],
              tokenAgents: [bobWallet.address],
              complianceModules: [await countryAllowModule.getAddress()],
              complianceSettings: [
                new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData('batchAllowCountries', [
                  [42, 66],
                ]),
              ],
            },
            {
              claimTopics: [ethers.keccak256(ethers.toUtf8Bytes('DEMO_TOPIC'))],
              issuers: [await claimIssuerContract.getAddress()],
              issuerClaims: [[ethers.keccak256(ethers.toUtf8Bytes('DEMO_TOPIC'))]],
            },
          );
          expect(tx).to.emit(trexFactory, 'TREXSuiteDeployed');
          expect(tx).to.emit(identityFactory, 'Deployed');
          expect(tx).to.emit(identityFactory, 'TokenLinked');
        });
      });
    });
  });

  describe('.getToken()', () => {
    describe('when salt was used to deploy a token', () => {
      it('should return the token address', async () => {
        const {
          accounts: { deployer },
          factories: { trexFactory },
        } = await loadFixture(deployFullSuiteFixture);

        const tx = await trexFactory.connect(deployer).deployTREXSuite(
          'salt',
          {
            owner: deployer.address,
            name: 'Token name',
            symbol: 'SYM',
            decimals: 8,
            irs: ethers.ZeroAddress,
            ONCHAINID: ethers.ZeroAddress,
            irAgents: [],
            tokenAgents: [],
            complianceModules: [],
            complianceSettings: [],
          },
          {
            claimTopics: [],
            issuers: [],
            issuerClaims: [],
          },
        );

        await tx.wait();
        const event = (await trexFactory.queryFilter(trexFactory.filters.TREXSuiteDeployed, -1))[0];
        const tokenAddressExpected = event.args._token;

        const tokenAddress = await trexFactory.getToken('salt');
        expect(tokenAddress).to.equal(tokenAddressExpected);
      });
    });
  });

  describe('.setIdFactory()', () => {
    describe('when try to input address 0', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer },
          factories: { trexFactory },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(trexFactory.connect(deployer).setIdFactory(ethers.ZeroAddress)).to.be.revertedWith('invalid argument - zero address');
      });
    });
    describe('when try to input a valid address', () => {
      it('should set new Id Factory', async () => {
        const {
          accounts: { deployer },
          factories: { trexFactory },
          authorities: { identityImplementationAuthority },
        } = await loadFixture(deployFullSuiteFixture);

        // const newIdFactory = await new ethers.ContractFactory(OnchainID.contracts.Factory.abi, OnchainID.contracts.Factory.bytecode, deployer).deploy(
        //   await identityImplementationAuthority.getAddress(),
        // );
        const newIdFactory = await ethers.deployContract('IdFactory', [await identityImplementationAuthority.getAddress()], deployer);

        const tx = await trexFactory.setIdFactory(await newIdFactory.getAddress());
        expect(tx).to.emit(trexFactory, 'IdFactorySet');
        expect(await trexFactory.getIdFactory()).to.equal(await newIdFactory.getAddress());
      });
    });
  });

  describe('.recoverContractOwnership()', () => {
    describe('when sender is not owner', () => {
      it('should revert', async () => {
        const {
          accounts: { deployer, aliceWallet },
          factories: { trexFactory },
        } = await loadFixture(deployFullSuiteFixture);

        const tx = await trexFactory.connect(deployer).deployTREXSuite(
          'salt',
          {
            owner: deployer.address,
            name: 'Token name',
            symbol: 'SYM',
            decimals: 8,
            irs: ethers.ZeroAddress,
            ONCHAINID: ethers.ZeroAddress,
            irAgents: [],
            tokenAgents: [],
            complianceModules: [],
            complianceSettings: [],
          },
          {
            claimTopics: [],
            issuers: [],
            issuerClaims: [],
          },
        );

        await tx.wait();
        
        const event = (await trexFactory.queryFilter(trexFactory.filters.TREXSuiteDeployed, -1))[0];
        const tokenAddress = event.args._token;

        await expect(trexFactory.connect(aliceWallet).recoverContractOwnership(tokenAddress, aliceWallet.address)).to.be.revertedWithCustomError(trexFactory, 'OwnableUnauthorizedAccount');
      });
    });

    describe('when sender is owner and factory owns the trex contract', () => {
      it('should transfer ownership on the desired contract', async () => {
        const {
          accounts: { deployer, aliceWallet },
          factories: { trexFactory },
        } = await loadFixture(deployFullSuiteFixture);

        const deployTx = await trexFactory.connect(deployer).deployTREXSuite(
          'salt',
          {
            owner: await trexFactory.getAddress(),
            name: 'Token name',
            symbol: 'SYM',
            decimals: 8,
            irs: ethers.ZeroAddress,
            ONCHAINID: ethers.ZeroAddress,
            irAgents: [],
            tokenAgents: [],
            complianceModules: [],
            complianceSettings: [],
          },
          {
            claimTopics: [],
            issuers: [],
            issuerClaims: [],
          },
        );

        await deployTx.wait();
        
        const event = (await trexFactory.queryFilter(trexFactory.filters.TREXSuiteDeployed, -1))[0];
        const tokenAddress = event.args._token;

        const tx = await trexFactory.connect(deployer).recoverContractOwnership(tokenAddress, aliceWallet.address);

        const token = await ethers.getContractAt('Token', tokenAddress);

        await expect(tx).to.emit(token, 'OwnershipTransferred').withArgs(await trexFactory.getAddress(), aliceWallet.address);

        await expect(token.owner()).to.eventually.eq(aliceWallet.address);
      });
    });
  });
});
