const main = document.getElementById("report");
let activityLevels = [];

const colors = {
  'rss': '#1f77b4',
  'lists': '#aec7e8',
  'repository': '#ff7f0e',
  'wiki': '#ffbb78',
  'join': '#2ca02c'
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

// this aligns 3000 to ~50
const factor = Math.log(1.173);

const bar = (count, type, group, fill) => {
  const width = count ? 2*Math.log(count)/factor : 0;
  return `<svg width=${width} height='16' viewBox='0 0 ${width} 16' role='presentation'><rect x='0' y='0' height='16' width='${width}' fill='${fill}'/></svg><span title='${count} ${type} events for ${group}'>${count ? count : ''}</span>`;
};

fetch("report.json").then(r => r.json())
  .then(groupdata => {
    groupdata.forEach(d => {
      const section = document.createElement("tr");

      const h2 = document.createElement("th");
      const link = document.createElement("a");
      link.appendChild(document.createTextNode(d.name.replace(/ Community Group/, '')));
      link.href = d.link;
      h2.appendChild(link);
      const sp = document.createElement('span');
      console.log(d.created, (new Date() - new Date(d.created)) / (1000 * 3600 * 24 * 30));
      const monthsSinceStart = d.created ? Math.round((new Date() - new Date(d.created)) / (1000 * 3600 * 24 * 30)) : 0;
      sp.innerHTML = `<svg width='${monthsSinceStart * 5}' height='2' viewBox='0 0 ${monthsSinceStart * 5} 2'><title>Created ${monthsSinceStart} months ago</title></title><rect x='0' y='0' height='2' width='${monthsSinceStart * 5}' fill='#00A'/></svg>`;
      h2.appendChild(sp);
      section.appendChild(h2);


      let total = 0;
      ['lists', 'repository', 'wiki', 'rss', 'join']
        .forEach(servicetype => {
          const activitywrapper = document.createElement("td");
          const activity = document.createElement("p");
          const data = d.activity[servicetype];
          let val = 0;
          if (data && Object.keys(data)) {
            val = lastTwelveMonths.reduce((acc, m) => acc + (data[m] || 0), 0);
          }
          activity.innerHTML = bar(val, servicetype, d.name, colors[servicetype]);
          total += val;
          activitywrapper.appendChild(activity);
          section.appendChild(activitywrapper);
        });
      const notes = document.createElement("td");
      if (d.staff.length) {
        const staff = document.createElement("span");
        d.staff.sort((a,b) => (b.photo !== undefined) - (a.photo !== undefined))
          .forEach(s => {
          if (s.photo) {
            const img = document.createElement("img");
            img.src = s.photo;
            img.alt = s.name;
            img.width = 20;
            staff.appendChild(img);
          } else {
            staff.appendChild(document.createTextNode(s.name.split(' ')[0]));
          }
          notes.appendChild(staff);
        });
      }
      if (!d.chairs.length) {
        const chairs = document.createElement("span");
        chairs.classList.add("no");
        chairs.appendChild(document.createTextNode("no chair"));
        notes.appendChild(chairs);
      }

      section.appendChild(notes);
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
