import mongoose = require("mongoose");
import _ = require("lodash");
import async = require("async");
import moment = require("moment-timezone");
import qs = require("querystring");
import QuickBooks = require("node-quickbooks");
import request = require("request");
import express = require("express");
import http = require("http");
export declare interface CompanyDataSchema extends mongoose.Document {
    qboServices: {
        qboToken: string,
        qboTokenSecret: string,
        qboCompanyId: string,
        verifier: string,
        qboExpenseAccount: string,
    };
    creditCards: {
        name: String,
        qboId: String
    }[];
}
export declare interface WorkorderMaterialsSchema extends mongoose.Document {
    description: string;
    supplier: string;
    amount: number;
    url: string;
    card: string;
    createdDate: string;
    contactName: string;
    serviceType: string;
    qboId: string;
    qboSyncToken: string;
}
export declare interface PropertyDataSchema extends mongoose.Document {
    name: string;
    address: string;
    address2: string;
    city: string;
    data: string;
    state: string;
    postalCode: number;
    qbCustomerNo: string;
    latitude: number;
    longitude: number;
}
export declare interface ContactDataSchema extends mongoose.Document {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    qbCustomerNo: number;
    client: string
}
export declare interface ClientDataSchema extends mongoose.Document {
    name: string;
    email: string;
    qbCustomerNo: number;
}
export declare interface UnitDataSchema extends PropertyDataSchema {
}
export declare interface ServiceTypeDataSchema extends mongoose.Document {
    qboId: number;
    qboName: string;
    taxable: boolean;

}
export declare interface WorkorderSchema extends mongoose.Document {
    company: CompanyDataSchema;
    number: number;
    materials: WorkorderMaterialsSchema[];
    property: PropertyDataSchema;
    unit: UnitDataSchema;
    description: string;
    billing: {
        billingMethod: string,
        bidAmount: string,
        invoice: {
            qboId: string,
            description: string,
            amount: number,
            invoiceItems: {
                bill: string,
                qty: string,
                name: string,
                description: string,
                serviceType: ServiceTypeDataSchema
            }[]
        }
    };
}
let Client = mongoose.model("Client"),
    CommunicationEventLog = mongoose.model("CommunicationEventLog"),
    Company = mongoose.model("Company"),
    Contact = mongoose.model("Contact"),
    Estimate = mongoose.model("Estimate"),
    MaintainFeed = mongoose.model("MaintainFeed"),
    Project = mongoose.model("Project"),
    Property = mongoose.model("Property"),
    ServiceType = mongoose.model("ServiceType"),
    TimeClock = mongoose.model("TimeClock"),
    Unit = mongoose.model("Unit"),
    Vendor = mongoose.model("Vendor"),
    Workorder = mongoose.model("Workorder");

let communicationEngine = require("./communicationEngine.server.controller"),
    config = require("../../config/config"),
    logger = require("../../config/logger"),
    helper = require("./quickbooks.server.helper");
// improve req: express.REQUEST
export function qbConnect(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: qbConnect(req, res)");
    let companyId: string = req.params.companyId;
    request.post({
        url: QuickBooks.REQUEST_TOKEN_URL,
        oauth: {
            callback: config.siteURL + "/qb/callback/" + companyId,
            consumer_key: config.quickBooks.oAuthConsumerKey,
            consumer_secret: config.quickBooks.oAuthConsumerSecret
        }
    }, function(e: any, r: http.IncomingMessage, data: any) {
        if (e) {
            logger.error(e);
            return res.status(500).send({ message: e.message });
        }
        let requestToken = qs.parse(data);
        logger.debug(requestToken);
        if (typeof requestToken.oauth_token_secret === "undefined") {
            logger.error(requestToken);
            return res.status(500).send({ message: "You has error in token and key!" });
        }
        else {
            req.session.oauth_token_secret = requestToken.oauth_token_secret;
            return res.redirect(QuickBooks.APP_CENTER_URL + requestToken.oauth_token);

        }
    })
}

export function qbCallback(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: qbCallback(req, res)");
    let companyId: string = req.params.companyId;
    request.post({
        url: QuickBooks.ACCESS_TOKEN_URL,
        oauth: {
            consumer_key: config.quickBooks.oAuthConsumerKey,
            consumer_secret: config.quickBooks.oAuthConsumerSecret,
            token: req.query.oauth_token,
            token_secret: req.session.oauth_token_secret || req.query.oauth_token_secret,
            verifier: req.query.oauth_verifier,
            realmId: req.query.realmId || ""
        }
    }, function(e: any, r: any, data: any) {
        if (e) {
            logger.error(e);
            return res.status(500).send({ message: e.message });
        }
        let accessToken = qs.parse(data);
        logger.debug(accessToken);
        if (typeof accessToken.oauth_token === "undefined") {
            logger.error(accessToken);
            return res.status(500).send({ message: "You has error in Oauth!" });
        }
        else {
            // save the access token somewhere on behalf of the logged in user
            // We moved it to the company.  it just makes more sense since access is per company with QBO
            helper.insertOrUpdateCompany(companyId, accessToken, req.query.realmId, function(err, data) {
                if (err) {
                    return res.status(500).send({ message: err.message });
                } else {
                    return res.send(
                        '<!DOCTYPE html>                                                                                    \
                <html lang="en">                                                                                    \
                <head>                                                                                          \
                <meta charset="UTF-8">                                                                      \
                <title>Success</title>                                                                      \
                <script language="javascript" type="text/javascript">                                       \
                function windowClose() {                                                                \
                  window.open("","_parent","");                                                       \
                  window.close();                                                                     \
                }                                                                                       \
                (function() {                                                                           \
                  window.setTimeout(function() {                                                      \
                    window.close();                                                                 \
                  }, 3000);                                                                           \
                })()                                                                                    \
                </script>                                                                                   \
                </head>                                                                                         \
                <body>                                                                                          \
                <h3>Success!</h3>                                                                           \
                This window will now close... If it does not close, please click the button below. <br />   \
                <input type="button" value="Close" onclick="windowClose();">                                \                                                    \
                </button>                                                                                   \
                </body>                                                                                         \
                </html>'
                    );
                }
            })
        }

    });
}

