import * as mongoose from "mongoose";
import * as _ from "lodash";
import * as async from "async";
import * as moment from "moment-timezone";
import * as short from "short";
import * as Handlebars from "handlebars";
import * as express from "express";

export declare interface ShortUrlDataSchema extends mongoose.Document {
    URL: string;
    hash: string;
    hits: number;
}

export declare interface MessageTemplateDataSchema extends mongoose.Document {
    company: string;
    contactMethod: string;
    type: string;
    template: string;
    subject: string;
    deleted: boolean;
}

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

let Company = mongoose.model("Company"),
    MessageTemplate = mongoose.model("MessageTemplate"),
    ShortURL = mongoose.model("ShortURL");

let config = require("../../config/config.js"),
    logger = require("../../config/logger");


// parse the string stored in messageTemplate
/**
 * parse the string stored in messageTemplate
 * @param  {string}    messageTemplate [description]
 * @param  {any}    params          [description]
 * @param  {any}    callback        [description]
 * @return {[type]}                 [description]
 */
export function parseTemplate(messageTemplate: string, params: any, callback: any) {
    /* set default value for params */
    if (typeof params.company === "undefined") { params.company = {}; }
    if (typeof params.contact === "undefined") { params.contact = {}; }
    if (typeof params.controlInformation === "undefined") { params.controlInformation = {}; }
    if (typeof params.project === "undefined") { params.project = {}; }
    if (typeof params.property === "undefined") { params.property = {}; }
    if (typeof params.vendor === "undefined") { params.vendor = {}; }
    if (typeof params.workorderList === "undefined") { params.workorderList = {}; }

    if (params.associatedItems && params.associatedItems[0].type === "Workorder") {
        params.workorder = params.associatedItems[0].item;
    }
    else if (params.associatedItems && params.associatedItems[0].type === "Showing") {
        params.showing = params.associatedItems[0].item;
    }

    /* Email Template Helper */

    Handlebars.registerHelper("CONTACT_ACCOUNT_SETUP_LINK", function() {
        return new Handlebars.SafeString(`<a href="${config.appURL}/settings/users/validate/${params.controlInformation.contactUUID || (params.contact && params.contact.uuid) || ""}">Setup Link</a>`);
    });

    Handlebars.registerHelper("PASSWORD_RESET_LINK", function() {
        return new Handlebars.SafeString(`<a href="${config.appURL}/settings/users/reset-password/${params.controlInformation.contactUUID || (params.contact && params.contact.uuid)}/${(params.controlInformation && params.controlInformation.passwordResetToken) || params.passwordResetToken || ""}">Reset Password</a>`);
    });

    Handlebars.registerHelper("COMPANY_EMAIL", function() {
        return params.company.email;
    });

    Handlebars.registerHelper("COMPANY_NAME", function() {
        return params.company.name;
    });

    Handlebars.registerHelper("COMPANY_PHONE", function() {
        return params.company.phone;
    });

    Handlebars.registerHelper("COMPANY_TIMEZONE", function() {
        return params.company.timezone;
    });

    Handlebars.registerHelper("CONTACT_APPROVAL", function() {
        return params.controlInformation.contactApproval.displayName;
    });

    Handlebars.registerHelper("CONTACT_DISPLAYNAME", function() {
        return params.contact.displayName;
    });

    Handlebars.registerHelper("CONTACT_EMAIL", function() {
        return params.contact.email;
    });

    Handlebars.registerHelper("CONTACT_FIRSTNAME", function() {
        return params.contact.firstName;
    });

    Handlebars.registerHelper("CONTACT_LASTNAME", function() {
        return params.contact.lastName;
    });

    Handlebars.registerHelper("CONTACT_TYPE", function() {
        return params.contact.type;
    });

    Handlebars.registerHelper("DETAIL_LINK", function() {
        return new Handlebars.SafeString((`${config.siteURL}/showings/generate-showing-detail-report-data/${params.associatedItems && params.associatedItems[0] && (params.associatedItems[0].item._id || params.associatedItems[0].item)}`) || params.controlInformation.workorderDetailLink || "");
    });

    Handlebars.registerHelper("ESTIMATE_APPROVE", function() {
        let link: string = `${config.siteURL}/estimate/approve/${params.associatedItems && params.associatedItems[0].item._id || params.associatedItems[0].item}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Approve</a>`);
    });

    Handlebars.registerHelper("ESTIMATE_DENY", function() {
        let link: string = `${config.siteURL}/estimate/deny/${params.associatedItems && params.associatedItems[0].item._id || params.associatedItems[0].item}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Deny</a>`);
    });

    Handlebars.registerHelper("ESTIMATE_DETAIL", function() {
        return params.estimate.detail;
    });

    Handlebars.registerHelper("ESTIMATE_NUMBER", function() {
        return params.estimate.number;
    });

    Handlebars.registerHelper("MESSAGE", function() {
        return params.message
    });

    Handlebars.registerHelper("PROPERTY_ADDRESS", function() {
        return (params.unit && params.unit.address) || (params.property && params.property.address) || "";
    });

    Handlebars.registerHelper("PROPERTY_CITY", function() {
        return (params.property && params.property.city) || "";
    });

    Handlebars.registerHelper("PROPERTY_NAME", function() {
        return (params.property && params.property.name) || "";
    });

    Handlebars.registerHelper("PROPERTY_POSTALCODE", function() {
        return (params.property && params.property.postalCode) || "";
    });

    Handlebars.registerHelper("PROPERTY_STATE", function() {
        return (params.property && params.property.state) || "";
    });

    Handlebars.registerHelper("SHOWING_START", function() {
        return params.showing && moment(params.showing.showingStart).tz(params.company.timezone || "America/Chicago").format("dddd, MMMM Do YYYY, h:mm:ss a") || "";
    });

    Handlebars.registerHelper("SHOWING_END", function() {
        return params.showing && moment(params.showing.showingEnd).tz(params.company.timezone || "America/Chicago").format("dddd, MMMM Do YYYY, h:mm:ss a") || "";
    });

    Handlebars.registerHelper("SHOWING_AGENT_NAME", function() {
        return params.showing && params.showing.agent && params.showing.agent.displayName || "";
    });

    Handlebars.registerHelper("SHOWING_TENANT_LEAD_NAME", function() {
        return params.showing && params.showing.contact && params.showing.contact.displayName || "";
    });

    Handlebars.registerHelper("SHOWING_TENANT_LEAD_PHONE", function() {
        return params.showing && params.showing.contact && params.showing.contact.phones && params.showing.contact.phones[0] && params.showing.contact.phones[0].number || "";
    });

    Handlebars.registerHelper("SHOWING_TENANT_LEAD_EMAIL", function() {
        return params.showing && params.showing.contact && params.showing.contact.email || "";
    });

    Handlebars.registerHelper("SHOWING_CONFIRM", function() {
        let link: string = `${config.siteURL}/showings/emailConfirm/${(params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item))}/${params.contact._id}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Confirm</a>`);
    });

    Handlebars.registerHelper("SHOWING_CANCEL", function() {
        let link: string = `${config.siteURL}/showings/emailCancel/${(params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item))}/${params.contact._id}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Cancel</a>`);
    });

    Handlebars.registerHelper("SHOWING_DETAIL_LINK", function() {
        let link: string = `${config.siteURL}/showings/generate-showing-detail-report-data/${params.associatedItems && params.associatedItems[0] && (params.associatedItems[0].item._id || params.associatedItems[0].item)}` || "";
        return new Handlebars.SafeString(`"<a href="${link}">Details</a>"`);
    });

    Handlebars.registerHelper('SHOWING_LOCKBOX_CODE', function() {
        return (params.showing && params.showing.lockboxCode) || '';
    });

    Handlebars.registerHelper('SHOWING_REVIEW_LINK', function() {
        return new Handlebars.SafeString(`<a href="${params.controlInformation.showingReviewLink || ""}">Review Showing</a>`);
    });

    Handlebars.registerHelper('UNIT_NAME', function() {
        return (params.unit && params.unit.name) || '';
    });

    Handlebars.registerHelper('VENDOR_NAME', function() {
        return params.vendor && params.vendor.name || '';
    });

    Handlebars.registerHelper('WORKORDER_APPROVE', function() {
        let link: string = `${config.siteURL}/workorder/approve/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Approve</a>`);
    });

    Handlebars.registerHelper('WORKORDER_DENY', function() {
        let link: string = `${config.siteURL}/workorder/deny/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Deny</a>`);
    });

    Handlebars.registerHelper('WORKORDER_ACCESSDETAIL', function() {
        return params.workorder && params.workorder.accessDetail || '';
    });

    Handlebars.registerHelper('WORKORDER_ACCESSMETHOD', function() {
        return params.workorder && params.workorder.accessMethod || '';
    });

    Handlebars.registerHelper('WORKORDER_CANCEL', function() {
        let link: string = `${config.siteURL}/workorder/ownerCancel/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Cancel</a>`);
    });

    Handlebars.registerHelper('WORKORDER_COMPLETED', function() {
        let link: string = `${config.siteURL}/workorder/completed/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Completed</a>`);
    });

    Handlebars.registerHelper('WORKORDER_CONFIRM', function() {
        let link: string = `${config.siteURL}/workorder/confirm/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Confirm</a>`);
    });

    Handlebars.registerHelper('WORKORDER_CONFIRM_TODAY', function() {
        let link: string = `${config.siteURL}/workorder/confirmToday/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Confirm Today</a>`);
    });

    Handlebars.registerHelper('WORKORDER_DESCRIPTION', function() {
        return params.workorder && params.workorder.description || '';
    });

    Handlebars.registerHelper('WORKORDER_DETAIL_LINK', function() {
        return new Handlebars.SafeString(`<a href="${params.controlInformation.workorderDetailLink || ''}">Details</a>`);
    });

    Handlebars.registerHelper('WORKORDER_DETAILOWNER', function() {
        return params.workorder && params.workorder.detail_owner || '';
    });

    Handlebars.registerHelper('WORKORDER_DETAILTECHNICIAN', function() {
        return (params.workorder && params.workorder.detail_technician) || '';
    });

    Handlebars.registerHelper('WORKORDER_DURATION', function() {
        return (params.workorder && params.workorder.scheduledDate && getDuration(params.workorder.scheduledDate, params.company.timezone)) || '';
    });

    Handlebars.registerHelper('WORKORDER_INCOMPLETE', function() {
        let link: string = `${config.siteURL}/workorder/incomplete/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Not Completed</a>`);
    });

    Handlebars.registerHelper('WORKORDER_LOCKBOX_MESSAGE', function() {
        return params.workorder && (params.workorder.accessMethod === 'lockbox' ? 'Lockbox Code: ' + params.workorder.accessDetail : (params.workorder.accessMethod === 'tenant' ? 'The tenant will be present.' : '')) || '';
    });

    Handlebars.registerHelper('WORKORDER_NUMBER', function() {
        return params.workorder && params.workorder.number || '';
    });

    Handlebars.registerHelper('WORKORDER_RESCHEDULE', function() {
        let link: string = `${config.siteURL}/workorder/reschedule/${params.associatedItems && (params.associatedItems[0].item._id || params.associatedItems[0].item)}/${params.contact._id.toString()}` || "";
        return new Handlebars.SafeString(`<a href="${link}">Reschedule</a>`);
    });

    Handlebars.registerHelper('WORKORDER_REVIEW_LINK', function() {
        return new Handlebars.SafeString(`<a href="${params.controlInformation.workorderReviewLink || ''}">Review Workorder</a>`);
    });

    Handlebars.registerHelper('WORKORDER_SCHEDULEDDATE', function() {
        return params.workorder && (params.workorder.scheduledDate ? params.workorder.scheduledDate.toDateString() : '') || '';
    });

    Handlebars.registerHelper('WORKORDER_START', function() {
        return params.workorder && params.workorder.start || '';
    });

    // these were changed to use scheduledDate addhoc, might want to rename things later, found out that workorder.start is legacy (also workorder.end)
    Handlebars.registerHelper('WORKORDER_START_DATE', function() {
        return params.workorder && params.workorder.scheduledDate && moment(params.workorder.scheduledDate).tz(params.company.timezone || 'America/Chicago').format('MMMM Do, YYYY') || '';
    });

    Handlebars.registerHelper('WORKORDER_START_HOURS', function() {
        return params.workorder && params.workorder.scheduledDate && moment(params.workorder.scheduledDate).tz(params.company.timezone || 'America/Chicago').hours() || '';
    });

    Handlebars.registerHelper('WORKORDER_START_MINUTES', function() {
        return params.workorder && params.workorder.scheduledDate && moment(params.workorder.scheduledDate).tz(params.company.timezone || 'America/Chicago').minutes() || '';
    });

    Handlebars.registerHelper('WORKORDER_TENANT_PRESENCE', function() {
        return params.workorder && (params.workorder.accessMethod === 'tenant' ? 'You should be present through the duration of the appointment.' : 'You do not need to be present.') || '';
    });

    Handlebars.registerHelper('WORKORDER_VENDORNAME', function() {
        return params.workorder && params.workorder.vendorName || '';
    });

    // not actually a model this is built via a controller, need to work on this

    Handlebars.registerHelper('WORKORDER_LIST_MANAGER', function() {
        return params.workorderList && params.workorderList.manager || '';
    });

    Handlebars.registerHelper('WORKORDER_LIST_TODAY', function() {
        return params.workorderList && params.workorderList.today || '';
    });

    Handlebars.registerHelper('WORKORDER_LIST_YESTERDAY', function() {
        return params.workorderList && params.workorderList.yesterday || '';
    });

    // Format date time
    // usage: {{formatDateTime workder.create yyyy/mm/dd }}
    Handlebars.registerHelper('formatDateTime', (datetime: string, format: string): string => {
        return moment(datetime).format(format);
    });

    // usage: {{formatMoney payment.cost }}
    Handlebars.registerHelper('formatMoney', (money: string): any => {
        if (_.isNumber(money) && parseInt(money) > 0) {
            return parseFloat(money).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
        }
        else {
            return 0;
        }
    });

    function handlebarParser(dictParams: any, messageTemplate: any) {

        logger.warn('messageTemplate.server.controller.js: handlebarParser(messageTemplate, dictParams)');
        let subj: string, msg: string, template: any;
        logger.warn('******** PRINTING PARAMS PASSED IN ********');
        logger.debug(dictParams);
        logger.warn('******** END PRINT PARAMS ********');

        if (messageTemplate.subject) {
            messageTemplate.subject = messageTemplate.subject.replace(/[<]+/g, '{{');
            messageTemplate.subject = messageTemplate.subject.replace(/[>]+/g, '}}');
            template = Handlebars.compile(messageTemplate.subject);
            subj = template(dictParams);
        }
        messageTemplate.template = messageTemplate.template.replace(/[<]+/g, '{{');
        messageTemplate.template = messageTemplate.template.replace(/[>]+/g, '}}');
        template = Handlebars.compile(messageTemplate.template);
        msg = template(dictParams);

        let msgObj = {
            subject: subj || '',
            message: msg || ''
        };

        logger.warn('******** PRINTING msgObj ********');
        logger.debug(msgObj);
        logger.warn('******** END PRINT msgObj ********');

        return callback && callback(msgObj);
    }

    // we are going to send a detail pdf link, but we need to make it shorter
    function getShortURL(params: any, message: any, callback: any) {
        // if we are already connected let's not try to connect again

        //todo: could still have some kind of connection collision things when we actually have customers
        if (!(short && short.connection && short.connection.db)) {
            logger.warn('not connected to short link db yet');
            short.connect(config.db);
        }

        short.connection.on('error', function(error) {
            logger.debug(error);
        });

        //todo: the promises are rejected occasionally, so i just rerun it through the function. in fact, we could move this out into a separate function
        //todo: the issue could be that we are generating links for the same url?
        //todo: duplicate key error under mongodbdoc on rejected callback, probably because we are trying to generate the same key multiple times, so this is fine but it would be better to generate once...but kind of hard to do

        //todo: fix this further up
        if (params.associatedItems && params.associatedItems[0].type === 'Workorder') {
            async.parallel([
                function(callback) {
                    ShortURL.findOne({ URL: config.siteURL + '/pdf/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || '') + '.pdf?type=workorderdetail&displayFormat=' + params.type }, function(err: any, shortenedUrl: ShortUrlDataSchema) {
                        if (err) {
                            logger.debug(err);
                        }

                        logger.debug(config.siteURL + '/pdf/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || '') + '.pdf?type=workorderdetail&displayFormat=' + params.type);
                        // i couldn't get this to work so i hacked it...
                        if (!shortenedUrl) {
                            logger.warn('GENERATING SHORT URL');
                            short.generate({
                                URL: config.siteURL + '/pdf/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || '') + '.pdf?type=workorderdetail&displayFormat=' + params.type
                            }).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    if (!params.controlInformation) params.controlInformation = {};
                                    params.controlInformation.workorderDetailLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.workorderDetailLink = '';
                                    return callback(null);
                                }
                            }, function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    params.controlInformation.workorderDetailLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.workorderDetailLink = '';
                                    return callback(null);
                                }
                            });
                        }
                        else {
                            logger.warn('RETRIEVING SHORT URL');
                            short.retrieve(shortenedUrl.hash).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    params.controlInformation.workorderDetailLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback && callback(null);
                                }
                                else {
                                    params.controlInformation.workorderDetailLink = '';
                                    return callback && callback(null);
                                }
                            }, function(err) {
                                logger.warn('Error in short url again!: ' + err);
                            });
                        }
                    })
                },
                function(callback: any) {
                    logger.warn('ABOUT TO GENERATE SHORTURL FOR SURVEYS HERE ARE THE PARAMS');
                    logger.debug(params);
                    ShortURL.findOne({ URL: config.appURL + '/surveys/complete/' + (params.company._id || params.company || '') + '/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || params.workorder) + '/maintain' }, function(err: any, shortenedUrl: ShortUrlDataSchema) {
                        logger.debug(config.appURL + '/surveys/complete/' + (params.company._id || params.company || '') + '/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || params.workorder) + '/maintain');

                        if (err) {
                            logger.debug(err);
                        }

                        if (!shortenedUrl) {
                            logger.warn('GENERATING SHORT URL');
                            logger.debug(config.siteURL);

                            short.generate({
                                URL: config.appURL + '/surveys/complete/' + (params.company._id || params.company || '') + '/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || params.workorder) + '/maintain'
                            }).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    if (!params.controlInformation) params.controlInformation = {};
                                    params.controlInformation.workorderReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.workorderReviewLink = '';
                                    return callback(null);
                                }
                            }, function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    params.controlInformation.workorderReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.workorderReviewLink = '';
                                    return callback(null);
                                }
                            });
                        }
                        else {
                            logger.warn('RETRIEVING SHORT URL');
                            short.retrieve(shortenedUrl.hash).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    params.controlInformation.workorderReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.workorderReviewLink = '';
                                    return callback(null);
                                }
                            });
                        }
                    });
                }
            ], function(err: any) {
                if (err) {
                    logger.debug(err);
                    return callback && callback(err);
                }
                return callback && callback(params, message);
            }
            )
        }
        else if (params.associatedItems && params.associatedItems[0].type === 'Showing') {
            async.parallel([
                function(callback: any) {
                    ShortURL.findOne({ URL: config.siteURL + '/pdf/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || '') + '.pdf?type=workorderdetail&displayFormat=' + params.type }, function(err: any, shortenedUrl: ShortUrlDataSchema) {
                        logger.debug(config.siteURL + '/pdf/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || '') + '.pdf?type=workorderdetail&displayFormat=' + params.type);

                        if (err) {
                            logger.debug(err);
                        }
                        // i couldn't get this to work so i hacked it...
                        if (!shortenedUrl) {
                            logger.warn('GENERATING SHORT URL');
                            short.generate({
                                URL: config.siteURL + '/pdf/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || '') + '.pdf?type=workorderdetail&displayFormat=' + params.type
                            }).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    if (!params.controlInformation) params.controlInformation = {};
                                    params.controlInformation.showingReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.showingReviewLink = '';
                                    return callback(null);
                                }
                            }, function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Workorder') {
                                    params.controlInformation.showingReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.showingReviewLink = '';
                                    return callback(null);
                                }
                            });
                        }
                        else {
                            logger.warn('RETRIEVING SHORT URL');
                            short.retrieve(shortenedUrl.hash).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Showing') {
                                    params.controlInformation.showingReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback && callback(null);
                                }
                                else {
                                    params.controlInformation.showingReviewLink = '';
                                    return callback && callback(null);
                                }
                            }, function(err) {
                                logger.warn('Error in short url again!: ' + err);
                            });
                        }
                    })
                },
                function(callback: any) {
                    logger.warn('ABOUT TO GENERATE SHORTURL FOR SURVEYS HERE ARE THE PARAMS');
                    logger.debug(params);
                    ShortURL.findOne({ URL: config.appURL + '/surveys/complete/' + (params.company._id || params.company || '') + '/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || params.workorder) + '/showing' }, function(err: any, shortenedUrl: ShortUrlDataSchema) {
                        logger.debug(config.appURL + '/surveys/complete/' + (params.company._id || params.company || '') + '/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || params.workorder) + '/showing');

                        if (err) {
                            logger.debug(err);
                        }

                        if (!shortenedUrl) {
                            logger.warn('GENERATING SHORT URL');
                            logger.debug(config.siteURL);

                            short.generate({
                                URL: config.appURL + '/surveys/complete/' + (params.company._id || params.company || '') + '/' + (params.associatedItems[0].item._id || params.associatedItems[0].item || params.showing) + '/showing'
                            }).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Showing') {
                                    if (!params.controlInformation) params.controlInformation = {};
                                    params.controlInformation.showingReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.showingReviewLink = '';
                                    return callback(null);
                                }
                            }, function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Showing') {
                                    params.controlInformation.showingReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.showingReviewLink = '';
                                    return callback(null);
                                }
                            });
                        }
                        else {
                            logger.warn('RETRIEVING SHORT URL');
                            short.retrieve(shortenedUrl.hash).then(function(mongodbDoc: ShortUrlDataSchema) {
                                if (params.associatedItems[0].type === 'Showing') {
                                    params.controlInformation.showingReviewLink = config.siteURL + '/pmt/' + mongodbDoc.hash;
                                    return callback(null);
                                }
                                else {
                                    params.controlInformation.showingReviewLink = '';
                                    return callback(null);
                                }
                            });
                        }
                    });
                }
            ], function(err: any) {
                if (err) {
                    logger.debug(err);
                    return callback && callback(err);
                }
                return callback && callback(params, message);
            }
            )
        }
        else {
            logger.debug(params);
            logger.debug(message);
            return callback && callback(params, message);
        }
    }

    return getShortURL(params, messageTemplate, handlebarParser);
}

