const bip39 = require('bip39')
const hdkey = require('hdkey')
const ethUtil = require('ethereumjs-util')

const mongo = require("../../database/mongo.js")
mongo.connect()
  .then(res => start())


function start(){
  console.log("Starting...")
    const database = mongo.get().db("ETH-HIVE").collection("addresses")
    getAddresses(database)
}

function getAddresses(database){
  return new Promise((resolve, reject) => {
    database.countDocuments(async (err, result) =>  {
      if (err) console.log('ERROR: '+err)
      else {
        const seed = await bip39.mnemonicToSeed(process.env.SEED)
        const root = await hdkey.fromMasterSeed(seed)
        for (let i = 0; i < result; i++){
          var path = `m/44'/60'/0'/0/${i}`; //bip39 address index starts with 0, count with 1
          const addrNode = root.derive(path)
          const pubKey = ethUtil.privateToPublic(addrNode._privateKey)
          const addr = '0x' + ethUtil.publicToAddress(pubKey).toString('hex');
          const address = ethUtil.toChecksumAddress(addr)
          console.log(`-----\nIndex: ${i}\nAddress: ${address.toString('hex')} \nPublic key: ${pubKey.toString('hex')} \nPrivate key: ${addrNode._privateKey.toString('hex')}\n-----`)
        }
        process.exit(1);
      }
    })
  })
}
