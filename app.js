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

const sendConfirmationEmail = (email) => {
	// send mail with defined transport object
	//console.log('Sending email...');
	// setup email data with unicode symbols
	const mailOptions = {
		from: MAIL_ADDR, // sender address
		to: email, // list of receivers
		subject: 'Payment OK ✔', // Subject line
		//text: 'Hello world1?', // plain text body
		html: '<b>Payment OK</b>' // html body
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
					sendConfirmationEmail(payment.owner_email);
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