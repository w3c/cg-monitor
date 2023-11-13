const authedFetch = require("./authed-fetch");

async function recursiveFetchDiscourse(url, before = null, acc = []) {
  const fetchedUrl = url + (before ? '?before=' + before : '');
  try {
    const text = (await authedFetch(fetchedUrl)).body;
    const {latest_posts} = JSON.parse(text);
    if (!latest_posts) return acc;
    acc = acc.concat(latest_posts.map(p => { return {created_at: p.created_at, topic_title: p.topic_title}; }));
    const minId= Math.min(...latest_posts.map(p => p.id));
    if (before === null || before > minId) {
      return recursiveFetchDiscourse(url, minId, acc);
    }
    return acc;
  } catch (e) {
    console.error("Error while fetching " + fetchedUrl);
    console.error(e);
    return acc;
  }
}

async function fetchForum(url) {
  if (url.match(/slack\.com\//) || url.match(/google.com\//)) {
    return `Forum ${url} is hosted on a non-supported platform`;
  }
  if (url.endsWith("/")) url = url.slice(0, -1);
  try {
    return {items: await recursiveFetchDiscourse(url + '/posts.json')};
  } catch (e) {
    return `Did not recognize discourse API for ${url}`;
  }
  // TODO: handle case where discourse URL is for a specific category à la
  // https://discourse.wicg.io/c/web-mapping
}

module.exports.fetchForum = fetchForum;
