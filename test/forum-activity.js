/**
 * Tests the Forum Activity monitor
 */
/* global describe, it */

const {fetchForum} = require("../lib/forum-activity");
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const fs = require("fs").promises;

const assert = require("assert");
const origDispatcher = getGlobalDispatcher();

const agent = new MockAgent();

let counter = 0;
const testUrl = () => {
  counter++;
  return new URL(`https://example.test/disc/mail${counter}/`);
}

const toDiscourseAPI = p => p + 'posts.json';

describe('The Forum Activity monitor', function () {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it('detects activity in a discourse forum', async function() {
    const discourseApi = await fs.readFile('test/mock-content/discourse.json', 'utf-8');
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: toDiscourseAPI(u.pathname), method: "GET"})
      .reply(200, discourseApi);

    agent
      .get(u.origin)
      .intercept({path: toDiscourseAPI(u.pathname) + '?before=42', method: "GET"})
      .reply(200, JSON.stringify({latest_posts: []}));

    const {items: data} = await fetchForum(u.href);
    assert.equal(data.length, 1, 'One item retrieved in discourse posts');
    assert.equal(data[0].created_at, "2023-11-01T21:30:42.605Z", 'Date retrieved from discourse post');
  });

  it('skips Google Groups and Slacks', async function() {
    const data = await fetchForum("https://groups.google.com/g/test");
    assert.equal(typeof data, 'string');
    const data2 = await fetchForum("https://test.slack.com/channel");
    assert.equal(typeof data2, 'string');
  });

  
  /*
  it("returns an error when the archive doesn't exist", async function() {
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: u.pathname, method: "GET"})
      .reply(404);
    const err = await fetchMail(u.href);
    assert.equal(err, `Error fetching ${u}: Error: HTTP error 404  while fetching ${u}`);
  });*/
  
  afterEach(() => {
    agent.assertNoPendingInterceptors();
  });

  after(async () => {
    await agent.close();
    setGlobalDispatcher(origDispatcher);
  });
});
