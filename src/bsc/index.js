const dhive = require("@hiveio/dhive")
const Web3 = require("web3")
const Tx = require('ethereumjs-tx').Transaction;
const { Hive } = require('@splinterlands/hive-interface');

const abiArray = require("../abi.js")
const config = require("../../config/config.js")

const client = new dhive.Client(config.hive_api_nodes);
const web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org/'));
const hive = new Hive({rpc_error_limit: 5});

const mongo = require("../../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("status")

var alreadyProcessed = []

function processDeposit(sender, memo, amount, id){
  if (!alreadyProcessed.includes(id)){ //make sure tx was not processed yet (db can be too slow sometimes, use array instead)
    alreadyProcessed.push(id)
    isAlreadyProcessed(id)
      .then(async (result) => {
        if (result == false){
          insertTransaction(id)
          var fee = await getFee()
          let isCorrect = await isTransferInCorrectFormat(memo, amount, fee)
          if (isCorrect == true) sendTokens(memo, amount.split(" ")[0], sender, amount);
          else if (isCorrect == 'not_eth_address') sendRefund(sender, amount, 'Please use BSC address as memo!');
          else if (isCorrect == 'not_hive') sendRefund(sender, amount, 'Please only send HIVE!');
          else if (isCorrect == 'under_min_amount') sendRefund(sender, amount, 'Please send more than '+config.min_amount_bsc+' HIVE!');
          else if (isCorrect == 'over_max_amount') sendRefund(sender, amount, 'Please send less than '+config.max_amount_bsc+' HIVE!');
        } else {
          console.log("Hive transaction already processed (db)!")
        }
      })
      .catch((err) => {
        console.log(err)
        logToDatabase(err, `Error while chekcking transaction ${id}`)
      })
  } else {
    console.log("Hive transaction already processed (array)!")
  }
}

function isAlreadyProcessed(id){
  return new Promise((resolve, reject) => {
    let db_tx  = mongo.get().db("ETH-HIVE").collection("hive_transactions")
    db_tx.findOne({tx: id}, (err, result) => {
      if (err) reject(err)
      else {
        if (result == null) resolve(false)
        else resolve(true)
      }
    })
  })
}

//add tx id to database
function insertTransaction(id){
  let db_tx  = mongo.get().db("ETH-HIVE").collection("hive_transactions")
  db_tx.insertOne({tx: id}, (err, result) => {
    if (err){
      console.log(err)
      logToDatabase(err, `Error inserting new transaction: ${id}`)
    }
  })
}

async function isTransferInCorrectFormat(memo, amount, fee){
  const value = Number(amount.split(" ")[0])
  const symbol = amount.split(" ")[1]

  if (web3.utils.isAddress(memo) != true) return 'not_eth_address';
  else if (symbol != "HIVE") return 'not_hive';
  else if (value < config.min_amount_bsc) return "under_min_amount"
  else if (config.max_amount_bsc > 0 && value > config.max_amount_bsc) return "over_max_amount"
  else return true;
}

function sendRefund(to, amount, message){
  const tx = {
    from: config.hiveAccount,
    to: to,
    amount: amount,
    memo: `Refund! Reason: ${message}`
  }
  const key = dhive.PrivateKey.fromString(process.env.PRIVATE_HIVE_KEY);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Refund of ${amount} sent to ${to}! Reason: ${message}`))
    .catch((err) => {
      console.log(err)
      logToDatabase(err, `Error while sending ${amount} refund for ${to}`)
    });
}

async function sendTokens(address, amount, from, full_amount){
  try {
    console.log(`Sending ${amount} WHIVE to ${address} on BSC, paid by ${from}`)
    var fee = await getFee()
    var transferAmount_not_rounded = amount * 1000;
    var transferAmount = parseFloat(transferAmount_not_rounded - 1000).toFixed(0) //1 HIVE fee
    var contract = new web3.eth.Contract(abiArray.abi, config.contractAddress_bsc, {
      from: config.ethereumAddress_bsc
    });
    var contractFunction = contract.methods.mint(address, transferAmount);
    var functionAbi = contractFunction.encodeABI();
    var gasPriceGwei = 20//await getRecomendedGasPrice();
    var nonce = web3.eth.getTransactionCount(config.ethereumAddress_bsc, 'pending')
    var rawTransaction = {
        "from": config.ethereumAddress_bsc,
        "nonce": "0x" + nonce.toString(16),
        "gasPrice": web3.utils.toHex(gasPriceGwei * 1e9),
        "gasLimit": web3.utils.toHex(config.ethereum_config.gasLimit),
        "to": config.contractAddress_bsc,
        "data": functionAbi,
        "chainId": 56
    };
    var tx = new Tx(rawTransaction, { chain: 56 });
    tx.sign(new Buffer.from(process.env.PRIVATE_ETH_KEY_BSC, 'hex'));
    var serializedTx = tx.serialize();
    var receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    var hash = receipt.transactionHash
    var gas_spent = receipt.gasUsed
    sendConfirmationMemo(hash, from)
    sendFeeAmount(amount, hash, fee, gas_spent, gasPriceGwei, from)
  } catch (e) {
    console.log(e)
    console.log(e)
    sendRefund(from, full_amount, `Internal server error`)
    logToDatabase(e, `Error while sending ${amount} tokens to ${address}, but refund was attempted.`)
  }
}


async function sendFeeAmount(transferAmount_not_fee, hash, fixed_fee, gas_spent, gasPriceGwei, to){
  try {
    const tx = {
      from: config.bscAccount,
      to: config.fee_account,
      amount: amount + ' HIVE',
      memo: `${config.fee_deposit}% + ${parseFloat(fee).toFixed(3)} fee  for transaction: ${hash}!`
    }
    const key = dhive.PrivateKey.fromString(process.env.PRIVATE_HIVE_KEY_BSC);
    const op = ["transfer", tx];
    client.broadcast
      .sendOperations([op], key)
      .then(res => console.log(`Fee of 1.000 HIVE sent to ${config.fee_account} for ${hash}`))
      .catch((err) => {
        logger.debug.error(err)
        logToDatabase(err, `Error while sending ${amount} HIVE fee`)
      });
    refundFeeToUser(unspent_fee, to)
  } catch (err) {
    console.log(err)
    logToDatabase(err, `Error cought sending fee`)
  }
}


// function getRecomendedGasPrice(){
//   return new Promise((resolve, reject) => {
//     axios
//       .get(`https://ethgasstation.info/api/ethgasAPI.json?api-key=${config.ethgasstation_api}`)
//       .then(response => {
//         if (response.data.fast &&  typeof response.data.fast == "number") resolve(response.data.fast / 10) //safeLow
//         else reject("ethgasstation data is not number")
//       })
//       .catch(err => {
//         console.log(err)
//         reject(err)
//       });
//   })
// }

function sendConfirmationMemo(hash, hive_user){
  console.log("Transaction sent! "+hash)
  const tx = {
    from: config.bscAccount,
    to: hive_user,
    amount: '0.001 HIVE',
    memo: `Tokens sent! Hash: ${hash}!`
  }
  const key = dhive.PrivateKey.fromString(process.env.PRIVATE_HIVE_KEY_BSC);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Confirmation sent to ${hive_user} for ${hash}`))
    .catch(err => console.log(err));
}

function logToDatabase(err, message){
  mongo.get().db("ETH-HIVE").collection("errors").insertOne({type: "payment-deposit", error: err, message: message}, (err, result) => {
    if (err) console.log(err)
    else console.log("Error was stored to database!")
  })
}

module.exports.processDeposit = processDeposit
