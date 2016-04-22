'use strict';

var express = require('express');
var glob = require('glob');
var path = require('path');

var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compress = require('compression');
var methodOverride = require('method-override');
var cors = require('cors');

module.exports = function(app, config) {
  var env = process.env.NODE_ENV || 'development';
  app.locals.ENV = env;
  app.locals.ENV_DEVELOPMENT = env == 'development';

  app.use(function (err, req, res, next) {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500;
    res.end(res.sentry + '\n');
  });

  if(env == 'development'){
    app.set('view cache', false);
  }
  app.set('views', config.root + '/app/views');

  app.use(cors());
  app.options('*', cors()); // include before other routes
  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
  }));
  app.use(cookieParser());
  app.use(compress({
    filter: function (req, res) {
      return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
    },
    level: 9
  }));
  app.use(express.static(config.root + '/public'));
  app.use(methodOverride());

  var routes = glob.sync(config.root + '/app/routes/*.js');

  routes.forEach(function (routePath) {
    require(path.resolve(routePath))(app);
  });

  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  if(app.get('env') === 'development'){
    app.use(function (err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err,
        title: 'error'
      });
    });
  }

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: {},
        title: 'error'
      });
  });

};
