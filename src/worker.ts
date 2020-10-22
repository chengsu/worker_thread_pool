import {parentPort} from 'worker_threads';

parentPort!.on("message", (msg) => {
    try {
        const [script, argv]: [string, any[]] = msg;
        const fn = require(script);
        if (fn.constructor.name === 'AsyncFunction') {
            fn(...argv)
                .then(res => parentPort!.postMessage([null, res]))
                .catch(err => parentPort!.postMessage([err, null]));
        } else if (fn.constructor.name === 'Function') {
            const res = fn(...argv);
            parentPort!.postMessage([null, res]);
        }
    } catch (err) {
        parentPort!.postMessage([err, null]);
    }
});

