//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './Icomptroller.sol';
import './IsoToken.sol';
import './IveloRouter.sol';
import './Iunitroller.sol';

contract sonnePositionManager is Ownable {
  mapping (address=>address) erc20toSoToken;
  mapping (address=>IERC20) token;
  mapping (address=>IsoToken) soToken;
  address SONNEaddress;
  Icomptroller comptroller;
  IveloRouter veloRouter;
  Iunitroller unitroller;

  constructor(
    address comptrollerAddress,
    address veloRouterAddress,
    address unitrollerAddress,
    address SONNE
  ) {
    comptroller = Icomptroller(comptrollerAddress);
    veloRouter = IveloRouter(veloRouterAddress);
    unitroller = Iunitroller(unitrollerAddress);
    SONNEaddress = SONNE;
  }

  function listSoToken(address erc20Address, address soTokenAddress) external onlyOwner {
    erc20toSoToken[erc20Address] = soTokenAddress;
    token[erc20Address] = IERC20(erc20Address);
    token[erc20Address].approve(erc20toSoToken[erc20Address], 2**256 - 1);
    soToken[soTokenAddress] = IsoToken(soTokenAddress);
    address[] memory cTokens = new address[](1);
    cTokens[0] = soTokenAddress; 
    comptroller.enterMarkets(cTokens);
  }

  function openPosition(uint initialAmount, uint8 leverage, uint collateralFactorNumeratorXe18, address erc20address) external onlyOwner {
    require(address(token[erc20address]) != address(0), 'token not listed');
    IERC20 _token = token[erc20address];
    address soTokenAddress = erc20toSoToken[erc20address];
    // get tokens from sender
    _token.transferFrom(msg.sender, address(this), initialAmount);

    _supplyAndBorrow(initialAmount, leverage, collateralFactorNumeratorXe18, soTokenAddress);
  }

  function _supplyAndBorrow(uint collateralAmount, uint leverage, uint collateralFactorNumeratorXe18, address soTokenAddress) internal {
    IsoToken _soToken = soToken[soTokenAddress];
    uint nextCollateralAmount = collateralAmount;
    for(uint8 i = 0; i < leverage; i++) {
      _soToken.mint(nextCollateralAmount);
      uint borrowAmount = nextCollateralAmount * collateralFactorNumeratorXe18 / 1e18;
      _soToken.borrow(borrowAmount);
      nextCollateralAmount = borrowAmount;
    }

    _soToken.mint(nextCollateralAmount);
  }

  function closePosition(address erc20address, uint collateralFactorNumeratorXe18) external onlyOwner {
    address soTokenAddress = erc20toSoToken[erc20address];
    IsoToken _soToken = soToken[soTokenAddress];

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
    IsoToken _soToken = soToken[soTokenAddress];
    CToken[] memory cTokens = new CToken[](1);
    cTokens[0] = CToken(soTokenAddress); 
    unitroller.claimComp(address(this), cTokens);
    uint sonneBalance = IERC20(SONNEaddress).balanceOf(address(this));
    IERC20(SONNEaddress).approve(address(veloRouter), sonneBalance);
    uint[] memory amounts;
    if (isSimpleSwap == true) {
      amounts = veloRouter.swapExactTokensForTokensSimple(sonneBalance, amountOutMin, SONNEaddress, _soToken.underlying(), isStable, address(this), deadline);
    } else {
      amounts = veloRouter.swapExactTokensForTokens(sonneBalance, amountOutMin, routes, address(this), deadline);
    }

    _supplyAndBorrow(amounts[amounts.length - 1], leverage, collateralFactorNumeratorXe18, soTokenAddress);
  }
}