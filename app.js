
const URL_BASE = "https://premio-demo.caprover.acuerdo.dev/"
const WS_URL = "https://premio-demo.caprover.acuerdo.dev/paydb"

const REBATE_FACTOR = 0.05;
var qrCodeObj = null;
var email;
var photo;
var photoType;
// will be init later
var postPayDb;
var referralConditions;
var urlParamsSet;

function resetStorage() {
  //localStorage.clear();
  //location.reload(true);
  var setUp = JSON.parse(localStorage.getItem("keys"));
  var apiKey = setUp["apikey"];
  var apiSecret = setUp["secret"];
  Swal.fire(
      {
	 title: "POS setup",
	 allowEnterKey: true,
	 allowOutsideClick: false,
	 showCancelButton: true,
	 html: `<input type='text' id='apikey-input' class='swal2-input' value='${apiKey}'><input type='text' id='secret-input' class='swal2-input' value='${apiSecret}'>`,
	 preConfirm: function() {
	   const apiKey = Swal.getPopup().querySelector("#apikey-input").value;
	   const secretPrem  = Swal.getPopup().querySelector("#secret-input").value;
	     if(!apiKey || !secretPrem) {
	       Swal.showValidationMessage('Please enter all keys');
		}
		localStorage.setItem("keys", JSON.stringify({apikey: apiKey, secret: secretPrem}));
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
    var length = window.innerWidth * 0.25;
    document.querySelector(".qr-holder").setAttribute("style", `width: ${length}; height: ${length};`);
    var logoSrc = "data:image/png;base64," + photo;
    //TODO if photoType =- 'svg'
    var amount = parseFloat(document.querySelector('#input-amount').value) * 100;
    var invoiceid = document.querySelector('#input-invoiceid').value;
    var code = `premiopay://${email}?amount=${amount}&attachment={"invoiceid":"${invoiceid}"}`;
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
  const socket = io(WS_URL);
  const keysResult = JSON.parse(localStorage.getItem("keys"));
  const apikey = keysResult["apikey"];
  const apisecret = keysResult["secret"];
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
      console.log(arg);
      var tx = JSON.parse(arg);
      //if is merchant && correct invoice id
      if (tx.recipient == email && JSON.parse(tx.attachment).invoiceid == document.querySelector("#input-invoiceid").value) {
	if(parseFloat(document.querySelector("#input-amount").value * 100) == tx.amount) {
	  if (referralConditions) {
	    if(referralConditions.reward_recipient_type === "fixed") {
	      // if amount sent is referral requirement && sender is referral recipient
	      if (tx.amount >= referralConditions.recipient_min_spend && tx.sender === referralConditions.recipient) {
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
	    resetStorage();
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
  Particles.init({
    selector: '.particle-section',
    maxParticles: 180,
    connectParticles: true,
  });
  if(localStorage.getItem("keys") == null) {
    (Swal.fire(
      {
	 title: "POS setup",
	 allowEnterKey: true,
	 allowOutsideClick: false,
	 html: `<input type='text' id='apikey-input' class='swal2-input' placeholder='premio api-key'><input type='text' id='secret-input' class='swal2-input' placeholder='premio secret'>`,
	 preConfirm: function() {
	   const apiKey = Swal.getPopup().querySelector("#apikey-input").value;
	   const secretPrem  = Swal.getPopup().querySelector("#secret-input").value;
	     if(!apiKey || !secretPrem) {
	       Swal.showValidationMessage('Please enter all keys');
		}
		localStorage.setItem("keys", JSON.stringify({apikey: apiKey, secret: secretPrem}));
	      }
	    }
	  ).then(
	    function() {initPage();}
	  ));
  } else {
    initPage();
  }
};
