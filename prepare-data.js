const fs = require("fs");
const util = require("util");

const target = "./report.json";

const aggregatedData = [];

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
              const staffids = staff.map(s => s._links.self.href);
              cgData.name = data[0].name;
              cgData.link = data[0]._links.homepage.href;
              // Approximating creation date to date of first person joining
              cgData.created = new Date((data[3][0] || {}).created + "Z");
              cgData.participants = data[3].length;
              cgData.chairs = data[1].filter(x => x).map(c => c.title);
              cgData.staff = data[3].filter(u => u._links.user && staffids.includes(u._links.user.href)).map(u => { const team = staff.find(s => s._links.self.href === u._links.user.href); return { name: team.name, photo: (team._links.photos ? team._links.photos.find(p => p.name === "tiny").href : undefined) } ;});
              let serviceData = [];
              if (data[2] && data[2].length) {
                // aggregate by service type
                serviceData = data[2].reduce((acc, {service, data}) => {
                  const existingService = acc.find(s => s.service.type === service.type);
                  if (existingService) {
                    if (existingService.data.items) existingService.data.items = existingService.data.items.concat(data.items);
                    else if (Array.isArray(existingService.data)) existingService.data = [...new Set(Object.keys(existingService.data).concat(Object.keys(data)))]
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
                console.error("Missing data for " + data[0].name);
              }

              cgData.activity = {};
              serviceData.forEach(({service, data}) => {
                if (data) {
                  if (data.items) {
                    cgData.activity[service.type] = lastTwelveMonths
                      .reduce((acc, m) => {
                        acc[m] = data.items.filter(i => (i.isoDate && i.isoDate.startsWith(m)) || (i.created_at && i.created_at.startsWith(m)) || (i.commit && i.commit.committer && i.commit.committer.date && i.commit.committer.date.startsWith(m)) ).length;
                        return acc;
                      }, {});
                  } else {
                    cgData.activity[service.type] = data;
                  }
                }
              });
              cgData.activity['join'] = lastTwelveMonths
                .reduce((acc, m) => {
                  acc[m] = data[3].filter(j => j.created.startsWith(m)).length;
                  return acc;
                }, {});
              return cgData;
            })
        ))
         );
};

loadDir("./data").then(data => {
  fs.writeFileSync('./report.json', JSON.stringify(data, null, 2));
});
