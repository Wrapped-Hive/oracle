const axios = require('axios');
const config = require("../config/config.js")
var logger = require('./logs/logger.js');

const API_THROTTLE_MS = 60000; // one minute
const API_KEY = config.ethplorer_api;
const TRANSFERS_LIMIT = 25;
const TOKEN_API_URL = config.token_api_url;

async function start(callback) {
  setInterval(() => {
    console.log("Tracking")
    axios
      .get(
        `${TOKEN_API_URL}/${config.contractAddress}?apiKey=${API_KEY}` +
          `&type=transfer&limit=${TRANSFERS_LIMIT}`
      )
      .then(response => {
        response.data.operations.forEach(op => {
          if(op.type == 'transfer') callback(op);
        });
      })
      .catch(err => {
        logger.debug.error(err)
      });
  }, API_THROTTLE_MS + randomInt(0, 10000));
}

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low) + low);
}

module.exports.start = start
