import bcd from '@mdn/browser-compat-data' with { type: 'json' };


/**
 * Keep a mapping between a BCD key path and the key entry itself
 */
const bcdKeys = {};

/**
 * List of browsers in core Baseline browser set
 */
const baselineBrowsers = [
  'chrome',
  'firefox',
  'safari'
];



/**
 * Helper function to retrieve BCD support data from a key path such as
 * `css.properties.display.grid`.
 */
function getBcdKey(key, { support } = { support: false }) {
  const cachedKey = bcdKeys[key];
  if (cachedKey) {
    if (support) {
      return cachedKey.__compat;
    }
    else {
      return cachedKey;
    }
  }

  const keyPath = key.split('.');
  let currKey = bcd;
  for (const level of keyPath) {
    if (!level) {
      break;
    }
    currKey = currKey[level];
    if (!currKey) {
      return;
      throw new Error(`BCD key "${key}" does not exist`);
    }
  }
  bcdKeys[key] = currKey;
  if (support) {
    if (!currKey.__compat) {
      throw new Error(`BCD key "${key}" does not have compat data`);
    }
    return currKey.__compat;
  }
  else {
    return currKey;
  }
}


function* traverseBCDFeatures(key) {
  if (key) {
    const bcdKey = getBcdKey(key, { support: false });
    for (const i in bcdKey) {
      if (!!bcdKey[i] && typeof bcdKey[i] == 'object' && i !== '__compat') {
        const subkey = key ? `${key}.${i}` : i;
        yield subkey;
        yield* traverseBCDFeatures(subkey);
      }
    }
  }
  else {
    for (const rootLevel of [
      'api', 'css', 'html', 'http', 'svg', 'javascript', 'mathml', 'webassembly', 'webdriver']
    ) {
      yield* traverseBCDFeatures(rootLevel);
    }
  }
}

/**
 * Return true when the given web-specs entry is a good match for the given
 * list of URLs. Used to map BCD `spec_url` properties to web-specs.
 */
function isRelevantSpec(spec, urls) {
  return urls.find(url => url.startsWith(spec.nightly?.url)) ||
      urls.find(url => url.startsWith(spec.release?.url)) ||
      urls.find(url => url.startsWith(spec.url)) ||
      (spec.shortname === spec.series.currentSpecification && urls.find(url => url.startsWith(spec.series?.nightlyUrl))) ||
      (spec.shortname === spec.series.currentSpecification && urls.find(url => url.startsWith(spec.series?.releaseUrl)));
}


/**
 * Retrieve all BCD keys that map to the given spec
 *
 * The function expects the bcdKeys mapping table to have been initialized.
 */
export function getBcdKeysForSpec(spec) {
  if (Object.keys(bcdKeys).length === 0) {
    // Initialize the flat list of BCD keys
    for (const key of traverseBCDFeatures()) {
      getBcdKey(key, { support: false });
    }
  }

  const keys = [];
  for (const [key, desc] of Object.entries(bcdKeys)) {
    if (!desc.__compat) {
      continue;
    }
    if (!desc.__compat.spec_url) {
      continue;
    }
    const urls = Array.isArray(desc.__compat.spec_url) ?
      desc.__compat.spec_url :
      [desc.__compat.spec_url];
    if (isRelevantSpec(spec, urls)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Compute the support across browsers from a list of keys
 */
export function getBrowserSupport(keys) {
  const support = {};
  const compatData = keys
    .map(key => getBcdKey(key, { support: true }))
    .filter(data => !!data);
  for (const browser of baselineBrowsers) {
    support[browser] = '';
    for (const data of compatData) {
      let browserSupport = data.support?.[browser];
      if (!browserSupport) {
        support[browser] = '';
        break;
      }
      if (Array.isArray(browserSupport)) {
        browserSupport = browserSupport[0];
      }

      if (browserSupport.partial_implementation) {
        support[browser] = 'partial';
	break;
      }
      if (browserSupport.flags) {
        support[browser] = 'flag';
        break;
      }
      const versionAdded = browserSupport.version_added;
      if (versionAdded) {
	const versionRemoved = browserSupport.version_removed;
        if (versionAdded > support[browser] && (!versionRemoved || versionRemoved < versionAdded)) {
          support[browser] = versionAdded;
        }
      }
      else {
        support[browser] = '';
        break;
      }
    }
  }
  for (const browser of baselineBrowsers) {
    if (support[browser] === '') {
      delete support[browser];
    }
  }
  return support;
}
