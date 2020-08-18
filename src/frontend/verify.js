function getConfig(cb){
  $.ajax({
    url : '/status',
    type : 'GET',
    dataType:'json',
    success : function(data) {
      cb(data.deposit, data.contract)
    },
    error : function(request,error){
        alert("Failed to get data from server :(");
    }
  });
}

function getEthAddresses(cb){
  $.ajax({
    url : '/get_addresses',
    type : 'GET',
    dataType:'json',
    success : function(data) {
      cb(data.addresses)
    },
    error : function(request,error){
        alert("Failed to get data from server :(");
    }
  });
}

function getTotalSupply(contract, cb){
  $.ajax({
    url : 'https://api.ethplorer.io/getTokenInfo/'+contract+'?apiKey=freekey',
    type : 'GET',
    dataType:'json',
    success : function(data) {
      cb(data.totalSupply)
    },
    error : function(request,error){
        alert("Failed to get data from server :(");
    }
  });
}

async function getBalance(){
  getConfig((account, contract) => {
    hive.api.getAccounts([account], function(err, result) {
      if (err) alert("Error getting data!")
      else {
        let number = result[0].balance.split('.')
        document.getElementById("hive_balance").innerHTML = number[0] + '<small>.'+number[1]+'</small>'
        document.getElementById("hive_account").innerHTML = '<a href="https://hiveblocks.com/@'+account+'">@'+account+'</a>'
        ethBalance(contract)
      }
    });
  })
}

function ethBalance(contract){
  getEthAddresses((addresses) => {
    for (i in addresses){
      document.getElementById('eth_addresses').innerHTML += '<li class="list-group-item"><a href="https://etherscan.io/address/'+addresses[i]+'">'+addresses[i]+'</a></li>'
    }
    getTotalSupply(contract, (supply) => {
      supply = Number(supply) / 1000
      getProjectTokens(addresses, contract, supply)
    })
  })
}

async function getProjectTokens(addresses, contract, supply){
  let balance = 0
  for (i in addresses){
    balance += await getBalanceForAddress(addresses[i], contract)
  }
  console.log(supply - Number(balance))
  let number_1 = parseFloat(supply - Number(balance)).toFixed(3)
  let number = number_1.split('.')
  document.getElementById("whive_balance").innerHTML = number[0] + '<small>.'+number[1]+'</small>'
}

function getBalanceForAddress(address, contract){
  return new Promise((resolve, reject) => {
    $.ajax({
      url : 'https://api.ethplorer.io/getAddressInfo/'+address+'?token='+contract+'&apiKey=freekey',
      type : 'GET',
      dataType:'json',
      success : function(data) {
        if(data.countTxs == 0) resolve(0)
        else if (data.tokens[0]) resolve(data.tokens[0].balance / 1000)
      },
      error : function(request,error){
        reject(error)
      }
    });
  })
}

setTimeout(() => {
  getBalance()
}, 1000)
