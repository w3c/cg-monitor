const fs = require("fs");
const computeGroupData = require("./lib/compute-group-data");

const target = "./report.json";

const aggregatedData = [];

const loadDir = async (dirPath) => {
  const files = await fs.promises.readdir(dirPath);
  return fs.promises.readFile(dirPath + '/staff.json', 'utf-8')
    .then(JSON.parse)
    .then(staff => Promise.all(
      files.filter(path => path.match(/\.json$/)).filter(path => path !== 'staff.json')
        .map(
          path => fs.promises.readFile(dirPath + "/" + path, 'utf-8')
            .then(JSON.parse)
            .catch(err => { console.error("Failed parsing " + path + ": " + err);})
            .then(data => computeGroupData(data, staff)).catch(e => console.error("Error while dealing with " + path + ":" + JSON.stringify(e.stack)))
        )
    ));
};

loadDir("./data").then(data => {
  fs.writeFileSync(target, JSON.stringify({timestamp: new Date(), data: data.filter(x => x)}, null, 2));
});

