#! /usr/bin/env node

import fs from "fs";
import { exec, execSync } from "child_process";
import { resolve } from "path";
import { promisify } from "util";
import { table } from "table";
import _progress from "cli-progress";
import _colors from "ansi-colors";
import { homedir } from "os";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Functions
const myexec = promisify(exec);
const isDir = (path) => fs.existsSync(path) && fs.lstatSync(path).isDirectory();

class Logger {
  constructor(props) { }
  setVerbosity(bool) {
    this.verbose = bool;
  }
  warn(message) {
    const parsedMessage =
      typeof message === "object" ? JSON.stringify(message) : message;
    console.log(_colors.yellowBright(parsedMessage));
  }
  log(message) {
    if (this.verbose) {
      const parsedMessage =
        typeof message === "object" ? JSON.stringify(message) : message;
      console.log(_colors.cyanBright(parsedMessage));
    }
  }
  info(message) {
    const parsedMessage =
      typeof message === "object" ? JSON.stringify(message) : message;
    console.log(_colors.greenBright(parsedMessage));
  }
}
const loggy = new Logger();
const home = homedir();
const pathToDir = `${home}/.puppet`;
const pathToConfigFile = `${pathToDir}/configs.json`;

const commandHandler = (args) => {
  const { listedFiles } = getFiles(args.filter);
  if (args.verbose) {
    loggy.setVerbosity(true);
  }
  const command = args.command;
  loggy.log("Puppet configuration");
  loggy.log({
    rootPath: execSync("pwd").toString().replace(/\n/, ""),
    filter: args.filter,
    command: args.command,
    repos: listedFiles,
  });
  if (listedFiles.length === 0) return;
  loggy.info("Running puppets...");
  runCommand(command, listedFiles, true);
  loggy.info("Puppets done!");
};

const updateHandler = (args) => {
  const { listedFiles } = getFiles(args.filter);
  if (args.verbose) {
    loggy.setVerbosity(true);
  }
  const command = args.command;
  loggy.log("Puppet configuration");
  loggy.log({
    rootPath: execSync("pwd").toString().replace(/\n/, ""),
    filter: args.filter,
    command,
    repos: listedFiles,
  });
  if (listedFiles.length === 0) return;
  loggy.info("Running puppets...");
  runCommand(command, listedFiles, true);
  loggy.info("Puppets done!");
};

const branchesCommand = (args) => {
  const { branches } = getFiles(args.filter);
  if (branches.length === 0) return;
  loggy.info("Branches Info");
  loggy.info(table([["Repository", "Branch"]].concat(branches)));
};

function updateCommand(name) {
  return `git stash && git ch ${name} && git pull origin ${name} && npm i`;
}

function runAtPath(name, command) {
  return `cd ${name} && ${command}`;
}

function hasGitFile(parsedPath) {
  return fs.existsSync(`${parsedPath}/.git`)
}

function getBranch(path) {
  const getBranchName = `git rev-parse --abbrev-ref HEAD`;
  return execSync(runAtPath(path, getBranchName)).toString().replace(/\n/g, "");
}

async function runCommand(command, repos, showProgress) {
  const promises = [];
  const errorsInCommands = [];
  let bar;
  let increment;
  if (showProgress) {
    bar = new _progress.Bar({
      format:
        "Puppet Progress |" +
        _colors.cyan("{bar}") +
        "| {percentage}% || {value}/{total} Chunks",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });
    bar.start(100, 0);
    increment = 100 / repos.length;
  }
  repos.forEach((repo) => {
    const branchName = getBranch(repo);
    const setCommand = command
      ? command.replace(/\n/g, "")
      : updateCommand(branchName).replace(/\n/g, "");
    loggy.log(
      `\nRunning command:${setCommand} in ${repo}. Branch:${branchName}`
    );
    const promise = myexec(runAtPath(repo, setCommand))
      .then((result) => {
        if (showProgress) {
          bar.increment(increment);
        }
        loggy.log(`\nFinished command in ${repo}`);
        const { stdout, stderr } = result;
        loggy.log("STDOUT");
        stdout.split("\n").forEach((out) => {
          loggy.log(out);
        });
        loggy.log("STDERR");
        stderr.split("\n").forEach((out) => {
          loggy.log(out);
        });
      })
      .catch((err) => {
        if (showProgress) {
          bar.increment(increment);
        }
        loggy.log(`Command error in ${repo}`);
        loggy.log(err);
        errorsInCommands.push(err);
      });
    promises.push(promise);
  });
  await Promise.allSettled(promises);
  if (showProgress) {
    bar.stop();
  }
  if (errorsInCommands.length > 0) {
    loggy.warn("Error in commands");
    loggy.warn(errorsInCommands);
  }
}

function getFiles(filterList) {
  const rootPath = execSync("pwd").toString().replace(/\n/, "");
  const foundFilters = [];
  const branches = [];
  const listedFiles = execSync("ls")
    .toString()
    .split("\n")
    .filter((output) => {
      if (output) {
        const filePath = resolve(rootPath, output);
        const parsedPath = filePath.replace("\n", "");
        if (isDir(parsedPath) && hasGitFile(parsedPath)) {
          try {
            const branch = getBranch(parsedPath);
            if (!filterList) {
              branches.push([output, branch]);
              return true;
            }
            if (filterList.includes(output)) {
              branches.push([output, branch]);
              foundFilters.push(output);
              return true;
            }
          } catch (err) {
            console.log('err')
            return false;
          }
        }
      }
      return false;
    });
  if (filterList && foundFilters.length !== filterList.length) {
    loggy.warn("The following filtered repos were not found");
    filterList.forEach((filter) => {
      if (!foundFilters.includes(filter)) {
        loggy.warn(`  - ${filter}`);
      }
    });
  }
  if (listedFiles.length === 0) {
    loggy.warn(
      "No repos found for puppet usage. Confirm that you are running puppet in the top directory."
    );
  }
  return { listedFiles, branches };
}

