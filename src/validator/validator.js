var express =  require("express");
var app = express();
var bodyParser = require("body-parser");
const hive  = require('@hiveio/hive-js')
const dhive = require("@hiveio/dhive")
const config = require("../../config/config.js")
var client = new dhive.Client(config.hive_api_nodes);
const hiveTx = require('hive-tx')

app.disable('x-powered-by');
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/sign", (req, res) => {
  if (!req.body.tx && !req.body.trxId && !req.body.type) res.status(401).json({success: false, message: "missing_data"})
  else {
    hive.api.getTransaction(req.body.trxId, function(err, result) {
      if (err) console.log(err)//res.status(500).json({success: false, message: "internal_server_error", error: err});
      else {
        verifyTransaction(result, req.body.tx, req.body.type)
          .then((result) => res.status(200).json({success: true, trxId: result.transaction_id}))
          .catch(err =>  res.status(500).json({success: false, message: "internal_server_error", error: err}))
      }
    })
  }
})

function verifyTransaction(result, tx, type){
  return new Promise((resolve, reject) => {
    isAlreadyProcessed(result.transaction_id, tx)
      .then((isProcessed) => {
        if (isProcessed == false) return verifyTransactionDetails(result, tx, type)
      })
      .then(async (result) => {
        let isSent = await signTransaction(tx)
        if (isSent == true) resolve()
        else reject(isSent)
      })
      .catch((err) => {
        console.log(err)
        reject(err)
      })
  })
}

function isAlreadyProcessed(trxId, tx){
  return new Promise((resolve, reject) => {
    resolve(false);
  })
}

function verifyTransactionDetails(result, tx, type){
  return new  Promise((resolve, reject) => {
    if (result.operations[0][0] == 'transfer' && result.operations[0][1].to == config.hiveAccount && result.operations[0][1].from == tx.operations[0][1].to){
      resolve(true)
    } else reject('wrong_details')
  })
}

async function signTransaction(tx){
  // const privateKey = hiveTx.PrivateKey.from(config.validatorPrivateKey)
  // await tx.sign(privateKey)
  // console.log("transaction", tx)
  const signMultisig = hive.auth.signTransaction(tx, [config.validatorPrivateKey]);
  console.log(signMultisig)
  hive.api.broadcastTransactionSynchronous(signMultisig, function(err, result) {
    console.log(err, result);
  });
}

app.listen(56000)
