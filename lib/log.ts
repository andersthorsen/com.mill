import { Homey } from "homey/lib/Device";

import * as Sentry from '@sentry/node';
import crypto from 'crypto';

export class Log {
  capturedMessages: string[];
  homey: Homey;
  sentryEnabled: boolean = false;
  capturedExceptions: any;

  constructor(homey: Homey) {
    this.capturedExceptions = {};
    this.capturedMessages = [];

    if (!homey) {
      console.error('Error: Homey not found');
    }

    this.homey = homey;

    const sentryDSN = this.homey ? this.homey.env.SENTRY_DSN : process.env.SENTRY_DSN;
    if (sentryDSN) {
      this.init(sentryDSN);
    } else {
      console.error('Error: Sentry DSN not found');
    }
  }

  static log(...args: (string | Error)[]) {
    console.log(Log.logTime(), '[homey-log]', ...args);
  }

  init(dsn: string, opts: Sentry.NodeOptions = {}) {
    // if (process.env.DEBUG === '1' && this.homey.env.HOMEY_LOG_FORCE !== '1') {
    //   return Log.log('App is running in debug mode, disabling Sentry logging');
    // }

    opts = opts || {};
    opts.dsn = dsn;

    if (this.homey) {
      opts.release = `com.mill@${this.homey.manifest.version}`;
    }

    Sentry.init(opts);

    this.sentryEnabled = true;

    if (this.homey) {
      Sentry.configureScope((scope: { setTag: (arg0: string, arg1: string) => void; }) => {
        scope.setTag('appId', this.homey.manifest.id);
        scope.setTag('appVersion', this.homey.manifest.version);
        scope.setTag('homeyVersion', this.homey.version);
      });

      Log.log(`App ${this.homey.manifest.id} v${this.homey.manifest.version} logging...`);
    } else {
      Log.log('App logging...');
    }

    return this;
  }

  captureMessage(message: string) {
    Log.log('captureMessage:', message);

    if (this.capturedMessages.indexOf(message) > -1) {
      Log.log('Prevented sending a duplicate message');
      return this;
    }

    this.capturedMessages.push(message);

    if (this.sentryEnabled) {
      const eventId = Sentry.captureMessage(
        message
      );
      return eventId;
    }

    return null;
  }

  captureException(err: any) {
    Log.log('captureException:', err);

    const errHash = Log.hash(err.message);
    if (this.capturedExceptions[errHash]) {
      Log.log('Prevented sending a duplicate log');
      this.capturedExceptions[errHash].count += 1;
      return null;
    }

    this.capturedExceptions[errHash] = {
      exception: err.message,
      count: 1
    };

    if (this.sentryEnabled) {
      const eventId = Sentry.captureException(
        err
      );
      return eventId;
    }

    return null;
  }

  static logTime() {
    const padZero = (num: number) => (num < 10 ? `0${num}` : num)

    const date = new Date();
    const mm = padZero(date.getMonth() + 1);
    const dd = padZero(date.getDate());
    const hh = padZero(date.getHours());
    const min = padZero(date.getMinutes());
    const sec = padZero(date.getSeconds());

    return `${date.getFullYear()}-${mm}-${dd} ${hh}:${min}:${sec}`;
  }

  static hash(str: crypto.BinaryLike) {
    return crypto.createHash('sha1').update(str).digest('base64');
  }
}


