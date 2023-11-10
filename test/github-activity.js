/**
 * Tests the Forum Activity monitor
 */
/* global describe, it, before, after, afterEach, require */

const {fetchGithub} = require("../lib/github-activity");
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const fs = require("fs").promises;

const assert = require("assert");
const origDispatcher = getGlobalDispatcher();

const agent = new MockAgent();

const toCacheUrl = (u, path) => "https://labs.w3.org/github-cache/v3/repos" + (new URL(u)).pathname + '/' + path + (path === 'issues' ?  '?state=all' : '');
										const toGhApiUrl = (u, path) => "https://api.github.com/repos" + (new URL(u)).pathname + '/' +  path + '?state=all&per_page=100&direction=asc';


const ghObject = [
  {
    "created_at": "2020-09-29T10:05:14Z",
    "html_url": "https://example.com",
    "commit": "sha1"
  }
];

const repos = [
  {
    fork: true
  },
  {
    owner : { login: 'acme'},
    name: 'test-empty',
    size: 0
  },
  {
    owner : { login: 'acme'},
    name: 'test-org',
    size: 42
  }
];

const mock = (url, response, next = null) => {
  const responseOptions = next ? { headers: {link: `<${next}>;rel="next"`} } : {};
  const u = new URL(url);
  agent
    .get(u.origin)
    .intercept({path: u.pathname + u.search, method: "GET"})
    .reply(200, JSON.stringify(response), responseOptions);
};

describe('The Github Activity monitor', function () {
  before(() => {
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  it('detects issues and PRs in a single repo', async function() {
    const repo = "https://github.com/acme/test";
    const issueUrl = toCacheUrl(repo, "issues");
    const issueSecondPage = 'https://example.test/gh-issues-page-2';
    const prUrl = toGhApiUrl(repo, "pulls");
    mock(issueUrl, ghObject, issueSecondPage);
    mock(issueSecondPage, ghObject);
    mock(prUrl, ghObject);
    const {items: data} = await fetchGithub(repo);
    assert.equal(data.length, 3, 'Three items retrieved from github');
    assert.equal(data[0].created_at, ghObject[0].created_at, 'Date retrieved from gh item');
  });

  it('detects issues and commits in a single repo', async function() {
    const repo = "https://github.com/acme/test-commits";
    const issueUrl = toCacheUrl(repo, "issues");
    const prUrl = toGhApiUrl(repo, "pulls");
    const commitsUrl = toCacheUrl(repo, "commits");
    mock(issueUrl, ghObject);
    mock(prUrl, []);
    mock(commitsUrl, ghObject.concat(ghObject));
    const {items: data} = await fetchGithub(repo);
    assert.equal(data.length, 3, 'Three items retrieved from github');
  });

  it("detects activity across repos in a github org, including an empty repo where it doesn't look for commits", async function() {
    this.timeout(5000); 
    const repoUrls = ["https://github.com/acme/test-empty", "https://github.com/acme/test-org"];
    mock("https://api.github.com/users/acme/repos?per_page=100&direction=asc", repos);
    mock(toCacheUrl(repoUrls[0], "issues"), ghObject);
    mock(toGhApiUrl(repoUrls[0], "pulls"), []);
    mock(toCacheUrl(repoUrls[1], "issues"), ghObject);
    mock(toGhApiUrl(repoUrls[1], "pulls"), ghObject);
    const {items: data} = await fetchGithub("https://github.com/acme");
    assert.equal(data.length, 3, 'Three items retrieved from github');
  });
  
  afterEach(() => {
    agent.assertNoPendingInterceptors();
  });

  after(async () => {
    await agent.close();
    setGlobalDispatcher(origDispatcher);
  });
});

