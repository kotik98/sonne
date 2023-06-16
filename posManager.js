const { ethers, BigNumber } = require('ethers');
var args = process.argv.slice(2);
const acc = require('./accounts/' + args[0] + '.json');
const sonnePosManager = require('./abi/sonnePositionManager.json');
const WETHabi = require('./abi/wETHabi.json');
const { abi: moduleABI } =  require('./abi/WhitelistingModuleV2.json');
const { abi: posManagerABI } =  require('./abi/sonnePositionManager.json');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const doc = new GoogleSpreadsheet(acc.GOOGLE_SHEET);
const creds = require("./credentials.json");
const abi = require('./abi/veloRouter.json');
const sowETHabi = require('./abi/sowETHabi.json');
const comptrollerABI = require('./abi/comptrollerABIcut.json');
const DAIabi = require('./abi/DAIabi.json');
const { TelegramLogger } = require("node-telegram-log");
const logger = new TelegramLogger(
    acc.TG_KEY,
    Number(acc.TG_GROUP_ID)
);

const iface = new ethers.utils.Interface(moduleABI);
const posManagerIface = new ethers.utils.Interface(posManagerABI);
const web3Provider = new ethers.providers.StaticJsonRpcProvider(acc.ALCHEMY_OP);
const wallet = new ethers.Wallet(acc.WALLET_SECRET, web3Provider);

var fs = require('fs');

const timer = ms => new Promise(res => setTimeout(res, ms));

async function reinvest(soTokenAddress, leverage, collateralFactorNumeratorXe18){
    let route = [
        { 
          from: acc.SONNE_ADDRESS,
          to: acc.USDC_ADDRESS,
          stable: false
        }, 
        { 
          from: acc.USDC_ADDRESS,
          to: acc.DAI_ADDRESS,
          stable: true
        }
      ];
    const data = posManagerIface.encodeFunctionData('claimAndReinvest', [ soTokenAddress, leverage, collateralFactorNumeratorXe18, false, false, 0, route, Math.floor(Date.now() / 1000) + 60 ]);
    const txData = iface.encodeFunctionData('execTransaction', [ acc.CONTRACT_ADDRESS, '0', data ]);
    const transaction = {
        data: txData,
        to: acc.MODULE_ADDRESS,
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
    const txData = iface.encodeFunctionData('execTransaction', [ acc.CONTRACT_ADDRESS, '0', data ]);
    const transaction = {
        data: txData,
        to: acc.MODULE_ADDRESS,
        value: 0,
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(3000000)
    };
    return await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    });
}

async function run(){

    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    // const sheet = await doc.addSheet({ title: acc.NAME, headerValues: ['UnixTime', 'collateral', 'borrow', 'healthFactor', 'unclaimedSONNEbalance', 'SONNEPrice', 'sumbalance'] });
    const sheet = doc.sheetsByTitle[acc.NAME];

    let SONNEPrice, snapshot, collateral, borrow, unclaimedSONNEbalance, sumbalance, borrowIndex, borrowerIndex, deltaIndexB, borrowerAmount, marketBorrowIndex, borrowerDelta, supplyIndex, supplierIndex, deltaIndexS, supplierDelta, compAccrued;
    const DAI = new ethers.Contract(acc.DAI_ADDRESS, DAIabi, web3Provider);
    const soDAI = new ethers.Contract(acc.soDAI_ADDRESS, sowETHabi, web3Provider);
    const unitroller = new ethers.Contract(acc.UNITROLLER_ADDRESS, comptrollerABI, web3Provider);
    const router = new ethers.Contract(acc.VELO_ROUTER_ADDRESS, abi, web3Provider);
    

    let nextDate = fs.readFileSync('reinvest/' + args[0] + '.txt', 'utf8');
    if (Number(nextDate) == 0){
        let balance = await DAI.balanceOf(acc.SAFE_ADDRESS);
        await openPosition(balance, acc.leverage, acc.collateralFactorNumeratorXe18, acc.DAI_ADDRESS, acc.soDAI_ADDRESS);

        nextDate = (Date.now() + acc.reinvestingDelta * 24 * 60 * 60 * 1000).toString();
        fs.writeFileSync('reinvest/' + args[0] + '.txt', nextDate);
        let symbol = await DAI.symbol();
        logger.log(
            'position opened with ' + (balance/1e18).toString() + ' ' + symbol + '\n' +
            'with following parameters:\n' +
            'reinvesting delta: ' + acc.reinvestingDelta.toString() + ' days\n' +
            'leverage: ' + acc.leverage.toString() + '\n' +
            'reinvesting leverage: ' + acc.reinvestLeverage.toString() + '\n' +
            'collateral factor x 1e18: ' + (acc.collateralFactorNumeratorXe18).toString()
        );
    }
    
    while(true){

        SONNEPrice = (await router.getAmountOut('1000000000000000000', acc.SONNE_ADDRESS, acc.USDC_ADDRESS)).amount / 1e6;
        snapshot = await soDAI.getAccountSnapshot(acc.CONTRACT_ADDRESS);
        collateral = snapshot[1] * snapshot[3] / 1e36;
        borrow = snapshot[2] / 1e18;
        borrowIndex = (await unitroller.compBorrowState(acc.soDAI_ADDRESS))[0];
        borrowerIndex = await unitroller.compBorrowerIndex(acc.soDAI_ADDRESS, acc.CONTRACT_ADDRESS);
        deltaIndexB = borrowIndex - borrowerIndex;
        marketBorrowIndex = await soDAI.borrowIndex();
        borrowerAmount = snapshot[2] * 1e18 / marketBorrowIndex;
        borrowerDelta = borrowerAmount * deltaIndexB / 1e36;
        supplyIndex = (await unitroller.compSupplyState(acc.soDAI_ADDRESS))[0];
        supplierIndex = await unitroller.compSupplierIndex(acc.soDAI_ADDRESS, acc.CONTRACT_ADDRESS);
        deltaIndexS = supplyIndex - supplierIndex;
        supplierDelta = snapshot[1] * deltaIndexS / 1e36;
        compAccrued = await unitroller.compAccrued(acc.CONTRACT_ADDRESS);
        unclaimedSONNEbalance = borrowerDelta / 1e18 + supplierDelta / 1e18 + compAccrued / 1e18;
        sumbalance = collateral + unclaimedSONNEbalance * SONNEPrice - borrow;
        healthFactor = collateral * 0.9 / borrow;

        if (healthFactor < 1.0025){
            logger.error('@MrrMeow', 'be careful, we are close to liquidation', 'healthfactor: ' + healthFactor.toString());
        }

        if (Date.now() > Number(nextDate)){
            await reinvest(acc.soDAI_ADDRESS, acc.reinvestLeverage, acc.collateralFactorNumeratorXe18);

            nextDate = (Date.now() + acc.reinvestingDelta * 24 * 60 * 60 * 1000).toString();
            fs.writeFileSync('reinvest/' + args[0] + '.txt', nextDate);
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

run().catch((error) => {
    console.error(error);
    logger.error('@MrrMeow', 'mayday, position manager is down:', error);
    process.exitCode = 1;
  });
