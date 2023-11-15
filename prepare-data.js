const fs = require("fs").promises;
const { computeGroupData } = require("./lib/compute-group-data");

const target = "./report.json";

const aggregatedData = [];

const loadDir = async (dirPath) => {
  const files = (await fs.readdir(dirPath)).filter(path => path.match(/\.json$/) && path !== 'staff.json');
  const staff = JSON.parse(await fs.readFile(dirPath + '/staff.json', 'utf-8'));
  return Promise.all(
    files
      .map(
        async (path) => {
	  let data;
	  try {
	    data = JSON.parse(await fs.readFile(dirPath + "/" + path, 'utf-8'));
	  } catch (err) {
	    console.error("Failed parsing " + path + ": " + err);
	    return;
	  }
	  try {
	    return computeGroupData(data, staff);
	  } catch (e) {
	    console.error("Error while dealing with " + path + ":" + JSON.stringify(e.stack));
	  }
	}
      )
  );
};

loadDir("./data").then(data =>
  fs.writeFile(target, JSON.stringify({timestamp: new Date(), data: data.filter(x => x)}, null, 2))
);

