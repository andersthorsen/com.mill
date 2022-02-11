const settings = {
  username: 'username',
  password: 'password',
  debugLog: []
};

module.exports = {
  App: class App {
  },
  app: {
    settings: {
      get: param => settings[param],
      set: () => {}
    }
  },
  manifest: {
    id: 'com.mill'
  },
  settings: {
    get: param => settings[param],
    set: () => {}
  },
  __: (key, tagsopt) => key
};
