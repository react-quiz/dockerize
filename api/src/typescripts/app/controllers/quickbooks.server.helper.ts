import mongoose = require("mongoose");
import _ = require("lodash");
import async = require("async");
import QuickBooks = require("node-quickbooks");
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
    qbCustomerNo: number;
    latitude: number;
    longitude: number;
}
export declare interface ContactDataSchema extends mongoose.Document {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    qbCustomerNo: number;
    client: string;

}
export declare interface ClientDataSchema extends mongoose.Document {
    name: string;
    email: string;
    qbCustomerNo: number;
}
export declare interface QboDataObject {
    clientCustomerNo: string;
    ownerCustomerNo: string;
    propCustomerNo: string;
    unitCustomerNo: string;
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
            qboSyncToken: string,
            description: string,
            amount: number,
            qboTxnDetail: {
                taxCodeRef: string,
                taxCodeName: string
            },
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
    Company = mongoose.model("Company"),
    Contact = mongoose.model("Contact"),
    Property = mongoose.model("Property"),
    ServiceType = mongoose.model("ServiceType"),
    Unit = mongoose.model("Unit"),
    Vendor = mongoose.model("Vendor"),
    Workorder = mongoose.model("Workorder");

let config = require("../../config/config"),
    logger = require("../../config/logger");
/**
 * Find compnay by company id
 * @param  {string} companyId [description]
 * @param  {any}    callback  [description]
 * @return {[type]}           [description]
 */
export function validateCompany(companyId: string, callback: any) {
    Company.findById(companyId).exec(function(err: any, company: CompanyDataSchema) {
        if (err) {
            logger.warn("error find company qb information: quickbooks.helper.controller.js");
            logger.debug(err);
            callback(err);
        }
        else {
            callback(null, company);
        }
    });
}

/**
 * Find server type of work order
 * @param  {WorkorderSchema} workorder [description]
 * @param  {any}             callback  [description]
 * @return {[type]}                    [description]
 */
export function validateServiceType(workorder: WorkorderSchema, callback: any) {
    ServiceType.populate(workorder, {
        path: "billing.invoice.invoiceItems.serviceType",
        model: "ServiceType"
    }, function(err, workOrder: WorkorderSchema) {
        if (err) {
            logger.warn("error populating service type in bill: quickbooks.helper.controller.js");
            logger.debug(err);
            callback(err);
        }
        else {
            callback(null, workOrder);
        }
    });
}

/**
 * find owner of work order
 * @param  {WorkorderSchema} workorder [description]
 * @param  {any}             callback  [description]
 * @return {[type]}                    [description]
 */
export function validateOwner(workorder: WorkorderSchema, callback: any) {
    Contact.find({
        type: "Owner",
        properties: workorder.property
    }).sort({ _id: -1 }).exec(function(err: any, owners: ContactDataSchema) {
        if (err) {
            logger.warn("error find owner of propert: quickbooks.helper.controller.js");
            logger.debug(err);
            callback(err);
        }
        else {
            callback(null, workorder, owners);
        }
    });
}

/**
 * Insert compnay to QuickBooks or update that company if exist
 * @param  {string}    compnay     [description]
 * @param  {string}    accessToken [description]
 * @param  {string }}         oauth_token_secret [description]
 * @param  {string}    realmId     [description]
 * @return {[type]}                [description]
 */
export function insertOrUpdateCompany(companyId: string, accessToken: { oauth_token: string, oauth_token_secret: string }, realmId: string, callback) {
    Company.findByIdAndUpdate(companyId,
        {
            $set: {
                "qboServices.qboToken": accessToken.oauth_token,
                "qboServices.qboTokenSecret": accessToken.oauth_token_secret,
                "qboServices.qboCompanyId": realmId
            }
        }, { new: true }, function(err: any, company: CompanyDataSchema) {
            if (err) {
                logger.warn("error updating company qb information: quickbooks.server.helper.js");
                logger.debug(err);
                callback(err)
            }
            else {
                logger.info("*** quickbooks.server.helper -  insertOrUpdateCompany()");
                logger.debug(company);
                logger.info("*** end updated company");
                callback(null, company);
            }

        }
    );
}


/**
 * Validate Woker Order
 * @param  {string} worderId
 * @param  {any}    callback [description]
 * @return {[type]}          [description]
 */
export function validateWokerOrder(workorderId: string, callback: any) {
    Workorder.findById(workorderId).populate("property company").exec((err: any, workorder: WorkorderSchema) => {
        if (err) {
            logger.warn("error find work order id : quickbooks.server.helper.js");
            logger.debug(err);
            callback(err, null);
        }
        else {
            // remove Other type for credit card
            if (workorder.materials.length > 0) {
                workorder.materials = workorder.materials.filter(function(material: any) {
                    return material.card !== "Other";
                });
            }
            callback(null, workorder);
        }
    }
    );
}

/**
 * Create add purchase base on credit card
 * @param  {WorkorderSchema} workorder [description]
 * @param  {any}             callback  [description]
 * @return {[type]}                    [description]
 */
export function addCreditCardPurchase(workorder: WorkorderSchema, callback: any) {
    if (workorder.materials.length > 0) {
        let creditCards = workorder.company.creditCards;
        let expenseAccount = workorder.company.qboServices.qboExpenseAccount;
        let qbo = new QuickBooks(
            config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            workorder.company.qboServices.qboToken,
            workorder.company.qboServices.qboTokenSecret,
            workorder.company.qboServices.qboCompanyId,
            config.quickBooks.sandbox,
            config.quickBooks.debug
        );
        let purchaseTasks = [];
        workorder.materials.forEach(function(material: any) {
            purchaseTasks.push(function(purchaseCallback: any) {
                // find the matching credit card todo: handle non-match errors
                let creditCard: any = {};
                creditCards.forEach(function(card: any) {
                    if (card.name === material.card) {
                        creditCard = card;
                    }
                });
                let expense = {
                    "AccountRef": {
                        "value": creditCard.qboId,
                        "name": creditCard.name,
                    },
                    "TxnDate": material.createdDate,
                    "PaymentType": "CreditCard",
                    "DocNumber": "PMT" + workorder.number,
                    "Line": [
                        {
                            "Amount": material.amount,
                            "Description": material.description,
                            "DetailType": "AccountBasedExpenseLineDetail",
                            "AccountBasedExpenseLineDetail": {
                                "AccountRef": {
                                    "value": expenseAccount
                                }
                            }
                        }
                    ]
                };

                qbo.createPurchase(expense, function(err: any, data: any) {
                    if (err) {
                        let errorObject = {
                            error: err.Fault,
                            message: err.Fault.Error[0].Detail
                        };
                        purchaseCallback && purchaseCallback(errorObject);
                    }
                    else {
                        logger.info("yay, created purchase\n\n");
                        logger.debug(data);
                        purchaseCallback && purchaseCallback(null, data);
                    }
                });
            });
        });

        async.parallel(purchaseTasks, function(err: any, data: any) {
            if (err) {
                logger.warn("error in createPurchase async.parallel : quickbooks.server.helper.js");
                logger.debug(err);
                callback(err);
            }
            else {
                callback(null, data);
            }
        });
    }
    else {
        logger.info("Workorder has no materials, can\"t create purchase");
        return callback({ message: "Workorder has no materials, can\"t create purchase" });
    }
}

/**
 * Add a bill for a vendor
 * @param  {CompanyDataSchema} company [description]
 * @param  {any}             callback  [description]
 * @return {[type]}                    [description]
 */
export function addBill(company: CompanyDataSchema, callback: any) {
    if (company && company.qboServices) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox,
            config.quickBooks.debug);

    }
    else {
        return callback({ message: "Quickbooks is not configured for this company." })
    }
}