/**
 * Gets customized message template for a company.
 * If no such message was found, a copy of default message template will be provided to calback.
 * If the message type is unknown, a error will be provided to callback.
 * Please note that the returned template is NOT to be guaranteed the fully-featured MessageTemplate mongoose document.
 * Callback will get the following arguments: error (Error|null), template (object|undefined), templateIsDefault (boolean|undefined)
 * @param { { contactMethod: string, templateType: string, company: string} } options - template search options
 * @param {function} callback - Code that will receive operation output
 */
export function getCompanyOrDefaultMessageTemplate(options: any, callback: any) {
    MessageTemplate.findOne({ contactMethod: options.contactMethod, type: options.templateType, company: options.company },
        function messageTemplateSearchCompleted(err: any, template: MessageTemplateDataSchema) {
            if (err) {
                return callback && callback(err);
            }
            let needDefaultTemplate = !template;
            if (needDefaultTemplate) {
                let objTemplate: any = getDefaultTemplates(options.companyId).filter(function(defaultTemplate) {
                    return defaultTemplate.contactMethod && options.contactMethod
                        && defaultTemplate.type === options.messageType;
                })[0];
                if (objTemplate) {
                    template = _.cloneDeep(objTemplate);
                }
            }
            if (!template) {
                return callback && callback(new Error('Nor customized neither default message template was found for given contact method and message type'));
            }
            return callback && callback(null, template, needDefaultTemplate);
        });
}

