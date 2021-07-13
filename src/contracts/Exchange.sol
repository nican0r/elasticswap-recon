//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "../libraries/MathLib.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Exchange contract for Elastic Swap representing a single ERC20 pair of tokens to be swapped.
 * @author Elastic DAO
 * @notice This contract provides all of the needed functionality for a liquidity provider to supply/withdraw ERC20
 * tokens and traders to swap tokens for one another.
 */
contract Exchange is ERC20, ReentrancyGuard {
    using MathLib for uint256;
    using SafeERC20 for IERC20;

    struct InternalBalances {
        // x*y=k - we track these internally to compare to actual balances of the ERC20's
        // in order to calculate the "decay" or the amount of balances that are not
        // participating in the pricing curve and adding additional liquidity to swap.
        uint256 quoteTokenReserveQty; // x
        uint256 baseTokenReserveQty; // y
    }

    address public immutable quoteToken; // address of ERC20 quote token (elastic or fixed supply)
    address public immutable baseToken; // address of ERC20 base token (WETH or a stable coin w/ fixed supply)

    uint16 public elasticDAOFee; // ElasticDAO development fund fee in basis points
    uint16 public constant liquidityFee = 30; // fee provided to liquidity providers in basis points

    InternalBalances public internalBalances = InternalBalances(0, 0);

    /**
     * @dev Called to check timestamps from users for expiration of their calls.
     * Used in place of a modifier for byte code savings
     */
    function isNotExpired(uint256 _expirationTimeStamp) internal view {
        require(_expirationTimeStamp >= block.timestamp, "Exchange: EXPIRED");
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
    ) external nonReentrant() {
        isNotExpired(_expirationTimestamp);

        (
            uint256 quoteTokenQty,
            uint256 baseTokenQty,
            uint256 liquidityTokenQty
        ) =
            MathLib.calculateAddLiquidityQuantities(
                _quoteTokenQtyDesired,
                _baseTokenQtyDesired,
                _quoteTokenQtyMin,
                _baseTokenQtyMin,
                IERC20(quoteToken).balanceOf(address(this)),
                IERC20(baseToken).balanceOf(address(this)),
                this.totalSupply(),
                internalBalances
            );

        if (quoteTokenQty != 0) {
            // transfer quote tokens to Exchange
            IERC20(quoteToken).safeTransferFrom(
                msg.sender,
                address(this),
                quoteTokenQty
            );
        }
        if (baseTokenQty != 0) {
            // transfer base tokens to Exchange
            IERC20(baseToken).safeTransferFrom(
                msg.sender,
                address(this),
                baseTokenQty
            );
        }
        _mint(_liquidityTokenRecipient, liquidityTokenQty); // mint liquidity tokens to recipient
    }

    /**
     * @notice Entry point for a liquidity provider to add liquidity (quote tokens) to the exchange
     * when base token decay is present due to elastic token supply ( a rebase down event).
     * The caller will receive liquidity tokens in return.
     * Requires approvals to be granted to this exchange for quote tokens.
     * @dev variable names with the prefix "w" represent WAD values (decimals with 18 digits of precision)
     * @param _quoteTokenQtyDesired qty of quoteTokens that you would like to add to the exchange
     * @param _quoteTokenQtyMin minimum acceptable qty of quoteTokens that will be added (or transaction will revert)
     * @param _liquidityTokenRecipient address for the exchange to issue the resulting liquidity tokens from
     * this transaction to
     * @param _expirationTimestamp timestamp that this transaction must occur before (or transaction will revert)
     */
    function addQuoteTokenLiquidity(
        uint256 _quoteTokenQtyDesired,
        uint256 _quoteTokenQtyMin,
        address _liquidityTokenRecipient,
        uint256 _expirationTimestamp
    ) external nonReentrant() {
        isNotExpired(_expirationTimestamp);
        // to calculate decay in base token, we need to see if we have less
        // quote token than we expect.  This would mean a rebase down has occurred.
        uint256 quoteTokenReserveQty =
            IERC20(quoteToken).balanceOf(address(this));

        require(
            internalBalances.quoteTokenReserveQty > quoteTokenReserveQty,
            "Exchange: NO_BASE_DECAY"
        );

        (uint256 quoteTokenQty, uint256 liquidityTokenQty) =
            MathLib.calculateAddQuoteTokenLiquidityQuantities(
                _quoteTokenQtyDesired,
                _quoteTokenQtyMin,
                quoteTokenReserveQty,
                this.totalSupply(),
                internalBalances
            );

        IERC20(quoteToken).safeTransferFrom(
            msg.sender,
            address(this),
            quoteTokenQty
        ); // transfer quote tokens to Exchange

        _mint(_liquidityTokenRecipient, liquidityTokenQty); // mint liquidity tokens to recipient
    }

    /**
     * @notice Entry point for a liquidity provider to add liquidity (base tokens) to the exchange
     * when quote token decay is present due to elastic token supply.
     * The caller will receive liquidity tokens in return.
     * Requires approvals to be granted to this exchange for base tokens.
     * @dev variable names with the prefix "w" represent WAD values (decimals with 18 digits of precision)
     * @param _baseTokenQtyDesired qty of baseTokens that you would like to add to the exchange
     * @param _baseTokenQtyMin minimum acceptable qty of baseTokens that will be added (or transaction will revert)
     * @param _liquidityTokenRecipient address for the exchange to issue the resulting liquidity tokens from
     * this transaction to
     * @param _expirationTimestamp timestamp that this transaction must occur before (or transaction will revert)
     */
    function addBaseTokenLiquidity(
        uint256 _baseTokenQtyDesired,
        uint256 _baseTokenQtyMin,
        address _liquidityTokenRecipient,
        uint256 _expirationTimestamp
    ) external nonReentrant() {
        isNotExpired(_expirationTimestamp);

        uint256 quoteTokenReserveQty =
            IERC20(quoteToken).balanceOf(address(this));

        require(
            quoteTokenReserveQty > internalBalances.quoteTokenReserveQty,
            "Exchange: NO_QUOTE_DECAY"
        );

        (uint256 baseTokenQty, uint256 liquidityTokenQty) =
            MathLib.calculateAddBaseTokenLiquidityQuantities(
                _baseTokenQtyDesired,
                _baseTokenQtyMin,
                quoteTokenReserveQty,
                this.totalSupply(),
                internalBalances
            );

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
    ) external nonReentrant() {
        isNotExpired(_expirationTimestamp);
        require(this.totalSupply() > 0, "Exchange: INSUFFICIENT_LIQUIDITY");
        require(
            _quoteTokenQtyMin > 0 && _baseTokenQtyMin > 0,
            "Exchange: MINS_MUST_BE_GREATER_THAN_ZERO"
        );

        uint256 quoteTokenReserveQty =
            IERC20(quoteToken).balanceOf(address(this));
        uint256 baseTokenReserveQty =
            IERC20(baseToken).balanceOf(address(this));

        uint256 quoteTokenQtyToReturn =
            (_liquidityTokenQty * quoteTokenReserveQty) / this.totalSupply();
        uint256 baseTokenQtyToReturn =
            (_liquidityTokenQty * baseTokenReserveQty) / this.totalSupply();

        require(
            quoteTokenQtyToReturn >= _quoteTokenQtyMin,
            "Exchange: INSUFFICIENT_QUOTE_QTY"
        );

        require(
            baseTokenQtyToReturn >= _baseTokenQtyMin,
            "Exchange: INSUFFICIENT_BASE_QTY"
        );

        // this ensure that we are removing the equivalent amount of decay
        // when this person exits.
        uint256 quoteTokenQtyToRemoveFromInternalAccounting =
            (_liquidityTokenQty * internalBalances.quoteTokenReserveQty) /
                this.totalSupply();

        internalBalances
            .quoteTokenReserveQty -= quoteTokenQtyToRemoveFromInternalAccounting;

        // we need to ensure no overflow here in the case when
        // we are removing assets when a decay is present. (not sure if this is true, need test.)
        if (baseTokenQtyToReturn > internalBalances.baseTokenReserveQty) {
            internalBalances.baseTokenReserveQty = 0;
        } else {
            internalBalances.baseTokenReserveQty -= baseTokenQtyToReturn;
        }

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
    ) external nonReentrant() {
        isNotExpired(_expirationTimestamp);

        uint256 baseTokenQty =
            MathLib.calculateBaseTokenQty(
                _quoteTokenQty,
                _minBaseTokenQty,
                liquidityFee,
                internalBalances
            );

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
    ) external nonReentrant() {
        isNotExpired(_expirationTimestamp);
        require(
            _baseTokenQty > 0 && _minQuoteTokenQty > 0,
            "Exchange: INSUFFICIENT_TOKEN_QTY"
        );

        uint256 quoteTokenQty =
            MathLib.calculateQuoteTokenQty(
                _baseTokenQty,
                _minQuoteTokenQty,
                IERC20(quoteToken).balanceOf(address(this)),
                liquidityFee,
                internalBalances
            );

        IERC20(baseToken).safeTransferFrom(
            msg.sender,
            address(this),
            _baseTokenQty
        );
        IERC20(quoteToken).safeTransfer(msg.sender, quoteTokenQty);
    }
}
