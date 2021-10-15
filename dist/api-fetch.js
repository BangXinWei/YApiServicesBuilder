#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const child_process_1 = require("child_process");
const commander_1 = require("commander");
function GetPathUtils(...szPath) {
    if (szPath.filter((item) => item.indexOf(":") >= 0).length > 0) {
        return path_1.default.join(...szPath);
    }
    return path_1.default.join(process.cwd(), ...szPath);
}
function GetBuilderPathUtils(...szPath) {
    if (szPath.filter((item) => item.indexOf(":") >= 0).length > 0) {
        return path_1.default.join(...szPath);
    }
    return path_1.default.join(process.argv[1], "../../", ...szPath);
}
const templateFileName = "template";
const templateFileSrc = "assets/ts_services_template/typescript-tkit";
const cfgFileName = "yApi-ts-server.cfg.json";
const pkgFile = require("../package.json");
commander_1.program
    .command("init")
    .description("创建配置文件")
    .argument("[fileName]", "配置文件名", cfgFileName)
    .action((fileName) => {
    const currentModule = path_1.default.join(__dirname, "../");
    const runTimePackage = process.cwd();
    const dstFilePath = GetPathUtils(fileName);
    if (!fs_1.default.existsSync(dstFilePath)) {
        const relative = currentModule.replace(runTimePackage, ".");
        const schemeJsonPath = `${relative}assets/api-fetch-args-config.scheme.json`;
        const jsonCfg = {
            $schema: schemeJsonPath,
            services: [],
        };
        //console.log(schemeJsonPath, jsonCfg);
        const writer = fs_1.default.createWriteStream(dstFilePath);
        writer.write(JSON.stringify(jsonCfg, null, 2));
    }
});
commander_1.program
    .version(pkgFile.version)
    .description("基于yapi快速构建typescript接口库工具")
    .option("-c, --configPath <p>", "当命令行参数以配置文件形式填写路径", "")
    .option("-T, --createTemplate <p>", "生成独立template，将会在-s/-u 目录下生成typescript-kit 作为模版，如果存在就不生成")
    .option("-s, --sDir <p>", "生成ts server的根目录")
    .option("-u, --url <p>", "yapi url path, 详见yapi项目->设置->生成ts services")
    .option("-n, --pName <p>", "接口名称  会按照接口名称生成目录，会按照apiUrl进行唯一性判断")
    .option("-t, --template <p>", "模版路径, https://gogoyqj.github.io/auto-service/getting-started#222-swaggerparser-%E5%8F%82%E6%95%B0", "")
    .action((cmdObj) => {
    if (process.argv.length == 2) {
        const dstFilePath = GetPathUtils(cfgFileName);
        const createParams = process.argv.slice(0, 2);
        if (fs_1.default.existsSync(dstFilePath)) {
            cmdObj.configPath = cfgFileName;
        }
        else {
            createParams.push("--help");
            commander_1.program.parse(createParams);
            return;
        }
    }
    const { configPath } = cmdObj;
    if (configPath && configPath.length > 0) {
        const cfgPath = GetPathUtils(configPath);
        const jsonParams = require(cfgPath);
        const createParams = process.argv.slice(0, 2);
        if (jsonParams.services && jsonParams.services instanceof Array) {
            if (jsonParams.services.length == 0) {
                console.warn("warning: no services config is founded in cfg file");
                return;
            }
            jsonParams.services.forEach((jsonParam) => {
                for (let index in jsonParam) {
                    if (index.indexOf("$s") < 0) {
                        createParams.push(index);
                        createParams.push(jsonParam[index]);
                    }
                }
                cmdObj.configPath = undefined;
                process.argv = createParams;
                commander_1.program.parse(createParams);
            });
        }
        return;
    }
    const { url, pName, sDir, template, createTemplate, } = cmdObj;
    if (Object.values(cmdObj).findIndex((item) => item == undefined) > 0) {
        console.error("args has error");
        const createParams = process.argv.slice(0, 2);
        createParams.push("--help");
        commander_1.program.parse(createParams);
        return;
    }
    const commandArgs = {
        apiPath: GetPathUtils(`./${sDir}/${pName}`),
        servicesDir: sDir,
        apiName: pName,
        yApiUrl: url,
        templateDir: GetPathUtils(template),
        bCreateTemp: createTemplate,
    };
    function Build(commandArgs) {
        WriteJson2ServiceFile(commandArgs);
        fetchThenAutos(commandArgs);
    }
    function copyFile(sourcePath, targetPath) {
        const sourceFile = fs_1.default.readdirSync(sourcePath, {
            withFileTypes: true,
        });
        sourceFile.forEach((file) => {
            const newSourcePath = path_1.default.resolve(sourcePath, file.name);
            const newTargetPath = path_1.default.resolve(targetPath, file.name);
            if (file.isDirectory()) {
                copyFile(newSourcePath, newTargetPath);
            }
            fs_1.default.copyFileSync(newSourcePath, newTargetPath);
        });
    }
    function WriteJson2ServiceFile(commandArgs) {
        if (!fs_1.default.existsSync(commandArgs.servicesDir)) {
            fs_1.default.mkdirSync(commandArgs.servicesDir);
        }
        if (!fs_1.default.existsSync(commandArgs.apiPath)) {
            fs_1.default.mkdirSync(commandArgs.apiPath);
        }
        if (commandArgs.bCreateTemp) {
            const copyDst = path_1.default.resolve(commandArgs.apiPath, templateFileName);
            if (fs_1.default.existsSync(copyDst) == false) {
                fs_1.default.mkdirSync(copyDst);
                const copySrc = GetBuilderPathUtils(templateFileSrc);
                copyFile(copySrc, copyDst);
            }
            commandArgs.templateDir = `./${commandArgs.servicesDir}/${commandArgs.apiName}/template`;
        }
        const json2service = {
            url: `swagger.json`,
            remoteUrl: `api.json`,
            type: "yapi",
            swaggerParser: {
                "-o": `services`,
                "-t": commandArgs.templateDir.length > 0
                    ? GetPathUtils(commandArgs.templateDir)
                    : undefined,
            },
        };
        const json2serviceFile = fs_1.default.createWriteStream(`${commandArgs.apiPath}/json2service.js`);
        json2serviceFile.write(`module.exports = ` + JSON.stringify(json2service));
    }
    // autos https://gogoyqj.github.io/auto-service/
    function fetchThenAutos(commandArgs) {
        const savePath = `${commandArgs.apiPath}/api.json`;
        https_1.default
            .get(commandArgs.yApiUrl, (data) => data.pipe(fs_1.default.createWriteStream(savePath)))
            .on("close", () => {
            child_process_1.spawn(process.platform === "win32" ? "npx.cmd" : "npx", [`autos`], {
                cwd: `./${commandArgs.servicesDir}/${commandArgs.apiName}`,
                stdio: "inherit",
            });
        });
    }
    if (commandArgs.servicesDir && commandArgs.apiName) {
        Build(commandArgs);
    }
})
    .parse(process.argv);
