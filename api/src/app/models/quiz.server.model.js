'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

/**
 * Quiz Schema
 */
var QuizSchema = new Schema({
	title: {
		type: String,
		trim: true,
		default: '',
		required: 'Please fill in title'
	}
}, { collection: 'quizs' });

/**
 * Hook a pre save method to hash the password
 */

mongoose.model('Quiz', QuizSchema);
