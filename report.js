const main = document.getElementById("report");
let activityLevels = [];

const colors = {
  'rss': '#1f77b4',
  'lists': '#aec7e8',
  'repository': '#ff7f0e',
  'wiki': '#ffbb78',
  'twitter': '#2ca02c'
};

const lastTwelveMonths = (() => {
  const now = new Date();
  const ayearago = new Date();
  const months = [];
  ayearago.setDate(1);
  ayearago.setMonth(ayearago.getMonth() - 11);
  while (ayearago < now) {
    months.push(ayearago.toJSON().slice(0,7));
    ayearago.setMonth(ayearago.getMonth() + 1);
  }
  return months;
})();

const bar = (count, fill) => {
  const width = count ? 4*Math.log(count, 2) : 0;
  return `<svg width=${Math.max(width, 48)} height='16' viewBox='0 0 ${Math.max(width, 30)} 16'><rect x='0' y='0' height='16' width='${width}' fill='${fill}'/><text y='15'>${count ? count : ''}</text></svg>`;
};

fetch("report.json").then(r => r.json())
  .then(groupdata => {
    groupdata.forEach(d => {
      const section = document.createElement("tr");

      const h2 = document.createElement("th");
      const link = document.createElement("a");
      link.appendChild(document.createTextNode(d[0].name.replace(/ Community Group/, '')));
      link.href = d[0]._links.homepage.href;
      h2.appendChild(link);
      section.appendChild(h2);


      let serviceData = [];
      if (d[2] && d[2].length) {
        // aggregate by service type
        serviceData = d[2].reduce((acc, {service, data}) => {
          const existingService = acc.find(s => s.service.type === service.type);
          if (existingService) {
            if (existingService.data.items) existingService.data.items = existingService.data.items.concat(data.items);
            else existingService.data = [...new Set(Object.keys(existingService.data).concat(Object.keys(data)))]
              .reduce((acc, m) => {
                acc[m] = (existingService.data[m] || 0) + (data[m] || 0);
                return acc;
            }, {});
          } else {
            acc.push({service, data});
          }
          return acc;
        }, []);
      } else {
        console.error("Missing data for " + d[0].name);
      }
      let total = 0;
      ['lists', 'repository', 'wiki', 'rss', 'participation']
        .forEach(servicetype => {
          const activity = document.createElement("td");
          const data = (serviceData.find(s => s.service.type === servicetype) || {}).data;
          let val;
          if (data) {
            if (data.items) {
              val = lastTwelveMonths.reduce((acc, m) => acc + data.items.filter(i => (i.isoDate && i.isoDate.startsWith(m)) || (i.created_at && i.created_at.startsWith(m))).length, 0);
            } else {
              val = lastTwelveMonths.reduce((acc, m) => acc + (data[m] || 0), 0);
            }
            activity.innerHTML = bar(val, colors[servicetype]);
            total += val;
          }
          section.appendChild(activity);
        });

      const chairs = document.createElement("td");
      if (d[1] && d[1].length) {
        chairs.classList.add("yes");
        chairs.appendChild(document.createTextNode(d[1].length + " chairs"));
      } else {
        chairs.classList.add("no");
        chairs.appendChild(document.createTextNode("no chairs"));
      }
      section.appendChild(chairs);
      const idx = activityLevels.findIndex(x => total > x);
      if (idx >= 0) {
        main.insertBefore(section, main.children[idx]);
      } else {
        main.appendChild(section);
      }
      activityLevels.push(total);
      activityLevels.sort((a,b) => b - a);
    });
  });
