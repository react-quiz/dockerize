'use strict';
require('dotenv').load();
var express = require('express'),
    config = require('./config/config'),
    glob = require('glob'),
    mongoose = require('mongoose');
//var    logger = require( './config/logger.js' );

console.log(config.db);
mongoose.connect(config.db);
var db = mongoose.connection;
db.on('error', function (err) {
	console.log(err);
    throw new Error('unable to connect to database at ' + config.db);
});
var models = glob.sync(config.root + '/app/models/*.js');
models.forEach(function (model) {
    require(model);
});

var app = express();

app.engine('html', require('swig').renderFile);
app.set('view engine', 'html');

require('./config/express')(app,config);

app.listen(config.port, function(err) {
console.log('Application started on port ' + config.port);
//  logger.warn('Application started on port ' + config.port)
});

module.exports = app
