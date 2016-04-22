import * as chai from "chai";
import * as sinon from "sinon";
import * as request from "request";
import * as sinonChai from "sinon-chai";
import * as mongoose from "mongoose";
let chaiHttp = require("chai-http");
let fixtures = require("node-mongoose-fixtures");
let expect = chai.expect;

process.env.NODE_ENV = "test";
let app = require("../../app");
let should = chai.should();
/**
 * Unit test for quickbook server
 */
chai.use(chaiHttp);
chai.use(sinonChai);
describe("TESTING quickbook.server.controller.js:", function() {
    // set time out for mocha running
    this.timeout(15000);
    let api: any = chai.request(app);
    let companyId: string;
    fixtures.save("Company", {
        Company: [
            {
                name: "PM Toolbelt Company", email: "admin@pmtoolbelt.com",
                qboServices: {
                    qboToken: process.env.TEST_OAUTH_TOKEN,
                    qboTokenSecret: process.env.TEST_OAUTH_TOKEN_SECRET,
                    qboCompanyId: process.env.TEST_REALMID
                }
            }
        ]
    });

    // using hook for creating test data
    before((done) => {
        fixtures("Company", (err, data) => {
            console.log("Create testing data");
            if (err) {
                console.log(err);
            }
            else {
                console.log(data[0][0]);
                companyId = data[0][0]._id;
            }
        });
        done();
    });

    after((done) => {
        // clear data when it"s done.
        fixtures.reset("Company", (err, data) => {
            console.log("Clear data");
        });
        done();
    });

    describe("Quickbook Connect", () => {
        it("should redirect to Quickbook Page when token and key are right", (done) => {
            api
                .get(`/qb/connect/${companyId}`)
                .end((err, res) => {
                    console.log(res.redirects);
                    expect(err).to.be.null;
                    expect(res).to.have.status(200);
                    expect(res.redirects).to.have.length(1);
                    done();
                });
        });
    });

    describe("Quickbook Callback", () => {
        it("should throw error when missing oauth", (done) => {
            api
                .get(`/qb/callback/${companyId}`)
                .end((err, res) => {
                    expect(res).to.have.status(500);
                    done();
                });
        });

        it("should close page when it has been success", (done) => {
            //todo: later
            done();
        });
    })
});
