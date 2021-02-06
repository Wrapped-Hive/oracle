require('dotenv').config()
var express =  require("express");
var app = express();
var bodyParser = require("body-parser");
var toobusy = require('node-toobusy');
var serveStatic = require('serve-static')
var path = require('path')
const rateLimit = require("express-rate-limit");

const db = require('../database/mongo.js');
const track = require("./track.js");

db.connect()
  .then(() => console.log('Mongodb connected!'))
  .then(() => main())
  .catch((e) => {
      console.error(e);
      process.exit(1);
  });

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(function(req, res, next) {
  if (toobusy()) res.status(503).send("I'm busy right now, sorry.");
  else next();
});
app.disable('x-powered-by');
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
app.use(serveStatic(path.join(__dirname, 'frontend')))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(limiter);

function main() {
  const deposit = require("./deposit.js");
  const transfers = require("./token_transfers.js");
  const calculate_fee = require("./calculate_fee.js");
  const bsc_conversions = require("./bsc/trackConversions.js")

  deposit.start() //start scanning HIVE for deposits

  track.start((result) => { //start checking token transactions
    transfers.processTokenTransfer(result)
  })

  bsc_conversions.checkForConversions()
  setInterval(() => {
    bsc_conversions.checkForConversions()
  }, 1000 * 60)

  calculate_fee.calculate()
  setInterval(() => {
    calculate_fee.calculate()
  }, 1000 * 60 * 60)

  app.use('/create', require('./create_new_withdraw.js'));
  app.use('/get_addresses', require('./api/get_addresses.js'));
  app.use('/ping', require('./api/ping.js'));
  app.use('/status', require('./api/status.js'));
  app.use('/balances', require('./api/get_whive_balances.js'));
  app.use('/coingecko', require('./api/coingecko.js'))
  app.listen(8080)
}
