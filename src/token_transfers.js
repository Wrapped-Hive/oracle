const dhive = require("@hiveio/dhive")

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE")

const config = require("../config/config.js")
var client = new dhive.Client(config.hive_api_nodes)

var logger = require('./logs/logger.js');

async function processTokenTransfer(data){
  database.collection("addresses").findOne({ $text: { $search: data.to, $caseSensitive: false } }, (err, result) => {
    if (err) logger.debug.error(err);
    else if (result == null) return;//console.log("Address not ours")
    else isTxAlreadyProcessed(data, result)
  })
}

function isTxAlreadyProcessed(tx_data, db_data){
  database.collection('transactions').findOne({transactionHash: tx_data.transactionHash}, (err, result) => {
    if (err) logger.debug.error(err);
    else if (result != null) return;//console.log("Tx already processed.")
    else processHiveTransfer(tx_data, db_data)
  })
}

function processHiveTransfer(tx_data, db_data){
  let length = db_data.transactions.length
  let hive_account = db_data.transactions[length-1].hiveUsername
  var data = tx_data
  data.value = data.value / 1000 //3 decimal places
  data.hiveUsername = hive_account
  data.tx_id = db_data.transactions[length-1].id
  delete data.tokenInfo;
  insertTx(data)
    .then((result) => {
      sendHive(result.hiveUsername, result.value, result.transactionHash)
    })
    .catch((err) => {
      logger.debug.error(err);
    })
}

function insertTx(data){
  return new Promise((resolve, reject) => {
    database.collection("transactions").insertOne(data, (err, result) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function sendHive(to, value, hash){
  const tx = JSON.stringify([
      {
        contractName: 'tokens',
        contractAction: 'transfer',
        contractPayload: {
          symbol: "WEED",
          to: to,
          quantity: parseFloat(value).toFixed(8),
          memo: `${parseFloat(value).toFixed(8)} wWEED converted! Tx hash: ${hash}`
        }
      }
  ]);
  const op = {
    id: 'ssc-mainnet-hive',
    json: tx,
    required_auths: [config.hiveAccount],
    required_posting_auths: [],
  };
  const key = dhive.PrivateKey.fromString(config.hivePrivateKey);
  client.broadcast
    .json(op, key)
    .then(res => console.log(`Converted ${value} WEED sent to ${to}!`))
    .catch((err) => {
      logger.debug.error(err)
      logToDatabase(err, `Failed to send ${parseFloat(value).toFixed(8)} wWEED to ${to} for tranasction: ${hash}`)
    });
}

function logToDatabase(err, message){
  mongo.get().db("ETH-HIVE").collection("errors").insertOne({type: "payment-withdraw", error: err, message: message}, (err, result) => {
    if (err) logger.debug.error(err)
    else console.log("Error was stored to database!")
    })
}

module.exports.processTokenTransfer = processTokenTransfer
