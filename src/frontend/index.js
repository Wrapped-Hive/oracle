var deposit_account;
var min_amount;
var max_amount;

function getConfig(){
  $.ajax({
    url : '/status',
    type : 'GET',
    dataType:'json',
    success : function(data) {
      deposit_account = data.deposit
      min_amount = data.minAmount
      max_amount = data.maxAmount
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
    text: 'How much HIVE would you like to deposit?',
    input: 'text'
  }).then(function(result) {
    if (!isNaN(result.value)) {
      const amount = parseFloat(result.value).toFixed(3)
      if (amount > max_amount || amount < min_amount) alert("Max amount is "+max_amount+" and min amount is "+min_amount)
      else {
        if(window.hive_keychain) {
          requestKeychain(amount, address)
        } else {
          requestHiveSigner(amount, address)
        }
      }
    } else alert("use numbers")
  })
}

function requestKeychain(amount, address){
  hive_keychain.requestTransfer('', 'wrapped-hive', amount, address, 'HIVE', function(response) {
  	console.log(response);
  });
}

function requestHiveSigner(amount, address){
  let url = `https://hivesigner.com/sign/transfer?to=wrapped-hive&amount=${amount} HIVE&memo=${address}`
	var win = window.open(url, '_blank');
  win.focus();;
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
