const {WorkerThreadPool} = require("../index");

const pool = new WorkerThreadPool({size: 2, min: 2, max: 2, maxQueueSize: 50});

async function main() {
    const start = Date.now();
    // 测试同步任务
    for (let i = 0; i < 3; i++) {
        await Promise.all(new Array(4).fill(0).map(async () => {
            const a = Math.floor(Math.random() * 10);
            const b = Math.floor(Math.random() * 10);
            const script = __dirname + "/add.js";
            const [err, res] = await pool.exec({script, data: {a, b}});
            if (err) {
                return console.error(err);
            }
            console.log(`${a} + ${b} = ${res}`);
        }));
    }
    // 测试异步任务
    await Promise.all(new Array(4).fill(0).map(async () => {
        const a = Math.floor(Math.random() * 10);
        const b = Math.floor(Math.random() * 10);
        const script = __dirname + "/add.promise.js";
        const [err, res] = await pool.exec({script, data: {a, b}});
        if (err) {
            return console.error(err);
        }
        console.log(`${a} + ${b} = ${res}`);
    }));
    console.log('cost', Date.now() - start, 'ms');
    pool.close();
}

main();