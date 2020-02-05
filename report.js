const main = document.getElementById("report");
let activityLevels = [];

main.setAttribute("aria-busy", true);

const period = 12;

const grouptypes = location.search ? location.search.slice(1).split(',') : ['cg','bg'];

document.getElementById('period').textContent = period;
[...document.querySelectorAll('.grouptype')].forEach(n => n.textContent = grouptypes.includes('cg') && grouptypes.includes('wg') ? 'All groups' : (grouptypes.includes('cg') ? 'Community Groups' : 'Working Groups'));

const lastXMonths = ((period = period) => {
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
})(period);

const barWidth = 5;
const heightFactor = {
  lists: 1/3,
  repository: 1/3,
  wiki: 1,
  rss: 1,
  join: 1
};

const monthBar = (month, value, type, height) => {
  const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  const isLast = month === period - 1;
  bar.setAttribute("x", month * barWidth);
  bar.setAttribute("y", (height-value)*heightFactor[type]);
  bar.setAttribute("width", barWidth);
  bar.setAttribute("height", value*heightFactor[type]);
  bar.setAttribute("class", type + (isLast ? " last" : ""));
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = value + " " + type + " events in " + lastXMonths[month] + (isLast ? " (data as of " + document.getElementById('timestamp').textContent + ")" : "");
  bar.appendChild(title);
  return bar.outerHTML;
}

const arrayfi = x => Array.isArray(x) ? x : [x];

const bar = (values, type, group, fillname) => {
  const height = Math.max(...values, 0) ;
  const width = barWidth*13;
  const count = values.reduce((acc, d) => acc + d, 0);
  return `<svg width='${width}' height='${height*heightFactor[fillname]}' viewBox='0 0 ${width} ${height * heightFactor[fillname]}' role='presentation'>` + values.map((v,i) => monthBar(i, v, fillname, height)).join(' ') + `</svg><span title='${count} ${type} events for ${group} in the last ${period} months'>${count ? count : ''}</span>`;
};

const groupLink = (id) => {
  const link = document.createElement("a");
  link.href = typeof id === "number" ? "https://www.w3.org/2004/01/pp-impl/" + id : (id.startsWith('https://') ? id : "https://www.w3.org/community/" + id);
  return link;
};

let stats = {
  nochairs: 0,
  nostaff: 0,
  norepo: 0,
  nospec: 0
};

