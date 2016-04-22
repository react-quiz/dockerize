'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Quiz = mongoose.model('Quiz'),
    jwt = require('jsonwebtoken'),
  _ = require('lodash');
/**
 * Get the error message from error object
 */
var getErrorMessage = function (err) {
  var message = '';

  if (err.code) {
    switch (err.code) {
      case 11000:
      case 11001:
        message = 'Username already exists';
        break;
      default:
        message = 'Something went wrong';
    }
  } else {
    for (var errName in err.errors) {
      if (err.errors[errName].message) message = err.errors[errName].message;
    }
  }

  return message;
};

/**
 * Signin after passport authentication
 */
exports.signin = function (req, res, next) {
    // TODO: THIS ISN'T USED!!!! DELETE IT.   IT IS IN CONTACT
  User.findOne({
    email: req.body.email
  }, function(err, user) {

    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {

      // check if password matches
      if (user.password != req.body.password) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {

        // if user is found and password is right
        // create a token
        var token = jwt.sign(user, 'secret', {
          expiresInMinutes: 1440 // expires in 24 hours
        });

        // return the information including token as JSON
        res.json({
          success: true,
          message: 'Enjoy your token!',
          token: token
        });
      }

    }

  });
};

/**
 * Update user details
 */
exports.update = function (req, res) {
  // Init Variables
  var user = req.user;
  var message = null;

  if (user) {
    // Merge existing user
    user = _.extend(user, req.body);
    user.updated = Date.now();
    user.displayName = user.firstName + ' ' + user.lastName;
    user.company = req.user.company;

    user.save(function (err) {
      if (err) {
        return res.status(400).send({
          message: getErrorMessage(err)
        });
      } else {
        res.jsonp(user);
        /*req.login(user, function(err) {
         if (err) {
         res.status(400).send({message: err.message});
         } else {
         res.jsonp(user);
         }
         });*/
      }
    });
  } else {
    res.status(400).send({
      message: 'User is not signed in'
    });
  }
};

exports.read = function (req, res) {
  res.jsonp(req.profile);
};

/**
 * Signout
 */
exports.signout = function (req, res) {
  req.logout();
  res.redirect('/login');
};

exports.apiSignout = function (req, res) {
    req.logout();
    res.send(200);
};

/**
 * Send User
 */
exports.me = function (req, res) {
  res.jsonp(req.user || null);
};

/**
 * User middleware
 */
exports.userByID = function (req, res, next, id) {
  User.findById(id).exec(function (err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('Failed to load User ' + id));
    req.profile = user;
    next();
  });
};

/**
 * List of Quiz
 */
exports.list = function (req, res) {
  Quiz.find().exec(function (err, users) {
    if (err) {
      return res.status(400).send({
        message: getErrorMessage(err)
      });
    } else {
      res.jsonp(users);
    }
  });
};

exports.create = function (req, res) {
  var user = new User(req.body);
  user.company = req.companyId;

  user.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: getErrorMessage(err)
      });
    } else {
      res.jsonp(user);
    }
  });
};

exports.delete = function (req, res) {
  var user = req.user;
  user.company = req.user.company;

  /*user.remove(function (err) {*/
  user.update({deleted: true},function(err) {
    if (err) {
      return res.status(400).send({
        message: getErrorMessage(err)
      });
    } else {
      res.jsonp(user);
    }
  });
};
