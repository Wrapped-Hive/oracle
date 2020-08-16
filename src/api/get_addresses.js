const express = require('express')
var router = express.Router();
const axios = require('axios');

const mongo = require("../../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("addresses")

const config = require("../../config/config.js")
var logger = require('./../logs/logger.js');

router.get("/", async (req, res) => {
  getProjectAddresses()
    .then(async (result) => {
      res.status(200).json({success: true, message: 'success', addresses: result})
    })
    .catch((err) => {
      logger.debug.error(err)
      res.status(500).json({success: false, message: 'internal_server_error'})
    })
})

function getProjectAddresses(){
  return new Promise((resolve, reject) => {
    try {
      database
        .find()
        .toArray((err, result) => {
          let addresses = []
          for (i in result) addresses.push(result[i].address)
          resolve(addresses)
        })
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = router;
