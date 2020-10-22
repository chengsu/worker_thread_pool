module.exports = async function (a, b) {
    await sleep(500);
    return a + b;
};

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    })
}