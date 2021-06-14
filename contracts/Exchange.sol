//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Exchange contract for Elastic Swap representing a single ERC20 pair of tokens to be swapped.
 * @author Elastic DAO
 * @notice This contract provides all of the needed functionality for a liquidity provider to supply/withdraw ERC20
 * tokens and traders to swap tokens for one another.
 */
contract Exchange is ERC20, Ownable {
    using SafeERC20 for IERC20;

    address public immutable quoteToken; // address of ERC20 quote token (elastic or fixed supply)
    address public immutable baseToken; // address of ERC20 base token (WETH or a stable coin w/ fixed supply)

    uint16 public elasticDAOFee; // ElasticDAO development fund fee in basis points
    uint16 public constant liquidityFee = 30; // fee provided to liquidity providers in basis points
    uint16 public constant basisPoints = 10000;

    uint256 public pricingConstantK; // invariant "k" set by initial liquidity provider

    modifier notExpired(uint256 _expirationTimeStamp) {
        require(_expirationTimeStamp >= block.timestamp, "Exchange: EXPIRED");
        _;
    }

    /**
     * @notice called by the exchange factory to create a new erc20 token swap pair (do not call this directly!)
     * @param _name The human readable name of this pair (also used for the liquidity token name)
     * @param _symbol Shortened symbol for trading pair (also used for the liquidity token symbol)
     * @param _quoteToken address of the ERC20 quote token in the pair. This token can have a fixed or elastic supply
     * @param _baseToken address of the ERC20 base token in the pair. This token is assumed to have a fixed supply.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _quoteToken,
        address _baseToken
    ) ERC20(_name, _symbol) {
        quoteToken = _quoteToken;
        baseToken = _baseToken;
    }

    /**
     * @notice primary entry point for a liquidity provider to add new liquidity (quote and base tokens) to the exchange
     * and receive liquidity tokens in return.
     * Requires approvals to be granted to this exchange for both quote and base tokens.
     * @param _quoteTokenQtyDesired qty of quoteTokens that you would like to add to the exchange
     * @param _baseTokenQtyDesired qty of baseTokens that you would like to add to the exchange
     * @param _quoteTokenQtyMin minimum acceptable qty of quoteTokens that will be added (or transaction will revert)
     * @param _baseTokenQtyMin minimum acceptable qty of baseTokens that will be added (or transaction will revert)
     * @param _liquidityTokenRecipient address for the exchange to issue the resulting liquidity tokens from
     * this transaction to
     * @param _expirationTimestamp timestamp that this transaction must occur before (or transaction will revert)
     */
    function addLiquidity(
        uint256 _quoteTokenQtyDesired,
        uint256 _baseTokenQtyDesired,
        uint256 _quoteTokenQtyMin,
        uint256 _baseTokenQtyMin,
        address _liquidityTokenRecipient,
        uint256 _expirationTimestamp
    )
        external
        notExpired(_expirationTimestamp)
        returns (
            uint256 quoteTokenQty,
            uint256 baseTokenQty,
            uint256 liquidityTokenQty
        )
    {
        if (this.totalSupply() > 0) {
            // we have outstanding liquidity tokens present and an existing price curve
            uint256 quoteTokenReserveQty =
                IERC20(quoteToken).balanceOf(address(this));
            uint256 baseTokenReserveQty =
                IERC20(baseToken).balanceOf(address(this));
            uint256 requiredBaseTokenQty =
                _calculateQty(
                    _quoteTokenQtyDesired,
                    quoteTokenReserveQty,
                    baseTokenReserveQty
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
                    _calculateQty(
                        _baseTokenQtyDesired,
                        baseTokenReserveQty,
                        quoteTokenReserveQty
                    );
                assert(requiredQuoteTokenQty <= _quoteTokenQtyDesired);
                require(
                    _quoteTokenQtyDesired >= _quoteTokenQtyMin,
                    "Exchange: INSUFFICIENT_QUOTE_QTY"
                );
                quoteTokenQty = requiredQuoteTokenQty;
                baseTokenQty = _baseTokenQtyDesired;
            }

            liquidityTokenQty =
                (baseTokenQty * this.totalSupply()) /
                baseTokenReserveQty;
        } else {
            // this user will set the initial pricing curve
            pricingConstantK = _quoteTokenQtyDesired * _baseTokenQtyDesired; // x*y=k
            quoteTokenQty = _quoteTokenQtyDesired;
            baseTokenQty = _baseTokenQtyDesired;
            liquidityTokenQty = _baseTokenQtyDesired;
        }

        IERC20(quoteToken).safeTransferFrom(
            msg.sender,
            address(this),
            quoteTokenQty
        ); // transfer quote tokens to Exchange
        IERC20(baseToken).safeTransferFrom(
            msg.sender,
            address(this),
            baseTokenQty
        ); // transfer base tokens to Exchange
        _mint(_liquidityTokenRecipient, liquidityTokenQty); // mint liquidity tokens to recipient
    }

    /**
     * @notice called by a liquidity provider to redeem liquidity tokens from the exchange and receive back
     * quote and base tokens. Required approvals to be granted to this exchange for the liquidity token
     * @param _liquidityTokenQty qty of liquidity tokens that you would like to redeem
     * @param _quoteTokenQtyMin minimum acceptable qty of quote tokens to receive back (or transaction will revert)
     * @param _baseTokenQtyMin minimum acceptable qty of base tokens to receive back (or transaction will revert)
     * @param _tokenRecipient address for the exchange to issue the resulting quote and
     * base tokens from this transaction to
     * @param _expirationTimestamp timestamp that this transaction must occur before (or transaction will revert)
     */
    function removeLiquidity(
        uint256 _liquidityTokenQty,
        uint256 _quoteTokenQtyMin,
        uint256 _baseTokenQtyMin,
        address _tokenRecipient,
        uint256 _expirationTimestamp
    )
        external
        notExpired(_expirationTimestamp)
        returns (uint256 quoteTokenQtyToReturn, uint256 baseTokenQtyToReturn)
    {
        require(this.totalSupply() > 0, "Exchange: INSUFFICIENT_LIQUIDITY");
        require(
            _quoteTokenQtyMin > 0 && _baseTokenQtyMin > 0,
            "Exchange: MINS_MUST_BE_GREATER_THAN_ZERO"
        );

        uint256 quoteTokenReserveQty =
            IERC20(quoteToken).balanceOf(address(this));
        uint256 baseTokenReserveQty =
            IERC20(baseToken).balanceOf(address(this));

        quoteTokenQtyToReturn =
            (_liquidityTokenQty * quoteTokenReserveQty) /
            this.totalSupply();
        baseTokenQtyToReturn =
            (_liquidityTokenQty * baseTokenReserveQty) /
            this.totalSupply();

        require(
            quoteTokenQtyToReturn >= _quoteTokenQtyMin,
            "Exchange: INSUFFICIENT_QUOTE_QTY"
        );

        require(
            baseTokenQtyToReturn >= _baseTokenQtyMin,
            "Exchange: INSUFFICIENT_BASE_QTY"
        );

        _burn(msg.sender, _liquidityTokenQty);

        IERC20(quoteToken).safeTransfer(_tokenRecipient, quoteTokenQtyToReturn);
        IERC20(baseToken).safeTransfer(_tokenRecipient, baseTokenQtyToReturn);
    }

    /**
     * @notice swaps quote tokens for a minimum amount of base tokens.  Fees are included in all transactions.
     * The exchange must be granted approvals for the quote token by the caller.
     * @param _quoteTokenQty qty of quote tokens to swap
     * @param _minBaseTokenQty minimum qty of base tokens to receive in exchange for
     * your quote tokens (or the transaction will revert)
     * @param _expirationTimestamp timestamp that this transaction must occur before (or transaction will revert)
     */
    function swapQuoteTokenForBaseToken(
        uint256 _quoteTokenQty,
        uint256 _minBaseTokenQty,
        uint256 _expirationTimestamp
    ) external notExpired(_expirationTimestamp) returns (uint256 baseTokenQty) {
        require(
            _quoteTokenQty > 0 && _minBaseTokenQty > 0,
            "Exchange: INSUFFICIENT_TOKEN_QTY"
        );

        uint256 baseTokenReserveQty =
            IERC20(baseToken).balanceOf(address(this));
        // calculate what our quote token reserver "should" be based on K and our base token.
        uint256 impliedQuoteTokenReserveQty =
            pricingConstantK / baseTokenReserveQty;

        baseTokenQty = _calculateQtyToReturnAfterFees(
            _quoteTokenQty,
            impliedQuoteTokenReserveQty,
            baseTokenReserveQty
        );

        require(
            baseTokenQty > _minBaseTokenQty,
            "Exchange: INSUFFICIENT_BASE_TOKEN_QTY"
        );

        // we need to reassign K now to take into account growth due to fees
        pricingConstantK =
            (impliedQuoteTokenReserveQty + _quoteTokenQty) *
            (baseTokenReserveQty - baseTokenQty);
        IERC20(quoteToken).safeTransferFrom(
            msg.sender,
            address(this),
            _quoteTokenQty
        );
        IERC20(baseToken).safeTransfer(msg.sender, baseTokenQty);
    }

    /**
     * @notice swaps base tokens for a minimum amount of quote tokens.  Fees are included in all transactions.
     * The exchange must be granted approvals for the base token by the caller.
     * @param _baseTokenQty qty of base tokens to swap
     * @param _minQuoteTokenQty minimum qty of quote tokens to receive in exchange for
     * your base tokens (or the transaction will revert)
     * @param _expirationTimestamp timestamp that this transaction must occur before (or transaction will revert)
     */
    function swapBaseTokenForQuoteToken(
        uint256 _baseTokenQty,
        uint256 _minQuoteTokenQty,
        uint256 _expirationTimestamp
    )
        external
        notExpired(_expirationTimestamp)
        returns (uint256 quoteTokenQty)
    {
        require(
            _baseTokenQty > 0 && _minQuoteTokenQty > 0,
            "Exchange: INSUFFICIENT_TOKEN_QTY"
        );

        uint256 baseTokenReserveQty =
            IERC20(baseToken).balanceOf(address(this));

        // calculate what our quote token reserver "should" be based on K and our base token.
        uint256 impliedQuoteTokenReserveQty =
            pricingConstantK / baseTokenReserveQty;
        quoteTokenQty = _calculateQtyToReturnAfterFees(
            _baseTokenQty,
            baseTokenReserveQty,
            impliedQuoteTokenReserveQty
        );

        require(
            quoteTokenQty > _minQuoteTokenQty,
            "Exchange: INSUFFICIENT_QUOTE_TOKEN_QTY"
        );
        // we need to reassign K now to take into account growth due to fees
        pricingConstantK =
            (impliedQuoteTokenReserveQty - quoteTokenQty) *
            (baseTokenReserveQty + _baseTokenQty);
        IERC20(baseToken).safeTransferFrom(
            msg.sender,
            address(this),
            _baseTokenQty
        );
        IERC20(quoteToken).safeTransfer(msg.sender, quoteTokenQty);
    }

    /**
     * @dev used to calculate the qty of token a liquidity provider
     * must add in order to maintain the current reserve ratios
     * @param _tokenAQty quote or base token qty to be supplied by the liquidity provider
     * @param _tokenAReserveQty current reserve qty of the quote or base token (same token as tokenA)
     * @param _tokenBReserveQty current reserve qty of the other quote or base token (not tokenA)
     */
    function _calculateQty(
        uint256 _tokenAQty,
        uint256 _tokenAReserveQty,
        uint256 _tokenBReserveQty
    ) internal pure returns (uint256 tokenBQty) {
        require(_tokenAQty > 0, "Exchange: INSUFFICIENT_QTY");
        require(
            _tokenAReserveQty > 0 && _tokenBReserveQty > 0,
            "Exchange: INSUFFICIENT_LIQUIDITY"
        );
        tokenBQty = (_tokenAQty * _tokenBReserveQty) / _tokenAReserveQty;
    }

    /**
     * @dev used to calculate the qty of token a trader will receive (less fees)
     * given the qty of token A they are providing
     * @param _tokenASwapQty quote or base token qty to be swapped by the trader
     * @param _tokenAReserveQty current reserve qty of the quote or base token (same token as tokenA)
     * @param _tokenBReserveQty current reserve qty of the other quote or base token (not tokenA)
     */
    function _calculateQtyToReturnAfterFees(
        uint256 _tokenASwapQty,
        uint256 _tokenAReserveQty,
        uint256 _tokenBReserveQty
    ) internal pure returns (uint256 price) {
        uint256 tokenASwapQtyLessFee =
            _tokenASwapQty * (basisPoints - liquidityFee);
        price =
            (tokenASwapQtyLessFee * _tokenBReserveQty) /
            ((_tokenAReserveQty * basisPoints) + tokenASwapQtyLessFee);
    }
}
