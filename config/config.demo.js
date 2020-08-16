var config = {
  "contractAddress": "contract_address",
  "ethereumAddress": "minter_address",
  "privateKey": "minter_private_key",
  "hiveAccount": "deposit_hive_address",
  "hivePrivateKey": "private-key",
  "mongodb": "url_for_mongodb",
  "ethEndpoint": "infura.com-endpoint",
  "ethplorer_api": "ethplorer.com-api-key",
  "xpub": "extended_public_key",
  "ethgasstation_api": "ethgasstation.com api key",
  "token_api_url": 'http://api.ethplorer.io/getTokenHistory',
  "min_amount": 1,
  "max_amount": -2, //negative to disable
  "fee_deposit": 5, //fee in %
  "fee_account": "fee_hive_account", //send fees to this account
  "hive_api_nodes": [
    "https://api.hive.blog",
    "https://api.hivekings.com",
    "https://anyx.io",
    "https://api.openhive.network"
  ],
  "ethereum_config": {
    "chainId": 3, //3: ropsten, 1: mainnet,
    "chain": "ropsten", //mainnet...
    "gasLimit": 100000
  }
}


module.exports = config
