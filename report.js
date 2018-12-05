const main = document.getElementById("report");

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

fetch("report.json").then(r => r.json())
  .then(groupdata => {
    groupdata.forEach(d => {
      const section = document.createElement("section");

      const h2 = document.createElement("h2");
      const link = document.createElement("a");
      link.appendChild(document.createTextNode(d[0].name));
      link.href = d[0]._links.homepage.href;
      h2.appendChild(link);
      section.appendChild(h2);


      const chairs = document.createElement("p");
      if (d[1] && d[1].length) {
        chairs.classList.add("yes");
        chairs.appendChild(document.createTextNode(d[1].length + " chairs"));
      } else {
        chairs.classList.add("no chairs");
        chairs.appendChild(document.createTextNode("no"));

      }
      section.appendChild(chairs);

      const activity = document.createElement("section");
      if (d[2] && d[2].length) {
        const chart = document.createElement("div");
        const columns = [['x'].concat(lastTwelveMonths)];
        const groups = [];
        d[2].forEach(({service, data}) => {
          if (data.items) {
            const col = [service.type];
            groups.push(service.type);
            lastTwelveMonths.forEach(m => {
              col.push(data.items.filter(i => i.isoDate.startsWith(m)).length);
            });
            columns.push(col);
          }
        });
        c3.generate({
          bindto: chart,
          data : {
            x: 'x',
            xFormat: '%Y-%m',
            type: 'bar',
            columns,
            groups: [groups]
          },
          axis: {
            x: {
              type: 'timeseries',
              tick: {
                format: '%Y-%m-%d'
              }
            },
            y: {
              min: 0,
              max: 10,
              tick: {
                format: d3.format('d')
              }
            }
          }
        });
        activity.appendChild(chart);
      } else {
        activity.classList.add("no");
        activity.appendChild(document.createTextNode("no identified service"));
      }
      section.appendChild(activity);

      
      main.appendChild(section);
    });
  });
