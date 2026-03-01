import groups from "../invited-expert-roles.json" with {type: "json"};
import groupData from "../report.json" with {type: "json"};
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


const groupContributors = [];

for (const g of groups) {
  const repos = groupData.data.find(gg => gg.id == g.id)?.repositories || [];
  const contributors = {};
  for (const repoUrl of repos) {
    if (!repoUrl.match(/https:\/\/github.com\/[^\/]+\/[^\/]+/)) {
      continue;
    }
    const repo = repoUrl.replace(/\/$/,'').split('/').slice(-2).join('/');
    // there can be (near)duplicate URLs of repos in the top data
    if (contributors[repo]) {
      continue;
    }
    console.error(`Fetching issues for ${repo}`);
    let githubIssues;
    try {
      githubIssues = await fetchJSON(`https://labs.w3.org/github-cache/v3/repos/${repo}/issues?state=all`) || [];
    } catch (e) {
      console.error(e);
      continue;
    }
    console.error(`Found ${githubIssues.length} issues in ${repo}`);
    contributors[repo] = {issues: {}, prs: {}};
    for (const issue of githubIssues) {
      const contributor = issue.user.login;
      const target = issue.pull_request ? contributors[repo].prs : contributors[repo].issues;
      if (!target[contributor]) {
	target[contributor] = [];
      }
      target[contributor].push({url: issue.html_url, num: issue.number, created_at: issue.created_at});
    }
  }

  groupContributors.push({
    id: g.id,
    fullshortname: g.fullshortname,
    contributors
  });
}
console.log(JSON.stringify(groupContributors, null, 2));
