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

import w3c from "node-w3capi";

const typeToShortType = type => {
  return ({
    "community group": "cg",
    "working group": "wg",
    "interest group": "ig",
    "business group": "bg"
  })[type] || "other";
};

const groups = (await w3c.groups().fetch({embed: true}) || []).map(g => {
  return {
    // still useful to match with data from https://labs.w3.org/repo-manager/api/repos
    id: g.id,
    name: g.name, type: typeToShortType(g.type), fullshortname: typeToShortType(g.type) + '/' + g.shortname};
}).filter(g => g.type === "wg");


for(let g of groups) {
  const participants = (await w3c.group(g.fullshortname).users().fetch()) || [];
  // FIXME: somehow thought this was only available for WGs, not IGs - but https://api.w3.org/groups/ig/security/participations exist? 
  const participations = (await w3c.group(g.fullshortname).participations().fetch({embed: true})) || [];
  const chairs = (await w3c.group(g.fullshortname).chairs().fetch()) || [];
  const ies = participations.filter(p => p["invited-expert"]).map(p => { return {href: p._links.user.href, name: p._links.user.title, created: p.created, roles: {chair: !!chairs.find(c => c.href === p._links.user.href), editors:[]}} ; });
  const specs = ((await w3c.group(g.fullshortname).specifications().fetch({embed: true})) || []).filter(s => !s._links["superseded-by"]);
  g.editors = [];
  for (const s of specs) {
    const lv = await w3c.specification(s.shortname).latest().fetch();
    const [shortname,, date] = lv._links.self.href.split("/").slice(-3);
    const editors = (await w3c.specification(shortname).version(date).editors().fetch({embed: true})) || [];
    for (const e of editors) {
      const href = e._links.self.href;
      const github = e["connected-accounts"].find(c => c.service === "github")?.nickname;
      if (!g.editors.find(ee => ee.href === href)) {
	g.editors.push({href, github});
      }
      const ie = ies.find(i => i.href === href);
      if (ie) {
	ie.roles.editors.push({shortname, date});
	if (github) {
	  ie.github = github;
	}
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
}
console.log(JSON.stringify(groups, null, 2));
