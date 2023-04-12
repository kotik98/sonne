//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './Icomptroller.sol';
import './IsoToken.sol';
import './IveloRouter.sol';
import './Iunitroller.sol';

contract sonnePositionManager is Ownable {
  address SONNEaddress;
  address comptroller;
  address veloRouter;
  address unitroller;

  constructor(
    address comptrollerAddress,
    address veloRouterAddress,
    address unitrollerAddress,
    address SONNE
  ) {
    comptroller = comptrollerAddress;
    veloRouter = veloRouterAddress;
    unitroller = unitrollerAddress;
    SONNEaddress = SONNE;
  }

  function updateAddresses(address comptrollerAddress, address veloRouterAddress, address unitrollerAddress, address SONNE) external onlyOwner {
    comptroller = comptrollerAddress;
    veloRouter = veloRouterAddress;
    unitroller = unitrollerAddress;
    SONNEaddress = SONNE;
  }

  function listSoToken(address erc20address, address soTokenAddress) external onlyOwner {
    IERC20(erc20address).approve(soTokenAddress, 2**256 - 1);
    address[] memory cTokens = new address[](1);
    cTokens[0] = soTokenAddress; 
    Icomptroller(comptroller).enterMarkets(cTokens);
  }

  function openPosition(uint initialAmount, uint8 leverage, uint collateralFactorNumeratorXe18, address erc20address, address soTokenAddress) external onlyOwner {
    IERC20(erc20address).transferFrom(msg.sender, address(this), initialAmount);
    _supplyAndBorrow(initialAmount, leverage, collateralFactorNumeratorXe18, soTokenAddress);
  }

  function _supplyAndBorrow(uint collateralAmount, uint leverage, uint collateralFactorNumeratorXe18, address soTokenAddress) internal {
    IsoToken _soToken = IsoToken(soTokenAddress);
    uint nextCollateralAmount = collateralAmount;
    for(uint8 i = 0; i < leverage; i++) {
      _soToken.mint(nextCollateralAmount);
      uint borrowAmount = nextCollateralAmount * collateralFactorNumeratorXe18 / 1e18;
      _soToken.borrow(borrowAmount);
      nextCollateralAmount = borrowAmount;
    }

    _soToken.mint(nextCollateralAmount);
  }

  function closePosition(address soTokenAddress, uint collateralFactorNumeratorXe18) external onlyOwner {
    IsoToken _soToken = IsoToken(soTokenAddress);
    uint err;
    uint supply;
    uint borrowBalance;
    uint mantissa;
    (err, supply, borrowBalance, mantissa) = _soToken.getAccountSnapshot(address(this));
    require(err == 0, 'error in getting account snapshot');
    uint supplyBalance = mantissa * supply / 1e18;
    uint redeemAmount;
    uint repayAmount;

    while (borrowBalance > 0){
      redeemAmount = supplyBalance * collateralFactorNumeratorXe18 / 1e18 - borrowBalance;
      _soToken.redeemUnderlying(redeemAmount);
      repayAmount = redeemAmount > borrowBalance ? borrowBalance : redeemAmount;
      _soToken.repayBorrow(repayAmount);
      (err, supply, borrowBalance, mantissa) = _soToken.getAccountSnapshot(address(this));
      require(err == 0, 'error in getting account snapshot');
      supplyBalance = mantissa * supply / 1e18;
    }

    uint balanceSoToken = _soToken.balanceOf(address(this));
    _soToken.redeemUnderlying(balanceSoToken);
  }

  function returnERC20(address tokenAddress) external onlyOwner {
    IERC20 _token = IERC20(tokenAddress);
    _token.transfer(msg.sender, _token.balanceOf(address(this)));
  }

  function claimAndReinvest(address soTokenAddress, uint8 leverage, uint collateralFactorNumeratorXe18, bool isSimpleSwap, bool isStable, uint amountOutMin, IveloRouter.route[] memory routes, uint deadline) external onlyOwner {
    CToken[] memory cTokens = new CToken[](1);
    cTokens[0] = CToken(soTokenAddress); 
    Iunitroller(unitroller).claimComp(address(this), cTokens);
    uint sonneBalance = IERC20(SONNEaddress).balanceOf(address(this));
    IERC20(SONNEaddress).approve(address(veloRouter), sonneBalance);
    uint[] memory amounts;

    if (isSimpleSwap == true) {
      amounts = IveloRouter(veloRouter).swapExactTokensForTokensSimple(sonneBalance, amountOutMin, SONNEaddress, IsoToken(soTokenAddress).underlying(), isStable, address(this), deadline);
    } else {
      amounts = IveloRouter(veloRouter).swapExactTokensForTokens(sonneBalance, amountOutMin, routes, address(this), deadline);
    }

    _supplyAndBorrow(amounts[amounts.length - 1], leverage, collateralFactorNumeratorXe18, soTokenAddress);
  }
}