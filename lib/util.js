// eslint-disable-next-line import/no-unresolved
const fetch = require('node-fetch');

const log = (severity, message, data, homey) => {
  // Homey will not be available in tests
  if (!homey) {
    console.log(`${severity}: ${message}`, data || '');
    return;
  }

  if (homey.app.settings?.get('debug')) {
    const debugLog = homey.app.settings.get('debugLog') || [];
    const entry = { registered: new Date().toLocaleString(), severity, message };
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
    homey.app.settings.set('debugLog', debugLog);
    homey.ManagerApi.realtime('debugLog', entry);
  }
};

const debug = (message, data, homey) => {
  log('DEBUG', message, data, homey);
};

const warn = (message, data, homey) => {
  log('WARN', message, data, homey);
};

const error = (message, data, homey) => {
  log('ERROR', message, data, homey);
};

const fetchJSON = async (endpoint, options) => {
  try {
    const result = await fetch(endpoint, options);
    const text = await result.text();
    return text.length > 0 ? JSON.parse(text) : {};
  } catch (e) {
    return {
      error: e.message || e
    };
  }
};

module.exports = {
  debug, warn, error, fetchJSON
};
