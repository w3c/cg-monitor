const url = require("url");
const fs = require("fs");

const _fetch = require("node-fetch");
const jsdom = require("jsdom");
const RequestQueue = require('limited-request-queue');
const RSSParser = require('rss-parser');
const linkParse = require('parse-link-header');

const config = require("./config.json");

const { JSDOM } = jsdom;
const rssparser = new RSSParser();

const fetchResolve = {};
const fetchReject = {};

const ayearago = new Date();
ayearago.setFullYear(ayearago.getFullYear() - 1);

const queue = new RequestQueue(null, {
  'item': ({url}, done) => {
    console.warn("fetching " + url);
    const headers =  [
      ['User-Agent', 'W3C CG dashboard https://github.com/w3c/cg-monitor']
    ];
    if (url.match(/https:\/\/api\.github\.com\//)) {
      headers.push(['Authorization', 'token ' + config.ghapitoken]);
    }
    if (url.match(/https:\/\/api\.w3\.org\//)) {
      headers.push(['Authorization', 'W3C-API apikey="' + config.w3capikey + '"']);
    }
    _fetch(url, { headers }).then(r => {
      done();
      return fetchResolve[url](r);
    }).catch(fetchReject[url]);
  }
});

const fetch = url => new Promise((res, rej) => {
  fetchResolve[url] = res;
  fetchReject[url] = rej;
  queue.enqueue(url);
});

const httpToHttps = str => str.replace(/^http:\/\//, "https://");

function fetchRSS(url) {
  return fetch(url).then(r => r.text()).then(text => rssparser.parseString(text)).catch(error => "Error fetching "  + url + ": " + error);
}

function fetchMail(url) {
  if (!httpToHttps(url).startsWith('https://lists.w3.org/Archives/Public')) return Promise.resolve("Did not fetch " + url);
  return fetch(url)
    .then(r => r.text())
    .then(text => new JSDOM(text))
    .then(dom => {
      const data = {};
      [...dom.window.document.querySelectorAll("tbody")].forEach(tbody => {
        [...tbody.querySelectorAll("tr")].forEach(tr => {
          const month = new Date(tr.querySelector("td").textContent + " GMT");
          if (month.toJSON())
            data[month.toJSON().slice(0,7)] = parseInt(tr.querySelector("td:last-child").textContent, 10);
          else
            console.error("Error parsing ml archive at " + url);
        });
      });
      return data;
    });
}

function recursiveFetchDiscourse(url, before = null, acc = []) {
  const fetchedUrl = url + (before ? '?before=' + before : '');
  return fetch(fetchedUrl)
    .then(r => r.json())
    .then(({latest_posts}) => {
      acc = acc.concat(latest_posts);
      if (latest_posts[latest_posts.length - 1].updated_at > ayearago.toJSON()) {
        return recursiveFetchDiscourse(url, before = latest_posts[latest_posts.length - 1].id, acc);
      }
      return acc;
    });
}

function fetchForum(url) {
  if (!url.match(/discourse/)) return Promise.resolve("Did not fetch forum at " + url);
  return recursiveFetchDiscourse(url + '/posts.json');
}


function fetchWiki(url) {
  if (!url.startsWith('http')) url = 'https://www.w3.org' + url;
  return fetchRSS(url + '/api.php?action=feedrecentchanges&from=' + 1514761200);
}

// TODO: tracker? bugzilla?

function fetchDvcs(url) {
  const match = url.match(/dvcs\.w3\.org\/hg\/([^\/]*)\/?$/);
  if (!match) return Promise.resolve("Unrecognized repository url " + url);
  return fetchRSS(url + '/rss-log');
}

function recursiveW3cFetch(url, key=null, acc = []) {
  return fetch(url)
    .then(r => r.json())
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
    .then(r => Promise.all([Promise.resolve((r.headers || new Map()).get('link')), r.json()]))
    .then(([link, data]) => {
      if (link) {
        const parsed = linkParse(link);
        if (parsed.next) {
          return recursiveGhFetch(parsed.next.url, acc.concat(data));
        }
      }
      return {items: acc.concat(data)};
    });
}

function fetchGithubRepo(owner, repo) {
  return Promise.all([
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/issues?state=all&per_page=100'),
    recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/pulls?state=all&per_page=100')
      .then(pulls => {
        if (pulls.length === 0) {
          // if no pull request, we take a look at commits instead
          return recursiveGhFetch('https://api.github.com/repos/' + owner + '/' + repo + '/commits?since=' + ayearago.toJSON() + '&per_page=100');
        }
        return pulls;
      })
  ]).then(data => [].concat(...data));
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
      .then(repos => Promise.all(repos.map(r => fetchGithubRepo(r.owner.login, r.name))))
      .then(items => { return {items: [].concat(...items)} ;});
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

recursiveW3cFetch('https://api.w3.org/affiliations/52794/participants?embed=1', 'participants')
  .then(staff => {
    save('staff', staff);
    return recursiveW3cFetch('https://api.w3.org/groups?embed=1', 'groups');
  })
  .then(groups => {
    const communitygroups = groups.filter(g => g.type === 'community group' && !g['is-closed']) ;
    communitygroups
      .filter(g => process.argv.length > 2 ? process.argv.map(x => parseInt(x, 10)).includes(g.id) : true)
      .map(
        cg =>
          Promise.all([
            Promise.resolve(cg),
            recursiveW3cFetch(cg._links.chairs.href, 'chairs'),
            recursiveW3cFetch(cg._links.services.href + '?embed=1', 'services')
              .then(services => Promise.all(
                services
                  .map(fetchServiceActivity))),
            recursiveW3cFetch(cg._links.participations.href + '?embed=1', 'participations')
          ]).then(data => save(cg.id, data))
      );
  });
