const express = require('express')
var router = express.Router();
const axios = require('axios');

const config = require("../../config/config.js")
const mongo = require("../../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("status")

router.get("/", async (req, res) => {
  var maxAmount = config.max_amount < 0 ? undefined : config.max_amount
  res.status(200).json({
    deposit: config.hiveAccount,
    minAmount: config.min_amount,
    maxAmount: maxAmount,
    contract: config.contractAddress,
    fee: await getFee(),
    balance: await getBalance()
  })
})

function getFee(){
  return new Promise((resolve, reject) => {
    database.findOne({type: "leo_fee"}, (err, result) => {
      if (err) reject(err)
      else resolve(result.fee)
      })
  })
}

function getBalance(){
  return new Promise((resolve, reject) => {
    axios.post('https://api.hive-engine.com/rpc/contracts', {
      "jsonrpc": "2.0",
      "method": "find",
      "params": {
        "contract": "tokens",
        "table": "balances",
        "query": {
           "symbol": "LEO",
           "account": config.hiveAccount
        }
      },
      "id": 1
    })
    .then(function (response) {
      resolve(response.data.result[0].balance)
    })
    .catch(function (error) {
      resolve('error')
      console.log(error);
    });
  })
}

module.exports = router;
