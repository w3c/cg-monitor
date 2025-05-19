import authedFetch from "./lib/authed-fetch.js";
import  {recursiveW3cFetch} from "./lib/w3c-data.js";
import {JSDOM}  from "jsdom";

const groups = await recursiveW3cFetch("https://api.w3.org/groups/wg?embed=1", "groups");

const charters = {};

for (const g of groups) {
  const url = `https://www.w3.org/groups/wg/${g.shortname}/charters/active/`;
  charters[g.shortname] = {
    url
  };
  const body = (await authedFetch(url)).body;
  const dom = new JSDOM(body);
  charters[g.shortname].links = [...new Set([...dom.window.document.querySelectorAll('a[href^="https://"]')].map(el => el.href.split("#")[0]))];
}

console.log(JSON.stringify(charters, null, 2));
