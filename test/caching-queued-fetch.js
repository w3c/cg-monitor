/**
 * Tests the targets removal detection library.
 */
/* global describe, it */

const QueuedFetch = require("../lib/caching-queued-fetch");
const { queuedFetch } = QueuedFetch;
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const origInterval = QueuedFetch.DEFAULT_INTERVAL;


const assert = require("assert");
const origDispatcher = getGlobalDispatcher();

const agent = new MockAgent();

const mock = (url, response = 200, delay = 0, responseOptions = {}) => {
  const u = new URL(url);
  const interceptor = agent
        .get(u.origin)
        .intercept({path: u.pathname, method: "GET"})
        .reply(response, null, responseOptions);
  if (delay > 0) {
    interceptor.delay(delay);
  }
};

const testBaseUrl = 'https://example.com/';
const testBaseUrl2 = 'https://example.net/';

let counter = 0;
const newPath = () => {
  return "" + (counter++);
};

describe('The HTTP request manager', function () {
  this.timeout(5000);

  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it('makes only one request to a given URL', async () => {
    mock(testBaseUrl);
    const requests = [];
    for(let i = 0; i<10; i++) {
      requests.push(queuedFetch(testBaseUrl));
    }
    await Promise.all(requests);
  });

  it('queues different request to a single server, respecting the default request interval', async () => {
    const origInterval = QueuedFetch.DEFAULT_INTERVAL;
    QueuedFetch.DEFAULT_INTERVAL = 1000;
    const url1 = testBaseUrl + newPath();
    const url2 = testBaseUrl + newPath();
    mock(url1, 200, 500);
    mock(url2, 304);
    
    const requests = [];
    const startTime = Date.now();
    requests.push(queuedFetch(url1));
    requests.push(queuedFetch(url2));
    const response = await Promise.race(requests);
    await Promise.all(requests);
    const endTime = Date.now();
    assert.equal(response.status, 200);
    assert(endTime-startTime > QueuedFetch.DEFAULT_INTERVAL);
  });

  it('queues different request to a single server, respecting the specified request interval', async () => {
    const url1 = testBaseUrl + newPath();
    const url2 = testBaseUrl + newPath();
    mock(url1, 200, 500);
    mock(url2, 304);
    const interval = 2000;
    const requests = [];
    const startTime = Date.now();
    requests.push(queuedFetch(url1, {}, {interval}));
    requests.push(queuedFetch(url2));
    const response = await Promise.race(requests);
    await Promise.all(requests);
    const endTime = Date.now();
    assert.equal(response.status, 200);
    assert(endTime-startTime > interval);
  });

  
  it("reports an HTTP error but doesn't stop crawling upon it", async () => {
    const url1 = testBaseUrl + newPath();
    const url2 = testBaseUrl + newPath();
    mock(url1, 404, 500);
    mock(url2, 200);
    
    const requests = [];
    requests.push(queuedFetch(url1));
    requests.push(queuedFetch(url2));
    await Promise.all(requests)
      .then(arr => {
        assert.equal(arr[0], undefined);
        assert.equal(arr[1].status, 200);
      })
      .catch(err =>
        assert.match(err.message, /404/)
      );

  });

  it("respects retry-after header", async () => {
    const url1 = testBaseUrl + newPath();
    const url2 = testBaseUrl + newPath();
    mock(url1, 503, 0, { headers: {"Retry-After": 2}});
    mock(url1, 200);
    mock(url2, 200);
    
    const requests = [];
    requests.push(queuedFetch(url1));
    requests.push(queuedFetch(url2));

    const startTime = Date.now();
    await Promise.all(requests)
      .then(arr => {
        assert.equal(arr[0].status, 200);
        assert.equal(arr[1].status, 200);
      })
      .catch(err =>
        assert.fail("Unexpected HTTP error:" + err)
      );
    const endTime = Date.now();
    assert(endTime-startTime > 2000);
  });

  it("respects x-ratelimit-reset header", async () => {
    const url1 = testBaseUrl + newPath();
    const url2 = testBaseUrl + newPath();
    mock(url1, 503, 0, { headers: {"X-Ratelimit-Reset": (Date.now() / 1000) + 2 }});
    mock(url1, 200);
    mock(url2, 200);
    
    const requests = [];
    requests.push(queuedFetch(url1));
    requests.push(queuedFetch(url2));

    const startTime = Date.now();
    await Promise.all(requests)
      .then(arr => {
        assert.equal(arr[0].status, 200);
        assert.equal(arr[1].status, 200);
      })
      .catch(err =>
        assert.fail("Unexpected HTTP error:" + err)
      );
    const endTime = Date.now();
    assert(endTime-startTime > 2000, endTime-startTime);
  });

  
  
  it('runs in parallel requests to distinct servers', async () => {
    const url1 = testBaseUrl + newPath();
    const url2 = testBaseUrl2 + newPath();

    mock(url1, 200, 500);
    mock(url2, 304);
    
    const requests = [];
    requests.push(queuedFetch(url1));
    requests.push(queuedFetch(url2));
    const response = await Promise.race(requests);
    await Promise.all(requests);
    assert.equal(response.status, 304);
  });

  it('loads a response from the FS cache with the proper request headers', async () => {
    const ims = "Fri, 20 Oct 2023 16:51:59 GMT";
    const fsUrl = testBaseUrl + "fs";
    const u = new URL(fsUrl);
    const interceptor = agent
          .get(u.origin)
          .intercept({path: u.pathname, method: "GET", headers: {"if-modified-since": ims, authorization: "test"}})
        .reply(304);
    const response = await queuedFetch(fsUrl, {headers: {authorization: "test"}}, {fsCachePath: "test/fs-cache"});
    assert.match(response.headers.get("cache-status"), /hit/)
  });
  
  afterEach(() => {
    QueuedFetch.INTERVAL = origInterval;
    agent.assertNoPendingInterceptors();
  });

  after(async () => {
    await agent.close();
    setGlobalDispatcher(origDispatcher);
  });
});

