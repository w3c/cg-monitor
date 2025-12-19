import groups from "../invited-expert-roles.json" with {type: "json"};
import { recursiveGhFetch } from "./github-activity.js";

const hrGroups = {
  "wg/privacy": "w3cping/privacy-request",
  "wg/i18n-core": "w3c/i18n-request",
  "wg/apa": "w3c/a11y-request",
  "ig/security": "w3c/security-request"
};


const groupReviewers = [];

async function fetchGithubIssues(repo) {
  return recursiveGhFetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100`)
    .then(data => data.map(i => { return {html_url: i.html_url, created_at: i.created_at, closed_at: i.closed_at, assignees: i.assignees.map(a => a.login)};}))
    .catch(() => []);
}

for (const shortname of Object.keys(hrGroups)) {
  const g = groups.find(gg => gg.fullshortname === shortname);
  const repo = hrGroups[shortname];
  const issues = await fetchGithubIssues(repo);
  const reviewers = issues.reduce((acc, issue) => {
    for (const reviewer of issue.assignees) {
      if (!acc[reviewer]) {
	acc[reviewer] = [];
      }
      acc[reviewer].push(issue);
    }
    return acc;
  }, {});

  groupReviewers.push({
    id: g.id,
    reviewers
  });
}
console.log(JSON.stringify(groupReviewers, null, 2));
