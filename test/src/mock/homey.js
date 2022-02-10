const settings = {
  username: 'username',
  password: 'password',
  debugLog: []
};

module.exports = {
  App: class App {},
  manifest: {
    id: 'com.mill'
  },
  settings: settings,
  ManagerSettings: {
    get: param => settings[param],
    set: () => {}
  },
  __: (key, tagsopt) => key
};
