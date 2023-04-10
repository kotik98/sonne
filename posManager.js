const { ethers, BigNumber } = require('ethers');
const fs = require("fs")
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, CONTRACT_ADDRESS, SONNE_ADDRESS, USDC_ADDRESS, WETH_ADDRESS, UNITROLLER_ADDRESS, VELO_ROUTER_ADDRESS, COMPTROLLER_ADDRESS, soWETH_ADDRESS, MODULE_ADDRESS } = process.env;
const sonnePosManager = require('./artifacts/contracts/sonnePositionManger.sol/sonnePositionManager.json')
const WETHabi = require('./abi/wETHabi.json');
const soWETHabi = require('./abi/sowETHabi.json');
const { abi: moduleABI } =  require('./abi/WhitelistingModuleV2.json')
const { abi: posManagerABI } =  require('./abi/sonnePositionManager.json')

const iface = new ethers.utils.Interface(moduleABI)
const posManagerIface = new ethers.utils.Interface(posManagerABI)
const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP)
const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider)
// const posManager = new ethers.Contract(CONTRACT_ADDRESS, sonnePosManager.abi)

const timer = ms => new Promise(res => setTimeout(res, ms)) 

var args = process.argv.slice(2);

async function reinvest(leverage, collateralFactorNumeratorXe18){
    let route = [
        { 
          from: SONNE_ADDRESS,
          to: USDC_ADDRESS,
          stable: false
        }, 
        { 
          from: USDC_ADDRESS,
          to: WETH_ADDRESS,
          stable: false
        }
      ];
    const data = posManagerIface.encodeFunctionData('claimAndReinvest', [ soWETH_ADDRESS, leverage, collateralFactorNumeratorXe18, false, false, 0, route, Math.floor(Date.now() / 1000) + 60 ]) 
    const txData = iface.encodeFunctionData('execTransaction', [ CONTRACT_ADDRESS, '0', data ])
    const transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: '0',
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(1000000)
    }
    return await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    })
}

async function openPosition(initialAmount, leverage, collateralFactorNumeratorXe18, erc20address){
    const data = posManagerIface.encodeFunctionData('openPosition', [ initialAmount, leverage, collateralFactorNumeratorXe18, erc20address ]) 
    const txData = iface.encodeFunctionData('execTransaction', [ CONTRACT_ADDRESS, '0', data ])
    const transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: '0',
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(5000000)
    }
    return await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    })
}

async function run(args){

    const reinvestingDelta = Number(args[0])
    const leverage = Number(args[1])
    const collateralFactorNumeratorXe18 = args[2]

    let nextDate = fs.readFileSync('reinvest.txt', 'utf8');
    if (Number(nextDate) == 0){
        const weth = new ethers.Contract(WETH_ADDRESS, WETHabi);
        let balance = await weth.balanceOf(WALLET_ADDRESS);
        await openPosition(balance, leverage, collateralFactorNumeratorXe18, WETH_ADDRESS);

        fs.writeFileSync('reinvest.txt', (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString());
    }
    else if (Number(nextDate) < Date.now()){
        await reinvest(leverage, collateralFactorNumeratorXe18);

        fs.writeFileSync('reinvest.txt', (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString());
    }
    while(true){
        await timer(reinvestingDelta - Date.now());

        await reinvest(leverage, collateralFactorNumeratorXe18);

        fs.writeFileSync('reinvest.txt', (Date.now() + reinvestingDelta * 24 * 60 * 60 * 1000).toString());
    }
}

run(args)
