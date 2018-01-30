const express = require('express');
const fetch = require('fetch-cookie')(require('node-fetch'));
const { Client, Authentication, services: SERVICES } = require('zetapush-js');
const NodeJSTransports = require('zetapush-cometd/lib/node/Transports');
const Rx = require('@reactivex/rxjs');

const APP_CONFIG = require('./config');
const app = express();

const LOCATION_PATTERN = /^(.*)\|(.*)\:(.*)$/;
let traces = [];
let subject = new Rx.BehaviorSubject([]);

async function bootstrap() {
  await app.listen(5000);
  await login();
  await connectToSandbox();
}

async function login() {
  // Logout before login
  await fetch(`${APP_CONFIG.credentials.apiUrl}/zbo/auth/logout`, {
    method: 'GET',
    credentials: 'include',
  });

  const response = await fetch(
    `${APP_CONFIG.credentials.apiUrl}/zbo/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(APP_CONFIG.credentials),
      credentials: 'include',
    },
  );
}

async function connectToSandbox() {
  // Create new ZetaPush Client
  const client = new Client({
    apiUrl: `${APP_CONFIG.credentials.apiUrl}/zbo/pub/business/`,
    transports: NodeJSTransports,
    sandboxId: APP_CONFIG.sandboxId,
    authentication: () =>
      Authentication.create({
        authType: 'developer',
        deploymentId: 'developer',
        login: APP_CONFIG.credentials.username,
        password: APP_CONFIG.credentials.password,
      }),
  });

  // Add connection establised listener
  client.onConnectionEstablished(() => {
    console.log('onConnectionEstablished');
  });

  client.connect();

  const services = await getServices();

  // Enable debug and subscription for all deployed services
  const servers = await getServers(APP_CONFIG.sandboxId);

  services.forEach(async deploymentId => {
    await enableDebug(servers, deploymentId);
    createTraceObservable(client, deploymentId).subscribe(traces =>
      subject.next(traces),
    );
  });
}

/**
 * Gets sandbox services
 */
async function getServices() {
  const baseUrl = `${APP_CONFIG.credentials.apiUrl}/zbo/orga/item/list/${
    APP_CONFIG.sandboxId
  }`;

  let { content, pagination } = await request(baseUrl);
  let items = [...content];

  while (!pagination.last) {
    const response = await request(baseUrl, pagination.number + 1);
    content = response.content;
    pagination = response.pagination;
    items = [...items, ...content];
  }

  const services = items
    .filter(({ itemId, type }) => itemId === 'macro' && type === 'SERVICE')
    .map(({ deploymentId }) => deploymentId);

  return services;
}

async function request(baseUrl, page = 0) {
  const url = `${baseUrl}?page=${page}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  const { content, ...pagination } = await response.json();
  return { content, pagination };
}

function createTraceObservable(
  client,
  deploymentId = SERVICES.Macro.DEFAULT_DEPLOYMENT_ID,
) {
  return new Rx.Observable(observer => {
    const api = client.createService({
      Type: SERVICES.Macro,
      deploymentId,
      listener: {
        trace: message => {
          const trace = {
            ...message.data,
            location: parseTraceLocation(message.data.location),
            ts: Date.now(),
          };

          traces = [...traces, trace];

          observer.next(traces);
        },
      },
    });
    return () => {
      client.unsubscribe(api);
    };
  });
}

async function enableDebug(servers, deploymentId) {
  const enableStatusByServer = server => {
    return fetch(
      `${server}/rest/deployed/${
        APP_CONFIG.sandboxId
      }/${deploymentId}/debug/enable`,
      {
        headers: {
          'X-Authorization': JSON.stringify(APP_CONFIG.credentials),
        },
      },
    );
  };
  const requests = servers.map(server => enableStatusByServer(server));
  const responses = await Promise.all(requests);
  return responses.reduce(success => {
    return success;
  }, true);
}

async function getServers(sandboxId) {
  const response = await fetch(
    `${APP_CONFIG.credentials.apiUrl}/zbo/pub/business/${APP_CONFIG.sandboxId}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );
  const { servers } = await response.json();

  return servers;
}

function parseTraceLocation(location) {
  const [, recipe, version, path] = LOCATION_PATTERN.exec(location);
  return { recipe, version, path };
}

// Launch the application
bootstrap();
