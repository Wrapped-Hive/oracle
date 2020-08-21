const axios = require('axios');
const config = require("../config/config.js")
var logger = require('./logs/logger.js');

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("status")

async function calculate(){
  getRecomendedGasPrice()
    .then((result) => {
      let eth_fee = (result * 80000) / 1000000000 //gas price * gas limit / 1000000000 = ETH
      return getHiveInEth(eth_fee)
    })
    .then((result) => {
      let hive_fee = result.fee / result.price
      saveToDataBase(hive_fee)
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

function getHiveInEth(eth_fee){
  return new Promise((resolve, reject) => {
    axios
      .get('https://api.coingecko.com/api/v3/coins/hive')
      .then((result) => {
        resolve({price: result.data.market_data.current_price.eth, fee: eth_fee})
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function saveToDataBase(hive_fee){
  database.updateOne({type: 'fee'}, {$set: {fee: parseFloat(hive_fee).toFixed(3)}}, {upsert: true}, (err, result) => {
    if (err) logger.debug.error(err)
  })
}

module.exports.calculate = calculate
