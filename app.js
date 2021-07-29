
const URL_BASE = "https://mtoken-test.zap.me/";
const WS_URL = "https://mtoken-test.zap.me/paydb";

var REBATE_FACTOR = 0.05;
var qrCodeObj = null;
var email;
var photo;
var photoType;
// will be init later
var postPayDb;
var referralConditions;
var urlParamsSet;

function doStorage() {
  //localStorage.clear();
  //location.reload(true);
  var apiKey = '';
  var apiSecret = '';
  var chosenAssetTicker = '';
  var setUp = JSON.parse(localStorage.getItem("keys"));
  if (setUp !== null) {
      apiKey = setUp["apikey"];
      apiSecret = setUp["secret"];
      chosenAssetTicker = setUp["asset_ticker"];
  }
  Swal.fire(
      {
	 title: "POS setup",
	 allowEnterKey: true,
	 allowOutsideClick: false,
	 showCancelButton: true,
	 html: `
<form>
  <div class="form-group">
    <label for="apikey-input">Api Key</label>
    <input type='text' id='apikey-input' class='form-control' value='${apiKey}' placeholder='api key'>
  </div>
  <br/>
  <div class="form-group">
    <label for="secret-input">Api Secret</label>
    <input type='text' id='secret-input' class='form-control' value='${apiSecret}' placeholder='api secret'>
  </div>
  <br/>
  <div class="form-group">
    <label for="rebate-input">Rebate (%)</label>
    <input type='text' id='rebate-input' class='form-control' value='${Math.floor(REBATE_FACTOR * 100)}' placeholder='rebate %'>
  </div>
  <br/>
  <div class="form-group">
    <label for="ticker-input">Asset</label>
    <input type='text' id='ticker-input' class='form-control' value='${chosenAssetTicker}' placeholder='asset name'>
  </div>
</form>
    `,
	 preConfirm: function() {
	   const apiKey = Swal.getPopup().querySelector("#apikey-input").value;
	   const secretPrem  = Swal.getPopup().querySelector("#secret-input").value;
           const rebatePercentage = Swal.getPopup().querySelector("#rebate-input").value;
           const newAssetTicker = Swal.getPopup().querySelector("#ticker-input").value;
	     if(!apiKey || !secretPrem) {
	       Swal.showValidationMessage('Please enter all keys');
		}
		localStorage.setItem("keys", JSON.stringify({apikey: apiKey, secret: secretPrem, rebate_percentage: rebatePercentage, asset_ticker: newAssetTicker}));
	      }
	    }
	  ).then(
	    function(res){
	      if(res.isConfirmed) {
		location.reload(true);
	      }
	    }
	  );
}

const showReferralConditions = function() {
  document.querySelector("form").insertAdjacentHTML("beforeend",`
    <div class="alert alert-dark shadow-lg mt-3" role="alert">
      Spend ${referralConditions.recipient_min_spend / 100} to recieve ${referralConditions.reward_recipient / 100}
    </div> 
  `);
}

const doReferral = function() {
  Swal.fire(
    {
      title: "Claim referral",
      allowEnterKey: true,
      allowOutsideClick: false,
      showCancelButton: true,
      html: `<input type='text' id='referral-code' class='swal2-input' placeholder='referral code'>`,
      preConfirm: function() {
	const referralToken = Swal.getPopup().querySelector("#referral-code").value;
	if(!referralToken) {
	  Swal.showValidationMessage('Please enter a referral code');
	} else {
	  return referralToken;
	}
      },
    }
  ).then((res) => {
    if(res.isConfirmed) {
      postPayDb('reward/referral_validate', {token: res.value})
      .then(
	function(results) {
	  referralConditions = results.referral;
	  showReferralConditions();
	}
      );
    }
  });
}

window.addEventListener("keydown",
  function(e) {
    console.log("key pressed!");
    if(e.key === "Escape") {
      console.log("escaped");
      var confirmButton = document.querySelector(".swal2-confirm");
      if(confirmButton) {
	console.log("there is a confirm btn");
	confirmButton.click();
      }
    }
  }
);
window.addEventListener("mousedown", 
  function(e) {
    var popUp = document.querySelector(".swal2-popup");
    if(popUp) {
      if (popUp !== e.target && !popUp.contains(e.target)) {
	var cancelButton = document.querySelector(".swal2-cancel");
	if(cancelButton !== null && (cancelButton.getAttribute("style") !== "display: none;")) {
	  cancelButton.click();
	} else {
	  document.querySelector(".swal2-confirm").click();
	}
      }
    }
  }
);