/**
 * getDuration get the duration.
 * @param start
 * @param companyTimezone
 * @returns {string}
 */
function getDuration(start, companyTimezone) {
    let startDate: any = moment(start).tz(companyTimezone || 'America/Chicago');
    return ((moment(startDate).format('hh:mm A')) + ' and ' + (moment(startDate.add(2, 'hours')).format('hh:mm A')));
}

// crud stuff

export function create(req: any, res: express.Response) {
    logger.warn('messageTemplate.server.controller.js: create(req,res)');

    let companyId: string = req.companyId;
    req.body.company = companyId;

    MessageTemplate.findOne({ company: companyId, contactMethod: req.body.contactMethod, type: req.body.type }, function(err: any, template: MessageTemplateDataSchema) {
        if (!template) {
            let messageTemplate = new MessageTemplate(req.body);
            messageTemplate.save(function(err: any) {
                if (err) {
                    return res.send({ error: err });
                }
                else {
                    return res.end();
                }
            });
        }
        else {
            return res.status(403).send({});
        }
    });
}

export function read(req: any, res: express.Response, next: any) {
    logger.debug("messageTemplate.server.controller.js: exports.read(req,res)");

    let messageTemplateId = req.params.messageTemplateId || req.messageTemplateId;

    let fields: any = {},
        populate: any = { values: '', fields: '' };

    if (req.query.fields)
        fields = req.query.fields;
    if (req.query.populate)
        populate = JSON.parse(req.query.populate);

    MessageTemplate.findById(messageTemplateId)
        .select(fields)
        .populate(populate.fields, populate.values)
        .exec(function(err: any, messageTemplate: MessageTemplateDataSchema) {
            if (err) {
                return next(err);
            }
            if (!messageTemplate) return next(new Error('Failed to load messageTemplate ' + messageTemplateId));
            req.messageTemplate = messageTemplate;

            res.jsonp(messageTemplate);
        });
}

