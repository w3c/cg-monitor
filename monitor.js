const url = require("url");
const fs = require("fs");

const _fetch = require("node-fetch");
const jsdom = require("jsdom");
const {ITEM_EVENT, default:RequestQueue} = require('limited-request-queue');
const RSSParser = require('rss-parser');
const linkParse = require('parse-link-header');

const config = require("./config.json");

const { JSDOM } = jsdom;
const rssparser = new RSSParser();

const fetchResolve = {};
const fetchReject = {};
const cache = {};

const queue = new RequestQueue()
  .on(ITEM_EVENT, (url, data, done) => {
    console.log("fetching " + url);
    const headers =  [
      ['User-Agent', 'W3C Group dashboard https://github.com/w3c/cg-monitor']
    ];
    if (url.href.match(/https:\/\/api\.github\.com\//)) {
      headers.push(['Authorization', 'token ' + config.ghapitoken]);
    }
    if (url.href.match(/https:\/\/api\.w3\.org\//)) {
      headers.push(['Authorization', 'W3C-API apikey="' + config.w3capikey + '"']);
    }
    _fetch(url, { headers }).then(r => Promise.all([Promise.resolve(r.status), Promise.resolve(r.headers), r.text()]))
      .then(([status, headers, body]) => {
        done();
        cache[url] = {status, headers, body};;
        return Promise.all(fetchResolve[url].map(res => res({status, headers, body})));
      }).catch(err => {console.error(err); return fetchReject[url].forEach(rej => rej(err));});
  }
);

const fetch = (url, options = {}) => new Promise((res, rej) => {
  if (cache[url]) return res(cache[url]);
  if (!fetchResolve[url]) fetchResolve[url] = [];
  if (!fetchReject[url]) fetchReject[url] = [];
  fetchResolve[url].push(res);
  fetchReject[url].push(rej);
  queue.enqueue(new URL(url), {}, options);
});

const httpToHttps = str => str.replace(/^http:\/\//, "https://");

function fetchRSS(url) {
  return fetch(url).then(({body: text}) => rssparser.parseString(text)).catch(error => "Error fetching "  + url + ": " + error);
}

function fetchMail(url) {
  if (!httpToHttps(url).startsWith('https://lists.w3.org/Archives/Public')) return Promise.resolve("Did not fetch " + url);
  return fetch(url)
    .then(({body: text}) => new JSDOM(text))
    .then(dom => {
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
    });
}

function recursiveFetchDiscourse(url, before = null, acc = []) {
  const fetchedUrl = url + (before ? '?before=' + before : '');
  return fetch(fetchedUrl, {maxSocketsPerHost: 1, rateLimit: 200})
    .then(({body: text}) => JSON.parse(text))
    .then(({latest_posts}) => {
      if (!latest_posts) return acc;
      acc = acc.concat(latest_posts.map(p => { return {created_at: p.created_at, topic_title: p.topic_title}; }));
      const minId= Math.min(...latest_posts.map(p => p.id));
      if (before === null || before > minId) {
        return recursiveFetchDiscourse(url, minId, acc);
      }
      return acc;
    }).catch(e => {
      console.error("Error while fetching " + fetchedUrl);
      console.error(e);
      return acc;
    });
}

function fetchForum(url) {
  if (!url.match(/discourse/) && !url.match(/socialhub\.activitypub\.rocks/)) return Promise.resolve("Did not fetch forum at " + url);
  // TODO: fix case where discourse URL is for a specific category à la
  // https://discourse.wicg.io/c/web-mapping
  if (url.endsWith("/")) url = url.slice(0, -1);
  return recursiveFetchDiscourse(url + '/posts.json').then(items => { return {items}; });
}


function fetchWiki(url) {
  if (!url.startsWith('http')) url = 'https://www.w3.org' + url;
  return fetchRSS(url + '/api.php?action=feedrecentchanges&days=1000&limit=1000');
}

// TODO: tracker? bugzilla?

function fetchDvcs(url) {
  const match = url.match(/dvcs\.w3\.org\/hg\/([^\/]*)\/?$/);
  if (!match) return Promise.resolve("Unrecognized repository url " + url);
  return fetchRSS(url + '/rss-log');
}

function recursiveW3cFetch(url, key=null, acc = []) {
  return fetch(url)
    .then(({body: text}) => JSON.parse(text))
    .then(data => {
      const selectedData = !key ? data : (data._embedded ? data._embedded[key] : data._links[key]);
      if (!key) {
        return selectedData; // This assumes when no key, no recursion
      }
      if (data._links && data._links.next) {
        return recursiveW3cFetch(data._links.next.href, key, acc.concat(selectedData));
      }
      return acc.concat(selectedData);
    }).catch(log);
}


function recursiveGhFetch(url, acc = []) {
  return fetch(url)
    .then(({headers, body}) => [(headers || new Map()).get('link'), JSON.parse(body)])
    .then(([link, data]) => {
      if (link) {
        const parsed = linkParse(link);
        if (parsed.next) {
          return recursiveGhFetch(parsed.next.url, acc.concat(data));
        }
      }
      return acc.concat(data);
    });
}

function fetchGithubRepo(owner, repo) {
  return Promise.all([
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/issues?state=all&per_page=100')
      .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at};})),
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/pulls?state=all&per_page=100')
      .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at};}))
      .then(pulls => {
        if (pulls.length === 0) {
          // if no pull request, we take a look at commits instead
          return recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/commits?per_page=100')
            .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at, commit: i.commit}; }));
        }
        return pulls;
      })
  ]).then(data => data.flat());
}


