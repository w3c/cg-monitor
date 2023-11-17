const QueuedFetch = require("./caching-queued-fetch");
const { queuedFetch } = QueuedFetch;

const githubToken = process.env.GH_TOKEN ?? (_ => {
  try {
    return require("../config.json").ghapitoken;
  }
  catch {
    return null;
  }
})();

const authedFetch = (url) => {
  // this is the value used for the discourse API, and feels like a safe default in general
  let interval = 200;
  const u = new URL(url);
  const headers =  {
    'User-Agent': 'W3C Group dashboard https://github.com/w3c/cg-monitor'
  };
  if (u.href.startsWith("https://api.github.com/") && githubToken) {
    headers['Authorization'] = 'token ' + githubToken;
    // Roughly matching github API rate limit of 5000 requests per hour
    interval = 750;
  }
  return queuedFetch(url, { headers }, { interval, verbose: true, fsCachePath: ".cache" });
};


module.exports = authedFetch;
