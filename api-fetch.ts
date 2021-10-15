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

const templateFileName = "template";
const templateFileSrc = "assets/ts_services_template/typescript-tkit";
const cfgFileName = "yApi-ts-server.cfg.json";

program
  .command("init")
  .description("创建配置文件")
  .argument("[fileName]", "配置文件名", cfgFileName)
  .action((fileName: string) => {
    //console.log(fileName, __dirname, path.join(__dirname, "../"));

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
      //console.log(schemeJsonPath, jsonCfg);
      const writer = fs.createWriteStream(dstFilePath);
      writer.write(JSON.stringify(jsonCfg, null, 2));
    }
  });

program
  .version("0.0.1")
  .description("基于yapi快速构建typescript接口库工具")
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
      const createParams = process.argv.slice(0, 2);
      if (jsonParams.services && jsonParams.services instanceof Array) {
        if (jsonParams.services.length == 0) {
          console.warn("warning: no services config is founded in cfg file")
          return;
        }

        jsonParams.services.forEach((jsonParam: any) => {
          for (let index in jsonParam) {
            if (index.indexOf("$s") < 0) {
              createParams.push(index);
              createParams.push(jsonParam[index]);
            }
          }

          cmdObj.configPath = undefined;
          process.argv = createParams
          program.parse(createParams);
        });
      }
      return;
    }

    type PossibleValue<T = string> = T | undefined;

    const {
      url,
      pName,
      sDir,
      template,
      createTemplate,
    }: {
      url: PossibleValue;
      pName: PossibleValue;
      sDir: PossibleValue;
      template: PossibleValue;
      createTemplate: PossibleValue<boolean>;
    } = cmdObj;

    if (Object.values(cmdObj).findIndex((item) => item == undefined) > 0) {
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

    function copyFile(sourcePath: string, targetPath: string) {
      const sourceFile = fs.readdirSync(sourcePath, {
        withFileTypes: true,
      });

      sourceFile.forEach((file) => {
        const newSourcePath = path.resolve(sourcePath, file.name);
        const newTargetPath = path.resolve(targetPath, file.name);
        if (file.isDirectory()) {
          copyFile(newSourcePath, newTargetPath);
        }
        fs.copyFileSync(newSourcePath, newTargetPath);
      });
    }

    function WriteJson2ServiceFile(commandArgs: TCommandArgs) {
      if (!fs.existsSync(commandArgs.servicesDir)) {
        fs.mkdirSync(commandArgs.servicesDir);
      }

      if (!fs.existsSync(commandArgs.apiPath)) {
        fs.mkdirSync(commandArgs.apiPath);
      }

      if (commandArgs.bCreateTemp) {
        const copyDst = path.resolve(commandArgs.apiPath, templateFileName);

        if (fs.existsSync(copyDst) == false) {
          fs.mkdirSync(copyDst);
          const copySrc = path.resolve(templateFileSrc);
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
          "-t":
            commandArgs.templateDir.length > 0
              ? GetPathUtils(commandArgs.templateDir)
              : undefined,
        },
      };

      const json2serviceFile = fs.createWriteStream(
        `${commandArgs.apiPath}/json2service.js`
      );
      json2serviceFile.write(
        `module.exports = ` + JSON.stringify(json2service)
      );
    }

    // autos https://gogoyqj.github.io/auto-service/
    function fetchThenAutos(commandArgs: TCommandArgs) {
      const savePath = `${commandArgs.apiPath}/api.json`;
      https
        .get(commandArgs.yApiUrl, (data) =>
          data.pipe(fs.createWriteStream(savePath))
        )
        .on("close", () => {
          spawn(process.platform === "win32" ? "npx.cmd" : "npx", [`autos`], {
            cwd: `./${commandArgs.servicesDir}/${commandArgs.apiName}`,
            stdio: "inherit"
          });
        });
    }

    if (commandArgs.servicesDir && commandArgs.apiName) {
      Build(commandArgs);
    }
  })
  .parse(process.argv);
