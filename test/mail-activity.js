/**
 * Tests the Mailing List Activity monitor
 */
/* global describe, it */

const {fetchMail} = require("../lib/mail-activity");
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const fs = require("fs").promises;

const assert = require("assert");
const origDispatcher = getGlobalDispatcher();

const agent = new MockAgent();

let counter = 0;
const testUrl = () => {
  counter++;
  return new URL(`https://lists.w3.org/Archives/Public/mail${counter}/`);
}

describe('The Mailing List Activity monitor', function () {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it('detects activity in a monthly mailing list archive', async function() {
    const archive = await fs.readFile('test/mock-content/mail-archive.html', 'utf-8');
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: u.pathname, method: "GET"})
      .reply(200, archive);
    const data = await fetchMail(u.href);
    console.log(data);
    assert.equal(data["2023-11"], 3, 'Mail archives list three items in November 2023');
  });

  it('detects activity in a quarterly mailing list archive', async function() {
    const archive = await fs.readFile('test/mock-content/mail-archive-quarterly.html', 'utf-8');
    const u = testUrl();
    agent
      .get(u.origin)
      .intercept({path: u.pathname, method: "GET"})
      .reply(200, archive);
    const data = await fetchMail(u.href);
    console.log(data);
    assert.equal(Object.keys(data).length, 3, 'Mail archives list three months');
    assert.equal(data["2023-11"], 1, 'Mail archives list one item in November 2023');
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
