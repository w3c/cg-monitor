const url = require("url");
const _fetch = require("node-fetch");
const jsdom = require("jsdom");
const RequestQueue = require('limited-request-queue');

//const Octokat = require("octokat");
const config = require("./config.json");
const w3c = require('node-w3capi');
let RSSParser = require('rss-parser');
const { JSDOM } = jsdom;
const rssparser = new RSSParser();
const MWBot = require('nodemw');

w3c.apiKey = config.w3capikey;

const fetchResolve = {};
const fetchReject = {};

const queue = new RequestQueue(null, {
  'item': ({url}, done) => {
    console.warn("fetching " + url);
    _fetch(url).then(r => {
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

const _p = pathObj => function() {
  const args = [...arguments];
  return new Promise((res, rej) => {
    args.push((err, results) => {
      if (err) return rej(err);
      return res(results);
    });
    pathObj.fetch.apply(pathObj, args);
  });
};

const httpToHttps = str => str.replace(/^http:\/\//, "https://");

const relevantServices = ["rss", "lists", "repository", "wiki"];

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

function fetchWiki(url) {
  if (!url.startsWith('http')) url = 'https://www.w3.org' + url;
  return fetchRSS(url + '/api.php?action=feedrecentchanges&from=' + 1514761200);
}

function fetchGithub(url) {
  // Repo vs Org
  return fetchRSS(url + 'commits/master.atom'); // TODO: figure the right branch
  // TODO: detect comment / issue / PR activity as well
}

function wrapService(service) {
  return data => {
    return { service, data};
  }
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
  }
  return Promise.resolve(service).then(wrapService(service));
}

w3c.groups().fetch({embed:true}, (err, groups) => {
    if (err) return console.error(err);
  const communitygroups = groups.filter(g => g.type === 'community group' && !g['is-closed']) ;
  // is-closed, chairs
    // services: RSS for blog activity, Wiki for editing (API?), x "Mailing Lists", Twitter, "Version Control"
    // ? participations: created (level of recent interest)

  Promise.all(
    communitygroups
      .map(
        cg =>
          Promise.all([
            Promise.resolve(cg),
            _p(w3c.group(cg.id).chairs())(),
            _p(w3c.group(cg.id).services())({embed:true})
              .then(services => Promise.all(
                services
                  .filter(s => relevantServices.includes(s.type))
                  .map(fetchServiceActivity))),
            _p(w3c.group(cg.id).participations())({embed: true})
          ])
      )
  ).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
});
