const dhive = require("@hiveio/dhive")
const Web3 = require("web3")
const Tx = require('ethereumjs-tx').Transaction;
const axios = require('axios');
var logger = require('./logs/logger.js');

var abiArray = require("./abi.js")
const config = require("../config/config.js")

var client = new dhive.Client(config.hive_api_nodes);
var web3 = new Web3(new Web3.providers.HttpProvider(config.ethEndpoint));

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("status")

function start(){
  try {
    stream = client.blockchain.getBlockStream({mode: dhive.BlockchainMode.Latest});
    console.log("Start streaming HIVE!")
    stream
      .on('data', function(block) {
        for (const transaction of block.transactions) {
          for (const op of transaction){
            let type = op[0]
            let data = op[1]
            if (type == 'transfer' && data.to == config.hiveAccount) processDeposit(data.from, data.memo, data.amount)
          }
        }
      })
      .on('error', function() {
        setTimeout(() => {
          start()
        }, 3000)
      })
      .on('end', function() {
        setTimeout(() => {
          start()
        }, 3000)
      });
  } catch (e) {
    setTimeout(() => {
      start()
    }, 3000)
  }
}

function processDeposit(sender, memo, amount){
  let isCorrect = isTransferInCorrectFormat(memo, amount)
  if (isCorrect == true) sendTokens(memo, amount.split(" ")[0], sender, amount);
  else if (isCorrect == 'not_eth_address') sendRefund(sender, amount, 'Please use Ethereum address as memo!');
  else if (isCorrect == 'not_hive') sendRefund(sender, amount, 'Please only send HIVE!');
  else if (isCorrect == 'under_min_amount') sendRefund(sender, amount, 'Please send more than '+config.min_amount+' HIVE!');
  else if (isCorrect == 'over_max_amount') sendRefund(sender, amount, 'Please send less than '+config.max_amount+' HIVE!');
}

function isTransferInCorrectFormat(memo, amount){
  const value = Number(amount.split(" ")[0])
  const symbol = amount.split(" ")[1]

  if (web3.utils.isAddress(memo) != true) return 'not_eth_address';
  else if (symbol == "HIVE") return 'not_hive';
  else if (value < config.min_amount) return "under_min_amount"
  else if (config.max_amount > 0 && value > config.max_amount) return "over_max_amount"
  else return true;
}

function sendRefund(to, amount, message){
  const tx = {
    from: config.hiveAccount,
    to: to,
    amount: amount,
    memo: `Refund! Reason: ${message}`
  }
  const key = dhive.PrivateKey.fromString(config.hivePrivateKey);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Refund of ${amount} sent to ${to}! Reason: ${message}`))
    .catch(err => logger.debug.error(err));
}

async function sendTokens(address, amount, from, full_amount){
  try {
    console.log(`Sending ${amount} WHIVE to ${address}, paid by ${from}`)
    var transferAmount_not_rounded = amount * 1000;
    var transferAmount = parseFloat(transferAmount_not_rounded - ((transferAmount_not_rounded * config.fee_deposit) / 100)).toFixed(0)
    var contract = new web3.eth.Contract(abiArray.abi, config.contractAddress, {
      from: config.ethereumAddress
    });
    const contractFunction = contract.methods.mint(address, transferAmount);
    const functionAbi = contractFunction.encodeABI();
    var gasPriceGwei = await getRecomendedGasPrice();
    var nonce = await getNonce()
    var rawTransaction = {
        "from": config.ethereumAddress,
        "nonce": "0x" + nonce.toString(16),
        "gasPrice": web3.utils.toHex(gasPriceGwei * 1e9),
        "gasLimit": web3.utils.toHex(config.ethereum_config.gasLimit),
        "to": config.contractAddress,
        "data": functionAbi,
        "chainId": config.ethereum_config.chainId
    };
    var tx = new Tx(rawTransaction, { chain: config.ethereum_config.chain });
    tx.sign(new Buffer.from(config.privateKey, 'hex'));
    var serializedTx = tx.serialize();
    var receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    var hash_share = receipt.transactionHash
    sendConfirmationMemo(hash_share, from)
    sendFeeAmount(amount, hash_share)
  } catch (e) {
    console.log(e)
    logger.debug.error(e)
    sendRefund(from, full_amount, `Internal server error`)
  }
}

async function getNonce(){ //use database, since web3.eth.getTransactionCount(config.ethereumAddress) does not return pending tx's
  return new Promise((resolve, reject) => {
    database.findOne({type: "nonce"}, (err, result) => {
      if (err) reject(err)
      else {
        database.updateOne({type: "nonce"}, {$set: {nonce: Number(result.nonce) + 1}}, (err1, result1) => {
          if (err1) reject(err1)
          else if (result1 != null) resolve(result.nonce)
          else reject("nonce not found")
        })
      }
    })
  })
}

function sendFeeAmount(transferAmount_not_fee, hash){
  let amount = parseFloat((transferAmount_not_fee * config.fee_deposit) / 100).toFixed(3)
  const tx = {
    from: config.hiveAccount,
    to: config.fee_account,
    amount: amount + ' HIVE',
    memo: `${config.fee_deposit}% fee for transaction: ${hash}!`
  }
  const key = dhive.PrivateKey.fromString(config.hivePrivateKey);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Fee of ${amount} HIVE sent to ${config.fee_account} for ${hash}`))
    .catch(err => logger.debug.error(err));
}

function getRecomendedGasPrice(){
  return new Promise((resolve, reject) => {
    axios
      .get(`https://ethgasstation.info/api/ethgasAPI.json?api-key=${config.ethgasstation_api}`)
      .then(response => {
        if (response.data.fast &&  typeof response.data.fast == "number") resolve(response.data.fast / 10) //safeLow
        else reject("ethgasstation data is not number")
      })
      .catch(err => {
        logger.debug.error(err)
        reject(err)
      });
  })
}

function sendConfirmationMemo(hash, hive_user){
  console.log("Transaction sent! "+hash)
  const tx = {
    from: config.hiveAccount,
    to: hive_user,
    amount: '0.001 HIVE',
    memo: `Tokens sent! Hash: ${hash}, network: Kovan!`
  }
  const key = dhive.PrivateKey.fromString(config.hivePrivateKey);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Confirmation send to ${hive_user} for ${hash}`))
    .catch(err => logger.debug.error(err));
}

module.exports.start = start
