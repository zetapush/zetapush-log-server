# zetapush-log-server

> Experimental project under development

## Development

> Create a config.js file with the following format:
```console
const APP_CONFIG = {
  sandboxId: "<YOUR-SANDBOX-ID>",
  credentials: {
    apiUrl: "<API-URL>",
    username: "<USERNAME>",
    password: "<PASSWORD>"
  },
  elatic: {
    host: '<ELASTIC-URL>',
    log: '<LOG-TYPE>',
  }
};

module.exports = APP_CONFIG;
```

> Install dependencies and start server
```console
yarn install
yarn start:watch
```