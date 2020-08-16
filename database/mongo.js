const { MongoClient } = require('mongodb');

var config = require('../config/config.js')

let connection = null;

module.exports.connect = () => new Promise((resolve, reject) => {
  MongoClient.connect(config.mongodb, { useUnifiedTopology: true }, function(err, db) {
    if (err) { reject(err); return; };
    resolve(db);
    connection = db;
  });
});

module.exports.get = () => {
  if(!connection) {
      throw new Error('Call connect first!');
  }
  return connection;
}
