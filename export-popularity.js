const fs = require("fs");

const groupdata = require("./report.json").data;

// Looking at activity over the last 3 months
const lastXMonths = (period => {
  const now = new Date();
  const ayearago = new Date();
  const months = [];
  ayearago.setDate(1);
  ayearago.setMonth(ayearago.getMonth() - (period - 1));
  while (ayearago < now) {
    months.push(ayearago.toJSON().slice(0,7));
    ayearago.setMonth(ayearago.getMonth() + 1);
  }
  return months;
})(3);

let activityLevels = [];
groupdata.filter(d => d && ["cg", "bg"].includes(d.type))
  .forEach(d => {
    let total = 0;
    ['lists', 'repository', 'wiki', 'rss', 'join']
      .forEach(servicetype => {
        const data = d.activity[servicetype];
        let values = [];
        if (data && Object.keys(data)) {
          values = lastXMonths.map(m => data[m] || 0);
        }
        total += values.reduce((acc, d) => acc + d, 0);
      })
    activityLevels.push({id: d.id, activity: total});
  });
activityLevels.sort((a,b) => b.activity - a.activity);


fs.writeFileSync("popularity.json", JSON.stringify(activityLevels.map(d => d.id), null, 2));
