"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
//console.log(process.cwd());
const packageInfo = require("../../package.json");
//console.log(packageInfo, packageInfo.version);
const szVersion = packageInfo.version.split(".");
const newVersion = parseInt(szVersion[2]) + 1;
const dstVersion = `${szVersion[0]}.${szVersion[1]}.${newVersion}`;
console.log(dstVersion);
(0, child_process_1.spawn)(process.platform === "win32" ? "npm.cmd" : "npm", ["version", dstVersion], {
    stdio: "inherit",
});
