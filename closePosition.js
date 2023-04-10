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

async function run(){

    const data = posManagerIface.encodeFunctionData('closePosition', [ WETH_ADDRESS, ethers.BigNumber.from('750000000000000000') ]) 
    const txData = iface.encodeFunctionData('execTransaction', [ CONTRACT_ADDRESS, '0', data ])
    const transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: '0',
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(5000000)
    }
    await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    })

    data = posManagerIface.encodeFunctionData('returnERC20', [ WETH_ADDRESS ]) 
    txData = iface.encodeFunctionData('execTransaction', [ CONTRACT_ADDRESS, '0', data ])
    transaction = {
        data: txData,
        to: MODULE_ADDRESS,
        value: '0',
        // gasPrice: gasPrice,
        gasLimit: ethers.utils.hexlify(5000000)
    }
    await wallet.sendTransaction(transaction).then(async function(transaction) {
        return await transaction.wait();
    })
    console.log('completed');
}

run()