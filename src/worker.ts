import {parentPort} from 'worker_threads';

parentPort!.on("message", (msg) => {
    try {
        const {script, data} = msg;
        const fn = require(script);
        if (fn.constructor.name === 'AsyncFunction') {
            fn(data)
                .then(res => parentPort!.postMessage([null, res]))
                .catch(err => parentPort!.postMessage([err, null]));
        } else if (fn.constructor.name === 'Function') {
            const res = fn(data);
            parentPort!.postMessage([null, res]);
        }
    } catch (err) {
        parentPort!.postMessage([err, null]);
    }
});

