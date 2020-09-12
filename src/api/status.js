const express = require('express')
var router = express.Router();

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
    fee: await getFee()
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

module.exports = router;
