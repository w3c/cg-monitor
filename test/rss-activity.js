/**
 * Tests the RSS Activity monitor
 */
/* global describe, it */

const {fetchRSS} = require("../lib/rss-activity");
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const fs = require("fs").promises;

const assert = require("assert");
const origDispatcher = getGlobalDispatcher();

const agent = new MockAgent();

let counter = 0;
const testUrl = () => {
  counter++;
  return new URL(`https://example.test/feed${counter}.rss`);
}

describe('The RSS Activity monitor', function () {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it('detects activity in an RSS feed', async function() {
    const feed = await fs.readFile('test/mock-content/feed.rss', 'utf-8');
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: u.pathname, method: "GET"})
      .reply(200, feed);
    const { items: data} = await fetchRSS(u.href);
    assert.equal(data.length, 1, 'RSS Feed has one item');
    assert.equal(data[0].isoDate, '2023-11-10T13:24:37.000Z', 'RSS feed item date correctly identified');
  });

  it("returns an error when the feed doesn't exist", async function() {
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: u.pathname, method: "GET"})
      .reply(404);
    const err = await fetchRSS(u.href);
    assert.equal(err, `Error fetching ${u}: Error: HTTP error 404  while fetching ${u}`, 'Error when hitting 404');
  });
  
  afterEach(() => {
    agent.assertNoPendingInterceptors();
  });

  after(async () => {
    await agent.close();
    setGlobalDispatcher(origDispatcher);
  });
});
