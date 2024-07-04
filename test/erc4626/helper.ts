export async function getCorrectDepositNumber(vault: any) {
    for (let i = 1; i > 0; i++) {
        if (await vault.previewDeposit(i) != 0) {
            return i;
        }
    }
}

module.exports = {
    getCorrectDepositNumber,
}
