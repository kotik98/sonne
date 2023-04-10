const { ethers, BigNumber } = require('ethers');
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, CONTRACT_ADDRESS } = process.env;
const sonnePosManager = require('./artifacts/contracts/sonnePositionManger.sol/sonnePositionManager.json')

async function check(){
    const wstETH = '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb'
    const sowstETH = '0x26AaB17f27CD1c8d06a0Ad8E4a1Af8B1032171d5'
    const SONNE = '0x1DB2466d9F5e10D7090E7152B68d62703a2245F0'
    const velo = '0x3c8B650257cFb5f272f799F5e2b4e65093a11a05'
    const WETH = '0x4200000000000000000000000000000000000006';
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP)
    const wallet1 = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet1 = wallet1.connect(web3Provider)

    const posManager = new ethers.Contract(CONTRACT_ADDRESS, sonnePosManager.abi)

    // await posManager.connect(connectedWallet1).listSoToken(wstETH, sowstETH);

    // const ERC20 = require('./abi/wETHabi.json')
    // const wstETHcontract = new ethers.Contract(wstETH, ERC20)
    // await wstETHcontract.connect(connectedWallet1).approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256)

    // const routes = [{ 
    //     from: SONNE,
    //     to: velo,
    //     stable: false
    //   },
    //   { 
    //     from: velo,
    //     to: WETH,
    //     stable: false
    //   },
    //   { 
    //     from: WETH,
    //     to: wstETH,
    //     stable: true
    //   }]
    // await posManager.connect(connectedWallet1).claimAndReinvest(
    //         sowstETH,
    //         false, 
    //         false,
    //         0,
    //         routes,
    //         Date.now() / 1000 + 120)

    console.log('completed')
}

check()