const mongo = require("../../database/mongo.js")
const express = require('express')
var router = express.Router();

const config = require("../../config/config.js")
var abiArray = require("../abi.js")

const Web3 = require("web3")
var web3 = new Web3(new Web3.providers.HttpProvider(config.ethEndpoint));

router.get("/", (req, res) => {
  if (!req.query.apiKey || req.query.apiKey != config.coingecko_api){
    res.status(401).json({success: false, message: 'Wrong API key'})
  } else {
    getAddresses()
      .then((result) => {
        return getAddressBalance(result)
      })
      .then(async (result) => {
        let array = result.sort(function(a, b) {
          return a.index - b.index;
        });
        let balance = 0
        for (i in array){
          balance += Number(array[i].balance)
        }
        let supply = await getSupply()
        res.status(200).json({success: true, message: "Success", curculating_supply: Number(parseFloat(supply - balance).toFixed(3)), full_supply: supply, burnable_balance: balance})
      })
      .catch((err) => {
        console.log(err)
      })
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
        let object = {address: address, balance: result/1000}
        resolve(object)
      })
  })
}

async function getSupply(){
  var totalSupplyHex = web3.utils.sha3('totalSupply()').substring(0,10);
  var contractAddress = config.contractAddress;
  var totalSupplyCall = getDataObj(contractAddress, totalSupplyHex, []);
  var totalSupply = await web3.eth.call(totalSupplyCall);
  return parseInt(totalSupply, 16) / 1000; //to decimal and to 3 decimal places
}

function getDataObj(to, func, arrVals) {
  var val = "";
  for (var i = 0; i < arrVals.length; i++) val += this.padLeft(arrVals[i], 64);
  return {
    to: to,
    data: func + val
  };
}


module.exports = router;
