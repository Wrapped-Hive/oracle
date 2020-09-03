const express = require('express')
var router = express.Router();
const axios = require('axios');

router.get("/", async (req, res) => {
  let price = await getPrice("market", "buyBook", {"symbol":"LEO"}, 0)
  let eth = await getHiveInEth()
  res.json({
    token: "LEO",
    current_hive_price: Number(price[price.length - 1].price),
    current_eth_price: Number(parseFloat(eth * Number(price[price.length - 1].price)).toFixed(8))
  })
})

function getPrice(contract, table, query, offset){
  return new Promise((resolve, reject) => {
    let url = 'https://api.hive-engine.com/rpc/contracts'
    let params = {'contract':contract, 'table':table, 'query':query, 'limit':1000, 'offset':offset, 'indexes':[]}
    let request_body = {'jsonrpc':'2.0', 'id':1, 'method':'find', 'params':params}
    axios
      .post(url, request_body)
      .then(async (result) => {
        resolve(result.data.result)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function getHiveInEth(){
  return new Promise((resolve, reject) => {
    axios
      .get('https://api.coingecko.com/api/v3/coins/hive')
      .then((result) => {
        resolve(result.data.market_data.current_price.eth)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

module.exports = router;
