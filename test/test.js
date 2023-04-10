/*
  be shure, to hardhat-config is properly configured
  run: npx hardhat test
*/

const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("sonne position manager", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployManagerFixture() {
    const comptrollerAddress = '0xDb0C52f1F3892e179a69b19aa25dA2aECe5006ac';
    const veloRouterAddress = '0x9c12939390052919af3155f41bf4160fd3666a6f';
    const veloTokenAddress = '0x3c8B650257cFb5f272f799F5e2b4e65093a11a05';
    const SONNEaddress = '0x1DB2466d9F5e10D7090E7152B68d62703a2245F0';
    const unitrollerAddress = '0x60CF091cD3f50420d50fD7f707414d0DF4751C58';
    const WETHaddress = '0x4200000000000000000000000000000000000006';
    const soWETHaddress = '0xf7B5965f5C117Eb1B5450187c9DcFccc3C317e8E';
    const WETHabi = require('../abi/wETHabi.json');
    const soWETHabi = require('../abi/sowETHabi.json');

    const [owner, otherAccount] = await ethers.getSigners();

    // const compabi = require('../abi/comptrollerABI.json');
    // const comp = new ethers.Contract(comptrollerAddress, compabi);
    // console.log(await comp.connect(owner).markets(soWETHaddress));

    // Contracts are deployed using the first signer/account by default
    const posManager = await ethers.getContractFactory("sonnePositionManager");
    const contract = await posManager.deploy(comptrollerAddress, veloRouterAddress, unitrollerAddress, SONNEaddress);
    await contract.deployed();

    // get some WETH to supply
    const WETH = new ethers.Contract(WETHaddress, WETHabi);
    await WETH.connect(owner).deposit({ value: ethers.utils.parseEther('10')});

    const soWETH = new ethers.Contract(soWETHaddress, soWETHabi);

    return { contract, WETHaddress, WETH, soWETHaddress, soWETH, owner, otherAccount, veloRouterAddress, SONNEaddress, veloTokenAddress };
  }

  describe("base functions", function () {
    // describe("work test", function () {
    //   it("weth deposit", async function () {
    //     const { contract, WETH, soWETH, owner, otherAccount } = await loadFixture(deployManagerFixture);

    //     await expect(async() => await WETH.connect(owner).deposit({ value: ethers.utils.parseEther('1').toString()})).to
    //     .changeTokenBalance(WETH, owner.address, ethers.utils.parseEther('1').toString());
    //   });
    // });
    describe("not revert validations", function () {
      it("list token", async function () {
        const { contract, WETH, soWETH, owner, otherAccount } = await loadFixture(deployManagerFixture);

        await expect(await contract.connect(owner).listSoToken(WETH.address, soWETH.address)).not.to.be.reverted;
      });

      it("open position", async function () {
        const { contract, WETH, soWETH, owner, otherAccount } = await loadFixture(deployManagerFixture);

        await contract.connect(owner).listSoToken(WETH.address, soWETH.address);
        await WETH.connect(owner).approve(contract.address, ethers.utils.parseEther('1').toString());
        
        await expect(await contract.openPosition(ethers.utils.parseEther('1').toString(), 5, ethers.BigNumber.from('749990000000000000'), WETH.address))
        .not.to.be.reverted;
      });

      it("reinvesting", async function () {
        const { contract, WETH, soWETH, owner, otherAccount, veloRouterAddress, SONNEaddress, veloTokenAddress } = await loadFixture(deployManagerFixture);

        const abi = require('../abi/veloRouter.json');
        const router = new ethers.Contract(veloRouterAddress, abi);

        await contract.connect(owner).listSoToken(WETH.address, soWETH.address);
        await WETH.connect(owner).approve(contract.address, ethers.utils.parseEther('1').toString());
        await WETH.connect(owner).approve(soWETH.address, ethers.utils.parseEther('1').toString());
        await contract.connect(owner).openPosition(ethers.utils.parseEther('1').toString(), 5, ethers.BigNumber.from('749990000000000000'), WETH.address);

        await WETH.connect(owner).approve(router.address, ethers.utils.parseEther('1').toString());
        const routes = [{ 
                  from: WETH.address,
                  to: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
                  stable: false
                },
                { 
                  from: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
                  to: SONNEaddress,
                  stable: false
                }]
        res = await router.connect(owner).swapExactTokensForTokens(ethers.utils.parseEther('1').toString(), 0, routes, owner.address, Math.floor(Date.now() / 1000) + 60, { gasLimit: ethers.BigNumber.from('20000000') } );

        const WETHabi = require('../abi/wETHabi.json');
        const SONNE = new ethers.Contract(SONNEaddress, WETHabi)
        var balance = await SONNE.connect(owner).balanceOf(owner.address);
        await SONNE.connect(owner).transfer(contract.address, balance);
        balance = await SONNE.connect(owner).balanceOf(contract.address);
        // console.log(balance);
        // console.log(await soWETH.connect(owner).callStatic.borrowBalanceCurrent(contract.address));

        await expect(await contract.connect(owner).claimAndReinvest(
              soWETH.address,
              5,
              ethers.BigNumber.from('749990000000000000'),
              false, 
              false,
              0,
              [
                { 
                  from: SONNEaddress,
                  to: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
                  stable: false
                }, 
                { 
                  from: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
                  to: WETH.address,
                  stable: false
                }
              ],
              Math.floor(Date.now() / 1000) + 60
          )).not.to.be.reverted;
      });

      it("close the position", async function () {
        const { contract, WETH, soWETH, owner, otherAccount } = await loadFixture(deployManagerFixture);

        await contract.connect(owner).listSoToken(WETH.address, soWETH.address);
        await WETH.connect(owner).approve(contract.address, ethers.utils.parseEther('1').toString());
        await contract.connect(owner).openPosition(ethers.utils.parseEther('1').toString(), 5, ethers.BigNumber.from('749990000000000000'), WETH.address);
        // console.log(await soWETH.connect(owner).callStatic.borrowBalanceCurrent(contract.address));

        await expect(await contract.connect(owner).closePosition(WETH.address, ethers.BigNumber.from('750000000000000000'), { gasLimit: ethers.BigNumber.from('20000000') } )).not.to.be.reverted;
      });

      it("withdraw", async function () {
        const { contract, WETH, soWETH, owner, otherAccount } = await loadFixture(deployManagerFixture);

        await contract.connect(owner).listSoToken(WETH.address, soWETH.address);
        await WETH.connect(owner).approve(contract.address, ethers.utils.parseEther('1').toString());
        await contract.connect(owner).openPosition(ethers.utils.parseEther('1').toString(), 5, ethers.BigNumber.from('749990000000000000'), WETH.address);
        // console.log(await soWETH.connect(owner).callStatic.borrowBalanceCurrent(contract.address));
        await contract.connect(owner).closePosition(WETH.address, ethers.BigNumber.from('750000000000000000'), { gasLimit: ethers.BigNumber.from('20000000') } )

        await expect(await contract.connect(owner).returnERC20(WETH.address)).not.to.be.reverted;
      });
    });
  });
});
