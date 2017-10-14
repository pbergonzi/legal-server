const express = require('express');
const querystring = require('querystring');
const request = require('request');
const colors = require('colors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const MongoClient = require('mongodb').MongoClient;
const zlib = require('zlib');

const MONGODB_CONN = process.env.MONGODB_CONN || 'mongodb://pbergonzi:abritta1@ds019966.mlab.com:19966/morci';
const PAYPAL_URL = process.env.PAYPAL_URL || 'https://www.sandbox.paypal.com/cgi-bin/webscr';
const MAIL_USER = process.env.MAIL_USER || 'infoattorney';
const MAIL_PASS = process.env.MAIL_PASS || '1234567';
const MAIL_ADDR = process.env.MAIL_ADDR || 'info@attorney-assistance.com';
const MAIL_SMTP = process.env.MAIL_SMTP || 'smtp.webfaction.com';
const MAIL_PORT = process.env.MAIL_PORT || 465;
const MAIL_SECURE = process.env.MAIL_SECURE || true;

const port = process.env.PORT || 8080;

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
}));
app.use(bodyParser.json());

const account = { user: MAIL_USER, pass: MAIL_PASS };
const smtp = {host: MAIL_SMTP, port: MAIL_PORT, secure: MAIL_SECURE };

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
	host: smtp.host,
	port: smtp.port,
	secure: smtp.secure, // true for 465, false for other ports
	auth: {
		user: account.user,
		pass: account.pass
	}
});

const toLegibleDate = (strIsoDate) => {
	const isoDate = new Date(strIsoDate);
	const legibleDate = ("0" + (isoDate.getMonth() + 1)).slice(-2) + "-" + ("0" + isoDate.getDate()).slice(-2) + "-" + isoDate.getFullYear();
	return legibleDate;
}

const sendConfirmationEmail = (payment) => {
	// send mail with defined transport object
	//console.log('Sending email...');
	// setup email data with unicode symbols
	
	const name = payment.owner_name;
	const passport = payment.owner_passport;
	const email = payment.owner_email;
	const pack = payment.item_name;
	const valid_from = toLegibleDate(payment.card_date_from);
	const valid_to = toLegibleDate(payment.card_date_to);
	const currency = payment.payment_currency;
	const ammount = payment.payment_amount;

	const mail = `
	<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"><html><head><META http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><div>
			<div bgcolor="#335781" style="background-color:#335781">
				  <img src="http://themonstera.com/aa-logo.png" alt="">
		  </div>
		  <h1 style="text-align:center;padding-top:35px">Welcome to Attorney Assistance</h1>
		  <p style="font-size:15px;margin-top:10px;margin-bottom:5px;text-align:justify;width:80%;margin-left:10%">
		  Thank you for choosing us as your personal attorneys in Argentina. We are glad to have you as our client, please check that your data is correct, if not, please contact us.
		  </p>
		  <div style="background-color:rgb(247,247,247);padding:20px;margin-top:30px;text-align:center">
			<div>
			  <img width="44px" style="padding-top:5px;padding-bottom:5px" src="http://themonstera.com/aa-footer.png">
			  <hr>
			  <table style="margin:0 auto">
				  <tr>
					  <td>
						  <img style="padding-left:10px;padding-right:10px" width="16px" src="http://themonstera.com/profile.png">
					  </td>
					  <td>
						  <b>Name:</b> ${name}<br>
						  <b>Passport:</b> ${passport} <br>
						  <b>Email:</b> ${email}<br>
					  </td>
				  </tr>
			  </table>
			  <hr>
			  <table style="margin:0 auto">
				  <tr>
					  <td>
						  <img style="padding-left:10px;padding-right:10px" width="16px" src="http://themonstera.com/info.png">
					  </td>
					  <td>
						  <b>Your Selection:</b> ${pack}<br>
						  <b>Valid from:</b> ${valid_from} to ${valid_to}<br>
						  <b>Price:</b> (${currency}) ${ammount}<br>
					  </td>
				  </tr>
			  </table>
			  <hr>
			  <h4 style="margin-bottom:5px">Contact Us</h4>
			  <a href="tel:+5491150061109" style="background-color:#ad2d1d;color:white;padding:9px 0;width:150px;margin:0 auto;border-radius:8px;text-decoration:none;display:block">+54 9 11 5006 1109</a>
			  <br>
			  <a href="mailto:contact@attorney-assistance.com" style="background-color:#ad2d1d;color:white;padding:9px 0;width:150px;margin:0 auto;border-radius:8px;text-decoration:none;display:block">contact@attorney-assistance.com</a>
			  
			  <hr>
			  <table style="margin:0 auto">
				<tr>
					<td>
					  <a href="http://www.facebook.com" target="_blank">
						  <img src="http://themonstera.com/facebook.png" style="padding-right:20px">
						</a>
					  </td>
					  <td>
					  <a href="http://www.twitter.com" target="_blank">
						  <img src="http://themonstera.com/twitter.png" style="padding-left:20px">
						</a>
					  </td>
				</tr>
			  </table>
			</div>
		  </div>
		  <div style="text-align:center">
			<img src="http://themonstera.com/bottom.png" style="margin-top:15px;width:100%">
		  </div>
		</div></body></html>`;
	
	const mailOptions = {
		from: MAIL_ADDR, // sender address
		to: email, // list of receivers
		subject: 'Attorney Assistance Payment Received ✔', // Subject line
		//text: 'Hello world1?', // plain text body
		html: mail // html body
	};

	transporter.sendMail(mailOptions, (error, info) => {
		if (error) {
			console.log('Email delivery failed'.red);
			return console.log(error);
		}
		//console.log(info);
		//console.log('Message sent: %s'.green, info.messageId);
	});
};

