/*
 * go through list of WG/IG participations à la https://api.w3.org/groups/wg/webrtc/participations?embed=1
 * identify those that are invited expert (p["invited-expert"] === true)
 * (are any chairs)
 * percentage of participants that are IE
 * get their github account (if any) via user endpoint u["connected-accounts"].find(a => a.service === "github")
 find if they chair
 find if they edit any specs (via user_url/specifications)

 for wgs, for each specs, check if they are among the substantive contributors via repo manager à la https://labs.w3.org/repo-manager/api/repos/w3c/webrtc-pc/contributors

 for horizontal groups, look for assignees to to -request repos à la https://www.w3.org/PM/horizontal/leaderboard.html?year=2025&repo=Accessibility
  */

import {recursiveW3cFetch} from "./w3c-data.js";

const typeToShortType = type => {
  return ({
    "community group": "cg",
    "working group": "wg",
    "interest group": "ig",
    "business group": "bg"
  })[type] || "other";
};

const groups = (await recursiveW3cFetch('https://api.w3.org/groups?embed=1', 'groups') || []).map(g => {
  return {
    // still useful to match with data from https://labs.w3.org/repo-manager/api/repos
    id: g.id,
    name: g.name, type: typeToShortType(g.type), fullshortname: typeToShortType(g.type) + '/' + g.shortname};
}).filter(g => g.type === "wg" || g.type === "ig");

const processedGroups = [];

for(let g of groups) {
  const participants = (await recursiveW3cFetch(`https://api.w3.org/groups/${g.fullshortname}/users?embed=1`, 'users')) || [];
  // There are IGs for which this doesn't work, but they don't have IEs by definition
  let participations = [];
  try {
    participations = await recursiveW3cFetch(`https://api.w3.org/groups/${g.fullshortname}/participations?embed=1`, 'participations') || [];
  } catch (e) {
    continue;
  }
  const chairs = (await recursiveW3cFetch(`https://api.w3.org/groups/${g.fullshortname}/chairs`, 'chairs')) || [];
  const ies = await Promise.all(participations.filter(p => p["invited-expert"])
	.map(async p =>
	  {
	    const id = p._links.user.href.split("/").pop();
	    let affiliations = [];
	    try {
	      affiliations = (await recursiveW3cFetch(`https://api.w3.org/users/${id}/affiliations`, 'affiliations') || []).filter(a => a.href !== "https://api.w3.org/affiliations/36747");
	    } catch (e) {
	      console.error(e);
	    }
	    return {
	      href: p._links.user.href,
	      name: p._links.user.title,
	      created: p.created,
	      roles: {chair: !!chairs.find(c => c.href === p._links.user.href), editors:[]},
	      github: participants.find(pp => pp._links.self.href === p._links.user.href)?.["connected-accounts"]?.find(c => c.service === "github")?.nickname,
	      affiliations
	    } ; }));
  const specs = ((await recursiveW3cFetch(`https://api.w3.org/groups/${g.fullshortname}/specifications?embed=1`, 'specifications')) || []).filter(s => !s._links["superseded-by"]);
  g.editors = [];
  for (const s of specs) {
    const lv = await recursiveW3cFetch(`https://api.w3.org/specifications/${s.shortname}/versions/latest`);
    const [shortname,, date] = lv._links.self.href.split("/").slice(-3);
    const editors = (await recursiveW3cFetch(`https://api.w3.org/specifications/${s.shortname}/versions/${date}/editors?embed=1`, 'editors')) || [];
    for (const e of editors) {
      const github = e["connected-accounts"].find(c => c.service === "github")?.nickname;
      const href = e._links.self.href;
      if (!g.editors.find(ee => ee.href === href)) {
	g.editors.push({href, github});
      }
      const ie = ies.find(i => i.href === href);
      if (ie) {
	ie.roles.editors.push({shortname, date});
      }
    }
  }
  g.ies = ies;
  g.numberOfParticipants = participants.length;
  g.numberOfChairs = chairs.length;
  g.numberOfIE = ies.length;
  g.numberOfIEChairs = ies.filter(i => i.roles.chair).length;
  g.numberOfEditors = g.editors.length;
  g.numberOfIEEditors = ies.filter(i => i.roles.editors.length !== 0).length;
  g.numberOfSpecs = specs.length;
  g.numberOfSpecWithIEEditors = specs.filter(s => ies.find(i => i.roles.editors.find(e => e.shortname === s.shortname))).length;
  processedGroups.push(g);
}
console.log(JSON.stringify(processedGroups, null, 2));
