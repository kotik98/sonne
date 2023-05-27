import { BigNumber, ethers } from 'ethers'
import EthersAdapter from '@safe-global/safe-ethers-lib'
import Safe, { SafeFactory, SafeAccountConfig, ContractNetworksConfig, SafeTransactionOptionalProps } from '@safe-global/safe-core-sdk'
import SafeServiceClient from '@safe-global/safe-service-client'
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types'
import { abi as module_abi } from './abi/WhitelistingModuleV2.json'
import * as daiABI from './abi/DAIabi.json'
import * as posManagerABI from './abi/sonnePositionManager.json'
require("dotenv").config();
const { ALCHEMY_OP, WALLET_ADDRESS, WALLET_SECRET, SAFE_ADDRESS, MODULE_ADDRESS, DAI_ADDRESS, CONTRACT_ADDRESS, VELO_ROUTER_ADDRESS, soDAI_ADDRESS } = process.env;

const web3Provider = new ethers.providers.StaticJsonRpcProvider(ALCHEMY_OP)
// const web3Provider = new ethers.providers.StaticJsonRpcProvider('http://127.0.0.1:8545/')

async function safeSetup(){

    if (WALLET_SECRET){
        const wallet1 = new ethers.Wallet(WALLET_SECRET)
        const connectedWallet1 = wallet1.connect(web3Provider)
        const ethAdapter = new EthersAdapter({
            ethers,
            signerOrProvider: connectedWallet1
        })
        const safeFactory = await SafeFactory.create({ ethAdapter })
        const safeService = new SafeServiceClient({
            txServiceUrl: 'https://safe-transaction-optimism.safe.global/',
            ethAdapter
          })

        if (SAFE_ADDRESS){
            const safeSdk: Safe = await Safe.create({ ethAdapter: ethAdapter, safeAddress: SAFE_ADDRESS })
            if (MODULE_ADDRESS){

                // module enabling
                // let safeTransaction = await safeSdk.createEnableModuleTx(MODULE_ADDRESS)
                // let txHash = await safeSdk.getTransactionHash(safeTransaction)
                // let signature = await safeSdk.signTransactionHash(txHash)
                // safeTransaction.addSignature(signature)
                // await safeService.proposeTransaction({
                //     safeAddress: SAFE_ADDRESS,
                //     /// @ts-ignore
                //     senderAddress: WALLET_ADDRESS,
                //     safeTransactionData: safeTransaction.data,
                //     safeTxHash: txHash,
                //     senderSignature: signature.data
                // });

                // addNewOperator
                const iface = new ethers.utils.Interface(module_abi)
                let data = iface.encodeFunctionData('addNewOperator', [ WALLET_ADDRESS ])
                let nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                let safeTransactionData: SafeTransactionDataPartial = {
                    to: MODULE_ADDRESS,
                    value: '0',
                    data: data,
                    nonce: nextNonce
                }
                // safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                // txHash = await safeSdk.getTransactionHash(safeTransaction)
                // signature = await safeSdk.signTransactionHash(txHash)
                // safeTransaction.addSignature(signature)
                // await safeService.proposeTransaction({
                //     safeAddress: SAFE_ADDRESS,
                //     /// @ts-ignore
                //     senderAddress: WALLET_ADDRESS,
                //     safeTransactionData: safeTransaction.data,
                //     safeTxHash: txHash,
                //     senderSignature: signature.data
                // });

                //approves
                const erc20iface = new ethers.utils.Interface(daiABI)
                data = erc20iface.encodeFunctionData('approve',
                [ 
                    CONTRACT_ADDRESS,
                    ethers.constants.MaxUint256,
                ])
                nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                safeTransactionData = {
                    /// @ts-ignore
                    to: DAI_ADDRESS,
                    value: '0',
                    data: data,
                    nonce: nextNonce
                }
                let safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                let txHash = await safeSdk.getTransactionHash(safeTransaction)
                let signature = await safeSdk.signTransactionHash(txHash)
                safeTransaction.addSignature(signature)
                await safeService.proposeTransaction({
                    safeAddress: SAFE_ADDRESS,
                    /// @ts-ignore
                    senderAddress: WALLET_ADDRESS,
                    safeTransactionData: safeTransaction.data,
                    safeTxHash: txHash,
                    senderSignature: signature.data
                });


                // data = erc20iface.encodeFunctionData('approve',
                // [  
                //     soDAI_ADDRESS,
                //     ethers.constants.MaxUint256,
                // ])
                // nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                // safeTransactionData = {
                //     /// @ts-ignore
                //     to: DAI_ADDRESS,
                //     value: '0',
                //     data: data,
                //     nonce: nextNonce
                // }
                // safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                // txHash = await safeSdk.getTransactionHash(safeTransaction)
                // signature = await safeSdk.signTransactionHash(txHash)
                // safeTransaction.addSignature(signature)
                // await safeService.proposeTransaction({
                //     safeAddress: SAFE_ADDRESS,
                //     /// @ts-ignore
                //     senderAddress: WALLET_ADDRESS,
                //     safeTransactionData: safeTransaction.data,
                //     safeTxHash: txHash,
                //     senderSignature: signature.data
                // });


                // list token
                // const contractIface = new ethers.utils.Interface(posManagerABI.abi)
                // data = contractIface.encodeFunctionData('listSoToken', [ DAI_ADDRESS, soDAI_ADDRESS ])
                // nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                // safeTransactionData = {
                //     /// @ts-ignore
                //     to: CONTRACT_ADDRESS,
                //     value: '0',
                //     data: data,
                //     nonce: nextNonce
                // }
                // safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                // txHash = await safeSdk.getTransactionHash(safeTransaction)
                // signature = await safeSdk.signTransactionHash(txHash)
                // safeTransaction.addSignature(signature)
                // await safeService.proposeTransaction({
                //     safeAddress: SAFE_ADDRESS,
                //     /// @ts-ignore
                //     senderAddress: WALLET_ADDRESS,
                //     safeTransactionData: safeTransaction.data,
                //     safeTxHash: txHash,
                //     senderSignature: signature.data
                // });


                // allowances:
                // open position
                data = iface.encodeFunctionData('addNewAllowance',
                [  CONTRACT_ADDRESS,
                   '0x84fbfc5b',
                   {
                       offset: 4 + 12 + 3 * 32,
                       dataLength: 164,
                       args: [
                           DAI_ADDRESS
                       ]
                   }
                ])
                nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                safeTransactionData = {
                    to: MODULE_ADDRESS,
                    value: '0',
                    data: data,
                    nonce: nextNonce
                }
                safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                txHash = await safeSdk.getTransactionHash(safeTransaction)
                signature = await safeSdk.signTransactionHash(txHash)
                safeTransaction.addSignature(signature)
                await safeService.proposeTransaction({
                    safeAddress: SAFE_ADDRESS,
                    /// @ts-ignore
                    senderAddress: WALLET_ADDRESS,
                    safeTransactionData: safeTransaction.data,
                    safeTxHash: txHash,
                    senderSignature: signature.data
                });


                // reinvest
                data = iface.encodeFunctionData('addNewAllowance',
                [  CONTRACT_ADDRESS,
                   '0x6d49329c',
                   {
                       offset: 4 + 12,
                       dataLength: 484,
                       args: [
                           soDAI_ADDRESS
                       ]
                   }
                ])
                nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                safeTransactionData = {
                    to: MODULE_ADDRESS,
                    value: '0',
                    data: data,
                    nonce: nextNonce
                }
                safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                txHash = await safeSdk.getTransactionHash(safeTransaction)
                signature = await safeSdk.signTransactionHash(txHash)
                safeTransaction.addSignature(signature)
                await safeService.proposeTransaction({
                    safeAddress: SAFE_ADDRESS,
                    /// @ts-ignore
                    senderAddress: WALLET_ADDRESS,
                    safeTransactionData: safeTransaction.data,
                    safeTxHash: txHash,
                    senderSignature: signature.data
                });


                // close position
                data = iface.encodeFunctionData('addNewAllowance',
                [  CONTRACT_ADDRESS,
                   '0x742fe1f8',
                   {
                       offset: 4 + 12,
                       dataLength: 68,
                       args: [
                           soDAI_ADDRESS
                       ]
                   }
                ])
                nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                safeTransactionData = {
                    to: MODULE_ADDRESS,
                    value: '0',
                    data: data,
                    nonce: nextNonce
                }
                safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                txHash = await safeSdk.getTransactionHash(safeTransaction)
                signature = await safeSdk.signTransactionHash(txHash)
                safeTransaction.addSignature(signature)
                await safeService.proposeTransaction({
                    safeAddress: SAFE_ADDRESS,
                    /// @ts-ignore
                    senderAddress: WALLET_ADDRESS,
                    safeTransactionData: safeTransaction.data,
                    safeTxHash: txHash,
                    senderSignature: signature.data
                });


                // returnERC20
                data = iface.encodeFunctionData('addNewAllowance',
                [  CONTRACT_ADDRESS,
                   '0xc7293668',
                   {
                       offset: 4 + 12,
                       dataLength: 36,
                       args: [
                           DAI_ADDRESS,
                           soDAI_ADDRESS
                       ]
                   }
                ])
                nextNonce = await safeService.getNextNonce(SAFE_ADDRESS)
                safeTransactionData = {
                    to: MODULE_ADDRESS,
                    value: '0',
                    data: data,
                    nonce: nextNonce
                }
                safeTransaction = await safeSdk.createTransaction({ safeTransactionData })
                txHash = await safeSdk.getTransactionHash(safeTransaction)
                signature = await safeSdk.signTransactionHash(txHash)
                safeTransaction.addSignature(signature)
                await safeService.proposeTransaction({
                    safeAddress: SAFE_ADDRESS,
                    /// @ts-ignore
                    senderAddress: WALLET_ADDRESS,
                    safeTransactionData: safeTransaction.data,
                    safeTxHash: txHash,
                    senderSignature: signature.data
                });
            }
        }

    }
}

safeSetup().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });