const fs = require("fs");
const report = require("./report.json");

const data = report.data;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

data.slice(1).forEach(d => {
  const shortname = d.shortname;
  const dateCursor = new Date(d.created);
  const now = new Date();
  let yearCursor = dateCursor.getFullYear() - 1;
  let monthCursor = dateCursor.getMonth();
  let yearNow = now.getFullYear();
  let monthNow = now.getMonth();
  const yearStart = yearCursor + 1;
  let row = 0;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <title>Activity of ${d.name}</title>
  <style type="text/css">.none { fill: #aaa;}
  .low { fill: #8ac;}
  .medium { fill: #49a;}
  .high { fill: #159;}
  </style>
`;
  while (true) {
    if (yearCursor < dateCursor.getFullYear()) {
      yearCursor = dateCursor.getFullYear();
      row = yearCursor - yearStart;
      if (yearCursor > yearStart) svg += `</g>`;
      svg += `
<g transform="translate(0 ${row*20})">
  <title>Activity in ${yearCursor}</title>
  <text x="2" y="20">${yearCursor}</text>`;
    }
    const monthActivity = ["lists", "repository", "wiki"].map(a => d.activity[a] ? d.activity[a][yearCursor + "-" + ((monthCursor + 1) + "").padStart(2, "0")] || 0 : 0);
    const sum = monthActivity.reduce((acc, b) => acc + b, 0);
    let activityLevel;
    if (sum === 0) activityLevel = "none"
    else if (sum < 20) activityLevel = "low"
    else if (sum < 80) activityLevel = "medium"
    else activityLevel = "high";
    svg += `<rect x="${50 + monthCursor*20}" y="6" width="15" height="15" class="${activityLevel}"><title>${monthActivity[0]} emails, ${monthActivity[1]} repo event, ${monthActivity[2]} wiki edits in ${monthNames[monthCursor]} ${yearCursor}</title></rect>`;
    dateCursor.setMonth(monthCursor + 1);
    if (dateCursor > now) break;
    monthCursor = dateCursor.getMonth();
  }
  svg += `</g></svg>`;
  fs.writeFileSync('viz/' + d.type + '/' + shortname + '.svg', svg, 'utf-8');
});
