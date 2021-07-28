//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Exchange.sol";
import "../interfaces/IExchangeFactory.sol";

/**
 * @title ExchangeFactory contract for Elastic Swap.
 * @author Elastic DAO
 * @notice The ExchangeFactory provides the needed functionality to create new Exchange's that represent
 * a single token pair.  Additionally it houses records of all deployed Exchange's for validation and easy
 * lookup.
 */
contract ExchangeFactory is Ownable, IExchangeFactory {
    mapping(address => mapping(address => address))
        public exchangeAddressByTokenAddress;
    mapping(address => bool) public isValidExchangeAddress;

    address private feeAddress_;

    // events
    event NewExchange(address indexed creator, address indexed exchangeAddress);
    event SetFeeAddress(address indexed feeAddress);

    constructor(address _feeAddress) {
        require(_feeAddress != address(0), "ExchangeFactory: INVALID_ADDRESS");
        feeAddress_ = _feeAddress;
    }

    /**
     * @notice called to create a new erc20 token pair exchange
     * @param _name The human readable name of this pair (also used for the liquidity token name)
     * @param _symbol Shortened symbol for trading pair (also used for the liquidity token symbol)
     * @param _quoteToken address of the ERC20 quote token in the pair. This token can have a fixed or elastic supply
     * @param _baseToken address of the ERC20 base token in the pair. This token is assumed to have a fixed supply.
     */
    function createNewExchange(
        string memory _name,
        string memory _symbol,
        address _quoteToken,
        address _baseToken
    ) external {
        require(_quoteToken != _baseToken, "ExchangeFactory: IDENTICAL_TOKENS");
        require(
            _quoteToken != address(0) && _baseToken != address(0),
            "ExchangeFactory: INVALID_TOKEN_ADDRESS"
        );
        require(
            exchangeAddressByTokenAddress[_quoteToken][_baseToken] ==
                address(0),
            "ExchangeFactory: DUPLICATE_EXCHANGE"
        );

        Exchange exchange =
            new Exchange(
                _name,
                _symbol,
                _quoteToken,
                _baseToken,
                address(this)
            );

        exchangeAddressByTokenAddress[_quoteToken][_baseToken] = address(
            exchange
        );
        isValidExchangeAddress[address(exchange)] = true;

        emit NewExchange(msg.sender, address(exchange));
    }

    function setFeeAddress(address _feeAddress) external onlyOwner {
        require(
            _feeAddress != address(0) && _feeAddress != feeAddress_,
            "ExchangeFactory: INVAlID_FEE_ADDRESS"
        );
        feeAddress_ = _feeAddress;
        emit SetFeeAddress(feeAddress_);
    }

    function feeAddress() public view virtual override returns (address) {
        return feeAddress_;
    }
}