function fetchGithub(url) {
  const match = url.match(/github\.com\/([^\/]*)(\/([^\/]*)\/?)?$/);
  if (!match) return fetchDvcs(url);
  const [, owner,, repo] = match;
  if (!repo) {
    // Fetch info on all repos from the org / the user
    let ownerType = "orgs";
    return fetch(`https://api.github.com/orgs/${owner}`)
      .then(r => {
        if (r.status === 404) ownerType = 'users';
        return recursiveGhFetch(`https://api.github.com/${ownerType}/${owner}/repos?per_page=100`);
      })
      .then(repos => Promise.all(repos.filter(r => !r.fork).map(r => r.owner ? fetchGithubRepo(r.owner.login, r.name) : [])))
      .then(items => { return {items: items.flat()} ;});
  } else {
    return fetchGithubRepo(owner, repo).then(items => { return {items} ;}) ;
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

const log = err => { console.error(err); return err;};

const save = (id, data) => { fs.writeFileSync('./data/' + id + '.json', JSON.stringify(data, null, 2)); return data; };

let groupRepos;

fetch('https://w3c.github.io/validate-repos/report.json')
  .then(({body}) => JSON.parse(body))
  .then(data =>
        { groupRepos = data.groups;
          return recursiveW3cFetch('https://api.w3.org/affiliations/52794/participants?embed=1', 'participants')
        })
  .then(staff => {
    save('staff', staff);
    return recursiveW3cFetch('https://api.w3.org/groups?embed=1', 'groups');
  }, err => console.error(err))
  .then(groups => {
    const w3cgroups = groups.filter(g => (g.type === 'community group' || g.type === 'business group' || g.type === 'working group' || g.type === 'interest group') && !g['is_closed']) ;
    return Promise.all(
      w3cgroups
        .filter(g => process.argv.length > 2 ? process.argv.map(x => parseInt(x, 10)).includes(g.id) : true)
        .map(
        w3cg =>
          Promise.all([
            Promise.resolve(w3cg),
            Promise.all((groupRepos[w3cg.id] || {repos:[]}).repos.map(({fullName}) => fetchGithub('https://github.com/' + fullName))),
            recursiveW3cFetch((w3cg._links.chairs || {}).href, 'chairs'),
            recursiveW3cFetch((w3cg._links.services || {}).href + '?embed=1', 'services')
              .then(services => Promise.all(
                services
                  .map(fetchServiceActivity))),
            recursiveW3cFetch((w3cg._links.participations || {}).href + '?embed=1', 'participations').catch(err => {console.error("Error fetching data on " + w3cg.id, err); return [w3cg, [], [], [], []];})
          ]).then(data => save(w3cg.id, data)).catch(err => {console.error("Error dealing with " + w3cg.id, err);})
      ));
  }).catch(err => console.error(err));