/**
 * get all vendors
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function getVendors(company: CompanyDataSchema, callback: any) {
    if (company && company.qboServices) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox,
            config.quickBooks.debug);

        qbo.findVendorCredits(function(err, vendors) {
            if (err) {
                logger.warn("error in get vendors of company getVendors : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                return callback(errorObject);
            }

            if (vendors.QueryResponse && vendors.QueryResponse.Customer) {
                logger.info("get vendors of vendors getVendors : quickbooks.server.helper.js");
                logger.debug(vendors);
                return callback(null, { vendors: vendors.QueryResponse.Vendor });
            }
            else {
                return callback({ message: "There was an error with Quickbooks." });
            }
        });
    }
    else {
        return callback({ message: "Quickbooks is not configured for this company." })
    }
}

/**
 * Create invoice base on work order
 * @param  {WorkorderSchema}   workorder [description]
 * @param  {ContactDataSchema} owners    [description]
 * @param  {any}               callback  [description]
 * @return {[type]}                      [description]
 */
export function createInvoice(workorder: WorkorderSchema, owners: ContactDataSchema[], callback: any) {
    let qbo: any = new QuickBooks(config.quickBooks.oAuthConsumerKey,
        config.quickBooks.oAuthConsumerSecret,
        workorder.company.qboServices.qboToken,
        workorder.company.qboServices.qboTokenSecret,
        workorder.company.qboServices.qboCompanyId,
        config.quickBooks.sandbox,
        config.quickBooks.debug);
    logger.info("createInvoice : quickbooks.server.helper.js");
    async.waterfall([
        function(callback) {
            let clientId: string = "";
            if (owners && owners[0]) {
                clientId = owners[0].client || "";
            }
            logger.info("createInvoice step 1:");
            findQuickBookIdOfClient(qbo, clientId, callback);
        },
        function(qboData, callback) {
            logger.info("createInvoice step 1 result:");
            logger.info(qboData);
            logger.info("createInvoice step 2:");
            if (owners.length > 0) {
                findQuickBookIdOfOwner(qbo, owners[0], qboData, callback);
            }
            else {
                callback(null, {
                    "ownerCustomerNo": 0,
                    "clientCustomerNo": qboData.clientCustomerNo
                });
            }
        },
        function(qboData, callback) {
            logger.info("createInvoice step 2 result:");
            logger.info(qboData);
            logger.info("createInvoice step 3:");
            findQuickBookIdOfProperty(qbo, workorder, qboData, callback);
        },
        function(qboData, callback) {
            logger.info("createInvoice step 3 result:");
            logger.info(qboData);
            logger.info("createInvoice step 4:");
            findQuickBookIdOfUnit(qbo, workorder, qboData, callback);
        }
    ],
        function(err, results) {
            logger.info("createInvoice step 4 result:");
            logger.info(err);
            logger.info(results);
            logger.info("createInvoice step 5: # insert or update invoice");
            if (err) {
                logger.warn("error in find createInvoice createInvoice : quickbooks.server.helper.js");
                logger.debug(err);
                return callback(err);
            }
            else {
                // insert or update invoice
                logger.info(results);
                insertOrUpdateQuickBookInvoice(qbo, workorder, results, callback);
            }
        });
}

