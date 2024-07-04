import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployFullSuiteFixture } from './fixtures/deploy-full-suite.fixture';
import { AbiCoder } from 'ethers';

describe('AgentManager', () => {
  describe('.callForceTransfer', () => {
    describe('when specified identity is missing the TransferManager role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callForcedTransfer(aliceWallet.address, bobWallet.address, 200, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Transfer Manager');
      });
    });

    describe('when specified identity has the TransferManager role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addTransferManager(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(anotherWallet).callForcedTransfer(aliceWallet.address, bobWallet.address, 200, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Transfer Manager');
      });
    });

    describe('when identity has the TransferManager role and the sender is authorized for it', () => {
      it('Should perform the transfer', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addTransferManager(await aliceIdentity.getAddress());

        const transferTx = await agentManager
          .connect(aliceWallet)
          .callForcedTransfer(aliceWallet.address, bobWallet.address, 200, await aliceIdentity.getAddress());

        await expect(transferTx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 200);
      });
    });
  });

  describe('.callBatchForceTransfer', () => {
    describe('when specified identity is missing the TransferManager role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchForcedTransfer(
              [aliceWallet.address, bobWallet.address],
              [bobWallet.address, aliceWallet.address],
              [200, 200],
              await aliceIdentity.getAddress(),
            ),
        ).to.be.revertedWith('Role: Sender is NOT Transfer Manager');
      });
    });

    describe('when specified identity has the TransferManager role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addTransferManager(await aliceIdentity.getAddress());

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchForcedTransfer(
              [aliceWallet.address, bobWallet.address],
              [bobWallet.address, aliceWallet.address],
              [200, 200],
              await aliceIdentity.getAddress(),
            ),
        ).to.be.revertedWith('Role: Sender is NOT Transfer Manager');
      });
    });

    describe('when identity has the TransferManager role and the sender is authorized for it', () => {
      it('Should perform the transfer', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addTransferManager(await aliceIdentity.getAddress());

        const transferTx = await agentManager
          .connect(aliceWallet)
          .callBatchForcedTransfer(
            [aliceWallet.address, bobWallet.address],
            [bobWallet.address, aliceWallet.address],
            [200, 200],
            await aliceIdentity.getAddress(),
          );

        await expect(transferTx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, bobWallet.address, 200);
        await expect(transferTx).to.emit(token, 'Transfer').withArgs(bobWallet.address, aliceWallet.address, 200);
      });
    });
  });

  describe('.callPause', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callPause(await aliceIdentity.getAddress())).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(agentManager.connect(anotherWallet).callPause(await aliceIdentity.getAddress())).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the pause', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        const pauseTx = await agentManager.connect(aliceWallet).callPause(await aliceIdentity.getAddress());

        await expect(pauseTx).to.emit(token, 'Paused').withArgs(await agentManager.getAddress());
        await expect(token.paused()).to.be.eventually.true;
      });
    });
  });

  describe('.callUnpause', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callUnpause(await aliceIdentity.getAddress())).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(agentManager.connect(anotherWallet).callUnpause(await aliceIdentity.getAddress())).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the pause', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await agentManager.connect(aliceWallet).callPause(await aliceIdentity.getAddress());

        const pauseTx = await agentManager.connect(aliceWallet).callUnpause(await aliceIdentity.getAddress());

        await expect(pauseTx).to.emit(token, 'Unpaused').withArgs(await agentManager.getAddress());
      });
    });
  });

  describe('.callMint', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callMint(bobWallet.address, 1000, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Supply Modifier',
        );
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await aliceIdentity.getAddress());

        await expect(agentManager.connect(anotherWallet).callMint(bobWallet.address, 1000, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Supply Modifier',
        );
      });
    });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the mint', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await aliceIdentity.getAddress());

        const mintTx = await agentManager.connect(aliceWallet).callMint(bobWallet.address, 1000, await aliceIdentity.getAddress());

        await expect(mintTx).to.emit(token, 'Transfer').withArgs(ethers.ZeroAddress, bobWallet.address, 1000);
      });
    });
  });

  describe('.callBatchMint', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callBatchMint([bobWallet.address, aliceWallet.address], [1000, 500], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(anotherWallet).callBatchMint([bobWallet.address, aliceWallet.address], [1000, 500], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the batch mint', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await aliceIdentity.getAddress());

        const mintTx = await agentManager
          .connect(aliceWallet)
          .callBatchMint([bobWallet.address, aliceWallet.address], [1000, 500], await aliceIdentity.getAddress());

        await expect(mintTx).to.emit(token, 'Transfer').withArgs(ethers.ZeroAddress, bobWallet.address, 1000);
        await expect(mintTx).to.emit(token, 'Transfer').withArgs(ethers.ZeroAddress, aliceWallet.address, 500);
      });
    });
  });

  describe('.callBurn', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callBurn(bobWallet.address, 1000, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Supply Modifier',
        );
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await bobIdentity.getAddress());

        await expect(agentManager.connect(anotherWallet).callBurn(bobWallet.address, 200, await bobIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Supply Modifier',
        );
      });
    });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the burn', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, bobWallet },
          identities: { bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await bobIdentity.getAddress());

        const burnTx = await agentManager.connect(bobWallet).callBurn(bobWallet.address, 200, await bobIdentity.getAddress());

        await expect(burnTx).to.emit(token, 'Transfer').withArgs(bobWallet.address, ethers.ZeroAddress, 200);
      });
    });
  });

  describe('.callBatchBurn', () => {
    describe('when specified identity is missing the SupplyModifier role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callBatchBurn([bobWallet.address, aliceWallet.address], [500, 1000], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when specified identity has the SupplyModifier role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(anotherWallet).callBatchBurn([bobWallet.address, aliceWallet.address], [500, 100], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Supply Modifier');
      });
    });

    describe('when identity has the SupplyModifier role and the sender is authorized for it', () => {
      it('Should perform the batch burn', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addSupplyModifier(await aliceIdentity.getAddress());

        const burnTx = await agentManager
          .connect(aliceWallet)
          .callBatchBurn([bobWallet.address, aliceWallet.address], [500, 100], await aliceIdentity.getAddress());

        await expect(burnTx).to.emit(token, 'Transfer').withArgs(bobWallet.address, ethers.ZeroAddress, 500);
        await expect(burnTx).to.emit(token, 'Transfer').withArgs(aliceWallet.address, ethers.ZeroAddress, 100);
      });
    });
  });

  describe('.callSetAddressFrozen', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callSetAddressFrozen(await aliceIdentity.getAddress(), true, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Freezer',
        );
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(agentManager.connect(anotherWallet).callSetAddressFrozen(await aliceIdentity.getAddress(), true, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Freezer',
        );
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the freeze', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        const tx = await agentManager.connect(aliceWallet).callSetAddressFrozen(aliceWallet.address, true, await aliceIdentity.getAddress());

        await expect(tx).to.emit(token, 'AddressFrozen').withArgs(aliceWallet.address, true, await agentManager.getAddress());
        await expect(token.isFrozen(aliceWallet.address)).to.eventually.be.true;
      });
    });
  });

  describe('.callBatchSetAddressFrozen', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchSetAddressFrozen([await aliceIdentity.getAddress(), bobWallet.address], [true, false], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchSetAddressFrozen([await aliceIdentity.getAddress(), bobWallet.address], [true, false], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the batch pause', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        const pauseTx = await agentManager
          .connect(aliceWallet)
          .callBatchSetAddressFrozen([aliceWallet.address, bobWallet.address], [true, false], await aliceIdentity.getAddress());

        await expect(pauseTx).to.emit(token, 'AddressFrozen').withArgs(aliceWallet.address, true, await agentManager.getAddress());
        await expect(pauseTx).to.emit(token, 'AddressFrozen').withArgs(bobWallet.address, false, await agentManager.getAddress());
      });
    });
  });

  describe('.callFreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callFreezePartialTokens(await aliceIdentity.getAddress(), 100, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT Freezer',
        );
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(anotherWallet).callFreezePartialTokens(await aliceIdentity.getAddress(), 100, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the freeze of partial tokens', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        const freezeTx = await agentManager.connect(aliceWallet).callFreezePartialTokens(aliceWallet.address, 100, await aliceIdentity.getAddress());

        await expect(freezeTx).to.emit(token, 'TokensFrozen').withArgs(aliceWallet.address, 100);
      });
    });
  });

  describe('.callBatchFreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callBatchFreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchFreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the batch freeze of partial tokens', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        const freezeTx = await agentManager
          .connect(aliceWallet)
          .callBatchFreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], await aliceIdentity.getAddress());

        await expect(freezeTx).to.emit(token, 'TokensFrozen').withArgs(aliceWallet.address, 100);
        await expect(freezeTx).to.emit(token, 'TokensFrozen').withArgs(bobWallet.address, 200);
      });
    });
  });

  describe('.callUnfreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callUnfreezePartialTokens(await aliceIdentity.getAddress(), 100, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(anotherWallet).callUnfreezePartialTokens(await aliceIdentity.getAddress(), 100, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the unfreeze of partial tokens', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await agentManager.connect(aliceWallet).callFreezePartialTokens(aliceWallet.address, 100, await aliceIdentity.getAddress());

        const freezeTx = await agentManager.connect(aliceWallet).callUnfreezePartialTokens(aliceWallet.address, 100, await aliceIdentity.getAddress());

        await expect(freezeTx).to.emit(token, 'TokensUnfrozen').withArgs(aliceWallet.address, 100);
      });
    });
  });

  describe('.callBatchUnfreezePartialTokens', () => {
    describe('when specified identity is missing the Freezer role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager
            .connect(aliceWallet)
            .callBatchUnfreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when specified identity has the Freezer role but the sender is not authorized for it', () => {
      it('should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await expect(
          agentManager
            .connect(anotherWallet)
            .callBatchUnfreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Freezer');
      });
    });

    describe('when identity has the Freezer role and the sender is authorized for it', () => {
      it('Should perform the batch unfreeze of partial tokens', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addFreezer(await aliceIdentity.getAddress());

        await agentManager.connect(aliceWallet).callFreezePartialTokens(aliceWallet.address, 100, await aliceIdentity.getAddress());
        await agentManager.connect(aliceWallet).callFreezePartialTokens(bobWallet.address, 200, await aliceIdentity.getAddress());

        const freezeTx = await agentManager
          .connect(aliceWallet)
          .callBatchUnfreezePartialTokens([aliceWallet.address, bobWallet.address], [100, 200], await aliceIdentity.getAddress());

        await expect(freezeTx).to.emit(token, 'TokensUnfrozen').withArgs(aliceWallet.address, 100);
      });
    });
  });

  describe('.callRecoveryAddress', () => {
    describe('when specified identity is missing the RecoveryAgent role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callRecoveryAddress(bobWallet.address, anotherWallet.address, await bobIdentity.getAddress(), await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Recovery Agent');
      });
    });

    describe('when specified identity has the RecoveryAgent role but sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet, anotherWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addRecoveryAgent(await aliceIdentity.getAddress());

        await expect(
          agentManager
            .connect(anotherWallet)
            .callRecoveryAddress(bobWallet.address, anotherWallet.address, await bobIdentity.getAddress(), await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT Recovery Agent');
      });
    });

    describe('when identity has the RecoveryAgent role and the sender is authorized for it', () => {
      it('Should perform the recovery of the address', async () => {
        const {
          suite: { agentManager, token },
          accounts: { tokenAdmin, aliceWallet, bobWallet, anotherWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addRecoveryAgent(await aliceIdentity.getAddress());

        await bobIdentity
          .connect(bobWallet)
          .addKey(ethers.keccak256(AbiCoder.defaultAbiCoder().encode(['address'], [anotherWallet.address])), 1, 1);

        const recoveryTx = await agentManager
          .connect(aliceWallet)
          .callRecoveryAddress(bobWallet.address, anotherWallet.address, await bobIdentity.getAddress(), await aliceIdentity.getAddress());

        await expect(recoveryTx).to.emit(token, 'RecoverySuccess').withArgs(bobWallet.address, anotherWallet.address, await bobIdentity.getAddress());
      });
    });
  });

  describe('.callRegisterIdentity', () => {
    describe('when specified identity is missing the WhiteListManager role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callRegisterIdentity(bobWallet.address, await bobIdentity.getAddress(), 42, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT WhiteList Manager');
      });
    });

    describe('when specified identity has the WhiteListManager role but sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(bobWallet).callRegisterIdentity(bobWallet.address, await bobIdentity.getAddress(), 42, await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT WhiteList Manager');
      });
    });

    describe('when identity has the WhitelistManager role and the sender is authorized for it', () => {
      it('Should perform the registration of the identity', async () => {
        const {
          suite: { agentManager, identityRegistry },
          accounts: { tokenAdmin, aliceWallet, charlieWallet },
          identities: { aliceIdentity, charlieIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        const registerTx = await agentManager
          .connect(aliceWallet)
          .callRegisterIdentity(charlieWallet.address, await charlieIdentity.getAddress(), 42, await aliceIdentity.getAddress());

        await expect(registerTx).to.emit(identityRegistry, 'IdentityRegistered').withArgs(charlieWallet.address, await charlieIdentity.getAddress());

        await expect(identityRegistry.contains(charlieWallet.address)).to.eventually.be.true;
      });
    });
  });

  describe('.callUpdateIdentity', () => {
    describe('when specified identity is missing the WhiteListManager role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(
          agentManager.connect(aliceWallet).callUpdateIdentity(bobWallet.address, await bobIdentity.getAddress(), await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT WhiteList Manager');
      });
    });

    describe('when specified identity has the WhiteListManager role but sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        await expect(
          agentManager.connect(bobWallet).callUpdateIdentity(bobWallet.address, await bobIdentity.getAddress(), await aliceIdentity.getAddress()),
        ).to.be.revertedWith('Role: Sender is NOT WhiteList Manager');
      });
    });

    describe('when identity has the WhitelistManager role and the sender is authorized for it', () => {
      it('Should perform the update of the identity', async () => {
        const {
          suite: { agentManager, identityRegistry },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity, bobIdentity, charlieIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        const updateTx = await agentManager
          .connect(aliceWallet)
          .callUpdateIdentity(bobWallet.address, await charlieIdentity.getAddress(), await aliceIdentity.getAddress());

        await expect(updateTx).to.emit(identityRegistry, 'IdentityUpdated').withArgs(await bobIdentity.getAddress(), await charlieIdentity.getAddress());
      });
    });
  });

  describe('.callUpdateCountry', () => {
    describe('when specified identity is missing the WhiteListManager role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callUpdateCountry(bobWallet.address, 100, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT WhiteList Manager',
        );
      });
    });

    describe('when specified identity has the WhiteListManager role but sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        await expect(agentManager.connect(bobWallet).callUpdateCountry(bobWallet.address, 100, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT WhiteList Manager',
        );
      });
    });

    describe('when identity has the WhitelistManager role and the sender is authorized for it', () => {
      it('Should perform the update of the country', async () => {
        const {
          suite: { agentManager, identityRegistry },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        const updateTx = await agentManager.connect(aliceWallet).callUpdateCountry(bobWallet.address, 100, await aliceIdentity.getAddress());

        await expect(updateTx).to.emit(identityRegistry, 'CountryUpdated').withArgs(bobWallet.address, 100);
      });
    });
  });

  describe('.callDeleteIdentity', () => {
    describe('when specified identity is missing the WhiteListManager role', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { aliceWallet, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await expect(agentManager.connect(aliceWallet).callDeleteIdentity(bobWallet.address, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT WhiteList Manager',
        );
      });
    });

    describe('when specified identity has the WhiteListManager role but sender is not authorized for it', () => {
      it('Should revert', async () => {
        const {
          suite: { agentManager },
          accounts: { tokenAdmin, bobWallet },
          identities: { aliceIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        await expect(agentManager.connect(bobWallet).callDeleteIdentity(bobWallet.address, await aliceIdentity.getAddress())).to.be.revertedWith(
          'Role: Sender is NOT WhiteList Manager',
        );
      });
    });

    describe('when identity has the WhitelistManager role and the sender is authorized for it', () => {
      it('Should perform the deletion of the identity', async () => {
        const {
          suite: { agentManager, identityRegistry },
          accounts: { tokenAdmin, aliceWallet, bobWallet },
          identities: { aliceIdentity, bobIdentity },
        } = await loadFixture(deployFullSuiteFixture);

        await agentManager.connect(tokenAdmin).addWhiteListManager(await aliceIdentity.getAddress());

        const deleteTx = await agentManager.connect(aliceWallet).callDeleteIdentity(bobWallet.address, await aliceIdentity.getAddress());

        await expect(deleteTx).to.emit(identityRegistry, 'IdentityRemoved').withArgs(bobWallet.address, await bobIdentity.getAddress());

        await expect(identityRegistry.contains(bobWallet.address)).to.eventually.be.false;
      });
    });
  });
});