function getConfigFile(override) {
  const fileExists = fs.existsSync(pathToConfigFile);
  if (fileExists) {
    const configFile = fs.readFileSync(pathToConfigFile);
    return JSON.parse(configFile);
  }
  if (override) return null;
  loggy.warn(
    "Config file does not exist. Confirm that the config exists at .puppet/configs.json"
  );
  process.exit(1);
}

function saveConfigCommand(args) {
  loggy.info(`Saving config ${args.name}`);
  const { branches } = getFiles(args.filter);
  const configName = args.name;
  const configFile = getConfigFile(true);
  if (configFile) {
    configFile[configName] = branches;
    fs.writeFileSync(pathToConfigFile, JSON.stringify(configFile));
    loggy.info(`config ${args.name} saved`);
    return;
  }
  const initialConfigurationFile = {
    [configName]: branches,
  };
  if (!fs.existsSync(pathToDir)) {
    fs.mkdirSync(pathToDir);
  }
  fs.writeFileSync(pathToConfigFile, JSON.stringify(initialConfigurationFile));
  loggy.info(`.puppet directory created and config ${args.name} saved`);
}

function removeConfigCommand(args) {
  loggy.info(`Removing ${args.name} configuration`);
  const configFile = getConfigFile();
  // find the key on the object
  if (!configFile[args.name]) {
    return loggy.warn(
      `Specified config ${args.name} does not exist in the config file. Confirm the configuration exists at .puppet/configs.json`
    );
  }
  delete configFile[args.name];
  fs.writeFileSync(pathToConfigFile, JSON.stringify(configFile));
  loggy.info(`Configuration ${args.name} was removed`);
}

async function runConfigCommand(args) {
  const configFile = getConfigFile();
  const config = configFile[args.name];
  if (!config) {
    return loggy.warn(
      `Specified config ${args.name} does not exist in the config file. Can you confirm it exists with puppet get`
    );
  }

  loggy.info(`running ${args.name} configuration`);
  config.forEach(([repo, branch]) => {
    const command = `git ch ${branch}`;
    runCommand(command, [repo], false);
  });
  loggy.info(`running ${args.name} configuration done`);
}

function getConfigsCommand(args) {
  const configFile = getConfigFile();
  if (args.name && !configFile[args.name]) {
    return loggy.warn(
      `Config ${args.name} does not exist in the configs file. Confirm that the config exists at the file .puppets/configs.json`
    );
  }
  if (args.name) {
    loggy.info(`Here is the config for ${args.name}`);
    loggy.info(table([["Repository", "Branch"]].concat(configFile[args.name])));
    return;
  }
  loggy.info("Here are the stored configs");
  Object.keys(configFile).forEach((config) => {
    loggy.info(`  - ${config}`);
  });
}

function commandBuilder(yInst) {
  return yInst.options({
    filter: {
      description: "array of sub repos to use",
      alias: "f",
      type: "array",
    },
  });
}

yargs(hideBin(process.argv))
  .scriptName(_colors.greenBright("puppet"))
  .usage("$0 <command> [options]")
  .command(
    ['command "<command>" [filter]', "co"],
    _colors.yellowBright(
      "Send a command to all sub repos. You must wrap your command in quotes to ensure it's passed in properly"
    ),
    commandBuilder,
    commandHandler
  )
  .command(
    ["update [filter]", "up"],
    _colors.yellowBright("Update all sub repos to their current branch"),
    commandBuilder,
    updateHandler
  )
  .command(
    ["branches [filter]", "br"],
    _colors.yellowBright("Get the list of branches for all your sub repos"),
    commandBuilder,
    branchesCommand
  )
  .command(
    ["save <name> [filter]", "sv"],
    _colors.yellowBright(
      "Save the current branch configuration for all sub repos"
    ),
    (yInst) => {
      return yInst.options({
        filter: {
          description: "array of sub repos to use",
          alias: "f",
          type: "array",
        },
        name: {
          description: "name of the saved config",
          alias: "n",
          type: "string",
          demandOption: true,
        },
      });
    },
    saveConfigCommand
  )
  .command(
    ["remove <name>", "rm"],
    _colors.yellowBright("Remove a branch configuration"),
    (yInst) => {
      return yInst.options({
        name: {
          description: "name of config to delete",
          alias: "n",
          type: "string",
          demandOption: true,
        },
      });
    },
    removeConfigCommand
  )
  .command(
    ["run <name>", "rn"],
    _colors.yellowBright("change to a saved branch configuration"),
    (yInst) => {
      return yInst.options({
        name: {
          description: "name of config to run",
          alias: "n",
          type: "string",
          demandOption: true,
        },
      });
    },
    runConfigCommand
  )
  .command(
    ["get [name]", "gt"],
    _colors.yellowBright(
      "view all configurations available. If name is specified, the branch configuration will be shown"
    ),
    (yInst) => {
      return yInst.options({
        name: {
          description: "name of config to show",
          alias: "n",
          type: "string",
        },
      });
    },
    getConfigsCommand
  )
  .alias("v", "verbose")
  .describe("v", "verbose mode")
  .example('$0 command "git ch main && git pull origin main"')
  .example('$0 command "git ch main && ls" --filter database front-end server')
  .example("$0 save default")
  .example("$0 run newFeatureConfig")
  .example("$0 remove featureIsDoneConfig")
  .demandCommand(1, "")
  .help().argv;