function updateQr() {
    var length = document.querySelector(".card").getBoundingClientRect().width;
    document.querySelector(".qr-holder").setAttribute("style", `width: ${length}px; height: ${length}px;`);
    var logoSrc = "data:image/png;base64," + photo;
    //TODO if photoType =- 'svg'
    var amount = parseFloat(document.querySelector('#input-amount').value) * 100;
    var invoiceid = document.querySelector('#input-invoiceid').value;
    var code = `premiofrankie://${email}?amount=${amount}&attachment={"invoiceid":"${invoiceid}"}`;
    if (qrCodeObj !== null)
      qrCodeObj.makeCode(code);
    else {
      var qrOptions = {text: code, logo: logoSrc, width: length, height: length};
      document.querySelector(".qr-holder").innerHTML="";
      qrCodeObj = new QRCode(document.querySelector(".qr-holder"), qrOptions);
    }
}

function inputChange(event) {
    updateQr();
}

function initPage() {
  const screenWidth = window.screen.width;
  if(screenWidth <= 768) {
   document.querySelector(".card").style.width = `${screenWidth * 0.8}px`; 
  }
  const socket = io(WS_URL);
  const keysResult = JSON.parse(localStorage.getItem("keys"));
  const apikey = keysResult["apikey"];
  const apisecret = keysResult["secret"];
  REBATE_FACTOR = parseFloat(keysResult["rebate_percentage"]) ? (parseFloat(keysResult["rebate_percentage"]) / 100 ) : REBATE_FACTOR;
  const currentAsset = keysResult["asset_ticker"];
  document.querySelector("#amount-label").innerText = `amount (${currentAsset})`;
  document.querySelector('#input-amount').addEventListener('input', inputChange);
  document.querySelector('#input-invoiceid').addEventListener('input', inputChange);
  if(urlParamsSet) {
    document.querySelector('#input-amount').value = `${urlParamsSet.amount}`;
    document.querySelector('#input-invoiceid').value = `${urlParamsSet.invoiceid}`;
  }
  document.querySelector(".qr-holder").innerHTML=`
    <div class="sk-cube-grid">
      <div class="sk-cube sk-cube1"></div>
      <div class="sk-cube sk-cube2"></div>
      <div class="sk-cube sk-cube3"></div>
      <div class="sk-cube sk-cube4"></div>
      <div class="sk-cube sk-cube5"></div>
      <div class="sk-cube sk-cube6"></div>
      <div class="sk-cube sk-cube7"></div>
      <div class="sk-cube sk-cube8"></div>
      <div class="sk-cube sk-cube9"></div>
    </div>
  `;
  function nonce() {
      return Math.floor(new Date().getTime() / 1000);
  }

  function sign(data) {
      var hash = CryptoJS.HmacSHA256(data, apisecret);
      return CryptoJS.enc.Base64.stringify(hash);
  }

  postPayDb = async function(endpoint, params) {
      params['api_key'] = apikey;
      params['nonce'] = nonce();
      var body = JSON.stringify(params);
      console.log(body);

      var sig = sign(body);
      console.log(sig);

      const response = await fetch(URL_BASE + endpoint, {
	  method: 'POST',
	  headers: {'Content-Type': 'application/json', 'X-Signature': sig},
	  body: body
      });
      console.log(response.status);
  
      return await response.json();
  }

  socket.on('connect', () => {
      console.log('socket connected, id', socket.id);
      // create auth data
      var nonce_ = nonce();
      var sig = sign(nonce_.toString());
      auth = {signature: sig, api_key: apikey, nonce: nonce_};
      // emit auth message
      socket.emit('auth', auth);
  });
  

  socket.on("info", (arg) => {
      console.log(arg);
  });
  
  socket.on('tx', (arg) => {
      var referralClaimed = false;
      console.log(arg);
      var tx = JSON.parse(arg);
      //if is merchant && correct invoice id
      if (tx.recipient == email && JSON.parse(tx.attachment).invoiceid == document.querySelector("#input-invoiceid").value) {
	if(parseFloat(document.querySelector("#input-amount").value * 100) == tx.amount) {
	  if (referralConditions) {
	    if(referralConditions.reward_recipient_type === "fixed") {
	      // if amount sent is referral requirement && sender is referral recipient
	      if (tx.amount >= referralConditions.recipient_min_spend && tx.sender === referralConditions.recipient) {
                referralClaimed = true;    
		postPayDb("reward/referral_claim",{token: referralConditions.token}).then(
		  function(results) {
		    Swal.fire(
		      {
			title: "Referral claimed!",
			text: "Successfully claimed referral",
			icon: "success"
		      }
		    );
		  }
		);
	      }
	    }
	  }
          if(!referralClaimed) {
	    Swal.fire(
	      {
		title: 'Transaction Receieved!',
		text: arg,
		icon: 'success',
		allowEscapeKey: false,
		stopKeydownPropagation: false,
		allowOutsideClick: false
	      }).then(
	      function(result) {
		if(result.isConfirmed) {
		  var scannedRebateEmail;
		  Swal.fire(
		    {
		      title: "Give rebate",
		      html: `<input type='email' id='email-input' class='swal2-input' placeholder='email'>`,
		      showCancelButton: true,
		      denyButtonText: "Scan email QR",
		      showDenyButton: true,
		      preConfirm: function() {
			const rebateEmail = Swal.getPopup().querySelector("#email-input").value;
			if(!rebateEmail) {
			  Swal.showValidationMessage('please enter an email');
			}
			return rebateEmail; 
		      }
		    }
		  ).then(
		      async function(emailInput) {
			if(emailInput.isConfirmed) {return emailInput}
			if(emailInput.isDenied) {
			//executed if clicked scan QR
			await Swal.fire( {
			  title: "Scan email QR",
			  html: `<video class="qr-input-stream"></video>`,
			  willOpen: function() {
			    const qrScanner = new QrScanner(document.querySelector(".qr-input-stream"), function(result) {
			      console.log(`result is ${result}`);
			      scannedRebateEmail = result;
			      document.querySelector(".swal2-confirm").click();

			    });
			    qrScanner.start();
			  },

			  preConfirm: function() {
			    console.log(`scannedRebateEmail is ${scannedRebateEmail}`);
			    return scannedRebateEmail;
			  },

			} ); 
		       } else {
			 return false;
		       }
		      }
		    
		  ).then((res)=>{
		    if(res !== false) {
		      if(res === undefined) {res = {value: scannedRebateEmail}}
		      var amountValue = Math.floor(tx.amount * REBATE_FACTOR);
		      postPayDb('payment_create', {reason: "rebate", recipient: res.value, amount: amountValue, category: "testing", message: 1})
		      .then(
			function(result) {
			  if(res.value != undefined) {
			    console.log("sent");
			    Swal.fire('Rebate sent!', `Sent ${amountValue / 100}`, 'success');
			  } 
			}
		      );

		    }
		    
		  });
		}
	      }
	    );

          }
	//otherwise, amount not correct, so update QR to include remaining amount:
	} else {
	  Swal.fire(
	    {
	      icon: "error", 
	      allowEnterKey: true,
	      title: "Insufficient amount",
	      text: "The QR code has been updated. Please send the remaining amount" 
	    }

	  ).then(
	    function(result) {
	      if(result.isConfirmed) {
		document.querySelector('#input-amount').value = parseFloat(parseFloat(document.querySelector('#input-amount').value) - (tx.amount / 100));
		updateQr();
	      }
	    }
	  );
	}
	console.log("recieved");
      }
  });

  postPayDb('paydb/user_info', {email: null}).then(
    function(res) {
      console.log(JSON.stringify(res));
      if (res.message === "authentication failed") {
	Swal.fire("Authentication error", "Please reconnect with correct keys", "error").then(
	  function() {
	    doStorage();
	  }
	);

      }
      email = res.email;
      photo = res.photo;
      photoType = res.photo_type;
      updateQr();
    }
  );
}

window.onload = async function() {
  const urlParams = window.location.search.substr(1);
  const queryParams = urlParams.split('&').reduce((accumulator, singleQueryParam) => {
    const [key, value] = singleQueryParam.split('=');
    accumulator[key] = decodeURIComponent(value);
    return accumulator;
  }, {});
  if(urlParams.length != 0) {
    urlParamsSet = queryParams;
    console.log("There are query params!");
  }
  console.log(queryParams);
  var length = window.innerWidth * 0.25
  document.querySelector(".qr-holder").setAttribute("style", `width: ${length}px; height: ${length}px;`);
  if(localStorage.getItem("keys") == null) {
    doStorage();
  } else {
    initPage();
  }
  document.getElementById("button-referral").addEventListener("click", doReferral);
  document.getElementById("button-storage").addEventListener("click", doStorage);
};
