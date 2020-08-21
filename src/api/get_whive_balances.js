const mongo = require("../../database/mongo.js")
const express = require('express')
var router = express.Router();
const NodeCache = require( "node-cache" );

const config = require("../../config/config.js")
var abiArray = require("../abi.js")

const Web3 = require("web3")
var web3 = new Web3(new Web3.providers.HttpProvider(config.ethEndpoint));

const myCache = new NodeCache( { stdTTL: 100, checkperiod: 120 } );

router.get("/", (req, res) => {
  value = myCache.get( "balances" );
  if (value == undefined){
    getAddresses()
      .then((result) => {
        return getAddressBalance(result)
      })
      .then((result) => {
        let array = result.sort(function(a, b) {
          return a.index - b.index;
        });
        let balance = 0
        for (i in array){
          balance += Number(array[i].balance)
        }
        obj = { my: "balances", variable: array };
        cache = myCache.set( "balances", obj, 3600 );
        res.status(200).json({success: true, message: "Success", balance: balance, data: array})
      })
      .catch((err) => {
        console.log(err)
      })
  } else {
    let balance = 0
    for (i in value.variable){
      balance += Number(value.variable[i].balance)
    }
    res.status(200).json({success: true, message: "Success", balance: balance, data: value.variable})
  }
})

function getAddresses(){
  return new Promise((resolve, reject) => {
    const database = mongo.get().db("ETH-HIVE").collection("addresses")
    try {
      database
        .find()
        .toArray((err, result) => {
          let addresses = []
          for (i in result) addresses.push(result[i].address)
          resolve(addresses)
        })
    } catch (err){
      reject(err)
    }
  })
}

async function getAddressBalance(addresses){
  return new Promise((resolve, reject) => {
    var contract = new web3.eth.Contract(abiArray.abi, config.contractAddress);
    var balances = []
    let a = 0
    addresses.forEach(function(item, i) {
      getBalance(addresses[i], contract)
        .then((result) => {
          balances.push({address: addresses[i], balance: Number(result.balance), index: i})
          a++
        })
    })
    setInterval(() => {if (a == addresses.length) resolve(balances)}, 1000)
  })
}

function getBalance(address, contract){
  return new Promise(async (resolve, reject) => {
    contract.methods.balanceOf(address).call()
      .then((result) => {
        let object = {address: address, balance: result}
        resolve(object)
      })
  })
}


module.exports = router;
