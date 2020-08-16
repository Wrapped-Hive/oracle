const dhive = require("@hiveio/dhive")

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE")

const config = require("../config/config.js")
var client = new dhive.Client(config.hive_api_nodes)

var logger = require('./logs/logger.js');
const multisig = require("./master_node/multisig.js")

async function processTokenTransfer(data){
  database.collection("addresses").findOne({ $text: { $search: data.to, $caseSensitive: false } }, (err, result) => {
    if (err) logger.debug.error(err);
    else if (result == null) console.log("Address not ours")
    else isTxAlreadyProcessed(data, result)
  })
}

function isTxAlreadyProcessed(tx_data, db_data){
  database.collection('transactions').findOne({transactionHash: tx_data.transactionHash}, (err, result) => {
    if (err) logger.debug.error(err);
    else if (result != null) console.log("Tx already processed.")
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
      sendHive(result.hiveUsername, result.value, result.transactionHash, result.to)
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

async function sendHive(to, value, hash, deposit_address){
  const expireTime=1000*3590;
  const props = await client.database.getDynamicGlobalProperties();
  const ref_block_num = props.head_block_number & 0xFFFF;
  const ref_block_prefix = Buffer.from(props.head_block_id, 'hex').readUInt32LE(4);
  const expiration = new Date(Date.now() + expireTime).toISOString().slice(0, -5);
  const extensions = [];
  const operations= [['transfer',
                   {
                    'amount': parseFloat(value).toFixed(3)+' HIVE',
                    'from': config.hiveAccount,
                    'memo': `${parseFloat(value).toFixed(3)} HIVE converted! Transaction hash: ${hash}`,
                    'to': to
                  }]];
  const tx = {
              expiration,
              extensions,
              operations,
              ref_block_num,
              ref_block_prefix,
          }
  addNewMultiSigToDatabase(tx, hash, deposit_address)
  multisig.process(tx, hash, deposit_address)
}

function addNewMultiSigToDatabase(tx, hash, deposit){
  database.collection("multisig").insertOne({transaction: tx, ethereumHash: hash, timestamp: new Date().getTime(), date: new Date(), deposit_address: deposit}, (err, result) => {
    if (err) logger.debug.error(err)
  })
}

module.exports.processTokenTransfer = processTokenTransfer
