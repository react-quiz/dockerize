// Type definitions for node-quickbooks 2.0.0
// Project: https://github.com/mcohen01/node-quickbooks/blob/master/package.json
// Definitions by: Dung Huynh <https://github.com/jellydn/>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />
/// <reference path="../moment/moment.d.ts"/>
/// <reference path="../bluebird/bluebird.d.ts"/>
/// <reference path="../node-uuid/node-uuid.d.ts"/>
/// <reference path="../underscore/underscore.d.ts"/>

declare module 'node-quickbooks' {
    namespace quickbooks {
        export interface QuickBooks {
            REQUEST_TOKEN_URL : string;
            ACCESS_TOKEN_URL : string;
            APP_CENTER_BASE : string;
            APP_CENTER_URL : string;
            RECONNECT_URL : string;
            V3_ENDPOINT_BASE_URL : string;
            PAYMENTS_API_BASE_URL : string;
            QUERY_OPERATORS : string;
            new(consumerKey:string, consumerSecret:string, token:string, tokenSecret:string, realmId:string, useSandbox:boolean, debug:boolean);
        }
    }
    var qb:quickbooks.QuickBooks;
    export = qb;
}
