const { ethers, BigNumber } = require('ethers');
const fs = require("fs")
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, CLIENT_0, SONNE_ADDRESS, USDC_ADDRESS, DAI_ADDRESS, UNITROLLER_ADDRESS, VELO_ROUTER_ADDRESS, COMPTROLLER_ADDRESS, soDAI_ADDRESS, MODULE_ADDRESS } = process.env;
const sonnePosManager = require('./artifacts/contracts/sonnePositionManger.sol/sonnePositionManager.json')
const WETHabi = require('./abi/wETHabi.json');
const soWETHabi = require('./abi/sowETHabi.json');
const { abi: moduleABI } =  require('./abi/WhitelistingModuleV2.json')
const { abi: posManagerABI } =  require('./abi/sonnePositionManager.json')

const iface = new ethers.utils.Interface(moduleABI)
const posManagerIface = new ethers.utils.Interface(posManagerABI)
const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP)
const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider)

async function run(){

    let data = posManagerIface.encodeFunctionData('closePosition', [ soDAI_ADDRESS, ethers.BigNumber.from('900000000000000000') ]) 
    let txData = iface.encodeFunctionData('execTransaction', [ CLIENT_0, '0', data ])
    let transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: 0,
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(3000000)
    }
    await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    })

    data = posManagerIface.encodeFunctionData('returnERC20', [ DAI_ADDRESS ]) 
    txData = iface.encodeFunctionData('execTransaction', [ CLIENT_0, '0', data ])
    transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: 0,
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(1000000)
    }
    await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    })
    console.log('completed');
}

run()