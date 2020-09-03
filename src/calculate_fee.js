const axios = require('axios');
const config = require("../config/config.js")
var logger = require('./logs/logger.js');

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("status")

async function calculate(){
  getRecomendedGasPrice()
    .then((result) => {
      let eth_fee = (result * 150000) / 1000000000 //gas price * gas limit / 1000000000 = ETH
      return getLeoInEth(eth_fee)
    })
    .then((result) => {
      let hive_fee = result.fee / result.price
      saveToDatabase(hive_fee)
    })
    .catch((err) => {
      logger.debug.error(err)
    })
}

function getRecomendedGasPrice(){
  return new Promise((resolve, reject) => {
    axios
      .get(`https://ethgasstation.info/api/ethgasAPI.json?api-key=${config.ethgasstation_api}`)
      .then(response => {
        if (response.data.average &&  typeof response.data.average == "number") resolve(response.data.average / 10) //safeLow
        else reject("ethgasstation data is not number")
      })
      .catch(err => {
        logger.debug.error(err)
        reject(err)
      });
  })
}

function getLeoInEth(eth_fee){
  return new Promise((resolve, reject) => {
    axios
      .get('http://localhost:8080/price')
      .then((result) => {
        resolve({price: result.data.current_eth_price, fee: eth_fee})
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function saveToDatabase(hive_fee){
  database.updateOne({type: 'leo_fee'}, {$set: {fee: parseFloat(hive_fee).toFixed(3)}}, {upsert: true}, (err, result) => {
    if (err) logger.debug.error(err)
  })
}

module.exports.calculate = calculate
