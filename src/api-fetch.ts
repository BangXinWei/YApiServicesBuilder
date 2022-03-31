#!/usr/bin/env node
declare const process: {
  env: {
    NODE_TLS_REJECT_UNAUTHORIZED: number;
  };
  argv: Array<string>;
  platform: string;
  cwd: () => string;
};

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

import path from "path";
import fs from "fs";
import https from "https";
import { spawn } from "child_process";
import { program } from "commander";

function GetPathUtils(...szPath: Array<string>) {
  if (szPath.filter((item) => item.indexOf(":") >= 0).length > 0) {
    return path.join(...szPath);
  }
  return path.join(process.cwd(), ...szPath);
}

function GetBuilderPathUtils(...szPath: Array<string>) {
  if (szPath.filter((item) => item.indexOf(":") >= 0).length > 0) {
    return path.join(...szPath);
  }
  return path.join(process.argv[1], "../../", ...szPath);
}

const templateFileName = "template";
const templateFileSrc = "assets/ts_services_template/typescript-tkit";
const service2jsonFileSrc = "assets/json2service.js";
const indexTsFileSrc = "assets/index.ts";
const cfgFileName = "yApi-ts-server.cfg.json";

const pkgFile: { version: string } = require("../package.json");

program
  .command("init")
  .description("创建配置文件")
  .argument("[fileName]", "配置文件名", cfgFileName)
  .action((fileName: string) => {
    const currentModule = path.join(__dirname, "../");
    const runTimePackage = process.cwd();
    const dstFilePath = GetPathUtils(fileName);
    if (!fs.existsSync(dstFilePath)) {
      const relative = currentModule.replace(runTimePackage, ".");
      const schemeJsonPath = `${relative}assets/api-fetch-args-config.scheme.json`;
      const jsonCfg = {
        $schema: schemeJsonPath,
        services: [],
      };
      const writer = fs.createWriteStream(dstFilePath);
      writer.write(JSON.stringify(jsonCfg, null, 2));
    }
  });

function resolveParams(params: any): IAutosCfg {
  const {
    "-s": sDir,
    "-T": createTemplate,
    "-u": url,
    "-n": pName,
    "-t": template,
  } = params;
  return {
    sDir: sDir ? sDir : "",
    createTemplate: createTemplate ? createTemplate : false,
    url: url ? url : "",
    pName: pName ? pName : "",
    template: template ? template : "",
  };
}

program
  .version(pkgFile.version)
  .description(
    "基于yapi快速构建typescript接口库 Autos（https://gogoyqj.github.io/auto-service/）工具"
  )
  .option("-c, --configPath <p>", "当命令行参数以配置文件形式填写路径", "")
  .option(
    "-T, --createTemplate <p>",
    "生成独立template，将会在-s/-u 目录下生成typescript-kit 作为模版，如果存在就不生成"
  )
  .option("-s, --sDir <p>", "生成ts server的根目录")
  .option("-u, --url <p>", "yapi url path, 详见yapi项目->设置->生成ts services")
  .option(
    "-n, --pName <p>",
    "接口名称  会按照接口名称生成目录，会按照apiUrl进行唯一性判断"
  )
  .option(
    "-t, --template <p>",
    "模版路径, https://gogoyqj.github.io/auto-service/getting-started#222-swaggerparser-%E5%8F%82%E6%95%B0",
    ""
  )
  .action((cmdObj) => {
    if (process.argv.length == 2) {
      const dstFilePath = GetPathUtils(cfgFileName);
      const createParams = process.argv.slice(0, 2);
      if (fs.existsSync(dstFilePath)) {
        cmdObj.configPath = cfgFileName;
      } else {
        createParams.push("--help");
        program.parse(createParams);
        return;
      }
    }

    const { configPath } = cmdObj;

    if (configPath && configPath.length > 0) {
      const cfgPath = GetPathUtils(configPath);
      const jsonParams = require(cfgPath);
      const cfgArray = jsonParams.services as ICfgParams[];

      if (cfgArray) {
        if (cfgArray.length == 0) {
          console.warn("warning: no services config is founded in cfg file");
          return;
        }

        function HandleAutos() {
          if (cfgArray.length > 0) {
            const cfg = cfgArray.shift();
            DoAutosWithCfg(resolveParams(cfg), () => {
              HandleAutos();
            });
          }
        }
        HandleAutos();
      }
      return;
    }

    DoAutosWithCfg(resolveParams(cmdObj), () => {});
  })
  .parse(process.argv);

