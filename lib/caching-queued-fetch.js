const {END_EVENT, ITEM_EVENT, default:RequestQueue} = require('limited-request-queue');


let ghToken = "";
module.exports.DEFAULT_INTERVAL = 50;

const cache = {};

const wait = async (ms) => new Promise(res => setTimeout(res, ms));


class Queue {
  maxRetry = 2;
  cache = {};
  originQueue = {};
  async request(url, options, {verbose}, attempts = 0) {
    if (!this.cache[url]) {
      if (attempts > this.maxRetry) {
        const error = `HTTP error ${this.cache[url].status} ${this.cache[url].statusText} while fetching ${url} (tried ${attempts} times)`;
        if (verbose) {
          console.log(error);
        }
        throw new Error(error);
      }
      if (verbose) {
        console.log("fetching " + url);
      }
      const r = await fetch(url, options);
      this.cache[url] = { status: r.status, statusText: r.statusText, headers: r.headers, body: await r.text()};
    }
    if (this.cache[url].status >= 400) {
      let retryAfter;
      if (this.cache[url].headers.get("retry-after")) {
        retryAfter = parseInt(this.cache[url].headers.get("retry-after"), 10)*1000;
      }
      // inspired by https://github.com/octokit/plugin-throttling.js/blob/9a61d13ad284353d1298f0decfbafd332707e528/src/index.ts#L146C1-L153C11
      if (this.cache[url].headers.get("x-ratelimit-reset")) {
        const rateLimitReset = new Date(
          this.cache[url].headers.get("x-ratelimit-reset") * 1000
        ).getTime();
        retryAfter = Math.max(
          Math.ceil((rateLimitReset - Date.now())),
          0
        );
      }
      if (retryAfter) {
        delete this.cache[url];
        await wait(retryAfter);
        await this.request(url, options, { verbose }, attempts++);
      } else {
        const error = `HTTP error ${this.cache[url].status} ${this.cache[url].statusText} while fetching ${url}`;
        if (verbose) {
          console.log(error);
        }
        throw new Error(error);
      }
    }
  }

  enqueue(url, options, queueOptions = { verbose: false, interval: module.exports.DEFAULT_INTERVAL}) {
    const { origin } = new URL(url);
    if (!this.originQueue[origin]) {
      this.originQueue[origin] = Promise.resolve(true);
    }
    return new Promise((res, rej) => {
      this.originQueue[origin] = this.originQueue[origin]
        .then(async () => {
          await this.request(url, options, queueOptions);
          return this.cache[url];
        })
        .then(async (ret) => {
          res(ret);
          return wait(queueOptions.interval);
        }).catch(rej);
    });
  }
}

const queue = new Queue();

module.exports.queuedFetch = async function queuedFetch(url, options = {}, queueOptions)  {
  return queue.enqueue(url, options, queueOptions);
}



