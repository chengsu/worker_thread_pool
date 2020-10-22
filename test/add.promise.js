module.exports = async function ({a, b}) {
    await sleep(3);
    return a + b;
};

function sleep(seconds) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, seconds * 1e3);
    })
}