const mongo = require("../../database/mongo.js")
mongo.connect()
  .then(res => start())

const config = require("../../config/config.js")
var abiArray = require("../abi.js")

const Web3 = require("web3")
var web3 = new Web3(new Web3.providers.HttpProvider(config.ethEndpoint));

function start(){
  getAddresses()
    .then((result) => {
      return getAddressBalance(result)
    })
    .then((result) => {
      console.log(result)
    })
    .catch((err) => {
      console.log(err)
    })
}

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
          balances.push({address: addresses[i], balance: result.balance})
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


module.exports.start = start;
