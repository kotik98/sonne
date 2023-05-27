const { ethers, BigNumber } = require('ethers');
const fs = require("fs");
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, CONTRACT_ADDRESS, SONNE_ADDRESS, USDC_ADDRESS, DAI_ADDRESS, UNITROLLER_ADDRESS, VELO_ROUTER_ADDRESS, COMPTROLLER_ADDRESS, soDAI_ADDRESS, MODULE_ADDRESS, SAFE_ADDRESS } = process.env;
const sonnePosManager = require('./artifacts/contracts/sonnePositionManger.sol/sonnePositionManager.json');
const WETHabi = require('./abi/wETHabi.json');
const { abi: moduleABI } =  require('./abi/WhitelistingModuleV2.json');
const { abi: posManagerABI } =  require('./abi/sonnePositionManager.json');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const doc = new GoogleSpreadsheet('1lNK2HNWwX3XuFzM9Zz0ch5J2fDNvp6c2f0QoHrqgzwQ');
const creds = require("./credentials.json");
const abi = require('./abi/veloRouter.json');
const sowETHabi = require('./abi/sowETHabi.json');
const comptrollerABI = require('./abi/comptrollerABIcut.json');
const DAIabi = require('./abi/DAIabi.json');
const { TelegramLogger } = require("node-telegram-log");
const logger = new TelegramLogger(
  "6087708284:AAHv6cLkgaFWLLAx_jE1Ejv5yKrqgt_s4rg",
  -935614405
);

const iface = new ethers.utils.Interface(moduleABI);
const posManagerIface = new ethers.utils.Interface(posManagerABI);
const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP);
const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);
// const posManager = new ethers.Contract(CONTRACT_ADDRESS, sonnePosManager.abi)

const timer = ms => new Promise(res => setTimeout(res, ms));

var args = process.argv.slice(2);

async function reinvest(soTokenAddress, leverage, collateralFactorNumeratorXe18){
    let route = [
        { 
          from: SONNE_ADDRESS,
          to: USDC_ADDRESS,
          stable: false
        }, 
        { 
          from: USDC_ADDRESS,
          to: DAI_ADDRESS,
          stable: true
        }
      ];
    const data = posManagerIface.encodeFunctionData('claimAndReinvest', [ soTokenAddress, leverage, collateralFactorNumeratorXe18, false, false, 0, route, Math.floor(Date.now() / 1000) + 60 ]);
    const txData = iface.encodeFunctionData('execTransaction', [ CONTRACT_ADDRESS, '0', data ]);
    const transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: 0,
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(3000000)
    };
    return await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    });
}

async function openPosition(initialAmount, leverage, collateralFactorNumeratorXe18, erc20address, soTokenAddress){
    const data = posManagerIface.encodeFunctionData('openPosition', [ initialAmount, leverage, collateralFactorNumeratorXe18, erc20address, soTokenAddress ]);
    const txData = iface.encodeFunctionData('execTransaction', [ CONTRACT_ADDRESS, '0', data ]);
    const transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: 0,
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(3000000)
    };
    return await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    });
}

async function run(args){

    const reinvestingDelta = Number(args[0])
    const leverage = Number(args[1])
    const reinvestLeverage = Number(args[2])
    const collateralFactorNumeratorXe18 = args[3]

    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    // const sheet = await doc.addSheet({ title: 'dai test', headerValues: ['UnixTime', 'collateral', 'borrow', 'healthFactor', 'unclaimedSONNEbalance', 'SONNEPrice', 'sumbalance'] });
    const sheet = doc.sheetsByTitle['dai test'];

    let SONNEPrice, snapshot, collateral, borrow, unclaimedSONNEbalance, sumbalance, borrowIndex, borrowerIndex, deltaIndexB, borrowerAmount, marketBorrowIndex, borrowerDelta, supplyIndex, supplierIndex, deltaIndexS, supplierDelta, compAccrued;
    const DAI = new ethers.Contract(DAI_ADDRESS, DAIabi, web3Provider);
    const soDAI = new ethers.Contract(soDAI_ADDRESS, sowETHabi, web3Provider);
    const unitroller = new ethers.Contract(UNITROLLER_ADDRESS, comptrollerABI, web3Provider);
    const router = new ethers.Contract(VELO_ROUTER_ADDRESS, abi, web3Provider);
    

    let nextDate = fs.readFileSync('reinvest.txt', 'utf8');
    if (Number(nextDate) == 0){
        let balance = await DAI.balanceOf(SAFE_ADDRESS);
        await openPosition(balance, leverage, collateralFactorNumeratorXe18, DAI_ADDRESS, soDAI_ADDRESS);

        nextDate = (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString();
        fs.writeFileSync('reinvest.txt', nextDate);
        let symbol = await DAI.symbol();
        logger.log(
            'position opened with ' + (balance/1e18).toString() + ' ' + symbol + '\n' +
            'with following parameters:\n' +
            'reinvesting delta: ' + reinvestingDelta.toString() + ' days\n' +
            'leverage: ' + leverage.toString() + '\n' +
            'reinvesting leverage: ' + reinvestLeverage.toString() + '\n' +
            'collateral factor x 1e18: ' + (collateralFactorNumeratorXe18).toString()
        );
    }
    
    while(true){

        SONNEPrice = (await router.getAmountOut('1000000000000000000', SONNE_ADDRESS, USDC_ADDRESS)).amount / 1e6;
        snapshot = await soDAI.getAccountSnapshot(CONTRACT_ADDRESS);
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
        unclaimedSONNEbalance = borrowerDelta / 1e18 + supplierDelta / 1e18 + compAccrued / 1e18;
        sumbalance = collateral + unclaimedSONNEbalance * SONNEPrice - borrow;
        healthFactor = collateral * 0.9 / borrow;

        if (healthFactor < 1.0025){
            logger.error('@MrrMeow', 'be careful, we are close to liquidation', 'healthfactor: ' + healthFactor.toString());
        }

        if (Date.now() > Number(nextDate)){
            await reinvest(soDAI_ADDRESS, reinvestLeverage, collateralFactorNumeratorXe18);

            nextDate = (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString();
            fs.writeFileSync('reinvest.txt', nextDate);
            logger.log('reinvested ' + unclaimedSONNEbalance.toString() + ' SONNE, cost ' + (unclaimedSONNEbalance * SONNEPrice).toString() + ' USDC at current price of ' + SONNEPrice.toString());
        }

        await sheet.addRow({ 
            UnixTime: Date(Date.now()), 
            collateral: collateral.toFixed(3), 
            borrow: borrow.toFixed(3),
            healthFactor: healthFactor.toFixed(3), 
            unclaimedSONNEbalance: unclaimedSONNEbalance.toFixed(6), 
            SONNEPrice: SONNEPrice.toFixed(6), 
            sumbalance: sumbalance.toFixed(3) 
        });

        await timer(60 * 60 * 1000);
    }
}

run(args).catch((error) => {
    console.error(error);
    logger.error('@MrrMeow', 'mayday, position manager is down:', error);
    process.exitCode = 1;
  });

//   node .\posManager.js 15 22 2 899999999000000000
