const { ethers, BigNumber } = require('ethers');
const fs = require("fs");
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, CONTRACT_ADDRESS, SONNE_ADDRESS, USDC_ADDRESS, DAI_ADDRESS, UNITROLLER_ADDRESS, VELO_ROUTER_ADDRESS, COMPTROLLER_ADDRESS, soDAI_ADDRESS, MODULE_ADDRESS } = process.env;
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
const comptrollerABI = require('./abi/comptrollerABIcut.json');

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
        value: '0',
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(1000000)
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
        value: '0',
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(5000000)
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
    const sheet = await doc.addSheet({ title: 'dai test', headerValues: ['UnixTime', 'tokenBalance', 'SONNEBalance', 'SONNEPrice', 'sumbalance'] });

    let SONNEPrice, tokenBalance, SONNEBalance, sumbalance;
    const DAI = new ethers.Contract(DAI_ADDRESS, DAIabi, web3Provider);
    const unitroller = new ethers.Contract(UNITROLLER_ADDRESS, comptrollerABI, web3Provider);
    const router = new ethers.Contract(VELO_ROUTER_ADDRESS, abi, web3Provider);
    

    let nextDate = fs.readFileSync('reinvest.txt', 'utf8');
    if (Number(nextDate) == 0){
        let balance = await DAI.balanceOf(WALLET_ADDRESS);
        await openPosition(balance, leverage, collateralFactorNumeratorXe18, DAI_ADDRESS, soDAI_ADDRESS);
        nextDate = (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString();
        fs.writeFileSync('reinvest.txt', nextDate);

        SONNEPrice = (await router.getAmountOut('1000000000000000000', SONNE_ADDRESS, USDC_ADDRESS)).amount / 1e6;
        tokenBalance = await DAI.balanceOf(CONTRACT_ADDRESS) / 1e18;
        SONNEBalance = await unitroller.callStatic.claimComp(CONTRACT_ADDRESS, [ soDAI_ADDRESS ]) / 1e18;
        sumbalance = tokenBalance + SONNEBalance * SONNEPrice;

        await sheet.addRow({ UnixTime: Date(Date.now()), tokenBalance: tokenBalance.toFixed(3), SONNEBalance: SONNEBalance.toFixed(3), SONNEPrice: SONNEPrice.toFixed(6), sumbalance: sumbalance.toFixed(3) })
    }
    else if (Number(nextDate) < Date.now()){
        await reinvest(soDAI_ADDRESS, reinvestLeverage, collateralFactorNumeratorXe18);

        nextDate = (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString();
        fs.writeFileSync('reinvest.txt', nextDate);

        SONNEPrice = (await router.getAmountOut('1000000000000000000', SONNE_ADDRESS, USDC_ADDRESS)).amount / 1e6;
        tokenBalance = await DAI.balanceOf(CONTRACT_ADDRESS) / 1e18;
        SONNEBalance = await unitroller.callStatic.claimComp(CONTRACT_ADDRESS, [ soDAI_ADDRESS ]) / 1e18;
        sumbalance = tokenBalance + SONNEBalance * SONNEPrice;

        await sheet.addRow({ UnixTime: Date(Date.now()), tokenBalance: tokenBalance.toFixed(3), SONNEBalance: SONNEBalance.toFixed(3), SONNEPrice: SONNEPrice.toFixed(6), sumbalance: sumbalance.toFixed(3) })
    }
    
    while(true){
        await timer(60 * 60 * 24 * 1000);

        if (Date.now() > Number(nextDate)){
            await reinvest(soDAI_ADDRESS, reinvestLeverage, collateralFactorNumeratorXe18);

            nextDate = (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString();
            fs.writeFileSync('reinvest.txt', nextDate);

        }

        SONNEPrice = (await router.getAmountOut('1000000000000000000', SONNE_ADDRESS, USDC_ADDRESS)).amount / 1e6;
        tokenBalance = await DAI.balanceOf(CONTRACT_ADDRESS) / 1e18;
        SONNEBalance = await unitroller.callStatic.claimComp(CONTRACT_ADDRESS, [ soDAI_ADDRESS ]) / 1e18;
        sumbalance = tokenBalance + SONNEBalance * SONNEPrice;

        await sheet.addRow({ UnixTime: Date(Date.now()), tokenBalance: tokenBalance.toFixed(3), SONNEBalance: SONNEBalance.toFixed(3), SONNEPrice: SONNEPrice.toFixed(6), sumbalance: sumbalance.toFixed(3) })

    }
}

run(args)