const isValidCard = (card) => {
	return (card.dateFrom && card.dateTo && card.packageName && card.ownerName && card.ownerPassport && card.ownerEmail);
};

const insertPayment = (paymentStatus) => {
	MongoClient.connect(MONGODB_CONN, function(err, db) {
		if(err) { return console.log(err); }
		//console.log('guardando en la db');
		const collection = db.collection('payments');
		collection.insert(paymentStatus);	
	});
};

const insertInvalidIPN = (log) => {
	MongoClient.connect(MONGODB_CONN, function(err, db) {
		if(err) { return console.log(err); }
		const collection = db.collection('notvalid');
		collection.insert(log);	
	});
};

// CORS header securiy
/*app.all('/*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
	res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
	next();
});*/

app.get('/', function(req, res) {
	res.status(200).send('Paypal IPN Listener');
	res.end('Response will be available on console, nothing to look here!');
	console.log(PAYPAL_URL);
});

/*app.get('/bye', function(req, res) {
	console.log(req.query);
	res.status(200).send("BYE");
	res.end('que se yo');
});
*/

/*
app.post('/card', function(req, res) {
	// Connect to the db
	res.status(200).send('OK');
	res.end();
	const card = req.body;
	if(isValidCard(card)){
		saveCard(card);
	}
});
*/

app.post('/', function(req, res) {
	//console.log('Received POST /'.bold);
	//console.log(req.body);
	//console.log('\n\n');

	// STEP 1: read POST data
	req.body = req.body || {};
	res.status(200).send('OK');
	res.end();

	// read the IPN message sent from PayPal and prepend 'cmd=_notify-validate'
	//var postreq = 'cmd=_notify-validate';
  
	//console.log('type of body : ' + typeof(req.body));

	const formUrlEncodedBody = querystring.stringify(req.body);
	// Build the body of the verification post message by prefixing 'cmd=_notify-validate'.
	const postreq = `cmd=_notify-validate&${formUrlEncodedBody}`;

  	/*
	for (var key in req.body) {
		if (req.body.hasOwnProperty(key)) {
			var value = querystring.escape(req.body[key]);
			postreq = postreq + "&" + key + "=" + value;
		}
	}
	*/

	// Step 2: POST IPN data back to PayPal to validate
	//console.log('Posting back to paypal'.bold);
	//console.log(postreq);
	//console.log('\n\n');
	var options = {
		url: PAYPAL_URL,
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
				//console.log('Verified IPN!'.green);
				//console.log('\n\n');
				
				// assign posted variables to local variables
				const item_name = req.body['item_name'];
				const item_number = req.body['item_number'];
				const payment_status = req.body['payment_status'];
				const payment_amount = req.body['mc_gross'];
				const payment_currency = req.body['mc_currency'];
				const txn_id = req.body['txn_id'];
				const receiver_email = req.body['receiver_email'];
				const payer_email = req.body['payer_email'];
				const gzipped_card = req.body['custom'];

				const buf = new Buffer(gzipped_card, 'base64');
				
				zlib.gunzip(buf, (error, buffer) => {
					if (error) throw error;
					
					const simpleCard = JSON.parse(buffer.toString('utf-8'));

					const payment = {
						txn_id: txn_id,
						payment_status: payment_status,
						item_number: item_number,
						item_name: simpleCard.packageName,
						payment_amount: payment_amount,
						payment_currency: payment_currency,
						payer_email: payer_email,
						owner_passport: simpleCard.ownerPassport,
						owner_email: simpleCard.ownerEmail,
						owner_name: simpleCard.ownerName,
						card_date_from: new Date(simpleCard.dateFrom),
						card_date_to: new Date(simpleCard.dateTo)
					};

					//console.log(payment);
					//console.log('mandando mail a ' + payment.owner_email);
					// send email
					sendConfirmationEmail(payment);
					// saving payment to the database
					insertPayment(payment);
				});

				//Lets check a variable
				//console.log("Checking variable".bold);
				//console.log("payment_status:", payment_status)
				//console.log('\n\n');

				// IPN message values depend upon the type of notification sent.
				// To loop through the &_POST array and print the NV pairs to the screen:
				/*console.log('Printing all key-value pairs...'.bold)
				for (var key in req.body) {
					if (req.body[key]) {
						var value = req.body[key];
						console.log(key + "=" + value);
					}
				}*/

			} else if (body.substring(0, 7) === 'INVALID') {
				// IPN invalid, log for manual investigation
				insertInvalidIPN(body);
				console.log('Invalid IPN!'.error);
				console.log('\n\n');
			}
		}
	});
});

app.listen(port);
const msg = 'Listening at port ' + port;
console.log(msg.green.bold);