const express = require('express')
var router = express.Router();
const { Client, Signature, cryptoUtils } = require('@hiveio/dhive');
var uuid = require('uuid-random');
const dhive = require("@hiveio/dhive")

const bip39 = require('bip39')
const hdkey = require('hdkey')
const ethUtil = require('ethereumjs-util')

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE").collection("addresses")

const config = require("../config/config.js")
var client = new Client(config.hive_api_nodes)
var logger = require('./logs/logger.js');

router.post("/", async (req, res) => {
  if(!req.body.username) res.status(200).json({success: false, message: "missing_username"})
  else {
    let isUsernameValid = await isHiveUsernameValid(req.body.username.toLowerCase())
    if (isUsernameValid == true){
      findAddressWithUsername(req.body.username.toLowerCase())
        .then((result) => {
          if (result == false){
            createNewTransaction(req.body.username.toLowerCase())
              .then((result) => {
                if (result == null) return createNewAddress(req.body.username.toLowerCase())
                else return reuseOldAddress(req.body.username.toLowerCase(), result)
              })
              .then((result) => {
                res.status(200).json({success: true, message: "transaction_created", id: result.id, address: result.address, expiration: result.expiration})
              })
          }
          else {
            let length = result.transactions.length
            res.status(200).json({success: true, message: "transaction_existing", id: result.transactions[length-1].id, address: result.address, expiration: result.transactions[length-1].expiration})
          }
        })
        .catch((err) => {
          logger.debug.error(err)
          res.status(500).json({success: false, message: "internal_server_error"})
        })
    } else {
      res.status(200).json({success: false, message: "hive_username_invalid"})
    }
  }
})

async function isHiveUsernameValid(username){
  const accounts = await client.database.call('lookup_accounts',[username, 1]);
  if (accounts[0] != username) return false
  else return true;
}

function findAddressWithUsername(username){
  let current_time = new Date().getTime()
  return new Promise((resolve, reject) => {
    database.findOne({ transactions: { $elemMatch: { hiveUsername: username, expiration: {$gt: current_time + 172800000} } } }, (err, result) => { //more than 2 days from expiration
      if (err) reject(err)
      else {
        if (result == null) resolve(false) //not found, create new address/reuse old one
        else  resolve(result) //user have assigned address
      }
    })
  })
}

function createNewTransaction(username){
  let current_time = new Date().getTime()
  return new Promise((resolve, reject) => {
    database.findOne({"transactions.expiration": {$not: {$gt: current_time}}}, (err, result) => {
      if (err) reject(err)
      else {
        resolve(result)
      }
    })
  })
}

async function createNewAddress(username, data){
  return new Promise(async (resolve, reject) => {
    try {
      const root = await hdkey.fromExtendedKey(config.xpub)
      database.countDocuments(async (err, result) =>  {
        if (err) reject(err)
        else {
          var path = `m/44'/60'/0'/0/${result}`; //bip39 address index starts with 0, count with 1
          const addrNode = await root.derive(path)
          const pubKey = await ethUtil.privateToPublic(addrNode._privateKey)
          const addr = '0x' + await ethUtil.publicToAddress(pubKey).toString('hex');
          const address = await ethUtil.toChecksumAddress(addr)
          insertIntoDatabase(address, username, data, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}

function insertIntoDatabase(address, username, data, callback){
  let tx = {
    id: uuid(),
    hiveUsername: username,
    created: new Date().getTime(),
    expiration: new Date().getTime() + 604800000
  }
  database.insertOne({address: address, transactions: [tx]}, (err, result) => {
    if (err) callback(err, null)
    else callback(null, {address: address, expiration: tx.expiration, id: tx.id})
  })
}

function reuseOldAddress(username, data){
  return new  Promise((resolve, reject) => {
    let address = data.address
    let tx = {
      id: uuid(),
      hiveUsername: username,
      created: new Date().getTime(),
      expiration: new Date().getTime() + 604800000
    }
    database.updateOne({address: data.address}, {$push: {transactions: tx}}, (err, result) => {
      if (err) reject(err)
      else {
        tx.address = data.address
        resolve(tx)
      }
    })
  })
}

module.exports = router;
