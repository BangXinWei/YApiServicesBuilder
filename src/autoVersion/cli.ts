import { spawn } from "child_process";

const packageInfo: { version: string } = require("../../package.json");
console.log(packageInfo, packageInfo.version);
const szVersion = packageInfo.version.split(".");
const newVersion = parseInt(szVersion[2]) + 1;
const dstVersion = `${szVersion[0]}.${szVersion[1]}.${newVersion}`;
console.log(dstVersion);
spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["version", dstVersion],
  {
    stdio: "inherit",
  }
);
