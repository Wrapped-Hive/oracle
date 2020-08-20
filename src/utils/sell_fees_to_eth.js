const dhive = require("@hiveio/dhive")

const config = require("../../config/config.js")
var client = new dhive.Client(config.hive_api_nodes)

async function start(){
  let account = await client.database.getAccounts([config.fee_account])
  if(Number(account[0].balance.split(" ")[0]) > 25) sendToBlocktrades(account[0].balance)
}

function sendToBlocktrades(amount){
  let memo = 'ddb34a16-6b5e-4836-b5e3-05adc77b2c00'
  const tx = {
    from: config.fee_account,
    to: 'blocktrades',
    amount: amount,
    memo: memo
  }
  const key = dhive.PrivateKey.fromString(config.fee_account_private_key);
  const op = ["transfer", tx];
  client.broadcast
    .sendOperations([op], key)
    .then(res => console.log(amount + ' sent to blocktrades.'))
    .catch(err => logger.debug.error(err));
}

start()
