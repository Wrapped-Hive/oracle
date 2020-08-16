const log4js = require('log4js');

log4js.configure({
  appenders: { debug: { type: "file", filename: "./src/logs/logs.log" } },
  categories: { default: { appenders: ["debug"], level: "debug" } }
});

module.exports = {
  debug: log4js.getLogger('debug')
};
