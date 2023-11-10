const url = require("url");
const fs = require("fs");

const authedFetch = require("./lib/authed-fetch");

const {fetchRSS} = require("./lib/rss-activity");
const {fetchWiki} = require("./lib/wiki-activity");
const {fetchMail} = require("./lib/mail-activity");
const {fetchForum} = require("./lib/forum-activity");
const {fetchGithub} = require("./lib/github-activity");
// TODO: tracker? bugzilla?

// TODO: replace with more semantic method?
const {recursiveW3cFetch} = require("./lib/w3c-data");

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
