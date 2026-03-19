const authedFetch = require("./authed-fetch");

async function recursiveW3cFetch(url, key=null, acc = []) {
  if (!url) return [];
  const text = (await authedFetch(url)).body;
  const data = JSON.parse(text);
  const selectedData = !key ? data : (data._embedded ? data._embedded[key] : data._links[key]);
  if (!key) {
    return selectedData; // This assumes when no key, no recursion
  }
  if (data._links && data._links.next) {
    return recursiveW3cFetch(data._links.next.href, key, acc.concat(selectedData));
  }
  if (selectedData)
    return acc.concat(selectedData);
}

module.exports.recursiveW3cFetch = recursiveW3cFetch;
