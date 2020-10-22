# worker_thread_pool
worker_thread_pool using node.js worker_threads package

[TOC]

## Install

```
npm i @chengsu/worker_thread_pool
```

## Usage

```js
// add.js
module.exports = function add(a, b) {
    return a + b;
};

// index.js
const {WorkerThreadPool} = require("@chengsu/worker_thread_pool");

const pool = new WorkerThreadPool({size: 2, min: 2, max: 2, maxQueueSize: 50});

async function main() {
    const a = 1;
    const b = 2;
    const script = __dirname + "/add.js";
    // add a and b, then return result as res  
    const [err, res] = await pool.exec([script, [a, b]]);
    if (err) {
        return console.error(err);
    }
    console.log(res); // res should be 3
    pool.close();
}

main();
```
