const dhive = require("@hiveio/dhive")
const config = require("../config/config.js")
const axios = require('axios');
const hive  = require('@hiveio/hive-js')
const hiveTx = require('hive-tx')

var client = new dhive.Client(config.hive_api_nodes);
var logger = require('./logs/logger.js');

const mongo = require("../database/mongo.js")
const database = mongo.get().db("ETH-HIVE")

async function sign(to, amount, memo, trxId, type){
  const expireTime=1000*3590;
  const props = await client.database.getDynamicGlobalProperties();
  const ref_block_num = props.head_block_number & 0xFFFF;
  const ref_block_prefix = Buffer.from(props.head_block_id, 'hex').readUInt32LE(4);
  const expiration = new Date(Date.now() + expireTime).toISOString().slice(0, -5);
  const extensions = [];
  const operations= [['transfer',
                   {'amount': amount,
                    'from': config.hiveAccount,
                    'memo': memo,
                    'to': to}]];
  const tx = {
              expiration,
              extensions,
              operations,
              ref_block_num,
              ref_block_prefix,
          }

  // const signMultisig = new hiveTx.Transaction()
  // await signMultisig.create(operations, expiration = 3590)
  // const privateKey = hiveTx.PrivateKey.from(config.hivePrivateKey)
  // await signMultisig.sign(privateKey)
  const signMultisig = hive.auth.signTransaction(tx, [config.hivePrivateKey]); //client.broadcast.sign(tx, dhive.PrivateKey.from(config.hivePrivateKey));

  axios.post(config.validators[0], {
    tx: signMultisig,
    trxId: trxId,
    type: type
  })
  .then(function (response) {
    console.log(response.data)
    if (response.data.success == true){
      verifyTransaction(response.data.trxId, to, amount, memo)
    } else {
      console.log(response.data);
      logger.debug.error(response.data)
      logToDatabase(response.data, `Error receiving valid confirmation from multisignature request.`)
    }
  })
  .catch(function (error) {
    console.log(error);
    logger.debug.error(error)
    logToDatabase(error, `Error sending multisignature request.`)
  });
}

function verifTransaction(trxId,to, amount, memo){
  hive.api.getTransaction(trxId, function(err, result) {
    if (err) logToDatabase(err, 'Error checking transaction status.')
    else {
      if (result.operations[0][0] == 'transfer' && result.operations[0][1].to == to && result.operations[0][1].amouunt == amount && result.operations[0][1].memo == memo){
        console.log("transaction "+trxId+" is valid!")
      } else logToDatabase(trxId, 'Multisig transaction does not mmatch requested data.')
    }
  });
}

function logToDatabase(err, message){
  mongo.get().db("ETH-HIVE").collection("errors").insertOne({type: "multisignature", error: err, message: message}, (err, result) => {
    if (err) logger.debug.error(err)
    else console.log("Error was stored to database!")
    })
}


module.exports.sign = sign
