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
        document.getElementById("hive_balance").innerHTML = numberWithCommas(number[0]) + '<small>.'+number[1].split(" ")[0]+'</small>'
        document.getElementById("hive_account").innerHTML = '<a href="https://hiveblocks.com/@'+account+'" target="_blank">@'+account+'</a>'
        ethBalance(contract)
      }
    });
  })
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

function ethBalance(contract){
  getEthAddresses((addresses) => {
    for (i in addresses){
      document.getElementById('eth_addresses').innerHTML += '<li class="list-group-item"><a href="https://etherscan.io/address/'+addresses[i]+'" target="_blank">'+addresses[i]+'</a></li>'
    }
    getTotalSupply(contract, (supply) => {
      supply = Number(supply) / 1000
      getProjectTokens(addresses, contract, supply)
    })
  })
}

async function getProjectTokens(addresses, contract, supply){
  let balance = await getWhiveBalance()
  console.log(supply - Number(balance))
  let number_1 = parseFloat(supply - Number(balance)).toFixed(3)
  let number = number_1.split('.')
  document.getElementById("whive_balance").innerHTML = numberWithCommas(number[0]) + '<small>.'+number[1]+'</small>'
  getPrice(number_1)
}

function getWhiveBalance(){
  return  new Promise((resolve, reject)  => {
    $.ajax({
      url : '/balances',
      type : 'GET',
      dataType:'json',
      success : function(data) {
        resolve(data.balance)
      },
      error : function(request,error){
        alert("Failed to get data from server :(, some data might be inaccurate!");
        resolve(0)
      }
    });
  })
}

function getPrice(balance){
  $.ajax({
    url : 'https://api.coingecko.com/api/v3/coins/hive',
    type : 'GET',
    dataType:'json',
    success : function(data) {
      let number = parseFloat(data.market_data.current_price.usd).toFixed(3) * balance + ''
      let value = number.split('.')
      document.getElementById("price").innerHTML =numberWithCommas(value[0]) + '<small>.'+value[1]+'</small>'
    },
    error : function(request,error){
        alert("Failed to get data from server :(");
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  getBalance()
}, false);
