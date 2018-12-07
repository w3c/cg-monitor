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

const arrayfi = x => Array.isArray(x) ? x : [x];

// this aligns 3000 to ~50
const factor = Math.log(1.173);

const bar = (count, type, group, fill) => {
  const width = count ? 2*Math.log(count)/factor : 0;
  return `<svg width=${width} height='16' viewBox='0 0 ${width} 16' role='presentation'><rect x='0' y='0' height='16' width='${width}' fill='${fill}'/></svg><span title='${count} ${type} events for ${group}'>${count ? count : ''}</span>`;
};

const groupLink = (id) => {
  const link = document.createElement("a");
  link.href = typeof id === "number" ? "https://www.w3.org/2004/01/pp-impl/" + id : "https://www.w3.org/community/" + id;
  return link;
};

Promise.all([
  fetch("report.json").then(r => r.json()),
  fetch("annotations.json").then(r => r.json())
])
  .then(([groupdata, annotations]) => {
    groupdata.forEach(d => {
      const section = document.createElement("tr");

      const h2 = document.createElement("th");
      const link = document.createElement("a");
      link.appendChild(document.createTextNode(d.name.replace(/ Community Group/, '')));
      link.href = d.link;
      h2.appendChild(link);
      const cgshortname = d.link.split('/')[4];


      const sp = document.createElement('span');

      const monthsSinceStart = d.created ? Math.round((new Date() - new Date(d.created)) / (1000 * 3600 * 24 * 30)) : 0;
      const monthsAndYearSinceStart = monthsSinceStart >= 12 ? Math.floor(monthsSinceStart / 12) + " year" + (monthsSinceStart >= 24 ? "s" : "") : monthsSinceStart + " months";
      sp.innerHTML = `<svg width='${monthsSinceStart * 5}' height='10' viewBox='0 0 ${monthsSinceStart * 5} 10'><title>Created ${monthsAndYearSinceStart} ago</title></title><rect x='0' y='8' height='2' width='${monthsSinceStart * 5}' fill='#00A'/></svg>`;
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
        const nospec = document.createElement("span");
        nospec.classList.add("tag");
        nospec.classList.add("info");
        nospec.appendChild(document.createTextNode("©-only"));
        notes.appendChild(nospec);
      }
      if (!d.chairs.length) {
        const chairs = document.createElement("span");
        chairs.classList.add("tag");
        chairs.classList.add("no");
        chairs.appendChild(document.createTextNode("no chair"));
        notes.appendChild(chairs);
      }
      if (!d.activity.repository) {
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