/**
 * Insert or Update invoice to Quick Book
 * @param  {any}             qbo       [description]
 * @param  {WorkorderSchema} workorder [description]
 * @param  {any}             qboData   [description]
 * @param  {any}             callback  [description]
 * @return {[type]}                    [description]
 */
function insertOrUpdateQuickBookInvoice(qbo: any, workorder: WorkorderSchema, qboData: QboDataObject, callback: any) {
    logger.info("insertOrUpdateQuickBookInvoice : quickbooks.server.helper.js");
    let billedCustomerNo = qboData.ownerCustomerNo;
    if (qboData.unitCustomerNo) {
        billedCustomerNo = qboData.unitCustomerNo;
    }
    else if (qboData.propCustomerNo) {
        billedCustomerNo = qboData.propCustomerNo;
    }
    let invoice: any = workorder.billing.invoice;
    let lines: any = [];

    // prepare data
    if (invoice.invoiceItems) {
        logger.info("we have invoice items, checking the array and generating lines");
        invoice.invoiceItems.forEach(function(invoiceItem) {
            if (!invoiceItem.serviceType) {
                // todo: this is causing a crash for me
                logger.warn("NO SERVICE TYPE ASSOCIATED, IMPORT YOUR SERVICE TYPES!");
                return callback({ message: "No service type on invoice" });
            }

            let line = {
                Amount: invoiceItem.bill,
                Description: invoiceItem.name + " - " + invoiceItem.description,
                DetailType: "SalesItemLineDetail",
                SalesItemLineDetail: {
                    ItemRef: {
                        value: invoiceItem.serviceType.qboId,
                        name: invoiceItem.serviceType.qboName
                    },
                    TaxCodeRef: {}
                }
            };

            if (invoiceItem.serviceType.taxable) {
                line.SalesItemLineDetail.TaxCodeRef = {
                    value: "TAX"
                };
            }
            else {
                line.SalesItemLineDetail.TaxCodeRef = {
                    value: "NON"
                };
            }

            // todo: to trigger sales tax, need to set SalexItemLineDetail.TaxCodeRef.value to TAX
            lines.push(line);
            // todo: we store into QB as owner:property:unit so we need to check to see if they exist and create if they don"t
            // todo: we don"t handle a property being in QB but the ID not being in our system
        });
    }

    let postData: any = {
        Line: lines,
        CustomerRef: {
            value: billedCustomerNo
        },
        PrivateNote: workorder.description,
        DocNumber: "PMT" + workorder.number,
        TotalAmt: invoice.amount
    };

    if (workorder.billing.invoice.qboTxnDetail) {
        postData.TxnTaxDetail = {
            TxnTaxCodeRef: {
                name: workorder.billing.invoice.qboTxnDetail.taxCodeName,
                value: workorder.billing.invoice.qboTxnDetail.taxCodeRef
            }
        }
    }

    logger.info("Invoice data: ");
    logger.info(postData);
    // update quickbook if invoice is exist
    if (workorder.billing.invoice.qboId) {
        logger.info("Update invoice!");
        postData.Id = workorder.billing.invoice.qboId;
        postData.SyncToken = workorder.billing.invoice.qboSyncToken;

        if (postData.Id && postData.SyncToken) {
            qbo.updateInvoice(postData, function(err, data) {
                if (err) {
                    logger.warn("error in update invoice insertOrUpdateQuickBookInvoice : quickbooks.server.helper.js");
                    logger.debug(err);
                    let errorObject = {
                        error: err.Fault,
                        message: err.Fault.Error[0].Detail
                    };
                    return callback(errorObject);
                }
                else {
                    if (data.TxnTaxDetail && data.TxnTaxDetail.TotalTax > 0) {
                        let amount: number;
                        let invoiceItems: any = workorder.billing.invoice.invoiceItems;
                        amount = invoiceItems.reduce(function(previous, current) {
                            return previous + current.bill
                        }, 0);
                        Workorder.update({ _id: workorder._id }, {
                            "billing.invoice.totalTax": data.TxnTaxDetail.TotalTax,
                            "billing.invoice.amount": amount
                        }, function(err, update) {
                            return callback(null, data);
                        });
                    }
                    else {
                        callback(null, data);
                    }
                }
            });
        } else {
            logger.warn("Error couldn\"t update invoice, missing qboSyncToken");
            return callback({ "messages": "Couldn\"t create invoice, missing qboSyncToken" });
        }

    }
    else {
        logger.info("Insert new invoice!");
        qbo.createInvoice(postData, function(err, data) {
            if (err) {
                logger.warn("error in update invoice insertOrUpdateQuickBookInvoice : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                return callback(errorObject);
            }
            else {
                if (data.TxnTaxDetail && data.TxnTaxDetail.TotalTax > 0) {
                    let amount: number;
                    let invoiceItems: any = workorder.billing.invoice.invoiceItems;
                    amount = invoiceItems.reduce(function(previous, current) {
                        return previous + current.bill
                    }, 0);
                    Workorder.update({ _id: workorder._id }, {
                        "billing.invoice.totalTax": data.TxnTaxDetail.TotalTax,
                        "billing.invoice.amount": amount
                    }, function(err, update) {
                        return callback(null, data);
                    });
                }
                else {
                    callback(null, data);
                }
            }
        });
    }

}
/**
 * Find Quick Book ID of client
 * @param  {string} clientId [description]
 * @param  {any}    callback [description]
 * @return {[type]}          [description]
 */
function findQuickBookIdOfClient(qbo: any, clientId: string, callback: any) {
    logger.info("findQuickBookIdOfClient : quickbooks.server.helper.js");
    if (clientId === "") {
        callback(null, { "clientCustomerNo": 0 });
    }
    else {
        Client.findById(clientId).exec(function(err, client: ClientDataSchema) {
            if (err) {
                logger.warn("error in findQuickBookIdOfClient : quickbooks.server.helper.js");
                logger.debug(err);
                return callback(err);
            }
            else {
                // if this client is exit on QuickBooks
                if (client && client.qbCustomerNo) {
                    callback(null, { "clientCustomerNo": client.qbCustomerNo });
                }
                else {
                    let clientCustomerNo: number = 0;
                    // checking client is exist on QuickBook or not
                    // we will create new client if needed
                    let displayName: string = client.name.substring(0, 25);
                    findQuickBookCustomersByName(qbo, displayName, (err, qboNo: number) => {
                        if (err) {
                            logger.warn("error in findQuickBookCustomersByName --> findQuickBookIdOfClient : quickbooks.server.helper.js");
                            logger.debug(err);
                            return callback(err);
                        }
                        else {
                            clientCustomerNo = qboNo;
                            if (!clientCustomerNo) {
                                let customerData: any = {
                                    CompanyName: displayName,
                                    DisplayName: displayName,
                                    PrimaryEmailAddr: {
                                        Address: client.email
                                    }
                                };
                                createQuickBookCustomer(qbo, customerData, (err, customerNo: number) => {
                                    client.qbCustomerNo = customerNo;
                                    client.save(function(err) {
                                        if (err) {
                                            logger.warn("error in update qbCustomerNo findQuickBookIdOfClient : quickbooks.server.helper.js");
                                            logger.debug(err);
                                            return callback(err);
                                        } else {
                                            callback(null, { "clientCustomerNo": customerNo });
                                        }
                                    });
                                });
                            }
                            else {
                                client.qbCustomerNo = clientCustomerNo;
                                client.save(function(err) {
                                    if (err) {
                                        logger.warn("error in update qbCustomerNo findQuickBookIdOfClient : quickbooks.server.helper.js");
                                        logger.debug(err);
                                        return callback(err);
                                    } else {
                                        callback(null, { "clientCustomerNo": clientCustomerNo });
                                    }
                                });
                            }
                        }
                    });

                }
            }
        });
    }
}


/**
 * Find Quick Book ID of owner (contact)
 * @param  {any}               qbo      [description]
 * @param  {ContactDataSchema} owner    [description]
 * @param  {any}               qboData [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
function findQuickBookIdOfOwner(qbo: any, owner: ContactDataSchema, qboData: QboDataObject, callback: any) {
    logger.info("findQuickBookIdOfOwner : quickbooks.server.helper.js");

    if (owner && owner.qbCustomerNo) {
        callback(null, {
            "ownerCustomerNo": owner.qbCustomerNo,
            "clientCustomerNo": qboData.clientCustomerNo
        });
    }
    else {
        let customerData: any;
        let ownerCustomerNo: number;
        findQuickBookCustomersByName(qbo, owner.displayName, (err, qboNo: number) => {
            if (err) {
                logger.warn("error in findQuickBookCustomersByName => findQuickBookIdOfOwner : quickbooks.server.helper.js");
                logger.debug(err);
                return callback(err);
            }
            else {
                ownerCustomerNo = qboNo;
                logger.info("ownerCustomerNo findQuickBookCustomersByName : quickbooks.server.helper.js");
                logger.info(ownerCustomerNo);
                logger.info("prepare for update qbCustomerNo in findQuickBookCustomersByName : quickbooks.server.helper.js");

                if (!ownerCustomerNo) {
                    // owner has belong to client or not
                    if (qboData.clientCustomerNo) {
                        customerData = {
                            GivenName: owner.firstName,
                            FamilyName: owner.lastName,
                            DisplayName: owner.displayName,
                            PrimaryEmailAddr: {
                                Address: owner.email
                            },
                            Job: true,
                            ParentRef: {
                                value: qboData.clientCustomerNo
                            },
                            BillWithParent: true
                        };
                    }
                    else {
                        customerData = {
                            GivenName: owner.firstName,
                            FamilyName: owner.lastName,
                            DisplayName: owner.displayName,
                            PrimaryEmailAddr: {
                                Address: owner.email
                            }
                        };
                    }
                    createQuickBookCustomer(qbo, customerData, (err, customerNo: number) => {
                        if (err) {
                            logger.warn("error in createQuickBookCustomer => findQuickBookIdOfOwner : quickbooks.server.helper.js");
                            logger.debug(err);
                            return callback(err);
                        }
                        else {
                            ownerCustomerNo = customerNo
                            owner.qbCustomerNo = ownerCustomerNo;
                            owner.save(function(err) {
                                if (err) {
                                    logger.warn("error in update qbCustomerNo findQuickBookIdOfOwner : quickbooks.server.helper.js");
                                    logger.debug(err);
                                    return callback(err);
                                } else {
                                    callback(null, {
                                        "ownerCustomerNo": owner.qbCustomerNo,
                                        "clientCustomerNo": qboData.clientCustomerNo
                                    });
                                }
                            });
                        }
                    });
                }
                else {
                    owner.qbCustomerNo = ownerCustomerNo;
                    owner.save(function(err) {
                        if (err) {
                            logger.warn("error in update qbCustomerNo findQuickBookIdOfOwner : quickbooks.server.helper.js");
                            logger.debug(err);
                            return callback(err);
                        } else {
                            callback(null, {
                                "ownerCustomerNo": owner.qbCustomerNo,
                                "clientCustomerNo": qboData.clientCustomerNo
                            });
                        }
                    });
                }
            }
        });


    }
}

/**
 * Find Quick Book Id of property
 * @param  {any}    qbo       [description]
 * @param  {any}    workorder [description]
 * @param  {any}    qboData   [description]
 * @param  {any}    callback  [description]
 * @return {[type]}           [description]
 */
function findQuickBookIdOfProperty(qbo: any, workorder: WorkorderSchema, qboData: QboDataObject, callback: any) {
    logger.info("findQuickBookIdOfProperty : quickbooks.server.helper.js");

    if (workorder.property) {
        if (workorder.property && workorder.property.qbCustomerNo) {
            callback(null, {
                "propCustomerNo": workorder.property.qbCustomerNo,
                "ownerCustomerNo": qboData.ownerCustomerNo,
                "clientCustomerNo": qboData.clientCustomerNo
            });
        }
        else {
            let customerData: any;
            let propCustomerNo: number;
            let displayName: string = workorder.property.name.substring(0, 25);
            findQuickBookCustomersByName(qbo, displayName, (err, qboNo: number) => {
                if (err) {
                    logger.warn("error in findQuickBookCustomersByName => findQuickBookIdOfOwner : quickbooks.server.helper.js");
                    logger.debug(err);
                    return callback(err);
                }
                else {
                    propCustomerNo = qboNo;
                    // create new customer for property if not exist
                    if (!propCustomerNo) {
                        // property has belong to owner or not
                        if (qboData.ownerCustomerNo) {
                            customerData = {
                                CompanyName: displayName,
                                DisplayName: displayName,
                                Job: true, // important in case of qb-sub-customer
                                ParentRef: {
                                    value: qboData.ownerCustomerNo
                                },
                                BillWithParent: true,
                                BillAddr: {
                                    Line1: workorder.property.address,
                                    Line2: workorder.property.address2,
                                    City: workorder.property.city,
                                    CountrySubDivisionCode: workorder.property.state,
                                    PostalCode: workorder.property.postalCode,
                                    Lat: workorder.property.latitude,
                                    Long: workorder.property.longitude
                                }
                            };
                            createQuickBookCustomer(qbo, customerData, (err, customerNo: number) => {
                                if (err) {
                                    logger.warn("error in createQuickBookCustomer => findQuickBookIdOfProperty : quickbooks.server.helper.js");
                                    logger.debug(err);
                                    return callback(err);
                                }
                                else {
                                    propCustomerNo = customerNo;
                                    let propertyId: any = workorder.property._id || workorder.property;
                                    Property.findById(propertyId, function(err, property: PropertyDataSchema) {
                                        if (err) {
                                            logger.warn("error in find property findQuickBookIdOfProperty : quickbooks.server.helper.js");
                                            logger.debug(err);
                                            return callback(err);
                                        }
                                        else {
                                            property.qbCustomerNo = propCustomerNo;
                                            property.save(function(err) {
                                                if (err) {
                                                    logger.warn("error in update qbCustomerNo findQuickBookIdOfProperty : quickbooks.server.helper.js");
                                                    logger.debug(err);
                                                    return callback(err);
                                                }
                                                else {
                                                    callback(null, {
                                                        "propCustomerNo": propCustomerNo,
                                                        "ownerCustomerNo": qboData.ownerCustomerNo,
                                                        "clientCustomerNo": qboData.clientCustomerNo
                                                    });
                                                }
                                            });

                                        }
                                    });
                                }
                            });
                        }
                        else {
                            logger.warn("onwer does not exist in Quick Book");
                        }
                    }
                    else {
                        let propertyId: any = workorder.property._id || workorder.property;
                        Property.findById(propertyId, function(err, property: PropertyDataSchema) {
                            if (err) {
                                logger.warn("error in find property findQuickBookIdOfProperty : quickbooks.server.helper.js");
                                logger.debug(err);
                                return callback(err);
                            }
                            else {
                                property.qbCustomerNo = propCustomerNo;
                                property.save(function(err) {
                                    if (err) {
                                        logger.warn("error in update qbCustomerNo findQuickBookIdOfProperty : quickbooks.server.helper.js");
                                        logger.debug(err);
                                        return callback(err);
                                    }
                                    else {
                                        callback(null, {
                                            "propCustomerNo": propCustomerNo,
                                            "ownerCustomerNo": qboData.ownerCustomerNo,
                                            "clientCustomerNo": qboData.clientCustomerNo
                                        });
                                    }
                                });

                            }
                        });
                    }
                }
            });
        }
    }
    else {
        callback(null, {
            "propCustomerNo": 0,
            "ownerCustomerNo": qboData.ownerCustomerNo,
            "clientCustomerNo": qboData.clientCustomerNo
        });
    }
}

/**
 * Find Quick Book Id of unit
 * @param  {any}             qbo       [description]
 * @param  {WorkorderSchema} workorder [description]
 * @param  {any}             qboData   [description]
 * @param  {any}             callback  [description]
 * @return {[type]}                    [description]
 */
function findQuickBookIdOfUnit(qbo: any, workorder: WorkorderSchema, qboData: QboDataObject, callback: any) {
    logger.info("findQuickBookIdOfUnit : quickbooks.server.helper.js");

    if (workorder.unit) {
        if (workorder.unit && workorder.unit.qbCustomerNo) {
            callback(null, {
                "unitCustomerNo": workorder.unit.qbCustomerNo,
                "propCustomerNo": workorder.property.qbCustomerNo,
                "ownerCustomerNo": qboData.ownerCustomerNo,
                "clientCustomerNo": qboData.clientCustomerNo
            });
        }
        else {
            var unitId: any = workorder.unit._id || workorder.unit;
            Unit.findById(unitId, function(err, unit: UnitDataSchema) {
                if (err) {
                    logger.warn("error in find unit findQuickBookIdOfUnit : quickbooks.server.helper.js");
                    logger.debug(err);
                    return callback(err);
                } else {
                    if (unit && unit.qbCustomerNo) {
                        callback(null, {
                            "unitCustomerNo": unit.qbCustomerNo,
                            "propCustomerNo": workorder.property.qbCustomerNo,
                            "ownerCustomerNo": qboData.ownerCustomerNo,
                            "clientCustomerNo": qboData.clientCustomerNo
                        });
                    }
                    else {
                        let customerData: any;
                        let unitCustomerNo: number;
                        let displayName: string = unit.name.substring(0, 25);
                        findQuickBookCustomersByName(qbo, displayName, (err, qboNo: number) => {
                            if (err) {
                                logger.warn("error in findQuickBookCustomersByName => findQuickBookIdOfOwner : quickbooks.server.helper.js");
                                logger.debug(err);
                                return callback(err);
                            }
                            else {
                                unitCustomerNo = qboNo;

                                // unit does not exist in quick book
                                if (!unitCustomerNo && qboData.propCustomerNo) {
                                    customerData = {
                                        CompanyName: unit.name.substring(0, 25),
                                        DisplayName: unit.name.substring(0, 25),
                                        Job: true, // important in case of qb-sub-customer
                                        ParentRef: {
                                            value: qboData.propCustomerNo
                                        },
                                        BillWithParent: true,
                                        BillAddr: {
                                            Line1: unit.address,
                                            Line2: unit.address2,
                                            City: unit.city,
                                            CountrySubDivisionCode: unit.state,
                                            PostalCode: unit.postalCode
                                        }
                                    };
                                    createQuickBookCustomer(qbo, customerData, (err, customerNo: number) => {
                                        if (err) {
                                            logger.warn("error in createQuickBookCustomer => findQuickBookIdOfUnit : quickbooks.server.helper.js");
                                            logger.debug(err);
                                            let errorObject = {
                                                error: err.Fault,
                                                message: err.Fault.Error[0].Detail
                                            };
                                            return callback(errorObject);
                                        }
                                        else {
                                            unitCustomerNo = customerNo;
                                            unit.qbCustomerNo = unitCustomerNo;
                                            unit.save(function(err) {
                                                if (err) {
                                                    logger.warn("error in update qbCustomerNo findQuickBookIdOfUnit : quickbooks.server.helper.js");
                                                    logger.debug(err);
                                                    return callback(err);
                                                }
                                                else {
                                                    callback(null, {
                                                        "unitCustomerNo": unitCustomerNo,
                                                        "propCustomerNo": workorder.property.qbCustomerNo,
                                                        "ownerCustomerNo": qboData.ownerCustomerNo,
                                                        "clientCustomerNo": qboData.clientCustomerNo
                                                    });

                                                }
                                            });
                                        }
                                    });
                                } else {
                                    unit.qbCustomerNo = unitCustomerNo;
                                    unit.save(function(err) {
                                        if (err) {
                                            logger.warn("error in update qbCustomerNo findQuickBookIdOfUnit : quickbooks.server.helper.js");
                                            logger.debug(err);
                                            return callback(err);
                                        }
                                        else {
                                            callback(null, {
                                                "unitCustomerNo": unitCustomerNo,
                                                "propCustomerNo": workorder.property.qbCustomerNo,
                                                "ownerCustomerNo": qboData.ownerCustomerNo,
                                                "clientCustomerNo": qboData.clientCustomerNo
                                            });

                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    }
    else {
        callback(null, {
            "unitCustomerNo": 0,
            "propCustomerNo": qboData.propCustomerNo,
            "ownerCustomerNo": qboData.ownerCustomerNo,
            "clientCustomerNo": qboData.clientCustomerNo
        });
    }
}

/**
 * Find Quick Book Customer by display name
 * @param  {any}    qbo         [description]
 * @param  {string} displayName [description]
 * @return {[type]}             [description]
 */
function findQuickBookCustomersByName(qbo: any, displayName: string, callback: any) {
    logger.info("findQuickBookCustomersByName : quickbooks.server.helper.js");
    qbo.findCustomers(
        {
            DisplayName: displayName
        },
        function(err, customers) {
            if (err) {
                logger.warn("error in findQuickBookCustomersByName  : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                callback(errorObject);
            }
            else {
                logger.info("findQuickBookCustomersByName displayName: ");
                logger.info(displayName);
                logger.info("findQuickBookCustomersByName result: ");
                logger.info(customers);
                logger.info("findQuickBookCustomersByName result end!");
                if (typeof customers.QueryResponse.Customer !== "undefined") {
                    callback(null, customers.QueryResponse.Customer[0].Id);
                }
                else {
                    callback(null, 0);
                }

            }
        });
}

/**
 * Create new Quick Book customer
 * @param  {any}    qbo      [description]
 * @param  {any}    custDate [description]
 * @return {[type]}          [description]
 */
function createQuickBookCustomer(qbo: any, customerData: any, callback: any) {
    logger.info("createQuickBookCustomer : quickbooks.server.helper.js");
    qbo.createCustomer(customerData, function(err, data: any) {
        if (err) {
            logger.warn("error in createQuickBookCustomer : quickbooks.server.helper.js");
            logger.debug(customerData);
            logger.debug(err);
            let errorObject = {
                error: err.Fault,
                message: err.Fault.Error[0].Detail
            };
            callback(errorObject);
        }
        else {
            logger.info("yay, created customer\n\n");
            logger.debug(data);
            callback(null, data.Id);
        }
    });
}

/**
 * Read Quick Book Invoice of work order
 * @param  {WorkorderSchema}   workOrder [description]
 * @param  {CompanyDataSchema} company   [description]
 * @param  {any}               callback  [description]
 * @return {[type]}                      [description]
 */
export function readInvoice(workOrder: WorkorderSchema, company: CompanyDataSchema, callback: any) {
    let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
        config.quickBooks.oAuthConsumerSecret,
        company.qboServices.qboToken,
        company.qboServices.qboTokenSecret,
        company.qboServices.qboCompanyId,
        config.quickBooks.sandbox,
        config.quickBooks.debug);

    qbo.getInvoice(workOrder.billing.invoice.qboId, function(err, invoice) {
        if (err) {
            logger.warn("error in readInvoice : quickbooks.server.helper.js");
            logger.debug(err);
            let errorObject = {
                error: err.Fault,
                message: err.Fault.Error[0].Detail
            };
            return callback(errorObject);
        }
        else {
            return callback(null, invoice);
        }
    });
}

/** importServiceTypes from QuickBooks */
/**
 * get Service Type
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function getServiceTypes(company: CompanyDataSchema, callback: any) {
    let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
        config.quickBooks.oAuthConsumerSecret,
        company.qboServices.qboToken,
        company.qboServices.qboTokenSecret,
        company.qboServices.qboCompanyId,
        config.quickBooks.sandbox,
        config.quickBooks.debug);
    ServiceType.find({
        company: company,
        deleted: false
    }, function(err: any, types: any) {
        if (err) {
            logger.warn("error in getServiceTypes : quickbooks.server.helper.js");
            logger.debug(err);
            return callback(err);
        }
        else {
            callback(null, types, qbo);
        }
    });
}

/**
 * find Quick Book Items
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function findQuickBookItems(company: CompanyDataSchema, callback: any) {
    if (company && company.qboServices) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox, // use the Sandbox depending on env
            config.quickBooks.debug); //
        qbo.findItems(function(err, items) {
            if (err) {
                logger.warn("error in importServiceTypes : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                return callback(errorObject);
            } else {
                logger.info("Got " + items.QueryResponse.Item + " items.");
                logger.info(items);
                if (items.QueryResponse && items.QueryResponse.Account) {
                    callback(null, items, qbo);
                }
                else {
                    callback({ message: "There was an error with Quickbooks." });
                }
            }
            ;
        });
    }
    else {
        return callback({ message: "Quickbooks is not configured for this company." });
    }
}

/**
 * find Quick Book Tax Code
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               types    [description]
 * @param  {any}               items    [description]
 * @param  {any}               qbo      [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function findQuickBookTaxCodes(company: CompanyDataSchema, types: any, items: any, qbo: any, callback: any) {
    qbo.findTaxCodes(function(err, codes) {
        if (err) {
            logger.warn("error in findQuickBookTaxCodes : quickbooks.server.helper.js");
            logger.debug(err);
            let errorObject = {
                error: err.Fault,
                message: err.Fault.Error[0].Detail
            };
            callback(errorObject);
        }
        else {
            if (items.QueryResponse && items.QueryResponse.Item) {
                items.QueryResponse.Item.forEach(function(item) {
                    if (!types.some(function(type) {
                        return (item.Name === type.name && item.FullyQualifiedName === type.qboName && item.Id === type.qboId && type.deleted === false);
                    })) {
                        let service: any = new ServiceType({ company: company._id });

                        service.name = item.Name;
                        service.qboName = item.FullyQualifiedName;
                        service.qboId = item.Id;
                        service.taxable = item.Taxable;
                        service.description = item.Description;
                        service.price = item.UnitPrice;

                        switch (item.Type) {
                            case "Service":
                                service.category = "Labor";
                                break;
                            case "Inventory":
                                service.category = "Inventory";
                                break;
                            case "NonInventory":
                                service.category = "Material";
                                break;
                        }

                        service.save(function(err, data) {
                            if (err) {
                                logger.warn("error in saving ServiceType findQuickBookTaxCodes : quickbooks.server.helper.js");
                                logger.debug(err);
                                return callback(err);
                            }
                        });
                    }
                    return callback(null, "Success!");
                });
            }
            else {
                return callback({ message: "No QueryResponse from Quickbooks" });
            }
        }
    });
}

/** Get quickbooks tax code */
/**
 * Get Quick Book tax code of company
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function getQuickBookTaxCodes(company: CompanyDataSchema, callback: any) {
    if (company && company.qboServices) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox,
            config.quickBooks.debug);

        qbo.findTaxCodes(function(err, codes) {
            if (err) {
                logger.warn("error in get tax code of company getQuickBookTaxCodes : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                return callback(errorObject);
            }

            if (codes.QueryResponse && codes.QueryResponse.TaxCode) {
                logger.info("Found " + codes.QueryResponse.TaxCode.length + " tax codes.");
                logger.info(codes.QueryResponse.TaxCode);

                return callback(null, { taxCodes: codes.QueryResponse.TaxCode });
            }
            else {
                logger.warn("error in get tax code of company getQuickBookTaxCodes : quickbooks.server.helper.js");
                logger.debug(codes);
                return callback({ message: "There was an error with Quickbooks." });
            }
        });
    }
    else {
        return callback({ message: "Quickbooks is not configured for this company." });
    }
}

/**
 * Get Quick Book acocunts of company
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function getQuickBookAccounts(company: CompanyDataSchema, callback: any) {
    if (company && company.qboServices) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox,
            config.quickBooks.debug);

        qbo.findAccounts(function(err, accounts) {
            if (err) {
                logger.warn("error in get accounts of company getQuickBookAccounts : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                return callback(errorObject);
            }

            if (accounts.QueryResponse && accounts.QueryResponse.Account) {
                logger.info("get accounts of company getQuickBookAccounts : quickbooks.server.helper.js");
                logger.debug(accounts);
                return callback(null, { accounts: accounts.QueryResponse.Account })
            }
            else {
                return callback({ message: "There was an error with Quickbooks." });
            }
        });
    }
    else {
        return callback({ message: "Quickbooks is not configured for this company." });
    }
}

/**
 * Find Quick Book customer of company
 * @param  {CompanyDataSchema} company  [description]
 * @param  {any}               callback [description]
 * @return {[type]}                     [description]
 */
export function findQuickBookCustomers(company: CompanyDataSchema, callback: any) {
    if (company && company.qboServices) {
        let qbo = new QuickBooks(config.quickBooks.oAuthConsumerKey,
            config.quickBooks.oAuthConsumerSecret,
            company.qboServices.qboToken,
            company.qboServices.qboTokenSecret,
            company.qboServices.qboCompanyId,
            config.quickBooks.sandbox,
            config.quickBooks.debug);

        qbo.findCustomers(function(err, customers) {
            if (err) {
                logger.warn("error in get customer of company findQuickBookCustomers : quickbooks.server.helper.js");
                logger.debug(err);
                let errorObject = {
                    error: err.Fault,
                    message: err.Fault.Error[0].Detail
                };
                return callback(errorObject);
            }

            if (customers.QueryResponse && customers.QueryResponse.Customer) {
                logger.info("get customers of company findQuickBookCustomers : quickbooks.server.helper.js");
                logger.debug(customers);
                return callback(null, { customers: customers.QueryResponse.Customer });
            }
            else {
                return callback({ message: "There was an error with Quickbooks." });
            }
        });
    }
    else {
        return callback({ message: "Quickbooks is not configured for this company." })
    }
}