export function qbListItems(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: qbListItems(req, res)");
    let companyId = req.params.companyId;

    Company.findById(companyId, function(err: any, company: CompanyDataSchema) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox, // use the Sandbox depending on env
            config.quickBooks.debug); // turn debugging on/off depending on env

        qbo.findItems(function(_, items) {
            logger.info(items);

            // These items come out as undefined -Steve

            // now that was easy :)  QBO wraps the items we want in items.QueryResponse.Item
            // name id name = qboname populated
            // todo: what if it was an error....

            return res.jsonp(items.QueryResponse.Item);
        });
    });
}

export function qbListCustomers(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: qbListCustomers(req, res)");
    let companyId = req.params.companyId;

    Company.findById(companyId, function(err: any, company: CompanyDataSchema) {
        logger.info(company);
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox, // use the Sandbox depending on env
            config.quickBooks.debug); // turn debugging on/off depending on env

        qbo.findCustomers({
            limit: 35,
            offset: req.query.offset
        }, function(_, items) {
            logger.info(items);

            //These items come out as undefined -Steve

            // now that was easy :)  QBO wraps the items we want in items.QueryResponse.Item
            // name id name = qboname populated
            // todo: what if it was an error....

            return res.jsonp(items.QueryResponse.Customer);
        });
    });
}

export function qbAddPurchase(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: qbAddPurchase(req, res)");

    async.waterfall([
        function(done) {
            helper.validateWokerOrder(req.params.workorderId || req.workorderId, done);
        },
        function(workorder, done) {
            //todo: depend on payment type, we will call addCreditCardPurchase() or addCreditBillPurchase(),addCheckPurchase()
            helper.addCreditCardPurchase(workorder, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.status(201).end();
        }
    });

}

export function qbCreateInvoice(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: exports.qbCreateInvoice");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.validateWokerOrder(req.params.workorderId || req.workorderId, done);
        },
        function(workorder: WorkorderSchema, done) {
            helper.validateServiceType(workorder, done);
        },
        function(workorder: WorkorderSchema, done) {
            helper.validateOwner(workorder, done);
        },
        function(workorder: WorkorderSchema, owners: ContactDataSchema, done) {
            helper.createInvoice(workorder, owners, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp(result);
        }
    });
}

export function qbReadInvoice(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: qbReadInvoice(req, res)");
    let Workorder: WorkorderSchema;
    async.waterfall([
        function(done) {
            helper.validateWokerOrder(req.params.workorderId, done);
        },
        function(workorder: WorkorderSchema, done) {
            Workorder = workorder;
            helper.validateCompany(workorder.company, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.readInvoie(Workorder, company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.erro(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp(result);
        }
        ;
    });
}

export function importServiceTypes(req: any, res: express.Response) {
    logger.info("quickbooks.server.controller.js: exports.importServiceTypes(req,res)");
    let companyId = req.companyId;
    let _company: CompanyDataSchema;
    let _types: any;
    async.waterfall([
        function(done) {
            helper.validateCompany(companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            _company = company;
            helper.getServiceTypes(company, done);
        },
        function(types: any, qbo: any, done) {
            _types = types;
            helper.findQuickBookItems(_company, done);
        },
        function(items: any, qbo: any, done) {
            helper.findQuickBookTaxCodes(_company, _types, items, qbo, done);
        },
    ], function(err, result) {
        if (err) {
            logger.erro(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.end(result);
        }
        ;
    });
}

export function getQuickbooksTaxCodes(req: any, res: express.Response) {
    logger.info("quickbooks.helper.controller.js: getQuickbooksTaxCodes(req, res)");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.getQuickBookTaxCodes(company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp(result);
        }
    });
}

export function getQuickbooksAccounts(req: any, res: express.Response) {
    logger.info("quickbooks.helper.controller.js: getQuickbooksAccounts(req, res)");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.getQuickBookAccounts(company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp(result);
        }
    });
}

export function getQuickbooksItems(req: any, res: express.Response) {
    logger.info("serviceType.server.controller.js: getQuickbooksItems(req, res)");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.findQuickBookItems(company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp({ items: result.QueryResponse.Item });
        }
    });
}

export function getQuickbooksCustomers(req: any, res: express.Response) {
    logger.info("serviceType.server.controller.js: getQuickbooksCustomers(req, res)");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.findQuickBookCustomers(company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp(result);
        }
    });
}

export function qbAddBill(req: any, res: express.Response) {
    logger.info("serviceType.server.controller.js: qbAddBill(req, res)");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.addBill(company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.status(201).end();
        }
    });
}

export function qbGetVendors(req: any, res: express.Response) {
    logger.info("serviceType.server.controller.js: qbGetVendors(req, res)");
    async.waterfall([
        function(done) {
            helper.validateCompany(req.companyId || req.params.companyId, done);
        },
        function(company: CompanyDataSchema, done) {
            helper.getVendors(company, done);
        },
    ], function(err, result) {
        if (err) {
            logger.error(err);
            return res.status(500).send({ message: err.message });
        } else {
            return res.jsonp(result);
        }
    });
}


export function importQuickbooksCustomers(req: any, res: express.Response) {
    logger.info("serviceType.server.controller.js: importQuickbooksCustomers(req, res)");
}
