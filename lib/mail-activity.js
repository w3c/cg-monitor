const authedFetch = require("./authed-fetch");

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const httpToHttps = str => str.replace(/^http:\/\//, "https://");

async function fetchMail(url) {
  if (!httpToHttps(url).startsWith('https://lists.w3.org/Archives/Public')) return "Did not fetch " + url;
  const text = (await authedFetch(url)).body;
  const dom = new JSDOM(text);
  const data = {};
  [...dom.window.document.querySelectorAll("tbody")].forEach(tbody => {
    [...tbody.querySelectorAll("tr")].forEach(tr => {
      const month = new Date(tr.querySelector("td").textContent + " GMT");
      if (month.toJSON()) {
        const mailCount = parseInt(tr.querySelector("td:last-child").textContent, 10);;
        // some archives are per quarter
        // we detect this on the presence of the string " to "
        // as in "January to March"
        if (tr.querySelector("td").textContent.includes(" to ")) {
          // and if so, we divide arbitrarily in 3 for the per-month view
          for (let i = 0; i < 3 ; i++) {
            data[month.toJSON().slice(0,7)] = mailCount / 3;
            month.setMonth(month.getMonth() - 1);
          }
        } else {
          data[month.toJSON().slice(0,7)] = mailCount;
        }
      } else {
        console.log("Empty ml archive at " + url);
      }
    });
  });
  return data;
}

module.exports.fetchMail = fetchMail;
