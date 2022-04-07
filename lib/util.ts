import { Homey } from "homey/lib/Device";
import fetch, { RequestInfo, RequestInit } from 'node-fetch';

const log = (severity: 'DEBUG' | 'WARN' | 'ERROR', message: string, data: any, homey: Homey) => {
  // Homey will not be available in tests
  if (!homey) {
    console.log(`${severity}: ${message}`, data || '');
    return;
  }

  if (homey.settings?.get('debug')) {
    const debugLog = homey.settings.get('debugLog') || [];
    let entry: { registered: string, severity: 'DEBUG' | 'WARN' | 'ERROR', message: string, data: any };
    
    entry = { registered: new Date().toLocaleString(), severity, message, data: undefined };

    if (data) {
      if (typeof data === 'string') {
        entry.data = { data };
      } else if (data.message) {
        entry.data = { error: data.message, stacktrace: data.stack };
      } else {
        entry.data = data;
      }
    }

    debugLog.push(entry);
    if (debugLog.length > 100) {
      debugLog.splice(0, 1);
    }
    homey.app.log(`${severity}: ${message}`, data || '');
    homey.settings.set('debugLog', debugLog);
    homey.api.realtime('debugLog', entry);
  }
};

const debug = (message: string, data: any, homey: import("homey/lib/Homey")) => {
  log('DEBUG', message, data, homey);
};

const warn = (message: string, data: any, homey: import("homey/lib/Homey")) => {
  log('WARN', message, data, homey);
};

const error = (message: string, data: any, homey: import("homey/lib/Homey")) => {
  log('ERROR', message, data, homey);
};

const fetchJSON = async (endpoint: RequestInfo, options: RequestInit) => {
  try {
    const result = await fetch(endpoint, options);
    const text = await result.text();
    return text.length > 0 ? JSON.parse(text) : {};
  } catch (e) {
    return {
      error: (e as any).message || e
    };
  }
};

export { debug, warn, error, fetchJSON };
