// run this script to set up the cache directory from fetch-filecache-for-crawling used for test purposes;

const fsCacheFetch = require('fetch-filecache-for-crawling');

const { MockAgent, setGlobalDispatcher } = require('undici');

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

setGlobalDispatcher(agent);
agent.disableNetConnect();

const testBaseUrl = 'https://example.com/';

mock(testBaseUrl + "fs", 200, 0, { headers: {"expires": "Mon, 20 Oct 2223 16:51:59 GMT"}});
mock(testBaseUrl + "fs2", 200, 0, { headers: {"expires": "Fri, 20 Oct 2023 16:51:59 GMT"}});
mock(testBaseUrl + "fs3", 200, 0, { headers: {"last-modified": "Fri, 20 Oct 2023 16:51:59 GMT"}});


fsCacheFetch(testBaseUrl + "fs", {cacheFolder: "test/fs-cache"});
fsCacheFetch(testBaseUrl + "fs2", {cacheFolder: "test/fs-cache"});
fsCacheFetch(testBaseUrl + "fs3", {cacheFolder: "test/fs-cache"});
