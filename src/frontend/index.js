var deposit_account;
var min_amount;
var max_amount;
var fee;

function getConfig(){
  $.ajax({
    url : '/status',
    type : 'GET',
    dataType:'json',
    success : function(data) {
      deposit_account = data.deposit
      min_amount = data.minAmount
      max_amount = data.maxAmount
      fee = data.fee
    },
    error : function(request,error){
        alert("Failed to get data from server :(");
    }
  });
}

async function isEthereumAddressCorrect(){
  await getConfig()
  var web3 = new Web3(Web3.givenProvider || "ws://localhost:8546");
  try {
    let raw_address = document.getElementById("eth").value
    const address = web3.utils.toChecksumAddress(raw_address)
    document.getElementById("invalid_eth_address").innerHTML = ''
    processHiveDeposit(address)
  } catch(e) {
    console.error('Invalid ethereum address:', e.message)
    document.getElementById("invalid_eth_address").innerHTML = 'Please provide a valid Ethereum address.'
  }
}

function processHiveDeposit(address){
  Swal.fire({
    text: 'How much LEO would you like to deposit?',
    input: 'text',
  }).then(async function(result) {
    if (!isNaN(result.value)) {
      const amount = parseFloat(result.value).toFixed(3)
      if (amount > max_amount || amount < min_amount) alert("Max amount is "+max_amount+" and min amount is "+min_amount)
      else {
        Swal.fire({text: 'You will receive a minimum of '+(Number(amount) - Number(fee))+' WLEO (part of the "fee reservation"  will be refunded)!', showCancelButton: true,}).then((isConfirmed) => {
          if (isConfirmed.isConfirmed){
            if(window.hive_keychain) {
              requestKeychain(amount, address)
            } else {
              requestHiveSigner(amount, address)
            }
          }
        })
      }
    } else alert("use numbers")
  })
}

function requestKeychain(amount, address){
  let json = {
    contractName: 'tokens',
    contractAction: 'transfer',
    contractPayload: {
      symbol: "LEO",
      to: 'wrapped-leo',
      quantity: amount,
      memo: address
    }
  }
  hive_keychain.requestCustomJson('', 'ssc-mainnet-hive', 'Active', json, 'LEO transfer', function(response) {
  	console.log(response);
  });
}

function requestHiveSigner(amount, address){
  alert("HiveSigner is not supported, please use Hive Keychain or manual transfer.")
  // let url = `https://hivesigner.com/sign/transfer?to=wrapped-hive&amount=${amount} HIVE&memo=${address}`
	// var win = window.open(url, '_blank');
  // win.focus();;
}

function displayDetails(){
  $.ajax({
    url : '/create',
    type : 'POST',
    data: {
      username: document.getElementById("hive").value
    },
    dataType:'json',
    success : function(data) {
      if(data.success){
        console.log(JSON.stringify(data))
        var html = `<div class="row">
          <div class="col-md-2">
          </div>
          <div class="col-md-8">
            <div class="main-card mb-3 card">
              <div class="card-body"><h4 class="card-title">Deposit details</h4>
                <p>ID: ${data.id}</p>
                <p>Address: ${data.address} <i class="fa fa-copy" onClick="copy('${data.address}')"></i></p>
                <p>Expiration: ${new Date(data.expiration)}</p>
                <button class="mt-1 btn" onClick='requestMetaMask("${data.address}")'><img srcset="/assets/images/metamask.png 10x"></button>
              </div>
            </div>
          </div>
          <div class="col-md-2">
          </div>
        </div>`
        document.getElementById('deposit_data').innerHTML = html
      } else {
        alert("Error, please try again!")
      }
    },
    error : function(request,error){
        alert("Failed to get data from server :(");
    }
  });
}

function copy(address){
  navigator.clipboard.writeText(address);
}

document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem("disclaimer") != 'true'){
    Swal.fire({
      title: 'Disclaimer',
      html: "This app is still in beta, use at your own risk!<br><small>You will not see this message again</small>",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'I understand!'
    }).then((result) => {
      if (result.value) {
        localStorage.setItem("disclaimer", 'true');
      } else {
        window.location.href = "http://hive.io";
      }
    })
  }
}, false);

async function requestMetaMask(deposit_address){
  if (typeof window.ethereum !== 'undefined') {
    let accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const account = accounts[0];
    Swal.fire({
      text: 'How much WHIVE would you like to send?',
      input: 'text'
    }).then(function(result) {
      if (!isNaN(result.value)) {
        const amount = parseFloat(result.value).toFixed(3)
        sendTx(account, deposit_address, amount)
      } else alert("use numbers")
    })
  } else {
    alert("MetaMask is not installed!")
  }
}

async function sendTx(account, deposit_address, amount){
  let abiArray = await getAbiArray()
  const Web3 = window.Web3;
  const web3 = new Web3(window.web3.currentProvider);
  var contract = new web3.eth.Contract(abiArray, '0x352c0f76cfd34ab3a2724ef67f46cf4d3f61192b');
  const contractFunction = contract.methods.transfer(deposit_address, amount * 1000);
  const functionAbi = contractFunction.encodeABI();
  const transactionParameters = {
    nonce: '0x00', // ignored by MetaMask
    to: '0x352c0f76cfd34ab3a2724ef67f46cf4d3f61192b', // Required except during contract publications.
    from: account, // must match user's active address.
    data: functionAbi, // Optional, but used for defining smart contract creation and interaction.
    chainId: 1, // Used to prevent transaction reuse across blockchains. Auto-filled by MetaMask.
  };

  // txHash is a hex string
  // As with any RPC call, it may throw an error
  const txHash = await ethereum.request({
    method: 'eth_sendTransaction',
    params: [transactionParameters],
  });
}

function getAbiArray(){
  return [{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isPauser","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renouncePauser","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"addPauser","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"addMinter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"renounceMinter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"isMinter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"}],"name":"MinterAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"}],"name":"MinterRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"}],"name":"PauserAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"account","type":"address"}],"name":"PauserRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"}]

}
