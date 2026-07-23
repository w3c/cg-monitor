const authedFetch = require("./authed-fetch");

const linkParse = require('parse-link-header');

async function recursiveGhFetch(url, acc = []) {
  const { headers, body} = await authedFetch(url);
  const link = (headers || new Map()).get('link');
  const data = JSON.parse(body);
  if (link) {
    const parsed = linkParse(link);
    if (parsed.next) {
      return recursiveGhFetch(parsed.next.url, acc.concat(data));
    }
  }
  return acc.concat(data);
}

function fetchGithubRepo(owner, repo, size) {
  return Promise.all([
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/issues?state=all&per_page=100&direction=asc')
      .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at};}))
      .catch(() => []),
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/pulls?state=all&per_page=100&direction=asc')
      .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at};}))
      .then(pulls => {
        if (pulls.length === 0) {
          // if no pull request, we take a look at commits instead
          // unless the repo is empty
	  if (size === 0) return [];
          return recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=100&direction=asc')
            .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at, commit: i.commit}; }))
	    .catch(() => []);
        }
        return pulls;
      }).catch(() => [])
  ]).then(data => data.flat());
}


async function fetchGithub(url) {
  const match = url.match(/github\.com\/([^\/]*)(\/([^\/]*)\/?)?$/);
  if (!match) return `Unrecognized repo url ${url}`;
  const [, owner,, repo] = match;
  if (!repo) {
    const repos = await recursiveGhFetch(`https://api.github.com/users/${owner}/repos?per_page=100&direction=asc`);
    const items = await Promise.all(repos.filter(r => !r.fork).map(r => r.owner ? fetchGithubRepo(r.owner.login, r.name, r.size) : []));
    // TODO: this should instead be sent as a collection of services (1 per repo)
    return { items: items.flat() };
  } else {
    return {items: await fetchGithubRepo(owner, repo)};
  }
}

module.exports.fetchGithub = fetchGithub;
module.exports.recursiveGhFetch = recursiveGhFetch;
