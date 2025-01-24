import webSpecs from 'web-specs/index.json' with { type: 'json' };
import webref from '../webref/ed/index.json' with { type: 'json' };
import repoData from '../validate-repos/report.json' with { type: 'json' };
import cgTransitions from './cg-transitions.json' with {type: 'json' };

import authedFetch from './lib/authed-fetch.js';
import {getBcdKeysForSpec, getBrowserSupport} from './lib/bcd.mjs';

function log(m) {
  console.log(m);
}

const cgShortname = "wicg";
const cgRepoOrg = "WICG";

const report = {};

report[cgShortname] = {specs: [], repos:{}};
// TODO CG ownership should be (also?) detected via r.w3c.group
// TODO: start from repo manager list of repos associated to groups
for (const repo of repoData.repos.filter(r => r.w3c?.["repo-type"]?.includes("cg-report") && r.owner.login === cgRepoOrg)) {
  // TODO: report repos with invalid w3c.json, or with valid w3c.json and cg-report type but not in IPR checker (for sanity check)

  const repoName = `${repo.owner.login}/${repo.name}`;
  if (repo.isArchived) {
    // TODO: check that no spec or marked as discontinued?
    report[cgShortname].repos[repoName] = `${repoName} is archived`;
  } else {
    const specs = webSpecs.filter(s => s.nightly?.repository === `https://github.com/${repoName}`);
    
    for (const spec of specs) {

      if (spec.standing === "discontinued") {
	report[cgShortname].repos[repoName] = `${spec.shortname} is discontinued but repo not archived`;
	continue;
      }

      const age = Math.round(new Date() - new Date(repo.createdAt)/(3600*1000*24));

      const crawledSpec = webref.results.find(s => s.shortname === spec.shortname);
      let lastModificationDate;

      if (crawledSpec?.date) {
	lastModificationDate = new Date(crawledSpec.date);
      } else {
	// fallback: last commit date in the repo
	const [lastCommit] = await (await authedFetch(`https://api.github.com/repos/${repoName}/commits`)).json();
	lastModificationDate = new Date(lastCommit.commit.committer.date);
      }

      // is implemented?
      const compat_features = getBcdKeysForSpec(spec);
      const engines = [];
      for (let feature of compat_features) {
	const support = Object.keys(getBrowserSupport([feature]));
	if (support) {
	  engines.push(...support);
	}
      }

      // has test suite?
      // is referenced by other brower specs?
      // under transition? doc marked as under transition?
      const transition = cgTransitions[cgShortname].specs.find(s => s.repo === repoName) ?? "N/A";
      report[cgShortname].specs.push({title: spec.title, url: spec.url, repo: repoName, lastModified: lastModificationDate.toJSON(), implementations: [... new Set(engines)], transition});
    }

    // list of contributors from IPR checker (@@@ not per spec but per repo atm)

  }
}
console.log(JSON.stringify(report, null, 2));

