const express = require('express');
const querystring = require('querystring');
const request = require('request');
const colors = require('colors');
const bodyParser = require('body-parser');

const port = process.env.PORT || 8080

colors.setTheme({
	silly: 'rainbow',
	input: 'grey',
	verbose: 'cyan',
	prompt: 'grey',
	info: 'green',
	data: 'grey',
	help: 'cyan',
	warn: 'yellow',
	debug: 'blue',
	error: 'red'
});

const app = express();

app.use(bodyParser.urlencoded({
	extended: false
}))

app.get('/', function(req, res) {
	res.status(200).send("Paypal IPN Listener");
	res.end('Response will be available on console, nothing to look here!');
});

app.post('/', function(req, res) {
	console.log('Received POST /'.bold);
	console.log(req.body);
	console.log('\n\n');

	// STEP 1: read POST data
	req.body = req.body || {};
	res.status(200).send('OK');
	res.end();

	// read the IPN message sent from PayPal and prepend 'cmd=_notify-validate'
  //var postreq = 'cmd=_notify-validate';
  
  console.log('type of body : ' + typeof(req.body));

  const formUrlEncodedBody = querystring.stringify(req.body);
  // Build the body of the verification post message by prefixing 'cmd=_notify-validate'.
  const postreq = `cmd=_notify-validate&${formUrlEncodedBody}`;

  /*
	for (var key in req.body) {
		if (req.body.hasOwnProperty(key)) {
			var value = querystring.escape(req.body[key]);
			postreq = postreq + "&" + key + "=" + value;
		}
  }*/

	// Step 2: POST IPN data back to PayPal to validate
	console.log('Posting back to paypal'.bold);
	console.log(postreq);
	console.log('\n\n');
	var options = {
		url: 'https://www.sandbox.paypal.com/cgi-bin/webscr',
		method: 'POST',
		headers: {
			'Connection': 'close'
		},
		body: postreq,
		strictSSL: true,
		rejectUnauthorized: false,
		requestCert: true,
		agent: false
	};

	request(options, function callback(error, response, body) {
		if (!error && response.statusCode === 200) {

			// inspect IPN validation result and act accordingly
			if (body.substring(0, 8) === 'VERIFIED') {
				// The IPN is verified, process it
				console.log('Verified IPN!'.green);
				console.log('\n\n');

				// assign posted variables to local variables
				var item_name = req.body['item_name'];
				var item_number = req.body['item_number'];
				var payment_status = req.body['payment_status'];
				var payment_amount = req.body['mc_gross'];
				var payment_currency = req.body['mc_currency'];
				var txn_id = req.body['txn_id'];
				var receiver_email = req.body['receiver_email'];
				var payer_email = req.body['payer_email'];

				//Lets check a variable
				console.log("Checking variable".bold);
				console.log("payment_status:", payment_status)
				console.log('\n\n');

				// IPN message values depend upon the type of notification sent.
				// To loop through the &_POST array and print the NV pairs to the screen:
				console.log('Printing all key-value pairs...'.bold)
				for (var key in req.body) {
					if (req.body.hasOwnProperty(key)) {
						var value = req.body[key];
						console.log(key + "=" + value);
					}
				}

			} else if (body.substring(0, 7) === 'INVALID') {
				// IPN invalid, log for manual investigation
				console.log('Invalid IPN!'.error);
				console.log('\n\n');
			}
		}
	});
});

app.listen(port);
var msg = 'Listening at http://localhost:' + port;
console.log(msg.green.bold);