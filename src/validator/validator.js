var express =  require("express");
var app = express();
var bodyParser = require("body-parser");
const hive  = require('@hiveio/hive-js')

const config = {
  account: 'fbslo',
  hivePrivateKey: "private_key"
}

app.disable('x-powered-by');
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/sign", (req, res) => {
  console.log('request is here')
  if (!req.body.tx && !req.body.trxId && !req.body.type) res.status(401).json({success: false, message: "missing_data"})
  else {
    hive.api.getTransaction(req.body.trxId, function(err, result) {
      if (err) res.status(500).json({success: false, message: "internal_server_error"})
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
    isAlreadyProcessed(trxid, tx)
      .then((result) => {
        if (result == false) return verifyTransactionDetails(result, tx, type)
      })
      .then(async (result) => {
        let isSent = await signTransaction(tx)
        if (isSent == true) resolve()
        else reject(isSent)
      })
      .catch((err) => { reject(err) })
  })
}

function isAlreadyProcessed(trxId, tx){
  return new Promise((resolve, reject) => {
    resolve(false);
  })
}

function verifyTransactionDetails(result, tx, type){
  return new  Promise((resolve, reject) => {
    if (result.operations[0][0] == 'transfer' && result.operations[0][1].to == config.account && result.operations[0][1].from == tx.operations[0][1].to){
      resolve(true)
    } else reject('wrong_details')
  })
}

async function signTransaction(tx){
  const signMultisig = await client.broadcast.sign(tx, dhive.PrivateKey.from(config.hivePrivateKey));
  const send = await client.broadcast.send(signMultisig);
  return send;
}

app.listen(56000)
