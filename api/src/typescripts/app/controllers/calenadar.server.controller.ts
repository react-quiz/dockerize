// import fs = require('fs');
import * as readline from "readline";
import * as express from "express";
import * as google from "googleapis";
import * as googleAuth from "google-auth-library"

let config = require("../../config/config"),
    logger = require("../../config/logger"),
    googleConfig = config.google,
    SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

export function callback(req: any, res: express.Response) {
    res.send('test');
}

export function login(req: any, res: express.Response) {
    let auth = new googleAuth(),
        oauth2Client = new auth.OAuth2(googleConfig.clientId, googleConfig.clientSecret, googleConfig.redirect_url);

    getNewToken(oauth2Client, listEvents);

    //console.log(oauth2Client);
    //googleAuth.OAuth2(11, 11, 11);
}

export function getNewToken(oauth2Client, callback) {
    let authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }

            console.log(token);

            oauth2Client.credentials = token;
            //storeToken(token);
            callback(oauth2Client);
        });
    });
}

export function listEvents(auth) {
    let calendar = google.calendar('v3');
    calendar.events.list({
        auth: auth,
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length == 0) {
            console.log('No upcoming events found.');
        } else {
            console.log('Upcoming 10 events:');
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var start = event.start.dateTime || event.start.date;
                console.log('%s - %s', start, event.summary);
            }
        }
    });
}