type PossibleValue<T = string> = T | undefined;
interface IAutosCfg {
  url: PossibleValue;
  pName: PossibleValue;
  sDir: PossibleValue;
  template: PossibleValue;
  createTemplate: PossibleValue<boolean>;
}

interface ICfgParams {
  "-s": string;
  "-T": string;
  "-u": string;
  "-n": string;
  "-t": string;
}

function DoAutosWithCfg(params: IAutosCfg, cb: (err?: Error) => void) {
  const { url, pName, sDir, template, createTemplate } = params;

  if (Object.values(params).findIndex((item) => item == undefined) > 0) {
    console.error("args has error");
    const createParams = process.argv.slice(0, 2);
    createParams.push("--help");
    program.parse(createParams);
    return;
  }

  const commandArgs = {
    apiPath: GetPathUtils(`./${sDir}/${pName}`),
    servicesDir: sDir as string,
    apiName: pName as string,
    yApiUrl: url as string,
    templateDir: GetPathUtils(template as string),
    bCreateTemp: createTemplate as boolean,
  };
  type TCommandArgs = typeof commandArgs;

  function Build(commandArgs: TCommandArgs) {
    WriteJson2ServiceFile(commandArgs);
    fetchThenAutos(commandArgs);
  }

  function WriteJson2ServiceFile(commandArgs: TCommandArgs) {
    if (!fs.existsSync(commandArgs.servicesDir)) {
      fs.mkdirSync(commandArgs.servicesDir);
    }

    if (!fs.existsSync(commandArgs.apiPath)) {
      fs.mkdirSync(commandArgs.apiPath);
    }

    const cpTasks: Array<{ copySrc: string; copyDst: string }> = [];

    function CreateCpTask(srcFile: string, dstFile: string) {
      const copyDst = path.resolve(commandArgs.apiPath, dstFile);
      if (fs.existsSync(copyDst) == false) {
        const copySrc = GetBuilderPathUtils(srcFile);
        cpTasks.push({
          copySrc,
          copyDst,
        });
      }
    }

    if (commandArgs.bCreateTemp) {
      CreateCpTask(templateFileSrc, templateFileName)
    }

    CreateCpTask(service2jsonFileSrc, "json2service.js")
    CreateCpTask(indexTsFileSrc, "index.ts")

    cpTasks.forEach((cpTask) => {
      if (fs.existsSync(cpTask.copyDst) == false) {
        fs.cpSync(cpTask.copySrc, cpTask.copyDst, {
          recursive: true,
        });
      }
    });

    // if (!fs.existsSync(`${commandArgs.apiPath}/json2service.js`)) {
    //   const json2service = {
    //     url: `swagger.json`,
    //     remoteUrl: `api.json`,
    //     type: "yapi",
    //     swaggerParser: {
    //       "-o": `services`,
    //       "-t": commandArgs.templateDir.length > 0 ? "./template" : undefined,
    //     },
    //     swaggerConfig: {
    //       modifier: eval('function b11(){}'),
    //     },
    //   };

    //   const data =
    //     `// https://gogoyqj.github.io/auto-service 的主配置文件 \n module.exports = ` +
    //     JSON.stringify(json2service, null, 2);

    //   fs.writeFileSync(`${commandArgs.apiPath}/json2service.js`, data, {
    //     encoding: "utf-8",
    //   });
    // }

    // const indexTsPath = `${commandArgs.apiPath}/index.ts`;
    // if (!fs.existsSync(indexTsPath)) {
    //   const json2serviceFile = fs.createWriteStream(indexTsPath);
    //   json2serviceFile.write(
    //     `// 导出services 全部模块 \nexport * from "./services"
    //     `
    //   );
    // }
  }

  // autos https://gogoyqj.github.io/auto-service/
  function fetchThenAutos(commandArgs: TCommandArgs) {
    const savePath = `${commandArgs.apiPath}/api.json`;
    https
      .get(commandArgs.yApiUrl, (data) =>
        data.pipe(fs.createWriteStream(savePath))
      )
      .on("close", () => {
        spawn(
          process.platform === "win32" ? "npx.cmd" : "npx",
          [`autos`, "-c", "json2service.js"],
          {
            cwd: `./${commandArgs.servicesDir}/${commandArgs.apiName}`,
            stdio: "inherit",
          }
        ).on("exit", () => {
          cb();
        });
      });
  }

  if (commandArgs.servicesDir && commandArgs.apiName) {
    Build(commandArgs);
  } else {
    cb(new Error("bad args"));
  }
}
