const {fetchRSS} = require("./rss-activity");

module.exports.fetchWiki = async function fetchWiki(url) {
  if (!url.startsWith('http')) url = 'https://www.w3.org' + url;
  if (url.startsWith("https://github.com")) {
    // based on https://stackoverflow.com/a/8573941
    return fetchRSS(url + ".atom");
  }
  // TODO: handle case of a single wiki page
  // handle case of Main_Page
  return fetchRSS(url + '/api.php?action=feedrecentchanges&days=1000&limit=1000');
};

