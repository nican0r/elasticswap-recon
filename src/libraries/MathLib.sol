//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "../contracts/Exchange.sol";

/**
 * @title MathLib
 * @author ElasticDAO
 */
library MathLib {
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant WAD = 10**18; // represent a decimal with 18 digits of precision

    /**
     * @dev divides two float values, required since solidity does not handle
     * floating point values.
     *
     * inspiration: https://github.com/dapphub/ds-math/blob/master/src/math.sol
     *
     * NOTE: this rounds to the nearest integer (up or down). For example .666666 would end up
     * rounding to .66667.
     *
     * @return uint256 wad value (decimal with 18 digits of precision)
     */
    function wDiv(uint256 a, uint256 b) public pure returns (uint256) {
        return ((a * WAD) + (b / 2)) / b;
    }

    /**
     * @dev rounds a integer (a) to the nearest n places.
     * IE roundToNearest(123, 10) would round to the nearest 10th place (120).
     */
    function roundToNearest(uint256 a, uint256 n)
        public
        pure
        returns (uint256)
    {
        return ((a + (n / 2)) / n) * n;
    }

    /**
     * @dev multiplies two float values, required since solidity does not handle
     * floating point values
     *
     * inspiration: https://github.com/dapphub/ds-math/blob/master/src/math.sol
     *
     * @return uint256 wad value (decimal with 18 digits of precision)
     */
    function wMul(uint256 a, uint256 b) public pure returns (uint256) {
        return ((a * b) + (WAD / 2)) / WAD;
    }

    /**
     * @dev calculates an absolute diff between two integers. Basically the solidity
     * equivalent of Math.abs(a-b);
     */
    function diff(uint256 a, uint256 b) public pure returns (uint256) {
        if (a >= b) {
            return a - b;
        }
        return b - a;
    }

    /**
     * @dev defines the amount of decay needed in order for us to require a user to handle the
     * decay prior to a double asset entry as the equivalent of 1 unit of base token
     */
    function isSufficientDecayPresent(
        uint256 _quoteTokenReserveQty,
        Exchange.InternalBalances memory _internalBalances
    ) public pure returns (bool) {
        return (wDiv(
            diff(
                _quoteTokenReserveQty,
                _internalBalances.quoteTokenReserveQty
            ) * WAD,
            wDiv(
                _internalBalances.quoteTokenReserveQty,
                _internalBalances.baseTokenReserveQty
            )
        ) >= WAD); // the amount of quote token (a) decay is greater than 1 unit of base token (token b)
    }

    /**
     * @dev used to calculate the qty of token a liquidity provider
     * must add in order to maintain the current reserve ratios
     * @param _tokenAQty quote or base token qty to be supplied by the liquidity provider
     * @param _tokenAReserveQty current reserve qty of the quote or base token (same token as tokenA)
     * @param _tokenBReserveQty current reserve qty of the other quote or base token (not tokenA)
     */
    function calculateQty(
        uint256 _tokenAQty,
        uint256 _tokenAReserveQty,
        uint256 _tokenBReserveQty
    ) public pure returns (uint256 tokenBQty) {
        require(_tokenAQty > 0, "MathLib: INSUFFICIENT_QTY");
        require(
            _tokenAReserveQty > 0 && _tokenBReserveQty > 0,
            "MathLib: INSUFFICIENT_LIQUIDITY"
        );
        tokenBQty = (_tokenAQty * _tokenBReserveQty) / _tokenAReserveQty;
    }

    /**
     * @dev used to calculate the qty of token a trader will receive (less fees)
     * given the qty of token A they are providing
     * @param _tokenASwapQty quote or base token qty to be swapped by the trader
     * @param _tokenAReserveQty current reserve qty of the quote or base token (same token as tokenA)
     * @param _tokenBReserveQty current reserve qty of the other quote or base token (not tokenA)
     * @param _liquidityFeeInBasisPoints fee to liquidity providers represented in basis points
     */
    function calculateQtyToReturnAfterFees(
        uint256 _tokenASwapQty,
        uint256 _tokenAReserveQty,
        uint256 _tokenBReserveQty,
        uint256 _liquidityFeeInBasisPoints
    ) public pure returns (uint256 qtyToReturn) {
        uint256 tokenASwapQtyLessFee =
            _tokenASwapQty * (BASIS_POINTS - _liquidityFeeInBasisPoints);
        qtyToReturn =
            (tokenASwapQtyLessFee * _tokenBReserveQty) /
            ((_tokenAReserveQty * BASIS_POINTS) + tokenASwapQtyLessFee);
    }

    /**
     * @dev used to calculate the qty of liquidity tokens (deltaRo) we will be issued to a supplier
     * of a single asset entry when decay is present.
     * @param _totalSupplyOfLiquidityTokens the total supply of our exchange's liquidity tokens (aka Ro)
     * @param _tokenQtyAToAdd the amount of tokens being added by the caller to remove the current decay
     * @param _internalTokenAReserveQty the internal balance (X or Y) of token A as a result of this transaction
     * @param _tokenBDecayChange the change that will occur in the decay in the opposite token as a result of
     * this transaction
     * @param _tokenBDecay the amount of decay in tokenB
     *
     * @return liquidityTokenQty qty of liquidity tokens to be issued in exchange
     */
    function calculateLiquidityTokenQtyForSingleAssetEntry(
        uint256 _totalSupplyOfLiquidityTokens,
        uint256 _tokenQtyAToAdd,
        uint256 _internalTokenAReserveQty,
        uint256 _tokenBDecayChange,
        uint256 _tokenBDecay
    ) public pure returns (uint256 liquidityTokenQty) {
        // gamma = deltaY / Y' / 2 * (deltaX / alphaDecay')
        uint256 wGamma =
            wDiv(
                (
                    wMul(
                        wDiv(_tokenQtyAToAdd, _internalTokenAReserveQty),
                        _tokenBDecayChange * WAD
                    )
                ),
                _tokenBDecay
            ) /
                WAD /
                2;

        liquidityTokenQty =
            wDiv(
                wMul(_totalSupplyOfLiquidityTokens * WAD, wGamma),
                WAD - wGamma
            ) /
            WAD;
    }

    /**
     * @dev used to calculate the qty of liquidity tokens (deltaRo) we will be issued to a supplier
     * of a single asset entry when decay is present.
     * @param _totalSupplyOfLiquidityTokens the total supply of our exchange's liquidity tokens (aka Ro)
     * @param _baseTokenQty the amount of base token the user it adding to the pool (deltaB or deltaY)
     * @param _baseTokenReserveBalance the total balance (external) of base tokens in our pool (Beta)
     *
     * @return liquidityTokenQty qty of liquidity tokens to be issued in exchange
     */
    function calculateLiquidityTokenQtyForDoubleAssetEntry(
        uint256 _totalSupplyOfLiquidityTokens,
        uint256 _baseTokenQty,
        uint256 _baseTokenReserveBalance
    ) public pure returns (uint256 liquidityTokenQty) {
        liquidityTokenQty =
            (_baseTokenQty * _totalSupplyOfLiquidityTokens) /
            _baseTokenReserveBalance;
    }

    /**
     * @dev used to calculate the qty of base token required and liquidity tokens (deltaRo) to be issued
     * in order to add liquidity and remove quote token decay.
     * @param _baseTokenQtyDesired the amount of base token the user wants to contribute
     * @param _baseTokenQtyMin the minimum amount of base token the user wants to contribute (allows for slippage)
     * @param _quoteTokenReserveQty the external quote token reserve qty prior to this transaction
     * @param _totalSupplyOfLiquidityTokens the total supply of our exchange's liquidity tokens (aka Ro)
     * @param _internalBalances internal balances struct from our exchange's internal accounting
     *
     *
     * @return baseTokenQty qty of base token the user must supply
     * @return liquidityTokenQty qty of liquidity tokens to be issued in exchange
     */
    function calculateAddBaseTokenLiquidityQuantities(
        uint256 _baseTokenQtyDesired,
        uint256 _baseTokenQtyMin,
        uint256 _quoteTokenReserveQty,
        uint256 _totalSupplyOfLiquidityTokens,
        Exchange.InternalBalances storage _internalBalances
    ) public returns (uint256 baseTokenQty, uint256 liquidityTokenQty) {
        uint256 quoteTokenDecay =
            _quoteTokenReserveQty - _internalBalances.quoteTokenReserveQty;

        // determine max amount of base token that can be added to offset the current decay
        uint256 wInternalQuoteTokenToBaseTokenRatio =
            wDiv(
                _internalBalances.quoteTokenReserveQty,
                _internalBalances.baseTokenReserveQty
            );

        // alphaDecay / omega (A/B)
        uint256 maxBaseTokenQty =
            wDiv(quoteTokenDecay, wInternalQuoteTokenToBaseTokenRatio);

        require(
            _baseTokenQtyMin < maxBaseTokenQty,
            "Exchange: INSUFFICIENT_DECAY"
        );

        if (_baseTokenQtyDesired > maxBaseTokenQty) {
            baseTokenQty = maxBaseTokenQty;
        } else {
            baseTokenQty = _baseTokenQtyDesired;
        }

        uint256 quoteTokenQtyDecayChange =
            roundToNearest(
                (baseTokenQty * wInternalQuoteTokenToBaseTokenRatio),
                WAD
            ) / WAD;

        require(
            quoteTokenQtyDecayChange > 0,
            "Exchange: INSUFFICIENT_CHANGE_IN_DECAY"
        );
        //x += alphaDecayChange
        //y += deltaBeta
        _internalBalances.quoteTokenReserveQty += quoteTokenQtyDecayChange;
        _internalBalances.baseTokenReserveQty += baseTokenQty;

        // calculate the number of liquidity tokens to return to user using
        liquidityTokenQty = calculateLiquidityTokenQtyForSingleAssetEntry(
            _totalSupplyOfLiquidityTokens,
            baseTokenQty,
            _internalBalances.baseTokenReserveQty,
            quoteTokenQtyDecayChange,
            quoteTokenDecay
        );
        return (baseTokenQty, liquidityTokenQty);
    }

    /**
     * @dev used to calculate the qty of quote tokens required and liquidity tokens (deltaRo) to be issued
     * in order to add liquidity and remove quote token decay.
     * @param _quoteTokenQtyDesired the amount of quote token the user wants to contribute
     * @param _quoteTokenQtyMin the minimum amount of quote token the user wants to contribute (allows for slippage)
     * @param _quoteTokenReserveQty the external quote token reserve qty prior to this transaction
     * @param _totalSupplyOfLiquidityTokens the total supply of our exchange's liquidity tokens (aka Ro)
     * @param _internalBalances internal balances struct from our exchange's internal accounting
     *
     * @return quoteTokenQty qty of quote token the user must supply
     * @return liquidityTokenQty qty of liquidity tokens to be issued in exchange
     */
    function calculateAddQuoteTokenLiquidityQuantities(
        uint256 _quoteTokenQtyDesired,
        uint256 _quoteTokenQtyMin,
        uint256 _quoteTokenReserveQty,
        uint256 _totalSupplyOfLiquidityTokens,
        Exchange.InternalBalances memory _internalBalances
    ) public pure returns (uint256 quoteTokenQty, uint256 liquidityTokenQty) {
        uint256 maxQuoteTokenQty =
            _internalBalances.quoteTokenReserveQty - _quoteTokenReserveQty;
        require(
            _quoteTokenQtyMin < maxQuoteTokenQty,
            "Exchange: INSUFFICIENT_DECAY"
        );

        if (_quoteTokenQtyDesired > maxQuoteTokenQty) {
            quoteTokenQty = maxQuoteTokenQty;
        } else {
            quoteTokenQty = _quoteTokenQtyDesired;
        }

        // determine the base token qty decay change based on our current ratios
        uint256 wInternalBaseToQuoteTokenRatio =
            wDiv(
                _internalBalances.baseTokenReserveQty,
                _internalBalances.quoteTokenReserveQty
            );

        // NOTE we need this function to use the same
        // rounding scheme as wDiv in order to avoid a case
        // in which a user is trying to resolve decay in which
        // baseTokenQtyDecayChange ends up being 0 and we are stuck in
        // a bad state.
        uint256 baseTokenQtyDecayChange =
            roundToNearest(
                (quoteTokenQty * wInternalBaseToQuoteTokenRatio),
                MathLib.WAD
            ) / WAD;

        require(
            baseTokenQtyDecayChange > 0,
            "Exchange: INSUFFICIENT_CHANGE_IN_DECAY"
        );

        // we can now calculate the total amount of base token decay
        uint256 baseTokenDecay =
            (maxQuoteTokenQty * wInternalBaseToQuoteTokenRatio) / WAD;

        // this may be redundant based on the above math, but will check to ensure the decay wasn't so small
        // that it was <1 and rounded down to 0 saving the caller some gas
        // also could fix a potential revert due to div by zero.
        require(baseTokenDecay > 0, "Exchange: NO_BASE_DECAY");

        // we are not changing anything about our internal accounting here. We are simply adding tokens
        // to make our internal account "right"...or rather getting the external balances to match our internal
        // baseTokenReserveQty += baseTokenQtyDecayChange;
        // quoteTokenReserveQty += quoteTokenQty;

        // calculate the number of liquidity tokens to return to user using:
        liquidityTokenQty = calculateLiquidityTokenQtyForSingleAssetEntry(
            _totalSupplyOfLiquidityTokens,
            quoteTokenQty,
            _internalBalances.quoteTokenReserveQty,
            baseTokenQtyDecayChange,
            baseTokenDecay
        );
        return (quoteTokenQty, liquidityTokenQty);
    }

    function calculateAddLiquidityQuantities(
        uint256 _quoteTokenQtyDesired,
        uint256 _baseTokenQtyDesired,
        uint256 _quoteTokenQtyMin,
        uint256 _baseTokenQtyMin,
        uint256 _quoteTokenReserveQty,
        uint256 _baseTokenReserveQty,
        uint256 _totalSupplyOfLiquidityTokens,
        Exchange.InternalBalances storage _internalBalances
    )
        public
        returns (
            uint256 quoteTokenQty,
            uint256 baseTokenQty,
            uint256 liquidityTokenQty
        )
    {
        if (_totalSupplyOfLiquidityTokens > 0) {
            // we have outstanding liquidity tokens present and an existing price curve

            // confirm that we have no beta or alpha decay present
            // if we do, we need to resolve that first
            if (
                isSufficientDecayPresent(
                    _quoteTokenReserveQty,
                    _internalBalances
                )
            ) {
                // decay is present and needs to be dealt with by the caller.

                uint256 quoteTokenQtyFromDecay;
                uint256 baseTokenQtyFromDecay;
                uint256 liquidityTokenQtyFromDecay;

                if (
                    _quoteTokenReserveQty >
                    _internalBalances.quoteTokenReserveQty
                ) {
                    // we have more quote token than expected (quote token decay) due to rebase up
                    // we first need to handle this situation by requiring this user
                    // to add base tokens
                    (
                        baseTokenQtyFromDecay,
                        liquidityTokenQtyFromDecay
                    ) = calculateAddBaseTokenLiquidityQuantities(
                        _baseTokenQtyDesired,
                        0, // there is no minimum for this particular call since we may use base tokens later.
                        _quoteTokenReserveQty,
                        _totalSupplyOfLiquidityTokens,
                        _internalBalances
                    );
                } else {
                    // we have less quote token than expected (base token decay) due to a rebase down
                    // we first need to handle this by adding quote tokens to offset this.
                    (
                        quoteTokenQtyFromDecay,
                        liquidityTokenQtyFromDecay
                    ) = calculateAddQuoteTokenLiquidityQuantities(
                        _quoteTokenQtyDesired,
                        0, // there is no minimum for this particular call since we may use quote tokens later.
                        _quoteTokenReserveQty,
                        _totalSupplyOfLiquidityTokens,
                        _internalBalances
                    );
                }

                if (
                    baseTokenQtyFromDecay < _baseTokenQtyDesired &&
                    quoteTokenQtyFromDecay < _quoteTokenQtyDesired
                ) {
                    // the user still has qty that they desire to contribute to the exchange for liquidity
                    (
                        quoteTokenQty,
                        baseTokenQty,
                        liquidityTokenQty
                    ) = calculateAddTokenPairLiquidityQuantities(
                        _quoteTokenQtyDesired - quoteTokenQtyFromDecay, // safe from underflow based on above IF
                        _baseTokenQtyDesired - baseTokenQtyFromDecay, // safe from underflow based on above IF
                        0, // we will check minimums below
                        0, // we will check minimums below
                        _baseTokenReserveQty + baseTokenQtyFromDecay,
                        _totalSupplyOfLiquidityTokens +
                            liquidityTokenQtyFromDecay,
                        _internalBalances, // NOTE: these balances have already been updated when we did the decay math.
                        false
                    );
                }
                quoteTokenQty += quoteTokenQtyFromDecay;
                baseTokenQty += baseTokenQtyFromDecay;
                liquidityTokenQty += liquidityTokenQtyFromDecay;

                require(
                    quoteTokenQty >= _quoteTokenQtyMin,
                    "Exchange: INSUFFICIENT_QUOTE_QTY"
                );

                require(
                    baseTokenQty >= _baseTokenQtyMin,
                    "Exchange: INSUFFICIENT_BASE_QTY"
                );
            } else {
                // the user is just doing a simple double asset entry / providing both quote and base.
                (
                    quoteTokenQty,
                    baseTokenQty,
                    liquidityTokenQty
                ) = calculateAddTokenPairLiquidityQuantities(
                    _quoteTokenQtyDesired,
                    _baseTokenQtyDesired,
                    _quoteTokenQtyMin,
                    _baseTokenQtyMin,
                    _baseTokenReserveQty,
                    _totalSupplyOfLiquidityTokens,
                    _internalBalances,
                    true
                );
            }
        } else {
            // this user will set the initial pricing curve
            quoteTokenQty = _quoteTokenQtyDesired;
            baseTokenQty = _baseTokenQtyDesired;
            liquidityTokenQty = _baseTokenQtyDesired;
            _internalBalances.quoteTokenReserveQty += quoteTokenQty;
            _internalBalances.baseTokenReserveQty += baseTokenQty;
        }
    }

    /**
     * @dev calculates the qty of quote and base tokens required and liquidity tokens (deltaRo) to be issued
     * in order to add liquidity when no decay is present.
     * @param _quoteTokenQtyDesired the amount of quote token the user wants to contribute
     * @param _baseTokenQtyDesired the amount of base token the user wants to contribute
     * @param _quoteTokenQtyMin the minimum amount of quote token the user wants to contribute (allows for slippage)
     * @param _baseTokenQtyMin the minimum amount of base token the user wants to contribute (allows for slippage)
     * @param _baseTokenReserveQty the external base token reserve qty prior to this transaction
     * @param _totalSupplyOfLiquidityTokens the total supply of our exchange's liquidity tokens (aka Ro)
     * @param _internalBalances internal balances struct from our exchange's internal accounting
     * @param _throwOnBadRatio should the function assert if the ratio of _quoteTokenQtyDesired/_baseTokenQtyDesired
     * cannot be honored. Otherwise will return 0s for all balances
     *
     * @return quoteTokenQty qty of quote token the user must supply
     * @return baseTokenQty qty of base token the user must supply
     * @return liquidityTokenQty qty of liquidity tokens to be issued in exchange
     */
    function calculateAddTokenPairLiquidityQuantities(
        uint256 _quoteTokenQtyDesired,
        uint256 _baseTokenQtyDesired,
        uint256 _quoteTokenQtyMin,
        uint256 _baseTokenQtyMin,
        uint256 _baseTokenReserveQty,
        uint256 _totalSupplyOfLiquidityTokens,
        Exchange.InternalBalances storage _internalBalances,
        bool _throwOnBadRatio
    )
        public
        returns (
            uint256 quoteTokenQty,
            uint256 baseTokenQty,
            uint256 liquidityTokenQty
        )
    {
        uint256 requiredBaseTokenQty =
            calculateQty(
                _quoteTokenQtyDesired,
                _internalBalances.quoteTokenReserveQty,
                _internalBalances.baseTokenReserveQty
            );

        if (requiredBaseTokenQty <= _baseTokenQtyDesired) {
            // user has to provide less than their desired amount
            require(
                requiredBaseTokenQty >= _baseTokenQtyMin,
                "Exchange: INSUFFICIENT_BASE_QTY"
            );
            quoteTokenQty = _quoteTokenQtyDesired;
            baseTokenQty = requiredBaseTokenQty;
        } else {
            // we need to check the opposite way.
            uint256 requiredQuoteTokenQty =
                calculateQty(
                    _baseTokenQtyDesired,
                    _internalBalances.baseTokenReserveQty,
                    _internalBalances.quoteTokenReserveQty
                );
            // assert(requiredQuoteTokenQty <= _quoteTokenQtyDesired);
            if (requiredQuoteTokenQty > _quoteTokenQtyDesired) {
                if (_throwOnBadRatio) {
                    assert(false); //should this really be an assert vs require?
                } else {
                    return (0, 0, 0);
                }
            }

            require(
                requiredQuoteTokenQty >= _quoteTokenQtyMin,
                "Exchange: INSUFFICIENT_QUOTE_QTY"
            );
            quoteTokenQty = requiredQuoteTokenQty;
            baseTokenQty = _baseTokenQtyDesired;
        }

        liquidityTokenQty = calculateLiquidityTokenQtyForDoubleAssetEntry(
            _totalSupplyOfLiquidityTokens,
            baseTokenQty,
            _baseTokenReserveQty
        );

        _internalBalances.quoteTokenReserveQty += quoteTokenQty;
        _internalBalances.baseTokenReserveQty += baseTokenQty;
    }

    function calculateQuoteTokenQty(
        uint256 _baseTokenQty,
        uint256 _minQuoteTokenQty,
        uint256 _quoteTokenReserveQty,
        uint256 _liquidityFeeInBasisPoints,
        Exchange.InternalBalances storage _internalBalances
    ) public returns (uint256 quoteTokenQty) {
        require(
            _baseTokenQty > 0 && _minQuoteTokenQty > 0,
            "Exchange: INSUFFICIENT_TOKEN_QTY"
        );

        require(
            _quoteTokenReserveQty > 0 &&
                _internalBalances.quoteTokenReserveQty > 0,
            "Exchange: INSUFFICIENT_QUOTE_TOKEN_QTY"
        );

        // check to see if we have experience base token decay / a rebase down event
        if (_quoteTokenReserveQty < _internalBalances.quoteTokenReserveQty) {
            // we have less reserves than our current price curve will expect, we need to adjust the curve
            uint256 wPricingRatio =
                wDiv(
                    _internalBalances.quoteTokenReserveQty,
                    _internalBalances.baseTokenReserveQty
                ); // omega

            uint256 impliedBaseTokenQty =
                wDiv(_quoteTokenReserveQty, wPricingRatio); // no need to divide by WAD, wPricingRatio is already a WAD.

            quoteTokenQty = calculateQtyToReturnAfterFees(
                _baseTokenQty,
                impliedBaseTokenQty,
                _quoteTokenReserveQty, // use the actual balance here since we adjusted the base token to match ratio!
                _liquidityFeeInBasisPoints
            );
        } else {
            // we have the same or more reserves, no need to alter the curve.
            quoteTokenQty = calculateQtyToReturnAfterFees(
                _baseTokenQty,
                _internalBalances.baseTokenReserveQty,
                _internalBalances.quoteTokenReserveQty,
                _liquidityFeeInBasisPoints
            );
        }

        require(
            quoteTokenQty > _minQuoteTokenQty,
            "Exchange: INSUFFICIENT_QUOTE_TOKEN_QTY"
        );

        _internalBalances.quoteTokenReserveQty -= quoteTokenQty;
        _internalBalances.baseTokenReserveQty += _baseTokenQty;
    }

    function calculateBaseTokenQty(
        uint256 _quoteTokenQty,
        uint256 _minBaseTokenQty,
        uint256 _liquidityFeeInBasisPoints,
        Exchange.InternalBalances storage _internalBalances
    ) public returns (uint256 baseTokenQty) {
        require(
            _quoteTokenQty > 0 && _minBaseTokenQty > 0,
            "Exchange: INSUFFICIENT_TOKEN_QTY"
        );

        baseTokenQty = calculateQtyToReturnAfterFees(
            _quoteTokenQty,
            _internalBalances.quoteTokenReserveQty,
            _internalBalances.baseTokenReserveQty,
            _liquidityFeeInBasisPoints
        );

        require(
            baseTokenQty > _minBaseTokenQty,
            "Exchange: INSUFFICIENT_BASE_TOKEN_QTY"
        );

        _internalBalances.quoteTokenReserveQty += _quoteTokenQty;
        _internalBalances.baseTokenReserveQty -= baseTokenQty;
    }
}