Promise.all([
  fetch("report.json").then(r => r.json()),
  fetch("annotations.json").then(r => r.json())
])
  .then(([{data: groupdata, timestamp}, annotations]) => {
    groupdata.filter(d => d && grouptypes.includes(d.type))
      .forEach(d => {
      if (!d) return;
      document.getElementById('timestamp').textContent = new Date(timestamp).toJSON().slice(0,10);

      const section = document.createElement("tr");

      const h2 = document.createElement("th");

      const sp = document.createElement('span');
      const monthsSinceStart = d.created ? Math.round((new Date() - new Date(d.created)) / (1000 * 3600 * 24 * 30)) : 0;
      const monthsAndYearSinceStart = monthsSinceStart >= 12 ? Math.floor(monthsSinceStart / 12) + " year" + (monthsSinceStart >= 24 ? "s" : "") : monthsSinceStart + " months";
      sp.innerHTML = `<svg width='${monthsSinceStart * 5}' height='10' viewBox='0 0 ${monthsSinceStart * 5} 10'><title>Created ${monthsAndYearSinceStart} ago</title></title><rect x='0' y='8' height='2' width='${monthsSinceStart * 5}' fill='${monthsSinceStart >= period ? "#ACF" : "#AFA"}'/></svg>`;
      h2.appendChild(sp);

      const link = document.createElement("a");
      link.appendChild(document.createTextNode(d.name.replace(/ Community Group/, '')));
      link.href = d.link;
      h2.appendChild(link);
      const cgshortname = d.link.split('/')[4];

      section.appendChild(h2);


      let total = 0;
      ['lists', 'repository', 'wiki', 'rss', 'join']
        .forEach(servicetype => {
          const activitywrapper = document.createElement("td");
          const activity = document.createElement("p");
          const data = d.activity[servicetype];
          let values = [];
          if (!data) {
            activitywrapper.classList.add('nosource');
            activitywrapper.title = "No known " + servicetype ;
          } else if (Object.keys(data)) {
            values = lastXMonths.map(m => data[m] || 0);
          }
          if (values.length) activitywrapper.classList.add('num');
          activity.innerHTML = bar(values, servicetype, d.name, servicetype);
          total += values.reduce((acc, d) => acc + d, 0);
          activitywrapper.appendChild(activity);
          section.appendChild(activitywrapper);
        });
      const related = document.createElement("td");
      if (annotations[cgshortname] && (annotations[cgshortname].wg || annotations[cgshortname].postWG)) {
        const groups = annotations[cgshortname].wg ? arrayfi(annotations[cgshortname].wg) : arrayfi(annotations[cgshortname].postWG);
        const closed = !!annotations[cgshortname].postWG;
        groups.forEach(g => {
          const link = groupLink(g);
          link.classList.add("tag");
          link.classList.add("related");
          if (g === "schemaorg") {
            link.textContent = "S.o";
            link.title = "Building for schema.org";
          } else {
            const img = document.createElement("img");
            img.src = "group.svg";
            img.alt = "Related " + (closed ? "closed" : "" ) + " WG/IG/CG";
            img.height = 10;
            if (closed) link.classList.add("closed");
            link.appendChild(img);
          }
          related.appendChild(link);
        });
      }
      if (annotations[cgshortname] && annotations[cgshortname].funnel) {
        const funnel = arrayfi(annotations[cgshortname].funnel);
        funnel.forEach(f => {
          const link = document.createElement("a");
          link.href = "https://github.com/w3c/strategy/issues/" + f;
          const img = document.createElement("img");
          img.src = "funnel.svg";
          img.alt = "W3C Strategy funnel entry #" + f;
          img.height = 10;
          link.classList.add("tag");
          link.classList.add("related");
          link.appendChild(img);
          related.appendChild(link);
        });
      }
      section.append(related);
      const stafflist = document.createElement("td");
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
            const name = document.createElement("span");
            name.title = s.name;
            name.appendChild(document.createTextNode(s.name.split(/[- ]/).map(n => n[0]).join('')));
            staff.appendChild(name);
          }
            stafflist.appendChild(staff);
        });
      } else {
        stats.nostaff++;
      }
      if (annotations[cgshortname] && annotations[cgshortname].dup) {
        const dup = document.createElement("span");
        dup.classList.add("tag");
        dup.classList.add("no");
        const link = groupLink(annotations[cgshortname].dup);
        link.title = "duplicate of another group";
        link.appendChild(document.createTextNode("dup"));
        dup.appendChild(link);
        related.appendChild(dup);
      }
      section.append(stafflist);

      const notes = document.createElement("td");
      if (annotations[cgshortname] && annotations[cgshortname].nospec) {
        stats.nospec++;
        const nospec = document.createElement("span");
        nospec.classList.add("tag");
        nospec.classList.add("info");
        nospec.appendChild(document.createTextNode("©-only"));
        notes.appendChild(nospec);
      }
      if (!d.chairs.length) {
        stats.nochairs++;
        const chairs = document.createElement("span");
        chairs.classList.add("tag");
        chairs.classList.add("no");
        chairs.appendChild(document.createTextNode("no chair"));
        notes.appendChild(chairs);
      }
      if (!d.activity.repository) {
        stats.norepo++;
        const repos = document.createElement("span");
        repos.classList.add("tag");
        repos.classList.add("repo");
        repos.appendChild(document.createTextNode("no repo"));
        notes.appendChild(repos);
      }
      if (d.participants <= 5) {
        const participants = document.createElement("span");
        participants.classList.add("tag");
        participants.classList.add("participant");
        participants.appendChild(document.createTextNode(d.participants + " participant" + (d.participants > 1 ? "s" : "")));
        notes.appendChild(participants);
      }
      const activityLevel = total * 1000 + d.participants;

      section.appendChild(notes);
      const idx = activityLevels.findIndex(x => activityLevel > x);
      if (idx >= 0) {
        main.insertBefore(section, main.children[idx]);
      } else {
        main.appendChild(section);
      }
      activityLevels.push(activityLevel);
      activityLevels.sort((a,b) => b - a);
    });

    const statList = document.getElementById("stats");
    const chairstat = document.createElement("li");
    chairstat.appendChild(document.createTextNode(`${stats.nochairs} (${Math.round(100 * stats.nochairs / groupdata.length)}%) groups have no chair`));
    statList.appendChild(chairstat);
    const staffstat = document.createElement("li");
    staffstat.appendChild(document.createTextNode(`${stats.nostaff} (${Math.round(100 * stats.nostaff / groupdata.length)}%) groups have no representative from the W3C staff`));
    statList.appendChild(staffstat);
    const repostat = document.createElement("li");
    repostat.appendChild(document.createTextNode(`${stats.norepo} (${Math.round(100 * stats.norepo / groupdata.length)}%) groups have no known repository`));
    statList.appendChild(repostat);
    const specstat = document.createElement("li");
    specstat.appendChild(document.createTextNode(`${stats.nospec} (${Math.round(100 * stats.nospec / groupdata.length)}%) groups are not intending to build technical specifications`));
    statList.appendChild(specstat);
    main.setAttribute("aria-busy", false);
  });
