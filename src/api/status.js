const express = require('express')
var router = express.Router();

const config = require("../../config/config.js")

router.get("/", async (req, res) => {
  var maxAmount = config.max_amount < 0 ? undefined : config.max_amount
  res.status(200).json({
    deposit: config.hiveAccount,
    minAmount: config.min_amount,
    maxAmount: maxAmount,
    contract: config.contractAddress
  })
})

module.exports = router;
