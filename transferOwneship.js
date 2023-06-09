const { ethers, BigNumber } = require('ethers');
const { FormatTypes, Interface } = require("@ethersproject/abi");
require("dotenv").config();
const { ALCHEMY_OP, WALLET_SECRET, CLIENT_0, SAFE_ADDRESS, DAI_ADDRESS, soDAI_ADDRESS } = process.env;


async function run(){
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP);
    const wallet = new ethers.Wallet(WALLET_SECRET, web3Provider);
    abi = [
        'function transferOwnership(address newOwner)',
        'function listSoToken(address erc20address, address soTokenAddress)'
    ]
    const iface = new Interface(abi);
    const contract = new ethers.Contract(CLIENT_0, iface);
    // await contract.connect(wallet).listSoToken(DAI_ADDRESS, soDAI_ADDRESS);
    await contract.connect(wallet).transferOwnership(SAFE_ADDRESS);

}
run()