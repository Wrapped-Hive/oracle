const axios = require('axios');
const dhive = require("@hiveio/dhive")

const logger = require('./logs/logger.js');
const config = require("../config/config.js")

var client = new dhive.Client(config.hive_api_nodes);

async function createTransaction(to, amount, memo, tx_hash){
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
  const signMultisig = client.broadcast.sign(tx, dhive.PrivateKey.fromString(config.hivePrivateKey));
  sendToValidators(signMultisig, tx_hash)
    .then((result) => {
      broadcastTransaction(result, to)
    })
    .catch((err) => {
      logger.debug.error(err)
      sendErrorMessage(err, to)
    })
}

function sendToValidators(tx, tx_hash){
  return new Promise((resolve, reject)  => {
    ajax
    .post(config.validators[0], {
      transaction: tx,
      deposit_hash: tx_hash
    })
    .then((result) => {
      if (result.data.success == true) resolve(result.data.transaction)
      else reject('not_signed')
    })
    .catch((err)  => {
      reject(err)
    })
  })
}

async function broadcastTransaction(tx, to){
  try {
    const send = await client.broadcast.send(tx);
  } catch (err) {
    sendErrorMessage(err, to)
  }
}

function sendErrorMessage(err, to){
  const tx = {
    from: config.messages.account,
    to: to,
    amount: '0.001 HIVE',
    memo: `Error while sending transaction! Our team will resolve this ASAP!`
  }
  const key = dhive.PrivateKey.fromString(config.messages.private_key);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`Error message send to ${hive_user} for ${hash}`))
    .catch(err => logger.debug.error(err));
}

module.exports.createTransaction = createTransaction
