const dhive = require("@hiveio/dhive")
const Web3 = require("web3")
const Tx = require('ethereumjs-tx').Transaction;
const axios = require('axios');
var logger = require('./logs/logger.js');
const NodeCache = require( "node-cache" );

var abiArray = require("./abi.js")
const config = require("../config/config.js")

var client = new dhive.Client(config.hive_api_nodes);
var web3 = new Web3(new Web3.providers.HttpProvider(config.ethEndpoint));

const myCache = new NodeCache( { stdTTL: 100, checkperiod: 120 } );

const multisignature = require("./multisignature.js")

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("status")

function start(){
  try {
    stream = client.blockchain.getBlockStream({mode: dhive.BlockchainMode.Latest});
    console.log("Start streaming HIVE!")
    stream
      .on('data', function(block) {
        for (const transaction of block.transactions) {
          for (const op of transaction.operations){
            let type = op[0]
            let data = op[1]
            if (type == 'transfer' && data.to == config.hiveAccount) processDeposit(data.from, data.memo, data.amount, transaction.transaction_id)
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


async function processDeposit(sender, memo, amount, trxId){
  var fee = await getFee()
  let isCorrect = await isTransferInCorrectFormat(memo, amount, fee)
  if (isCorrect == true) sendTokens(memo, amount.split(" ")[0], sender, amount, trxId);
  else if (isCorrect == 'not_eth_address') sendRefund(sender, amount, 'Please use Ethereum address as memo!', trxId);
  else if (isCorrect == 'not_hive') sendRefund(sender, amount, 'Please only send HIVE!', trxId);
  else if (isCorrect == 'under_min_amount') sendRefund(sender, amount, 'Please send more than '+config.min_amount+' HIVE!', trxId);
  else if (isCorrect == 'over_max_amount') sendRefund(sender, amount, 'Please send less than '+config.max_amount+' HIVE!', trxId);
  else if (isCorrect == 'fee_higher_than_deposit') sendRefund(sender, amount, 'Current ETH fee is '+fee+' HIVE!', trxId);
}

async function isTransferInCorrectFormat(memo, amount, fee){
  const value = Number(amount.split(" ")[0])
  const symbol = amount.split(" ")[1]

  if (web3.utils.isAddress(memo) != true) return 'not_eth_address';
  else if (symbol != "HIVE") return 'not_hive';
  else if (value < config.min_amount) return "under_min_amount"
  else if (config.max_amount > 0 && value > config.max_amount) return "over_max_amount"
  else if (value <= fee * (1 + (config.fee_deposit / 100))) return "fee_higher_than_deposit"
  else return true;
}

function sendRefund(to, amount, message, trxId){
  multisignature.sign(to, amount, message, trxId, 'deposit-refund')
}

async function sendTokens(address, amount, from, full_amount, trxId){
  try {
    console.log(`Sending ${amount} WHIVE to ${address}, paid by ${from}`)
    var fee = await getFee()
    var transferAmount_not_rounded = amount * 1000;
    var transferAmount = parseFloat(transferAmount_not_rounded - (fee * 1000) - ((transferAmount_not_rounded * config.fee_deposit) / 100)).toFixed(0)
    var contract = new web3.eth.Contract(abiArray.abi, config.contractAddress, {
      from: config.ethereumAddress
    });
    const contractFunction = contract.methods.mint(address, transferAmount);
    const functionAbi = contractFunction.encodeABI();
    var gasPriceGwei = await getRecomendedGasPrice();
    var nonce = await getNonce() //web3.eth.getTransactionCount(config.ethereumAddress)
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
    let gas_spent = receipt.gasUsed
    sendConfirmationMemo(hash_share, from, trxId)
    sendFeeAmount(amount, hash_share, fee, gas_spent, gasPriceGwei, from, trxId)
  } catch (e) {
    console.log(e)
    logger.debug.error(e)
    sendRefund(from, full_amount, `Internal server error`, trxId)
    logToDatabase(e, `Error while sending ${amount} tokens to ${address}, but refund was attempted.`)
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

function getFee(){
  return new Promise((resolve, reject) => {
    database.findOne({type: "fee"}, (err, result) => {
      if (err) reject(err)
      else resolve(result.fee)
      })
  })
}

async function sendFeeAmount(transferAmount_not_fee, hash, fixed_fee, gas_spent, gasPriceGwei, to, trxId){
  try {
    let hive_in_eth = await getHiveEthPrice()
    let fee = ((gas_spent * gasPriceGwei * 1.1) / 1000000000) / hive_in_eth //how much  did we actually burned + 10%
    let amount_1 = (transferAmount_not_fee * config.fee_deposit) / 100 // % fee
    let unspent_fee = Number(fixed_fee) - Number(fee) - Number(amount_1) //remove spent & percentage from reserved fee
    let amount_2 = Number(fixed_fee) + Number(fee)
    let amount = parseFloat(amount_2).toFixed(3)
    multisignature.sign(config.fee_account, amount + ' HIVE', `${config.fee_deposit}% + ${parseFloat(fee).toFixed(3)} fee  for transaction: ${hash}!`, trxId, 'deposit-fee')
    refundfeeToUser(unspent_fee, to)
  } catch (err) {
    logger.debug.error(err)
    logToDatabase(err, `Error cought sending fee`)
  }
}

function refundfeeToUser(unspent, to){
  const tx = {
    from: config.fee_account,
    to: to,
    amount: parseFloat(unspent).toFixed(3) + ' HIVE',
    memo: `Refund of ${parseFloat(unspent).toFixed(3)} HIVE (unspent transaction fees)!`
  }
  const key = dhive.PrivateKey.fromString(config.fee_account_private_key);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Fee refund of ${unspent} HIVE sent to ${to}.`))
    .catch((err) => {
      logger.debug.error(err)
      logToDatabase(err, `Error while refunding ${unspent} HIVE fee`)
    });
}

function getHiveEthPrice(){
  return new Promise((resolve, reject) => {
    value = myCache.get( "rate" );
    if (value == undefined){
      axios
        .get('https://api.coingecko.com/api/v3/coins/hive')
        .then((result) => {
          obj = { my: "exchange_rate", rate: result.data.market_data.current_price.eth };
          success = myCache.set( "rate", obj, 3600 );
          resolve(result.data.market_data.current_price.eth)
        })
        .catch((err) => {
          reject(err)
        })
    } else {
      resolve(value.rate)
    }
  })
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
    from: config.fee_account,
    to: hive_user,
    amount: '0.001 HIVE',
    memo: `Tokens sent! Hash: ${hash}!`
  }
  const key = dhive.PrivateKey.fromString(config.fee_account_private_key);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Confirmation sent to ${hive_user} for ${hash}`))
    .catch(err => logger.debug.error(err));
}

function logToDatabase(err, message){
  mongo.get().db("ETH-HIVE").collection("errors").insertOne({type: "payment-deposit", error: err, message: message}, (err, result) => {
    if (err) logger.debug.error(err)
    else console.log("Error was stored to database!")
    })
}

module.exports.start = start
