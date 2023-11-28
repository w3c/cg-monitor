const fs = require("fs/promises");

function uniq(x, i, arr) {
    return arr.findIndex(xx => xx.id === x.id) === i;
}

function cleanGroupDescription(g) {
    return {
        id: g.id,
        name: g.name,
        link: g.link,
        reason: g.reason,
        chairs: g.chairs
    };
}

// Whether a group is more than ~6 months old
function notNew(g) {
    const created = new Date(g.created);
    return (new Date() - created) > 3600*24*1000*180;
}

const activities = ["lists", "repository", "wiki"];

const documentReason = reason => x => { return {...x, reason};};

const lastSixMonths = (() => {
    let cur = new Date();
    let months = [];
    for (let i = 0 ; i < 6; i++) {
        months.push(`${cur.getFullYear()}-${("" + (cur.getMonth() + 1)).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() - 1);
    }
    return months;
})();

(async function() {
    const {data} = JSON.parse(await fs.readFile("report.json"));

    const cgs = data.filter(x => x.type === "cg");
    let candidates = [];

    candidates = candidates.concat(cgs.filter(x => x.participants <= 3).map(documentReason("fewer than 3 participants")));

    const lowActivityCgs = cgs.filter(cg => {
        let activityLevel = 0;
        for (let a of Object.keys(cg.activity).filter(a => activities.includes(a))) {
            activityLevel += Object.keys(cg.activity[a])
                .filter(m => lastSixMonths.includes(m))
                .reduce((acc, m) => acc += cg.activity[a][m], 0);
        }
        return activityLevel <= 5;
    }).map(documentReason("fewer than 5 events in the past 6 months"));

    candidates = candidates.concat(lowActivityCgs);

    candidates = candidates.filter(uniq).filter(notNew);

    console.log(JSON.stringify(candidates.map(cleanGroupDescription), null, 2));
    //console.log(candidates.length);
})();
