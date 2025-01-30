import webSpecs from 'web-specs/index.json' with { type: 'json' };
import webref from '../webref/ed/index.json' with { type: 'json' };
import repoData from '../validate-repos/report.json' with { type: 'json' };
import cgTransitions from './cg-transitions.json' with {type: 'json' };
import cgImplementations from './spec-implementations.json' with {type: 'json' };
import specAnnotations from './spec-annotations.json' with {type: 'json' };

import authedFetch from './lib/authed-fetch.js';
import {getBcdKeysForSpec, getBrowserSupport} from './lib/bcd.mjs';

import { promises as fs } from 'fs';

function log(m) {
  console.log(m);
}

const cgShortname = "wicg";
const cgRepoOrg = "WICG";
const webrefPath = "../webref"; // DRY also in import path above


const report = {};

const references = {};

async function buildReferencesMap() {
  const files = (await fs.readdir(`${webrefPath}/ed/refs/`)).filter(p => p.endsWith(".json"));
  for (const path of files) {
    const data = await fs.readFile(`${webrefPath}/ed/refs/${path}`, "utf-8");
    const { spec, refs } = JSON.parse(data);
    for (const { url } of refs.normative) {
      if (!references[url]) {
	references[url] = new Set();
      }
      references[url].add(spec.url);
    }
  }
}

await buildReferencesMap();

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
    // TODO: handle repos not referenced from browser-specs

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
      if (cgImplementations[spec.url]) {
	// TODO: avoid dups
	engines.push(...Object.keys(cgImplementations[spec.url]));
      }

      // has test suite?

      // is referenced by other brower specs?
      const referencedBy = references[spec.url] ? [...references[spec.url]].map(u => { return {url: u, title: webSpecs.find(s => s.url === u || s?.nightly?.url === u)?.title} ;}) : [];

      // under transition? doc marked as under transition?
      const transition = cgTransitions[cgShortname].specs.find(s => s.repo === repoName) ?? "N/A";
      report[cgShortname].specs.push({title: spec.title, url: spec.url, repo: repoName, lastModified: lastModificationDate.toJSON(), implementations: [... new Set(engines)], referencedBy, transition, notes: specAnnotations[spec.url] ?? ""});
    }

    // list of contributors from IPR checker (@@@ not per spec but per repo atm)

  }
}
console.log(JSON.stringify(report, null, 2));

