const authedFetch = require("./authed-fetch");
const RSSParser = require('rss-parser');
const rssparser = new RSSParser();

async function fetchRSS(url) {
  try {
    const text = (await authedFetch(url)).body;
    return rssparser.parseString(text);
  } catch (err) {
    return "Error fetching "  + url + ": " + err;
  }
}

module.exports.fetchRSS = fetchRSS;
