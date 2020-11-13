const fs = require("fs");
const report = require("./report.json");

const data = report.data;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const palette = ['#005a9c', '#3667a2', '#5174a8', '#6882ae', '#7d90b5', '#919fba', '#a5aec0', '#b9bdc6', '#cccccc'];

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
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360">
  <title>Activity of ${escape(d.name)}</title>
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
    let color = palette[8-Math.ceil(Math.min(200, sum)/25)];
    svg += `<rect x="${50 + monthCursor*20}" y="6" width="15" height="15" fill="${color}"><title>${monthActivity[0]} emails, ${monthActivity[1]} repository events, ${monthActivity[2]} wiki edits in ${monthNames[monthCursor]} ${yearCursor}</title></rect>`;
    dateCursor.setMonth(monthCursor + 1);
    dateCursor.setDate(1);
    if (dateCursor > now) break;
    monthCursor = dateCursor.getMonth();
  }
  svg += `</g>`;
  for (let i = 0 ; i<12; i++) {
    svg += `<text style="font-size: 10px; text-align: center" x="${53 + i*20}" y="${(row + 1)*20 + 10}">${monthNames[i][0]}</text>`;
  }
  svg += `<text style="font-size: 10px;" x="155" y="${(row + 1)*20 + 29}">Less</text><rect fill="${palette[7]}" width="10" height="10" x="180" y="${(row + 1)*20 + 20}"><title>No activity in the period</title></rect><rect fill="${palette[5]}" width="10" height="10" x="195" y="${(row + 1)*20 + 20}"><title>Low activity in the period</title></rect><rect fill="${palette[3]}" width="10" height="10" x="210" y="${(row + 1)*20 + 20}"><title>Medium activity in the period</title></rect><rect fill="${palette[0]}" width="10" height="10" x="225" y="${(row + 1)*20 + 20}"><title>High activity in period</title></rect><text x="240" y="${(row + 1)*20 + 29}" style="font-size: 10px;">More</text>`;
  svg += `</svg>`;
  fs.writeFileSync('viz/' + d.type + '/' + shortname + '.svg', svg, 'utf-8');
});
