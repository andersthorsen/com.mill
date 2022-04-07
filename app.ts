// eslint-disable-next-line import/no-unresolved
import { App } from 'homey';
import Mill from './lib/mill';
import { debug as _debug } from './lib/util';

export default class MillApp extends App {
  millApi: Mill = new Mill();
  isAuthenticated: boolean = false;
  isAuthenticating: boolean = false;
  user: any;

  async onInit() {
    this.user = null;

    console.log('homey - manifest');
    this.debug(`${this.manifest?.id} is running..`);
  }

  async connectToMill() {

    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');

    return this.authenticate(username, password);
  }

  async authenticate(username: string, password: string): Promise<boolean> {
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

  debug (message: string, data?: undefined) {
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