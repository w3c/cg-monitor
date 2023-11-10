/**
 * Tests the W3C Data fetcher
 */
/* global describe, it, before, after, afterEach, require */

const {recursiveW3cFetch} = require("../lib/w3c-data");
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const fs = require("fs").promises;

const assert = require("assert");
const origDispatcher = getGlobalDispatcher();

const agent = new MockAgent();

let counter = 0;

describe('The W3C Data fetcher', function () {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it('retrieves embedded data', async function() {
    const w3cApi = await fs.readFile('test/mock-content/w3c-api-1.json', 'utf-8');
    const w3cApi2 = await fs.readFile('test/mock-content/w3c-api-2.json', 'utf-8');
    const u = new URL("https://example.test/w3c-api/");
    agent
      .get(u.origin)
      .intercept({path: u.pathname, method: "GET"})
      .reply(200, w3cApi);

    agent
      .get(u.origin)
      .intercept({path: u.pathname + '2', method: "GET"})
      .reply(200, w3cApi2);

    const data = await recursiveW3cFetch(u.href, "test");
    assert.equal(data.length, 2, 'Two item retrieved from mock W3C API');
    assert.equal(data[0], "1", 'Expected value retrieved from mock W3C API');
    assert.equal(data[1], "2", 'Expected value retrieved from mock W3C API');
  });

  afterEach(() => {
    agent.assertNoPendingInterceptors();
  });

  after(async () => {
    await agent.close();
    setGlobalDispatcher(origDispatcher);
  });
});
