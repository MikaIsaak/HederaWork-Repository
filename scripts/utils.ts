import {
    Client, AccountId, PrivateKey, TokenCreateTransaction, ContractCreateFlow,
    TokenType, TokenSupplyType, TransferTransaction, AccountBalanceQuery,
    AccountCreateTransaction, ContractFunctionParameters, ContractExecuteTransaction,
    TokenMintTransaction
} from "@hashgraph/sdk";

export function getClient() {
    // const client = Client.forName(process.env.HEDERA_NETWORK);
    const client = Client.forTestnet();
    client.setOperator(
        AccountId.fromString(process.env.OPERATOR_ID || ''),
        PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY || '')
    );
    return client;
}

export async function deployContract(
    client: any,
    bytecode: any,
    gas: any,
    contractAdminKey: any,
    constructorParameters: any
) {
    const createContract = new ContractCreateFlow()
        .setGas(gas) // Increase if revert
        .setBytecode(bytecode); // Contract bytecode
    if (constructorParameters) {
        createContract.setConstructorParameters(constructorParameters);
    }
    if (contractAdminKey) {
        createContract.setAdminKey(contractAdminKey);
        await createContract.sign(contractAdminKey);
    }
    const createContractTx = await createContract.execute(client);
    const createContractRx = await createContractTx.getReceipt(client);
    const contractId = createContractRx.contractId;

    return contractId;

}

export async function TokenTransfer(
    tokenId: any,
    sender: any,
    receiver: any,
    amount: number,
    client: Client
) {
    const transferToken = await new TransferTransaction()
        .addTokenTransfer(tokenId, sender, -(amount * 1e8))
        .addTokenTransfer(tokenId, receiver, amount * 1e8)
        .freezeWith(client)

    const transferTokenSubmit = await transferToken.execute(client);
    const transferTokenRx = await transferTokenSubmit.getReceipt(client);

    return transferTokenRx;
}

export async function TokenBalance(
    accountId: any,
    client: Client
) {
    const AccountBalanceQueryTx = await new AccountBalanceQuery()
        .setAccountId(accountId)
        .execute(client);
    return AccountBalanceQueryTx;
}

export async function createAccount(client: Client, key: any, initialBalance: any) {
    const createAccountTx = await new AccountCreateTransaction()
        .setKey(key)
        .setInitialBalance(initialBalance)
        .execute(client);

    const createAccountRx = await createAccountTx.getReceipt(client);
    return createAccountRx.accountId;
}

export async function addToken(
    VaultContract: any,
    tokenId: any,
    amount: any,
    client: Client
) {
    let contractFunctionParameters = new ContractFunctionParameters()
        .addAddress(tokenId)
        .addUint256(amount * 1e8);

    const notifyRewardTx = await new ContractExecuteTransaction()
        .setContractId(VaultContract)
        .setFunction("addToken", contractFunctionParameters)
        .setGas(2500000)
        .execute(client);

    const notifyRewardRx = await notifyRewardTx.getReceipt(client);
    // const rewardRecord = await notifyRewardTx.getRecord(client);
    // const totalReward = rewardRecord.contractFunctionResult.getInt256(0);
    // console.log(`- Reward Claimed ${totalReward}.`);
    console.log(`- Add Token to the contract transaction status ${notifyRewardRx.status.toString()}.`);
}

export async function createFungibleToken(
    tokenName: string,
    tokenSymbol: string,
    treasuryAccountId: any,
    supplyPublicKey: any,
    client: Client,
    privateKey: any) {
    // Create the transaction and freeze for manual signing
    const tokenCreateTx = await new TokenCreateTransaction()
        .setTokenName(tokenName)
        .setTokenSymbol(tokenSymbol)
        .setDecimals(8)
        .setInitialSupply(1000 * 1e8)
        .setTreasuryAccountId(treasuryAccountId)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
        .setSupplyKey(supplyPublicKey)
        .freezeWith(client);


    const tokenCreateSign = await tokenCreateTx.sign(privateKey);
    const tokenCreateExec = await tokenCreateTx.execute(client);

    // Sign the transaction with the token adminKey and the token treasury account private key
    const tokenCreateRx = await tokenCreateExec.getReceipt(client);
    const tokenCreateRecord = await tokenCreateExec.getRecord(client);
    const transactionFee = await tokenCreateRecord.transactionFee._valueInTinybar;
    console.log("transactionFee", transactionFee);
    console.log(`- The token ID is: ${tokenCreateRx.tokenId!.toString()}`);
    const tokenId = tokenCreateRx.tokenId

    return tokenId;
}

export async function mintToken(tokenId: any, client: Client, amount: number, privatekey: any) {
    const tokenMintTx = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(amount * 1e8)
        .freezeWith(client)
        .sign(privatekey);

    const tokenMintExec = await tokenMintTx.execute(client);
    const tokenMintRx = await tokenMintExec.getReceipt(client);

    return tokenMintRx;
}

module.exports = {
    createFungibleToken,
    getClient,
    createAccount,
    mintToken,
    TokenTransfer,
    TokenBalance,
    addToken,
}
