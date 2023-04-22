const { ethers, BigNumber } = require('ethers');
const fs = require("fs");
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, CONTRACT_ADDRESS, SONNE_ADDRESS, USDC_ADDRESS, DAI_ADDRESS, UNITROLLER_ADDRESS, VELO_ROUTER_ADDRESS, COMPTROLLER_ADDRESS, soDAI_ADDRESS, MODULE_ADDRESS, SAFE_ADDRESS } = process.env;
const sonnePosManager = require('./artifacts/contracts/sonnePositionManger.sol/sonnePositionManager.json');
const WETHabi = require('./abi/wETHabi.json');
const soWETHabi = require('./abi/sowETHabi.json');
const { abi: moduleABI } =  require('./abi/WhitelistingModuleV2.json');
const { abi: posManagerABI } =  require('./abi/sonnePositionManager.json');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const doc = new GoogleSpreadsheet('1lNK2HNWwX3XuFzM9Zz0ch5J2fDNvp6c2f0QoHrqgzwQ');
const creds = require("./credentials.json");
const abi = require('./abi/veloRouter.json');
const DAIabi = require('./abi/DAIabi.json');
const sowETHabi = require('./abi/sowETHabi.json');
const comptrollerABI = require('./abi/comptrollerABIcut.json');

const iface = new ethers.utils.Interface(moduleABI);
const posManagerIface = new ethers.utils.Interface(posManagerABI);
const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP);
const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);
// const posManager = new ethers.Contract(CONTRACT_ADDRESS, sonnePosManager.abi)

async function run(){
    let SONNEPrice, collateral, borrow, unclaimedSONNEbalance, sumbalance, borrowIndex, borrowerIndex, deltaIndexB, borrowerAmount, marketBorrowIndex, borrowerDelta, supplyIndex, supplierIndex, deltaIndexS, supplierDelta, compAccrued;
    const DAI = new ethers.Contract(DAI_ADDRESS, DAIabi, web3Provider);
    const soDAI = new ethers.Contract(soDAI_ADDRESS, sowETHabi, web3Provider);
    const unitroller = new ethers.Contract(UNITROLLER_ADDRESS, comptrollerABI, web3Provider);
    const router = new ethers.Contract(VELO_ROUTER_ADDRESS, abi, web3Provider);
    
    SONNEPrice = (await router.getAmountOut('1000000000000000000', SONNE_ADDRESS, USDC_ADDRESS)).amount / 1e6;
    let snapshot = await soDAI.getAccountSnapshot(CONTRACT_ADDRESS);
    collateral = snapshot[1] * snapshot[3] / 1e36;
    borrow = snapshot[2] / 1e18;

    borrowIndex = (await unitroller.compBorrowState(soDAI_ADDRESS))[0];
    borrowerIndex = await unitroller.compBorrowerIndex(soDAI_ADDRESS, CONTRACT_ADDRESS);
    deltaIndexB = borrowIndex - borrowerIndex;
    marketBorrowIndex = await soDAI.borrowIndex();
    borrowerAmount = snapshot[2] * 1e18 / marketBorrowIndex;
    borrowerDelta = borrowerAmount * deltaIndexB / 1e36;
    supplyIndex = (await unitroller.compSupplyState(soDAI_ADDRESS))[0];
    supplierIndex = await unitroller.compSupplierIndex(soDAI_ADDRESS, CONTRACT_ADDRESS);
    deltaIndexS = supplyIndex - supplierIndex;
    supplierDelta = snapshot[1] * deltaIndexS / 1e36;
    compAccrued = await unitroller.compAccrued(CONTRACT_ADDRESS);
    unclaimedSONNEbalance = (borrowerDelta + supplierDelta + compAccrued) / 1e18;
    console.log(unclaimedSONNEbalance / 10)
}

run()
