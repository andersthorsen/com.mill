const proxyquire = require("proxyquire").noCallThru();
const chai = require("chai");
const { expect } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const { app } = require("./app.test");
const homey = require("./mock/homey");
const mill = require("./mock/mill");

describe("mill api", () => {
  before(() => {
    chai.use(chaiAsPromised);
    const App = proxyquire("../../app.ts", {
      homey,
      "./lib/mill": mill,
      "./lib/util": { debug: () => {} },
    });
    const app = new App();
    app.homey = homey;
    //    app.settings = homey.settings;
    //    app.manifest = homey.manifest;

    app.onInit();
    homey.app = app;
    const api = proxyquire("../../api", {
      homey,
      "./lib/mill": mill,
      "./lib/util": { debug: () => {} },
    });

    this.authenticate = api.authenticate;
    this.clearSettings = api.clearSettings;
    this.clearLog = api.clearLog;

    console.log(api);
  });

  it("should authenticate", async () => {

    const res = await this.authenticate({
      homey: homey,
      body: { username: "username", password: "password" },
    });

    // eslint-disable-next-line no-unused-expressions
    expect(res).to.be.true;
  });

  it("should clear settings", async () => {
    const res = await this.clearSettings({ homey: homey });
    expect(res).to.exist;
  });

  it("should clear logs", async () => {
    const res = this.clearLog({ homey: homey });
    expect(res).to.exist;
  });
});
