// eslint-disable-next-line import/no-unresolved
const Homey = require('homey');
const { ManagerSettings } = require('homey');
const Mill = require('./lib/mill');
const { debug: _debug } = require('./lib/util');

class MillApp extends Homey.App {
  async onInit() {
    this.homey = this.homey ?? Homey;
    this.settings = this.homey.settings ?? ManagerSettings;
    this.millApi = new Mill();
    this.user = null;
    this.isAuthenticated = false;
    this.isAuthenticating = false;

    console.log('homey - manifest');
    this.debug(`${this.manifest?.id} is running..`);
  }

  async connectToMill() {

    const username = this.settings.get('username');
    const password = this.settings.get('password');

    return this.authenticate(username, password);
  }

  async authenticate(username, password) {
    if (username && password && !this.isAuthenticating) {
      try {
        this.isAuthenticating = true;
        this.user = await this.millApi.login(username, password) || null;
        this.isAuthenticated = true;
        this.debug('Mill authenticated');
        return true;
      } finally {
        this.isAuthenticating = false;
      }
    }
    return false;
  }

  debug (message, data) {
    _debug(message, data, this.homey);
  }

  clear() {
    this.user = null;
  }

  isConnected() {
    return this.isAuthenticated;
  }

  getUser() {
    return this.user;
  }

  getMillApi() {
    return this.millApi;
  }
}

module.exports = MillApp;
