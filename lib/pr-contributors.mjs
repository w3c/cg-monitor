import groups from "../invited-expert-roles.json" with {type: "json"};
import authedFetch from "./authed-fetch.js";


const fetchJSON = async url => {
  try {
    const text = (await authedFetch(url)).body;
    const data = JSON.parse(text);
    return data;
  } catch (e) {
    throw new Error(`Failure to load JSON from ${url}: ${e.stack}`, e);
  }
};


const repos = await fetchJSON('https://labs.w3.org/repo-manager/api/repos');

const groupContributors = [];

for (const g of groups) {
  const groupRepos = repos.filter(r => r.groups.find(
    // ash-nazg API returns w3cid as a string, so == is intended here
    gg => gg.w3cid == g.id
  ));
  const contributors = {};
  for (const repo of groupRepos) {
    // removing "repo-" prefix
    const path = repo._id.slice(5);
    const { substantiveContributors } = await fetchJSON(`https://labs.w3.org/repo-manager/api/repos/${path}/contributors`);
    contributors[path] = Object.keys(substantiveContributors).reduce((acc, b) => {
      const contributor = substantiveContributors[b];
      // numeric ids are orgs, otherwise user (TODO: fix ash-nazg API?)
      contributor.href = b.match(/^[0-9]+$/) ? `https://api.w3.org/affiliations/${b}`: `https://api.w3.org/users/${b}`; 
      acc.push(contributor);
      return acc;
    }, []);
  }

  groupContributors.push({
    id: g.id,
    fullshortname: g.fullshortname,
    contributors
  });
}
console.log(JSON.stringify(groupContributors, null, 2));
