/**
 * Tests the Wiki Activity monitor
 */
/* global describe, it */

const {fetchWiki} = require("../lib/wiki-activity");
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

const toGithubFeed = path => path + '.atom';
const toWikimediaFeed = path => path + '/api.php?action=feedrecentchanges&days=1000&limit=1000';

describe('The Wiki Activity monitor', function () {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it('detects activity in a github wiki', async function() {
    const feed = await fs.readFile('test/mock-content/feed.rss', 'utf-8');
    const u = new URL("https://github.com/test/wiki");
    agent
      .get(u.origin)
      .intercept({path: toGithubFeed(u.pathname), method: "GET"})
      .reply(200, feed);
    const { items: data} = await fetchWiki(u.href);
    assert.equal(data.length, 1, 'RSS Feed from github wiki has one item');
    assert.equal(data[0].isoDate, '2023-11-10T13:24:37.000Z', 'RSS feed item wiki date correctly identified');
  });
  

  it('detects activity in an entire Mediawiki', async function() {
    const feed = await fs.readFile('test/feed.rss', 'utf-8');
    const u = new URL("https://example.test/wiki/");
    agent
      .get(u.origin)
      .intercept({path: toWikimediaFeed(u.pathname), method: "GET"})
      .reply(200, feed);
    const { items: data} = await fetchWiki(u.href);
    assert.equal(data.length, 1, 'RSS Feed from wikimedia has one item');
    assert.equal(data[0].isoDate, '2023-11-10T13:24:37.000Z', 'RSS feed item wiki date correctly identified');
  });

  it("returns an error when the feed doesn't exist", async function() {
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: toWikimediaFeed(u.pathname), method: "GET"})
      .reply(404);
    const err = await fetchWiki(u.href);
    assert.equal(err, `Error fetching ${toWikimediaFeed(u)}: Error: HTTP error 404  while fetching ${toWikimediaFeed(u)}`);
  });
  
  afterEach(() => {
    agent.assertNoPendingInterceptors();
  });

  after(async () => {
    await agent.close();
    setGlobalDispatcher(origDispatcher);
  });
});
