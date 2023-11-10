function wrapService(service) {
  return data => {
    return { service, data};
  };
}


// Failure mode:
// Source error:
// - service.link doesn't exist (signal)
// - service.link isn't recognized as a well-known data source (signal)
// - service.link is recognized as a data source we don't parse (warn)
// vs
// Fetch error:
// - errors while fetching data from service.link (warn)

function fetchActivityType(service) {
  switch(service.type) {
  case "blog":
    // optimistic approach at getting the RSS feed
    return fetchRSS(service.link + "feed");
  case "rss":
    return fetchRSS(service.link);
  case "lists":
    return fetchMail(service.link);
  case "wiki":
    return fetchWiki(service.link);
  case "repository":
    return fetchGithub(service.link);
  case "forum":
    return fetchForum(service.link);
  }
  // TODO: signal we don't parse this kind of service
  return service;
}

module.exports.fetchActivity = async function fetchActivity(service) {
  const serviceWrapper = service.type === "blog" ? {...service, type: "rss"} : service;
  return fetchActivityType(service)
    .then(wrapService(serviceWrapper))
  /* TODO: deal with errors fetching activity data
    .catch(); */
};
