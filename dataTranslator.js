require("dotenv").config();
const { UNITROLLER_ADDRESS, VELO_ROUTER_ADDRESS, ALCHEMY_OP, soDAI_ADDRESS, SONNE_ADDRESS, USDC_ADDRESS } = process.env;
const { exec } = require("child_process");
const { ethers } = require('ethers');
const abi = require('./abi/veloRouter.json');
const sowETHabi = require('./abi/sowETHabi.json');
const comptrollerABI = require('./abi/comptrollerABIcut.json');

const timer = ms => new Promise(res => setTimeout(res, ms));

const web3Provider_OP = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP);
const soDAI_OP = new ethers.Contract(soDAI_ADDRESS, sowETHabi, web3Provider_OP);
const unitrollerSONNE = new ethers.Contract(UNITROLLER_ADDRESS, comptrollerABI, web3Provider_OP);
const veloRouter = new ethers.Contract(VELO_ROUTER_ADDRESS, abi, web3Provider_OP);

sonneAccs = [ ['0x1a289e0daa4f52634e58de87965cf3b2b7292ca1', 26] ]

async function getBalanceOnSONNE(address) {
    let SONNEPrice = (await veloRouter.getAmountOut('1000000000000000000', SONNE_ADDRESS, USDC_ADDRESS)).amount / 1e6;
    let snapshot = await soDAI_OP.getAccountSnapshot(address);
    let collateral = snapshot[1] * snapshot[3] / 1e36;
    let borrow = snapshot[2] / 1e18;
    let borrowIndex = (await unitrollerSONNE.compBorrowState(soDAI_ADDRESS))[0];
    let borrowerIndex = await unitrollerSONNE.compBorrowerIndex(soDAI_ADDRESS, address);
    let deltaIndexB = borrowIndex - borrowerIndex;
    let marketBorrowIndex = await soDAI_OP.borrowIndex();
    let borrowerAmount = snapshot[2] * 1e18 / marketBorrowIndex;
    let borrowerDelta = borrowerAmount * deltaIndexB / 1e36;
    let supplyIndex = (await unitrollerSONNE.compSupplyState(soDAI_ADDRESS))[0];
    let supplierIndex = await unitrollerSONNE.compSupplierIndex(soDAI_ADDRESS, address);
    let deltaIndexS = supplyIndex - supplierIndex;
    let supplierDelta = snapshot[1] * deltaIndexS / 1e36;
    let compAccrued = await unitrollerSONNE.compAccrued(address);
    let unclaimedSONNEbalance = borrowerDelta / 1e18 + supplierDelta / 1e18 + compAccrued / 1e18;
    return collateral + unclaimedSONNEbalance * SONNEPrice - borrow;
}

async function run(){

    const username = 'sc_common'
    const password = 'cakes_are_yummy_omnomnom'
    const loginUrl = 'https://sicapital.ru/accounts/login/'
    const updateUrl = 'https://sicapital.ru/states/update_balance/'

    while(true) {
        sonneAccs.forEach(async (element) => {
            exec(
                "python3 ./transferer.py " + element[1] + " " + await getBalanceOnSONNE(element[0]),
                (err, stdout, stderr) => {
                  if (err) {
                    console.error(`exec error: ${err}`);
                    return;
                  }
                }
            );
        });

        await timer(60 * 60 * 1000);
    }

}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });