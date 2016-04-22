'use strict';

var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env = process.env.NODE_ENV || 'development';

var config = {
  development: {
    root: rootPath,
    app: {
      name: process.env.APP_NAME || 'quiz'
    },
    port: process.env.NODE_PORT || 9091,
    siteURL: process.env.SITE_URL || 'http://localhost:9091', // api server url
    appURL: process.env.APP_URL || 'http://localhost:3010', // frontend server url
    db: process.env.MONGO_DB || 'mongodb://localhost/quiz'
  }
}

/**
 * Add our server node extensions
 */
require.extensions['.server.controller.js'] = require.extensions['.js'];
require.extensions['.server.helper.js'] = require.extensions['.js'];
require.extensions['.server.model.js'] = require.extensions['.js'];
require.extensions['.server.routes.js'] = require.extensions['.js'];

module.exports = config[env];
