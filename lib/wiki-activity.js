const {fetchRSS} = require("./rss-activity");

module.exports.fetchWiki = async function fetchWiki(url) {
  if (!url.startsWith('http')) url = 'https://www.w3.org' + url;
  if (url.startsWith("https://github.com")) {
    // based on https://stackoverflow.com/a/8573941
    return fetchRSS(url + ".atom");
  }
  // from there on, this assume we're dealing with a wikimedia instance
  url = url.replace(/Main_Page$/, '');
  if (url.match(/\/wiki\/.+$/)) { // a specific page of the wiki
    const [base, page] = url.split('/wiki/');
    return fetchRSS(`${base}/wiki/index.php?title=${page}&feed=atom&action=history&days=1000&limit=1000`);
  }
  return fetchRSS(url + '/api.php?action=feedrecentchanges&days=1000&limit=1000');
};

