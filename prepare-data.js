const fs = require("fs");
const util = require("util");

const target = "./report.json";

const aggregatedData = [];

const listMonthsSince = d => {
  const now = new Date();
  let monthCur = new Date(d.valueOf());
  const months = [];
  while (monthCur < now) {
    monthCur.setUTCDate(1);
    months.push(monthCur.toJSON().slice(0,7));
    monthCur.setMonth(monthCur.getMonth() + 1);
  }
  return months;
}

const shortType = {
  'business group': 'bg',
  'community group': 'cg',
  'interest group': 'ig',
  'working group': 'wg'
};

const loadDir = async dirPath => {
  const files = await util.promisify(fs.readdir)(dirPath);
  return util.promisify(fs.readFile)(dirPath + '/staff.json', 'utf-8')
    .then(JSON.parse)
    .then(staff => Promise.all(
      files.filter(path => path.match(/\.json$/)).filter(path => path !== 'staff.json')
        .map(
          path => util.promisify(fs.readFile)(dirPath + "/" + path, 'utf-8')
            .then(JSON.parse)
            .catch(err => { console.error("Failed parsing " + path + ": " + err);})
            .then(data => {
              const cgData = {};
              const staffids = Array.isArray(staff) ? staff.map(s => s._links.self.href) : [];
              cgData.id = data[0].id;
              cgData.name = data[0].name;
              cgData.type = shortType[data[0].type];
              cgData.shortname = data[0].shortname;
              cgData.link = data[0]._links.homepage.href;
              // Approximating creation date to date of first person joining
              cgData.created = new Date(data[0]["start-date"] || ((data[4][0] || {}).created + "Z"));
              cgData.participants = data[4].length;
              cgData.chairs = data[2].filter(x => x).map(c => c.title);
              cgData.staff = data[4].filter(u => u._links.user && staffids.includes(u._links.user.href)).map(u => { const team = staff.find(s => s._links.self.href === u._links.user.href); return { name: team.name, photo: (team._links.photos ? team._links.photos.find(p => p.name === "tiny").href : undefined) } ;});

              cgData.repositories = [];
              cgData.activity = {};

              const monthsSinceCreation = listMonthsSince(cgData.created);

              // Merge data coming from validate-repos assoication of groups/repos into the other list of data fetched from services db
              if (data[1] && data[1].length) {
                if (!data[3]) {
                  data[3] = [];
                }
                data[1].forEach(({items}) => {
                  const repoUrl = items.map(i => (i.html_url || '').split('/').slice(0,5).join('/')).filter(x => x)[0];
                  if (!data[3].find(({service}) => service.type === 'repository' && (service.link === repoUrl || service.link === repoUrl + '/'))) {
                    data[3].push({service: {type: 'repository'}, data: {items}});
                  }
                });
              }

              if (data[3] && data[3].length) {
                // treat forums as mailing lists
                data[3].forEach(({service}) => {
                  if (service.type === "forum") service.type = "lists";
                  cgData.repositories = cgData.repositories.concat(
                    ...data[3].filter(({service}) => service.type === "repository")
                      .map(({data}) => {
                        if (!data.items) return [];
                        return data.items.map(i => (i.html_url || '').split('/').slice(0,5).join('/'))})
                  ).concat(data[3].filter(({service}) => service.type === "repository").map(({service}) => service.link));
                });
                cgData.repositories = [...new Set(cgData.repositories.filter(x => x))];

                // aggregate by service type
                data[3].forEach(({service, data}) => {
                  let perMonthData;
                  if (data && data.items) {
                    perMonthData = monthsSinceCreation
                      .reduce((acc, m) => {
                        acc[m] = data.items.filter(i => (i.isoDate && i.isoDate.startsWith(m)) || (i.created_at && i.created_at.startsWith(m)) || (i.commit && i.commit.committer && i.commit.committer.date && i.commit.committer.date.startsWith(m)) ).length;
                        return acc;
                      }, {});
                  } else if (data && typeof data === "object") {
                    perMonthData = data;
                  } else {
                    // console.error("Missing data for " + service.type + " of " + cgData.name);
                  }
                  if (!perMonthData) return;
                  if (cgData.activity[service.type]) {
                    cgData.activity[service.type] = Object.keys(perMonthData).reduce((acc, m) => {
                      acc[m] += perMonthData[m];
                      return acc;
                    }, cgData.activity[service.type]);
                  } else {
                    cgData.activity[service.type] = perMonthData;
                  }
                });
              }

              cgData.activity['join'] = monthsSinceCreation
                .reduce((acc, m) => {
                  acc[m] = data[4].filter(j => j.created.startsWith(m)).length;
                  return acc;
                }, {});
              return cgData;
            }).catch(e => console.error("Error while dealing with " + path + ":" + JSON.stringify(e.stack)))
        ))
         );
};

loadDir("./data").then(data => {
  fs.writeFileSync('./report.json', JSON.stringify({timestamp: new Date(), data: data.filter(x => x)}, null, 2));
});