export function update(req: any, res: express.Response) {
    logger.warn('messageTemplate.server.controller.js: update(req,res)');

    let messageTemplateId = req.params.messageTemplateId;

    let update = depopulateMessageTemplate(req.body);

    MessageTemplate.update({ _id: messageTemplateId }, update).exec(function(err, messageTemplate) {
        if (err) {
            logger.debug(err);
            return res.status(400).send({
                message: err.message
            });
        }
        else {
            logger.warn('updated, going to read');
            logger.debug(messageTemplate);
            return exports.read(req, res);
        }
    });
}

function depopulateMessageTemplate(messageTemplate) {
    if (messageTemplate.company) {
        messageTemplate.company = typeof messageTemplate.company == 'object' ? messageTemplate.company._id : messageTemplate.company;
    }

    var messageTemplate = _.cloneDeep(messageTemplate);

    delete messageTemplate._id;
    delete messageTemplate.__v;
    delete messageTemplate.$promise;
    delete messageTemplate.$resolved;

    return messageTemplate;
}

export function remove(req: any, res: express.Response) {
    logger.warn('messageTemplate.server.controller.js: delete(req,res)');

    let messageTemplateId: string = req.params.messageTemplateId;

    MessageTemplate.findByIdAndUpdate(messageTemplateId, { $set: { deleted: true } }, { new: true }).exec(function(err: any, template: MessageTemplateDataSchema) {
        if (err) {
            return res.status(400).send({ message: err.message });
        }
        else {
            return res.jsonp(template);
        }
    });

}

export function list(req: any, res: express.Response) {
    logger.warn('messageTemplate.server.controller.js: list(req,res)');

    let companyId: string = req.companyId;

    MessageTemplate.find({ company: companyId }, function(err, templates: MessageTemplateDataSchema[]) {
        if (err) {
            return res.status(400).send({ message: err.message });
        }
        else {
            return res.jsonp(templates);
        }
    });

}

export function messageTemplateById(req: any, res: express.Response, next: any, id: string) {
    MessageTemplate.findById(id)
        .exec(function(err: any, messageTemplate: MessageTemplateDataSchema) {
            if (err) {
                return next(err);
            }
            if (!messageTemplate) return next(new Error('Failed to load template ' + id));
            req.messageTemplate = messageTemplate;
            next();
        });
}

// defaults

export function saveDefaultTemplates(companyId: any) {
    if (typeof (companyId) === 'object' && companyId.params) {
        if (companyId.params) {
            companyId = companyId.params;
        }
    }

    let defaultTemplates: any = getDefaultTemplates(companyId);
    defaultTemplates.forEach(function(template: MessageTemplateDataSchema) {
        let tmp: any = new MessageTemplate(template);
        tmp.save(function(err: any, savedTemplate: MessageTemplateDataSchema) {
            logger.warn('saved template');
        })
    });
}

// check if the template exists before saving, for restoring templates that may have been deleted or for updating when we add new templates

export function restoreMissingTemplates(companyId: any) {
    if (typeof (companyId) === 'object') {
        if (companyId.params) {
            companyId = companyId.params;
        }
    }

    let defaultTemplates: any = getDefaultTemplates(companyId);
    defaultTemplates.forEach(function(template: MessageTemplateDataSchema) {
        let tmpl: any = new MessageTemplate(template);
        MessageTemplate.findOne({ company: companyId, contactMethod: tmpl.contactMethod, type: tmpl.type }, function(err, tmp) {
            if (err) {
                logger.debug(err);
            }
            if (!tmp) {
                tmpl.save(function(err, doc) {
                    if (err) {
                        logger.debug(err);
                    }
                    else {
                        logger.warn('Restored template: ' + tmpl.contactMethod + ' ' + tmpl.type);
                    }
                })
            }
            else {
                logger.warn('Template ' + tmpl.contactMethod + ' ' + tmpl.type + ' already exists, skipping.');
            }
        });
    })
}

// restore defaults, upserts
export function restoreDefaultTemplates(companyId: any) {
    logger.warn('attempting to restore default templates');
    if (typeof (companyId) === 'object') {
        if (companyId.params) {
            companyId = companyId.params.companyId;
        }
    }

    let defaultTemplates = getDefaultTemplates(companyId);
    defaultTemplates.forEach(function(template: MessageTemplateDataSchema) {
        let templ: MessageTemplateDataSchema = template;// = new MessageTemplate(template);
        MessageTemplate.findOneAndUpdate({ company: companyId, contactMethod: templ.contactMethod, type: templ.type }, templ, { new: true, upsert: true }, function(err: any, tmp: MessageTemplateDataSchema) {
            if (err) {
                logger.debug(err);
            }
            else {
                logger.debug(tmp);
            }
        });
    });
}

export function performActionAllCompanies(req: any, res: express.Response) {
    let action: string = req.params.action;

    Company.find({}).exec(function(err: any, companies: CompanyDataSchema[]) {
        if (err) {
            return res.status(500).send({ message: err.message });
        }
        companies.forEach(function(company: CompanyDataSchema) {
            switch (action) {
                case 'saveDefaults':
                    exports.saveDefaultTemplates(company._id);
                    break;

                case 'restoreMissing':
                    exports.restoreMissingTemplates(company._id);
                    break;

                case 'restoreDefaults':
                    exports.restoreDefaultTemplates(company._id);
                    break;

                default:
                    logger.warn('No function for action: ' + action);
                    break;
            }
        });

        return res.end();
    });
}

/**
 * Returns array of default templates for a given company
 * @param {string} companyId - Company id to use for default templates generation
 * @returns {[Object]} Array of generated default templates
 */
