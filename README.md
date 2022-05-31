This tool collects data from various sources (W3C API, Github API, screen-scraping of W3C mailing lists archives, RSS feeds, wikis) to build a picture of the activity level in W3C Community Groups.

# Data collection
You need to instantiate a `config.json` (from the `config.json.dist` template), filled with a W3C API key and a Github API key.

Once that done, run:
`node monitor.js`

It will run for a while to collect data across all the sources. The data is collected in one-file-per-CG in the `data` directory.

Alternatively, you can update the data for specific groups with
`node monitor.js [groupid1] [groupid2]`
where `groupid1` is a the id of the group in the W3C API.

# Data processing
Once the data is collected per the above, run
`node prepare-data.js`

It will generate a `report.json` file with the data needed for the [dashboard](https://w3c.github.io/cg-monitor/).

The tool also generate the activity charts used in Community Group homepages.
