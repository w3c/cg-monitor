const url = require("url");
const fs = require("fs");

const config = require("./config.json") || {};

const QueuedFetch = require("./lib/caching-queued-fetch");
const { queuedFetch } = QueuedFetch;

const authedFetch = (url) => {
  // this is the value used for the discourse API, and feels like a safe default in general
  let interval = 200;
  const u = new URL(url);
  const headers =  {
    'User-Agent': 'W3C Group dashboard https://github.com/w3c/cg-monitor'
  };
  if (u.href.startsWith("https://api.github.com/")) {
    headers['Authorization'] = 'token ' + config.ghapitoken;
    // Roughly matching github API rate limit of 5000 requests per hour
    interval = 750;
  }
  return queuedFetch(url, { headers }, { interval, verbose: true, fsCachePath: ".cache" });
};



const jsdom = require("jsdom");
const RSSParser = require('rss-parser');
const linkParse = require('parse-link-header');

const { JSDOM } = jsdom;
const rssparser = new RSSParser();

ghToken = config.ghapitoken;

const httpToHttps = str => str.replace(/^http:\/\//, "https://");

async function fetchRSS(url) {
  try {
    const text = (await authedFetch(url)).body;
    return rssparser.parseString(text);
  } catch (err) {
    return "Error fetching "  + url + ": " + err;
  }
}

async function fetchMail(url) {
  if (!httpToHttps(url).startsWith('https://lists.w3.org/Archives/Public')) return "Did not fetch " + url;
  const text = (await authedFetch(url)).body;
  const dom = new JSDOM(text);
  const data = {};
  [...dom.window.document.querySelectorAll("tbody")].forEach(tbody => {
    [...tbody.querySelectorAll("tr")].forEach(tr => {
      const month = new Date(tr.querySelector("td").textContent + " GMT");
      if (month.toJSON()) {
        const mailCount = parseInt(tr.querySelector("td:last-child").textContent, 10);;
        // some archives are per quarter
        // we detect this on the presence of the string " to "
        // as in "January to March"
        if (tr.querySelector("td").textContent.includes(" to ")) {
          // and if so, we divide arbitrarily in 3 for the per-month view
          for (let i = 0; i < 3 ; i++) {
            data[month.toJSON().slice(0,7)] = mailCount / 3;
            month.setMonth(month.getMonth() - 1);
          }
        } else {
          data[month.toJSON().slice(0,7)] = mailCount;
        }
      } else {
        console.log("Empty ml archive at " + url);
      }
    });
  });
  return data;
}

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
  if (!url.match(/discourse/) && !url.match(/socialhub\.activitypub\.rocks/)) return "Did not fetch forum at " + url;
  // TODO: fix case where discourse URL is for a specific category à la
  // https://discourse.wicg.io/c/web-mapping
  if (url.endsWith("/")) url = url.slice(0, -1);
  return {items: await recursiveFetchDiscourse(url + '/posts.json')};
}


async function fetchWiki(url) {
  if (!url.startsWith('http')) url = 'https://www.w3.org' + url;
  if (url.startsWith("https://github.com")) {
    // based on https://stackoverflow.com/a/8573941
    return fetchRSS(url + ".atom");
  }
  // TODO: handle case of a single wiki page
  // handle case of Main_Page
  return fetchRSS(url + '/api.php?action=feedrecentchanges&days=1000&limit=1000');
}

// TODO: tracker? bugzilla?

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
  return acc.concat(selectedData);
}


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

function fetchGithubRepo(owner, repo) {
  return Promise.all([
    recursiveGhFetch('https://labs.w3.org/github-cache/v3/repos/' + owner + '/' + repo + '/issues?state=all&per_page=100')
    // if the github cache doesn't work, try hitting github directly
      .catch(() => 
        recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/issues?state=all&per_page=100&direction=asc'))
      .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at};}))
      .catch(() => []),
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/pulls?state=all&per_page=100&direction=asc')
      .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at};}))
      .then(pulls => {
        if (pulls.length === 0) {
          // if no pull request, we take a look at commits instead
          return recursiveGhFetch('https://labs.w3.org/github-cache/v3/repos/' + owner + '/' + repo + '/commits?per_page=100')
          // if the github cache doesn't work, try hitting github directly
            .catch(() => 
              recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=100&direction=asc'))
            .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at, commit: i.commit}; }));
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
    // Fetch info on all repos from the org / the user
    let ownerType = "orgs";
    const r= await authedFetch(`https://api.github.com/orgs/${owner}`);
    if (r.status === 404) ownerType = 'users';
    const repos = await recursiveGhFetch(`https://api.github.com/${ownerType}/${owner}/repos?per_page=100&direction=asc`);
    const items = await Promise.all(repos.filter(r => !r.fork).map(r => r.owner ? fetchGithubRepo(r.owner.login, r.name) : []));
    // TODO: this should instead be sent as a collection of services (1 per repo)
    return { items: items.flat() };
  } else {
    return {items: await fetchGithubRepo(owner, repo)};
  }
}

function wrapService(service) {
  return data => {
    return { service, data};
  };
}

function fetchServiceActivity(service) {
  switch(service.type) {
  case "blog":
    // optimistic approach at getting the RSS feed
    return fetchRSS(service.link + "feed").then(wrapService({...service, type: "rss"}));
  case "rss":
    return fetchRSS(service.link).then(wrapService(service));
  case "lists":
    return fetchMail(service.link).then(wrapService(service));
  case "wiki":
    return fetchWiki(service.link).then(wrapService(service));
  case "repository":
    return fetchGithub(service.link).then(wrapService(service));
  case "forum":
    return fetchForum(service.link).then(wrapService(service));
  }
  return Promise.resolve(service).then(wrapService(service));
}


const save = (id, data) => { fs.writeFileSync('./data/' + id + '.json', JSON.stringify(data, null, 2)); return data; };

let groupRepos;

(async function() {
  try {
    const data = JSON.parse((await authedFetch('https://w3c.github.io/validate-repos/report.json')).body);
    const groupRepos =data.groups;
    const staff = await recursiveW3cFetch('https://api.w3.org/affiliations/52794/participants?embed=1', 'participants');
    save('staff', staff);
    const groups = await recursiveW3cFetch('https://api.w3.org/groups?embed=1', 'groups');
    const w3cgroups = groups.filter(g => (g.type === 'community group' || g.type === 'business group' || g.type === 'working group' || g.type === 'interest group') && !g['is_closed']) ;
    Promise.all(
      w3cgroups
        .filter(g => process.argv.length > 2 ? process.argv.map(x => parseInt(x, 10)).includes(g.id) : true)
        .map(
          w3cg =>
          Promise.all([
            Promise.resolve(w3cg),
            Promise.all((groupRepos[w3cg.id] || {repos:[]}).repos.map(({fullName}) => fetchGithub('https://github.com/' + fullName))),
            recursiveW3cFetch((w3cg._links.chairs || {}).href, 'chairs'),
            recursiveW3cFetch((w3cg._links.services || {}).href?.concat('?embed=1'), 'services')
              .then(services => Promise.all(
                services
                  .map(fetchServiceActivity))),
            recursiveW3cFetch((w3cg._links.participations || {}).href?.concat('?embed=1'), 'participations')
          ]).catch(err => {console.error("Error fetching data on " + w3cg.id, err); return [w3cg, [], [], [], []];})
	    .then(data => save(w3cg.id, data)).catch(err => {console.error("Error dealing with " + w3cg.id, err);})
        ));
  } catch (err) {
    console.error(err);
  }
})();
