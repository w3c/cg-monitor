/**
 * Tests the Group data wrangler
 */
/* global describe, it */

const {computeGroupData} = require("../lib/compute-group-data");
const assert = require("assert");

const baseCgData = [
  {
    id: 42,
    name: "test group",
    type: "community group",
    shortname: "test",
    _links : { homepage: { href: "https://example.com" } }
  },
  [], // WG repository data
  [{title: "Standing Couch"}], // chairs
  [], // activity data
  [{
    // this will be used as the default creation date in many tests,
    // so mock activity needs to be later
    created: "2023-08-14T15:44:00",
    _links: { user: { href: 'https://example.test/user-id' } }
  }] // participants
];

describe('The Group data wrangler', function () {
  it('observes start date of the group',  () => {
    const testData = structuredClone(baseCgData);
    testData[0]["start-date"] = "2011-05-05";
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.created, new Date("2011-05-05").toString());
  });

  it('assumes start date from first participant join date when start-date not set',  () => {
    const testData = structuredClone(baseCgData);
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.created, new Date("2023-08-14T15:44:00Z").toString());
  });

  it('calculates number of participants',  () => {
    const testData = structuredClone(baseCgData);
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.participants, 1);
  });

  it('lists staff in the group with their picture',  () => {
    const testData = structuredClone(baseCgData);
    const cgData = computeGroupData(testData, [{
      name: "Stick Cane",
      _links: {
	self: {
	  href: 'https://example.test/user-id'
	},
	photos: [
	  {
	    name: "tiny",
	    href: "https://example.test/user.jpg"
	  }
	]
      }
    }]);
    assert.equal(cgData.staff.length, 1);
    assert.equal(cgData.staff[0].name, "Stick Cane");
    assert.equal(cgData.staff[0].photo, "https://example.test/user.jpg");
  });

  it('compiles mailing list activity data', () => {
    const testData = structuredClone(baseCgData);
    testData[3].push(
      {
	"service": {
          "type": "lists",

	},
	"data": {
          "2023-10": 3,
	  "2023-11": 1
	}
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.lists["2023-10"], 3);
  });

  it('reports errors gotten from fetching mailing list activity data', () => {
    const testData = structuredClone(baseCgData);
    testData[3].push(
      {
	"service": {
          "type": "lists",

	},
	"data": [],
	"error": "Failed to fetch mailing list data"
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.lists.errors[0], "Failed to fetch mailing list data");
  });

  
  it('compiles forum activity data', () => {
    const testData = structuredClone(baseCgData);
    testData[3].push(
      {
	"service": {
          "type": "forum"
	},
	"data": {
	  "items": [
            {
              "created_at": "2023-10-19T19:05:56.303Z",
              "topic_title": "Test Oct 1"
            },
            {
              "created_at": "2023-10-20T19:05:56.303Z",
              "topic_title": "Test Oct 2"
            },
            {
              "created_at": "2023-11-19T19:05:56.303Z",
              "topic_title": "Test Nov"
            }
	  ]
	}
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.lists["2023-10"], 2);
    assert.equal(cgData.activity.lists["2023-11"], 1);
  });
  
  it('compiles repo activity data (CG mode)', () => {
    const testData = structuredClone(baseCgData);
    testData[3].push(
      {
	"service": {
          "type": "repository"
	},
	"data": {
	  "items": [
            {
	      "created_at": "2023-10-19T19:05:56.303Z",
	    }
	  ]
	}
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.repository["2023-10"], 1);
  });

  it('compiles repo activity data (WG mode)', () => {
    const testData = structuredClone(baseCgData);
    testData[1].push(
      {
	items: [
	  {
	    "created_at": "2023-10-19T19:05:56.303Z",
	  }
	]
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.repository["2023-10"], 1);
  });

  
  it('compiles wiki activity data', () => {
    const testData = structuredClone(baseCgData);
    testData[3].push(
      {
	"service": {
          "type": "wiki"
	},
	"data": {
	  "items": [
            {
	      "isoDate": "2023-10-18T10:02:10.000Z"
	    }
	  ]
	}
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.wiki["2023-10"], 1);
  });

  it('compiles blog activity data', () => {
    const testData = structuredClone(baseCgData);
    testData[3].push(
      {
	"service": {
          "type": "rss"
	},
	"data": {
	  "items": [
            {
	      "isoDate": "2023-10-18T10:02:10.000Z"
	    }
	  ]
	}
      }
    );
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.rss["2023-10"], 1);
  });

  it('compiles join activity data', () => {
    const testData = structuredClone(baseCgData);
    const cgData = computeGroupData(testData, []);
    assert.equal(cgData.activity.join["2023-08"], 1);
  });

});
