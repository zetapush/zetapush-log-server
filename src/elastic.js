const elasticsearch = require('elasticsearch');
const APP_CONFIG = require('./config');

const esClient = new elasticsearch.Client({
  host: APP_CONFIG.elatic.host,
  log: APP_CONFIG.elatic.log,
});

module.exports = esClient;
