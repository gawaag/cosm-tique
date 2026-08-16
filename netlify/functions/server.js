'use strict';

const serverless = require('serverless-http');
const { hydrateFromBlobs, persistToBlobs } = require('../../src/netlify-persist');
const { ensureReady } = require('../../src/sqlite');

let cachedHandler;

function normalizeEvent(event) {
  const prefix = '/.netlify/functions/server';
  const current = event.path || event.rawPath || '/';
  if (current.startsWith(prefix)) {
    let next = current.slice(prefix.length) || '/';
    if (!next.startsWith('/')) next = `/${next}`;
    event.path = next;
    if (event.rawPath) event.rawPath = next;
  }
  return event;
}

async function getHandler() {
  await hydrateFromBlobs();
  await ensureReady();
  const app = require('../../server');
  return serverless(app, {
    binary: ['image/*', 'font/*', 'application/octet-stream'],
  });
}

exports.handler = async (event, context) => {
  if (context) context.callbackWaitsForEmptyEventLoop = false;
  if (!cachedHandler) cachedHandler = getHandler();
  const handle = await cachedHandler;
  const result = await handle(normalizeEvent(event), context);
  const method = String(
    event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET'
  ).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    await persistToBlobs();
  }
  return result;
};