function getDefaultTemplates(companyId: string) {
    return [
        {
            company: companyId,
            contactMethod: 'MMS',
            template: '{{MESSAGE}}',
            type: 'mms:sendMessage'
        },
        {
            company: companyId,
            contactMethod: 'MMS',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled.',
            type: 'mms:scheduleTenantWorkOrder'
        },
        {
            company: companyId,
            contactMethod: 'MMS',
            template: 'Sorry, your phone number was not found in our database, please call our office at {{COMPANY_PHONE}}',
            type: 'mms:unknownContact'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'company:onsite {{MESSAGE}}',
            type: 'company:onsite'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'company:pm {{MESSAGE}}',
            type: 'company:pm'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'company:coord {{MESSAGE}}',
            type: 'company:coord'
        }, {
            company: companyId,
            contactMethod: 'SMS',
            template: 'company:maint Work Order #{{WORKORDER_NUMBER}}',
            type: 'company:maint'
        }, {
            company: companyId,
            contactMethod: 'SMS',
            template: 'company:agent Work Order #{{WORKORDER_NUMBER}}',
            type: 'company:agent'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: '{{MESSAGE}}\n\n Details: {{DETAIL_LINK}}',
            type: 'sms:sendMessage'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled for you by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\nPLEASE RESPOND with a 2 to accept, or an 8 to reschedule/decline\n\nDetails: {{WORKORDER_DETAIL_LINK}}\n',
            type: 'notifyVendor:workOrderScheduled'
        },
        /*{
         company: companyId,
         contactMethod: 'SMS',
         type: 'notifyVendor:workOrderScheduled',
         template: 'New Work Order Scheduled #{{WORKORDER_NUMBER}}\n\n{{WORKORDER_LOCKBOX_MESSAGE}}\n'
         },*/
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyCompany:workOrderCreated',
            template: 'Workorder #{{WORKORDER_NUMBER}} has been created.\n'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyCompany:workOrderCreated',
            template: 'Workorder #{{WORKORDER_NUMBER}} has been created.\n'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyCompany:workOrderCreated',
            template: 'Workorder #{{WORKORDER_NUMBER}} has been created.\n'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyCompany:workOrderCreated',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been created.\n'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyCompany:workOrderCreated',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been created.\n'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyCompany:workOrderCreated',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been created.\n'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'New text from {{CONTACT_DISPLAYNAME}} ({{CONTACT_TYPE}})\n{{MESSAGE}}\n',
            type: 'notifyCompany:textMessageReceived'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled. \n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyCompany:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Your schedule from {{WORKORDER_LIST_MANAGER}}:\nToday\'s Workorders\n{{WORKORDER_LIST_TODAY}}\nYesterday\'s Workorders (Completed):\n{{WORKORDERS_LIST_YESTERDAY}}\nTo confirm ALL reply with 2, to reschedule incomplete reply with the work order number(s)\n',
            type: 'notifyVendor:workOrderList'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Work Order # {{WORKORDER_NUMBER}} has been scheduled at one of your properties at {{PROPERTY_NAME}} on {{WORKORDER_START_DATE}}.\n',
            type: 'notifyOwner:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Thank you for confirming.',
            type: 'notifyVendor:workOrderScheduledConfirmed'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been created for your place. You will be notfied when it has been scheduled.\n',
            type: 'notifyTenant:workOrderCreated'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, a workorder has been created for your property. We are requesting permission to complete this work order. \nTo APPROVE with 2, to CANCEL reply with an 8\n',
            type: 'notifyOwner:workOrderOwnerPermission'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been completed.',
            type: 'notifyOwner:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been created for one of your properties at {{PROPERTY_NAME}}. You will be notified when it has been scheduled.\n',
            type: 'notifyOwner:workOrderCreated'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear Owner, please be informed that workorder #{{WORKORDER_NUMBER}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been cancelled.\n',
            type: 'notifyOwner:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Workorder #{{WORKORDER_NUMBER}} for your home has been rescheduled and you will be notified of the new date and time.\n',
            type: 'notifyTenant:workOrderReScheduled'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} will be rescheduled. We will contact you with a new date and time.',
            type: 'notifyVendor:workOrderReScheduled'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Reminder you are scheduled on work order #{{WORKORDER_NUMBER}} today for {{COMPANY_NAME}} Please respond with a 2 to confirm you will perform the work today, or an 8 if there is a problem and it needs to be rescheduled.',
            type: 'notifyVendor:workOrderReminder'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Reminder that work order #{{WORKORDER_NUMBER}} is scheduled at your place today. The vendor coming to your place is {{VENDOR_NAME}}. They will be there between {{WORKORDER_DURATION}}.',
            type: 'notifyTenant:workOrderReminder'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Thank you for working on work order #{{WORKORDER_NUMBER}} yesterday for {{COMPANY_NAME}}. Please respond with a 2 to confirm that the job was completed. If it was not completed, please respond with an 8 and a short description of the issue.',
            type: 'notifyVendor:workOrderFinished'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Thank you for your patience while {{VENDOR_NAME}} completed work order #{{WORKORDER_NUMBER}}. If the work was done completely please respond with a 2, if there was an issue, please respond with an 8.',
            type: 'notifyTenant:workOrderFinished'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Thanks again for working with {{COMPANY_NAME}}. We would love to hear your thoughts on the work performed, please follow the link provided to leave a review:\n\n {{WORKORDER_REVIEW_LINK}}.\n\n Details: {{WORKORDER_DETAIL_LINK}}.',
            type: 'notifyTenant:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear tenant, please be informed that workorder #{{WORKORDER_NUMBER}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been cancelled.',
            type: 'notifyTenant:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Thank you for working with {{COMPANY_NAME}}. Workorder #{{WORKORDER_NUMBER}} has been marked as complete. Please send the invoice as quickly as possible.',
            type: 'notifyVendor:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear Vendor, please be informed that workorder #{{WORKORDER_NUMBER}} scheduled on {{WORKORDER_SCHEDULEDDATE}} for {{COMPANY_NAME}} has been cancelled.',
            type: 'notifyVendor:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} will be rescheduled. We will contact you with a new date and time.',
            type: 'notifyOwner:workOrderReScheduled'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, an estimate has been created for your property. We are requesting permission to complete this estimate. \nTo APPROVE with 2, to DENY reply with an 8\n',
            type: 'notifyOwner:contactApprovalEstimates'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, an estimate has been created for your property. We are requesting permission to complete this estimate. \nTo APPROVE with 2, to DENY reply with an 8\n',
            type: 'notifyOwner:contactApprovalEstimates'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, a workorder has been created, we are requesting permission to complete this workorder. \nTo APPROVE with 2, to DENY reply with an 8\n',
            type: 'notifyCompany:contactApprovalWorkorders'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, an estimate has been created, we are requesting permission to complete this estimate. \nTo APPROVE with 2, to DENY reply with an 8\n',
            type: 'notifyCompany:contactApprovalEstimates'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: '{{CONTACT_APPROVAL}} approved workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactApprovedWorkorder'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: '{{CONTACT_APPROVAL}} denied estimate #{{ESTIMATE_NUMBER}}',
            type: 'notifyCompany:contactDeniedEstimate'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: '{{CONTACT_APPROVAL}} approved workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactApprovedWorkorder'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: '{{CONTACT_APPROVAL}} denied workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactDeniedWorkorder'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} will be rescheduled. We will contact y ou with a new date and time.',
            type: 'notifyOwner:workOrderReScheduled',
            subject: 'PM Toolbelt: Work Order Rescheduled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Work order #{{WORKORDER_NUMBER}} has been confirmed.',
            type: 'notifyOwner:workOrderScheduledConfirmed',
            subject: 'PM Toolbelt: Work Order Confirmed'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, we want you to know a workorder, #{{WORKORDER_NUMBER}} has been scheduled at one of your properties. A technician will be at  your property between {{WORKORDER_DURATION}} on {{WORKORDER_START_DATE}}.\n\nProperty: {{PROPERTY_ADDRESS}}\n{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n\nDescription: {{WORKORDER_DESCRIPTION}}\n\nNotes: {{WORKORDER_DETAILOWNER}}\n\n',
            type: 'notifyOwner:workOrderScheduled',
            subject: 'PM Toolbelt: Workorder Scheduled by {{COMPANY_NAME}}'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'requestContactForLogin',
            template: 'Hello.  You have been assigned a login account for PM Toolbelt.  To finish setting up your account, please click the link below.\n\n{{CONTACT_ACCOUNT_SETUP_LINK}}',
            subject: 'Your new login account for PM Toolbelt'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'sendPasswordResetLink',
            template: 'Hello.  A password reset link have been required for PM Toolbelt. If you requested a password reset for your PM Toolbelt account, click the link below.\n\n{{PASSWORD_RESET_LINK}}',
            subject: 'Your password reset link for PM Toolbelt'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, we want to thank you for your patience while we completed work order #{{WORKORDER_NUMBER}}. It is now complete. \nWe would love to hear your thoughts on the work performed, please follow the link provided to leave a review:\n\n {{WORKORDER_REVIEW_LINK}}.\n\n Details: {{WORKORDER_DETAIL_LINK}}.',
            type: 'notifyTenant:workOrderCompleted',
            subject: 'PM Toolbelt: Work Order Completed'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, we want to thank you for your patience while we completed work order #{{WORKORDER_NUMBER}}. It is now complete. \nWe would love to hear your thoughts on the work performed, please follow the link provided to leave a review:\n\n {{WORKORDER_REVIEW_LINK}}.',
            type: 'notifyTenant:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyOwner:workOrderOwnerPermission',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, a workorder has been created for your proeprty. We are requesting permission to complete this work order. The details are: \n\nWorkorder: {{WORKORDER_NUMBER}}\nIssue: {{WORKORDER_DESCRIPTION}}\nNotes: {{WORKORDER_DETAILOWNER}}\nScheduled: {{WORKORDER_SCHEDULEDDATE}}\nVendor: {{WORKORDER_VENDORNAME}}\n\nPLEASE NOTE: This work order requires your permission to proceed. Your timely response is appreciated. \n\nClick to allow us to proceed: \n{{WORKORDER_CONFIRM}}\n\nClick and we will cancel this work order:\n{{WORKORDER_CANCEL}}',
            subject: 'PMToolbelt: Permission Requested'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenant:workOrderCreated',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, we want you to know that we have created a workorder for your repair at {{PROPERTY_ADDRESS}}. The work order is {{WORKORDER_NUMBER}}. We will followup with you after it is scheduled.',
            subject: 'PM Toolbelt: Workorder created'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, thank you for your patience on work order #{{WORKORDER_NUMBER}}. Our records show it was completed yesterday. Please confirm that the work was done to your satisfaction.\nPlease click one of the links below (if you cannot click it, please copy and paste the URL into a web browser)\n\nWork Order Completed:\n{{WORKORDER_COMPLETED}}\n\nNot Complete:\n{{WORKORDER_INCOMPLETE}}',
            type: 'notifyTenant:workOrderFinished',
            subject: 'PM Toolbelt: Work Order Completed'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please be informed that workorder #{{WORKORDER_NUMBER}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been cancelled.',
            type: 'notifyTenant:workOrderDeleted',
            subject: 'PM Toolbelt: Workorder Cancelled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that work order #{{WORKORDER_NUMBER}} will be rescheduled. We will contact you with a new date and time.',
            type: 'notifyTenant:workOrderReScheduled',
            subject: 'PM Toolbelt: Work Order Rescheduled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Work Order Scheduled by {{COMPANY_NAME}}',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, we want you to know your work order, #{{WORKORDER_NUMBER}} has been scheduled. A technician will be at your place between {{WORKORDER_DURATION}} on {{WORKORDER_START_DATE}}. {{WORKORDER_TENANT_PRESENCE}} \n\nDescription: {{WORKORDER_DESCRIPTION}}\n\n',
            type: 'notifyTenant:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Work Order Reminder',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, this is a reminder that work order #{{WORKORDER_NUMBER}} is scheduled today for your home.',
            type: 'notifyTenant:workOrderReminder'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Work order #{{WORKORDER_NUMBER}} has been confirmed by the vendor.',
            type: 'notifyTenant:workOrderScheduledConfirmed',
            subject: 'PM Toolbelt: Work Order Confirmed'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, we want you to know a workorder, #{{WORKORDER_NUMBER}} has been scheduled for you by {{COMPANY_NAME}}. You are scheduled to be at the following property between {{WORKORDER_DURATION}} on {{WORKORDER_START_DATE}}.\n\nAddress: {{PROPERTY_ADDRESS}}\n{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n\nDescription: {{WORKORDER_DESCRIPTION}}\n\nNotes: {{WORKORDER_DETAILTECHNICIAN}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\nPlease click one of the links below (if y ou cannot click on it, please copy and paste the URL into a web browser)\n\nTo confirm:\n{{WORKORDER_CONFIRM}}\n\nTo reschedule:\n{{WORKORDER_RESCHEDULE}}',
            type: 'notifyVendor:workOrderScheduled',
            subject: 'PM Toolbelt: New Work Order Scheduled by {{COMPANY_NAME}}'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been cancelled.',
            type: 'notifyVendor:workOrderDeleted',
            subject: 'PM Toolbelt: Work Order Cancelled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, work order #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} has been confirmed.',
            type: 'notifyVendor:workOrderScheduledConfirmed',
            subject: 'PM Toolbelt: Work Order Confirmed'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Work Order Finished',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, thank you for working on work order #{{WORKORDER_NUMBER}} yesterday for {{COMPANY_NAME}}.\nPlease click one of the links below (if you cannot click on it, please copy and paste the URL into a web browser)\n\nWork Order Completed:\n{{WORKORDER_COMPLETE}}\n\nNot Complete:{{WORKORDER_INCOMPLETE}}',
            type: 'notifyVendor:workOrderFinished'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Work Order Rescheduled',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that work order #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} will be rescheduled. We will contact you with a new date and time.',
            type: 'notifyVendor:workOrderReScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, this is a reminder that you are scheduled on work order #{{WORKORDER_NUMBER}} today for {{COMPANY_NAME}}\nPlease click on the links below (if you cannot click on it, please copy and paste the URL into a web browser)\n\nTo Confirm\n{{WORKORDER_CONFIRM_TODAY}}\n\nTo Reschedule:\n{{WORKORDER_RESCHEDULE}}',
            type: 'notifyVendor:workOrderReminder',
            subject: 'PM Toolbelt: Work Order Reminder'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that work order #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been cancelled.',
            type: 'notifyOwner:workOrderDeleted',
            subject: 'M Toolbelt: Work Order Cancelled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been completed.',
            type: 'notifyOwner:workOrderCompleted',
            subject: 'PM Toolbelt: Work Order Completed'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been completed.',
            type: 'notifyOwner:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been completed.',
            type: 'notifyCompany:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Workorder Completed',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been completed.',
            type: 'notifyCompany:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, please know that workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been completed.',
            type: 'notifyCompany:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Workorder Completed',
            template: 'Thank you for working with {{COMPANY_NAME}}. Workorder #{{WORKORDER_NUMBER}} has been marked as complete. Please send the invoice as quickly as possible.',
            type: 'notifyVendor:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Thank you for working with {{COMPANY_NAME}}. Workorder #{{WORKORDER_NUMBER}} has been marked as complete. Please send the invoice as quickly as possible.',
            type: 'notifyVendor:workOrderCompleted'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, a workorder has been created, we are requesting ' +
            'permission to complete this work order. The ' +
            'details are: \n\nWorkorder: {{WORKORDER_NUMBER}}\nIssue: {{WORKORDER_DESCRIPTION}}\nNotes: ' +
            '{{WORKORDER_DETAILOWNER}}\nScheduled: {{WORKORDER_SCHEDULEDDATE}}\nVendor: {{WORKORDER_VENDORNAME}}\n\n' +
            'PLEASE NOTE: This work order requires your permission to proceed. Your timely response is appreciated.' +
            ' \n\nClick to allow us to proceed: \n{{WORKORDER_APPROVE}}\n\nClick and we will cancel this work order:\n{{WORKORDER_DENY}}',
            type: 'notifyCompany:contactApprovalWorkorders',
            subject: 'PM Toolbelt: Workorder Approval Requested'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Dear {{CONTACT_FIRSTNAME}} {{CONTACT_LASTNAME}}, an estimate has been created, we are requesting ' +
            'permission to complete this estimate.' +
            '\n\nEstimate number: {{ESTIMATE_NUMBER}}\nDescription: {{ESTIMATE_DESCRIPTION}}\nClick to approve this estimate: ' + '{{ESTIMATE_APPROVE}}\n\nClick and we will deny this estimate: {{ESTIMATE_DENY}}',
            type: 'notifyCompany:contactApprovalEstimates',
            subject: 'PM Toolbelt: Estimate Approval Requested'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: '{{CONTACT_APPROVAL}} approved workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactApprovedWorkorder',
            subject: 'PM Toolbelt: Workorder #{{WORKORDER_NUMBER}} Approved'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: '{{CONTACT_APPROVAL}} denied workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactDeniedWorkorder',
            subject: 'PM Toolbelt: Workorder #{{WORKORDER_NUMBER}} Denied'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: '{{CONTACT_APPROVAL}} approved estimate #{{ESTIMATE_NUMBER}}',
            type: 'notifyCompany:contactApprovedEstimate',
            subject: 'PM Toolbelt: Estimate #{{ESTIMATE_NUMBER}} Approved'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: '{{CONTACT_APPROVAL}} denied estimate #{{ESTIMATE_NUMBER}}',
            type: 'notifyCompany:contactDeniedEstimate',
            subject: 'PM Toolbelt: Estimate #{{ESTIMATE_NUMBER}} Denied'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyCompany:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Phone App',
            type: 'notifyVendor:workOrderScheduled',
            template: 'New Work Order Scheduled #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}}\n\n{{WORKORDER_LOCKBOX_MESSAGE}}\n'
        },
        {
            company: companyId,
            contactMethod: 'Phone App',
            type: 'sms:sendMessage',
            template: '{{MESSAGE}}\n\n Details: {{WORKORDER_DETAIL_LINK}}'
        },
        {
            company: companyId,
            contactMethod: 'Phone App',
            template: 'Workorder #{{WORKORDER_NUMBER}} for {{COMPANY_NAME}} scheduled on {{WORKORDER_SCHEDULEDDATE}} has been cancelled.\n',
            type: 'notifyVendor:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Requesting permission for workorder #{{WORKORDER_NUMBER}} <br />' + '{{WORKORDER_APPROVE}}' + '<br /> <br />' + '{{WORKORDER_DENY}}',
            type: 'notifyCompany:contactApprovalWorkorders'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Requesting permission for estimate #{{ESTIMATE_NUMBER}} <br />' + '{{ESTIMATE_APPROVE}}' + '<br /> <br />' + '{{ESTIMATE_DENY}}',
            type: 'notifyCompany:contactApprovalEstimates'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: '{{CONTACT_APPROVAL}} approved workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactApprovedWorkorder'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: '{{CONTACT_APPROVAL}} denied workorder #{{WORKORDER_NUMBER}}',
            type: 'notifyCompany:contactDeniedWorkorder'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: '{{CONTACT_APPROVAL}} approved estimate #{{ESTIMATE_NUMBER}}',
            type: 'notifyCompany:contactApprovedEstimate'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: '{{CONTACT_APPROVAL}} denied estimate #{{ESTIMATE_NUMBER}}',
            type: 'notifyCompany:contactDeniedEstimate'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyCompany:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Workorder #{{WORKORDER_NUMBER}} has been deleted.\n',
            type: 'notifyCompany:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            template: 'Workorder #{{WORKORDER_NUMBER}} has been deleted.\n',
            subject: 'Workorder Deleted',
            type: 'notifyCompany:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Workorder #{{WORKORDER_NUMBER}} has been deleted.\n',
            type: 'notifyCompany:workOrderDeleted'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyPropertyManager:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyOnsiteManager:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyMaintenance:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: "Smart Alerts",
            template: "Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n",
            type: "notifyLeasingAgent:workOrderScheduled"
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingCreated',
            template: 'The showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been created for you.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Created',
            type: 'notifyTenantLead:showingCreated',
            template: 'The showing at {{PROPERTY_ADDRESS}} staring on {{SHOWING_START}} has been created for you.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingConfirmed',
            template: 'Thank you for confirming the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingCancelled',
            template: 'The showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Confirmed',
            type: 'notifyTenantLead:showingConfirmed',
            template: 'Thank you for confirming the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Cancelled',
            type: 'notifyTenantLead:showingCancelled',
            template: 'The showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:showingAssigned',
            template: 'A showing has been assigned to you at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}, the lead\'s  name is {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:showingAssigned',
            subject: 'PM Toolbelt: Showing Assigned',
            template: 'A showing has been assigned to you at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}, the lead\'s  name is {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:showingAssigned',
            template: 'A showing has been assigned to you at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}, the lead\'s  name is {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:showingConfirmed',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been confirmed by the lead, {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:showingConfirmed',
            subject: 'PM Toolbelt: Showing Confirmed',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been confirmed by the lead, {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:showingConfirmed',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been confirmed by the lead, {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:showingCancelled',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled by the lead, {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:showingCancelled',
            subject: 'PM Toolbelt: Showing Cancelled',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled by the lead, {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:showingCancelled',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled by the lead, {{SHOWING_TENANT_LEAD_NAME}} (phone: {{SHOWING_TENANT_LEAD_PHONE}}, email: {{SHOWING_TENANT_LEAD_EMAIL}}).'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:showingCreated',
            template: 'A showing has been created at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nClick to allow us to claim this showing: \n' + '{{SHOWING_CONFIRM}}' + '\n\nClick to pass on this showing:\n' + '{{SHOWING_CANCEL}}',
            subject: 'PM Toolbelt: Showing Created'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:showingCreated',
            template: 'A showing has been created at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}. Press 2 to claim or 8 to pass.'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:showingCreated',
            template: 'A showing has been created at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.<br />' + '{{SHOWING_CONFIRM}}' + '<br /> <br />' + '{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Work Order #{{WORKORDER_NUMBER}} has been scheduled by {{COMPANY_NAME}}\n\nTime: {{WORKORDER_DURATION}}\nDate: {{WORKORDER_START_DATE}}\n\n{{PROPERTY_ADDRESS}}{{PROPERTY_CITY}} {{PROPERTY_STATE}}, {{PROPERTY_POSTALCODE}}\n{{WORKORDER_LOCKBOX_MESSAGE}}\n',
            type: 'notifyLeasingAgent:workOrderScheduled'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Claimed',
            template: 'Sorry, the showing for {{PROPERTY_NAME}} has already been claimed.',
            type: 'notifyLeasingAgent:showingClaimed'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'Sorry, the showing for {{PROPERTY_NAME}} has already been claimed.',
            type: 'notifyLeasingAgent:showingClaimed'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'Sorry, the showing for {{PROPERTY_NAME}} has already been claimed.',
            type: 'notifyLeasingAgent:showingClaimed'
        },
        {
            company: companyId,
            subject: 'PM Toolbelt: Showing Assigned',
            contactMethod: 'Email',
            template: 'An agent has been assigned to your showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.',
            type: 'notifyTenantLead:showingAssigned'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            template: 'An agent has been assigned to your showing {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.',
            type: 'notifyTenantLead:showingAssigned'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            template: 'An agent has been assigned to your showing  {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.',
            type: 'notifyTenantLead:showingAssigned'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenant:showingScheduled',
            template: 'A showing has been scheduled at your residence ({{PROPERTY_ADDRESS}}) starting at {{SHOWING_START}}.',
            subject: 'PM Toolbelt: Showing Scheduled'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenant:showingScheduled',
            template: 'A showing has been scheduled at your residence ({{PROPERTY_ADDRESS}}) starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenant:showingScheduled',
            template: 'A showing has been scheduled at your residence ({{PROPERTY_ADDRESS}}) starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyOwner:showingScheduled',
            template: 'A showing has been scheduled at your property ({{PROPERTY_ADDRESS}}) starting at {{SHOWING_START}}.',
            subject: 'PM Toolbelt: Showing Scheduled'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyOwner:showingScheduled',
            template: 'A showing has been scheduled at your property ({{PROPERTY_ADDRESS}}) starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyOwner:showingScheduled',
            template: 'A showing has been scheduled at your property ({{PROPERTY_ADDRESS}}) starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenantLead:showingAgentUnavailable',
            template: 'Sorry, no agent is available for the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.',
            subject: 'PM Toolbelt: Showing Scheduled'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:showingAgentUnavailable',
            template: 'Sorry, no agent is available for the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingAgentUnavailable',
            template: 'Sorry, no agent is available for the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenantLead:showingReminder24h',
            subject: 'PM Toolbelt: Showing Reminder',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nClick to allow us to proceed: \n{{SHOWING_CONFIRM}}\n\nClick and we will cancel this showing:\n{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:showingReminder24h',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nClick to allow us to proceed: \n{{SHOWING_CONFIRM}}\n\nClick and we will cancel this showing:\n{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingReminder24h',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nReply with 2 to confirm or 8 to cancel.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenantLead:showingReminder4h',
            subject: 'PM Toolbelt: Showing Reminder',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nClick to allow us to proceed: \n{{SHOWING_CONFIRM}}\n\nClick and we will cancel this showing:\n{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:showingReminder4h',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nClick to allow us to proceed: \n{{SHOWING_CONFIRM}}\n\nClick and we will cancel this showing:\n{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingReminder4h',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.\n\nReply with 2 to confirm or 8 to cancel.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenantLead:showingReminder2h',
            subject: 'PM Toolbelt: Final Showing Reminder',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}. If you do not confirm the showing within the next hour your showing will be cancelled\n\nClick to allow us to proceed: \n{{SHOWING_CONFIRM}}\n\nClick and we will cancel this showing:\n{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:showingReminder2h',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}. If you do not confirm the showing within the next hour your showing will be cancelled\n\nClick to allow us to proceed: \n{{SHOWING_CONFIRM}}\n\nClick and we will cancel this showing:\n{{SHOWING_CANCEL}}'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingReminder2h',
            template: 'Please confirm that you will be attending the showing that you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}. If you do not confirm the showing within the next hour your showing will be cancelled.\n\nReply with 2 to confirm or 8 to cancel.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyTenantLead:showingCancellationNotice',
            subject: 'PM Toolbelt: Showing Cancelled',
            template: 'The showing you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled due to lack of confirmation.'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:showingCancellationNotice',
            template: 'The showing you scheduled  at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled due to lack of confirmation.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingCancellationNotice',
            template: 'The showing you scheduled at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been cancelled due to lack of confirmation.'
        },
        {
            company: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:showingPassed',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been passed on.'
        },
        {
            company: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:showingPassed',
            subject: 'PM Toolbelt: Showing Cancelled',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been passed on.'
        },
        {
            company: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:showingPassed',
            template: 'The showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been passed on.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:showingAssignment',
            template: 'A showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been assigned to you. The lead\'s name is {{SHOWING_TENANT_LEAD_NAME}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:showingAssignment',
            subject: 'PM Toolbelt: Showing Assigned',
            template: 'A showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been assigned to you. The lead\'s name is {{SHOWING_TENANT_LEAD_NAME}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:showingAssignment',
            template: 'A showing for {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}} has been assigned to you. The lead\'s name is {{SHOWING_TENANT_LEAD_NAME}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyContact:lockboxAccessAssigned',
            template: 'You have been assigned access '
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            type: 'notifyContact:lockboxAccessAssigned',
            template: ''
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyContact:lockboxAccessAssigned',
            template: ''
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:tenantLeadConfirmed',
            template: 'The tenant lead has been confirmed for the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:tenantLeadConfirmed',
            template: 'The tenant lead has been confirmed for the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Tenant Lead Confirmed Showing',
            type: 'notifyLeasingAgent:tenantLeadConfirmed',
            template: 'The tenant lead has been confirmed for the showing at {{PROPERTY_ADDRESS}} starting at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyCompany:taskDueAssignedUser',
            template: 'You have overdue tasks.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyCompany:taskDueAssignedUser',
            template: 'You have overdue tasks.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Assigned Task Due',
            type: 'notifyCompany:taskDueAssignedUser',
            template: 'You have overdue tasks.'
        },
        {
            companyId: companyId,
            contactMethod: 'Phone App',
            type: 'notifyCompany:taskDueAssignedUser',
            template: 'You have overdue tasks.'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyCompany:taskDueWatcher',
            template: 'Some tasks that you are watching are due.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyCompany:taskDueWatcher',
            template: 'Some tasks that you are watching are due.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Watched Task Due',
            type: 'notifyCompany:taskDueWatcher',
            template: 'Some tasks that you are watching are due.'
        },
        {
            companyId: companyId,
            contactMethod: 'Phone App',
            type: 'notifyCompany:taskDueWatcher',
            template: 'Some tasks that you are watching are due.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Cancelled',
            type: 'notifyTenant:showingCancelled',
            template: 'The showing at your residence ({{PROPERTY_ADDRESS}}) at {{SHOWING_START}} has been cancelled.'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenant:showingCancelled',
            template: 'The showing at your residence ({{PROPERTY_ADDRESS}}) at {{SHOWING_START}} has been cancelled.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenant:showingCancelled',
            template: 'The showing at your residence ({{PROPERTY_ADDRESS}}) at {{SHOWING_START}} has been cancelled.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingManager:showingCancelledUnclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has been cancelled, no agents have claimed or been assigned to the showing'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Cancelled',
            type: 'notifyLeasingManager:showingCancelledUnclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has been cancelled, no agents have claimed or been assigned to the showing'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingManager:showingCancelledUnclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has been cancelled, no agents have claimed or been assigned to the showing'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:unclaimedShowing',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has not been claimed yet. Press 2 to claim or 8 to pass.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:unclaimedShowing',
            subject: 'PM Toolbelt: Showing Unclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has not been claimed yet.<br />' + '{{SHOWING_CONFIRM}}' + '<br /> <br />' + '{{SHOWING_CANCEL}}'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:unclaimedShowing',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has not been claimed yet.<br />' + '{{SHOWING_CONFIRM}}' + '<br /> <br />' + '{{SHOWING_CANCEL}}'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:showingCancelledUnclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has been cancelled due to lack of leasing agents.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            subject: 'PM Toolbelt: Showing Cancelled',
            type: 'notifyTenantLead:showingCancelledUnclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has been cancelled due to lack of leasing agents.'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:showingCancelledUnclaimed',
            template: 'The showing for {{PROPERTY_ADDRESS}} at {{SHOWING_START}} has been cancelled due to lack of leasing agents.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            type: 'notifyContact:showingScheduleChanged',
            template: 'The time for the showing for {{PROPERTY_ADDRESS}} at has been updated to take place at {{SHOWING_START}}.',
            subject: 'PM Toolbelt: Showing Time Updated'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyContact:showingScheduleChanged',
            template: 'The time for the showing for {{PROPERTY_ADDRESS}} at has been updated to take place at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyContact:showingScheduleChanged',
            template: 'The time for the showing for {{PROPERTY_ADDRESS}} at has been updated to take place at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            type: 'notifyTenantLead:lockboxShowingScheduled',
            template: 'The showing at {{PROPERTY_ADDRESS}} has been created for you. The code for this showing is {{SHOWING_LOCKBOX_CODE}} and will allow you access to the property for two hours starting at {{SHOWING_START}}.',
            subject: 'PM Toolbelt: Lockbox Showing Scheduled'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyTenantLead:lockboxShowingScheduled',
            template: 'The showing at {{PROPERTY_ADDRESS}} has been created for you. The code for this showing is {{SHOWING_LOCKBOX_CODE}} and will allow you access to the property for two hours starting at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyTenantLead:lockboxShowingScheduled',
            template: 'The showing at {{PROPERTY_ADDRESS}} has been created for you. The code for this showing is {{SHOWING_LOCKBOX_CODE}} and will allow you access to the property for two hours starting at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'Email',
            type: 'notifyLeasingAgent:lockboxShowingScheduled',
            template: 'The showing at {{PROPERTY_ADDRESS}} has been created for you. The code for this showing is {{SHOWING_LOCKBOX_CODE}} and will allow you access to the property for two hours starting at {{SHOWING_START}}.',
            subject: 'PM Toolbelt: Lockbox Showing Scheduled'
        },
        {
            companyId: companyId,
            contactMethod: 'Smart Alerts',
            type: 'notifyLeasingAgent:lockboxShowingScheduled',
            template: 'The showing at {{PROPERTY_ADDRESS}} has been created for you. The code for this showing is {{SHOWING_LOCKBOX_CODE}} and will allow you access to the property for two hours starting at {{SHOWING_START}}.'
        },
        {
            companyId: companyId,
            contactMethod: 'SMS',
            type: 'notifyLeasingAgent:lockboxShowingScheduled',
            template: 'The showing at {{PROPERTY_ADDRESS}} has been created for you. The code for this showing is {{SHOWING_LOCKBOX_CODE}} and will allow you access to the property for two hours starting at {{SHOWING_START}}.'
        }
    ];
}
