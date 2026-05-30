const fs = require("fs");
const path = require("path");

const times = {};
function time(name) {
    if (!times[name]) times[name] = 0;
    return process.hrtime.bigint();
}
function timeEnd(name, start) {
    const end = process.hrtime.bigint();
    times[name] += Number(end - start) / 1000000;
}

global.profile = { time, timeEnd, get: () => times };
