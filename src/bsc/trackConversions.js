const Web3 = require("web3")
const web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org/'));

const abiArray = require("../abi_bsc.js")
const config = require("../../config/config.js")
const mongo = require("../../database/mongo.js")
const { Hive } = require('@splinterlands/hive-interface');
const hive = new Hive({rpc_error_limit: 5});

let processedTransactions = []

function checkForConversions(){
  checkEvents()
    .then((result) => {
      for (i in result){
        let isInDatabase = await isAlreadyInTheDatabase(result[i].transactionHash)
        if (!isInDatabase && !processedTransactions.includes(result[i].transactionHash)){
          processedTransactions.push(result[i].transactionHash)
          addTransactionToDatabase(result[i].transactionHash)
          sendTokens({
            username: result[i].returnValues.username,
            amount: result[i].returnValues.amount / 1000,
            hash: result[i].transactionHash
          })
        }
      }
    })
}

function sendTokens(conversionData){
  const tx = {
    from: config.bscAccount,
    to: conversionData.username,
    amount: parseFloat(conversionData.amount).toFixed(3),
    memo: `${parseFloat(conversionData.amount).toFixed(3)} tokens converted! Tx hash: ${conversionData.hash}`
  }
  const key = dhive.PrivateKey.fromString(process.env.PRIVATE_HIVE_KEY_BSC);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(`BSC tokens converted, ${conversionData.amount} sent to ${conversionData.username} for ${conversionData.hash}`))
    .catch((err) => {
      console.log(err)
      logToDatabase(err, `Error while sending ${amount} refund for ${to}`)
    });
}

function checkEvents(){
  return new Promise(async (resolve, reject) => {
    let currentBlockNumber = await web3.eth.getBlockNumber();
    let lastProcessedBlock = await getLastProcesedBlock()
    let fromBlock = lastProcessedBlock;
    let toBlock = currentBlockNumber - 12 //wait 12 confirmations
    let contract = new web3.eth.Contract(abiArray.abi, config.contractAddress_bsc);
    let pastEvents = await contract.getPastEvents("convertToken", {}, { fromBlock: fromBlock, toBlock: toBlock })
    resolve(pastEvents)
  })
}

async function isAlreadyInTheDatabase(hash){
  return new Promise(async (resolve, reject) => {
     mongo.get().db("ETH-HIVE").collection("ethereum_transactions").findOne({ transactionHash: hash }, (err, result) => {
      if (err) reject(err)
      else if (result == undefined) resolve(false)
      else resolve(true)
    })
  })
}

function addTransactionToDatabase(hash){
   mongo.get().db("ETH-HIVE").collection("ethereum_transactions").insertOne({ transactionHash: hash }, (err, result) => {
    if (err) console.log(err)
  })
}

function getLastProcesedBlock(){
  return new Promise(async (resolve, reject) => {
    mongo.get().db("ETH-HIVE").collection("status").findOne({ type: "last_processed_block" }, (err, result) => {
      if (err) reject(err)
      else resolve(result.block)
    })
  })
}

module.exports.checkForConversions = checkForConversions
