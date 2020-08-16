const dhive = require("@hiveio/dhive")
const axios = require('axios');

const mongo = require("../../database/mongo.js")
const database = mongo.get().db("ETH-HIVE")

const config = require("../../config/config.js")
var client = new dhive.Client(config.hive_api_nodes)

var logger = require('../logs/logger.js');

function process(tx, hash, deposit_address){
  getValidatorNodes()
    .then((result) =>  {
      if (result == null) submitTransaction(tx) //no other validators in the network
      else requestValidatorSignatures(tx, hash, deposit_address, result)
    })
    .catch((err) => {
      logger.debug.error(err)
    })
}

function getValidatorNodes(){
  return new Promise((resolve, reject) => {
    database.collection("nodes").find({}, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

async function submitTransaction(tx){
  const transaction = client.broadcast.sign(tx, dsteem.PrivateKey.from(config.hivePrivateKey));
  const sendTransaction = await client.broadcast.send(transaction);
  console.log(transaction)
}

async function requestValidatorSignatures(tx, hash, deposit_address, nodes){
  var transaction = client.broadcast.sign(tx, dsteem.PrivateKey.from(config.hivePrivateKey));

  callValidatorNode(nodes[0].address, transaction, hash, deposit_address, transaction.signatures.length, 0)
  //use recursion
  function callValidatorNode(node, transaction, hash, deposit_address, current_signatures, i){
    axios
      .post(node, {
        transaction: transaction,
        ethereum_hash: hash,
        deposit_address: deposit_address
      })
      .then((result) => {
        if (result.signed_transaction.signatures.length == current_signatures + 1){
          callValidatorNode(nodes[i++].address, result.signed_transaction, hash, deposit_address, transaction.signatures.length, i++)
        } else {

        }
      })
      .catch((err)  => {

      })
  }
}

module.exports.process = process
