const Web3 = require("web3")
const config = require("../../config/config.js")
var web3 = new Web3(new Web3.providers.HttpProvider(config.ethEndpoint));

const mongo = require("../../database/mongo.js")
mongo.connect()
  .then((result) => {
    const database = mongo.get().db("ETH-HIVE").collection("status")
    start(database)
  })

async function start(database){
  let nonce = await web3.eth.getTransactionCount(config.ethereumAddress)

  database.findOne({type: "leo_nonce"}, (err, result) => {
    if (err) reject(err)
    else {
      database.updateOne({type: "leo_nonce"}, {$set: {nonce: Number(result.nonce) + 1}}, (err1, result1) => {
        if (err1) console.log(err1)
        else if (result1 != null) console.log('Nonce ' +result.nonce +' set!')
        else console.log('Nonce not found')
      })
    }
  })
}
