
import mongoose = require("mongoose");
import _ = require("lodash");
import async = require("async");
import moment = require("moment-timezone");
import qs = require("querystring");
import request = require("request");
import express = require("express");
import http = require("http");

let Feed = mongoose.model('Feed');
let config = require("../../config/config"),
    logger = require("../../config/logger");

export declare interface FeedDataSchema extends mongoose.Document {
    companyId: string;
    message: string;
    created: string;
    deleted: boolean;
}

/**
 * Fetch feed for real time channel
 * @param  {any}              req  [description]
 * @param  {express.Response} res  [description]
 * @return [FeedDataSchema]               [description]
 */
export function fetchFeeds(req: any, res: express.Response) {
    let limit: number = req.params.limit || 150;
    let companyId: string = req.companyId;
    Feed.find({ companyId: companyId })
        .sort({ created: -1 })
        .limit(limit)
        .exec(function(err, feeds: FeedDataSchema) {
            if (err) {
                logger.warn('error in fetchFeeds: feed.server.controller.js');
                logger.error(err);
                return res.status(500).send({ message: err.message });
            }
            else {
                res.json(feeds);
            }
        });
}

/**
 * add feed for real time channel
 * @param  {FeedDataSchema} feed     [description]
 * @param  {any}            callback [description]
 * @return {[type]}                  [description]
 */
export function addFeed(feed: FeedDataSchema, callback: any) {

    var dbFeed = new Feed(feed);
    dbFeed.save(function(err, feed) {
        if (err) {
            logger.warn('error in addFeed: feed.server.controller.js');
            logger.error(err);
        }
        return callback && callback(feed);
    });
}
