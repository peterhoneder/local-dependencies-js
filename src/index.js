#!/usr/bin/env node
const exec = require("child_process").exec;
const process = require("process");
const path = require("path");
const fs = require("fs");

const semver = require("semver");

const usage = () => {
  console.log("local-dependencies install");
  console.log("add properties to your package.json:");
  console.log(`"localDependencies": {
    "localPath": "./npm-deps",
    "originalDependencies": {
      "wasabi-logger": "git+ssh://git@github.com:some-user/some-package.git#some-branch"
    }
  }`);
};

// require an install command
const args = process.argv.slice(2);
if (args.length == 0 || args[0] !== "install") {
  usage();
  process.exit(1);
}

// open package.json
if (!fs.existsSync("./package.json")) {
  console.error("failed to open package.json");
  usage();
  process.exit(1);
}
const cwd = process.cwd();
const package_json = require(cwd + "/package.json");
const localDependencies = package_json.localDependencies;
const localPath = path.normalize(localDependencies.localPath);

if (!localDependencies.localPath) {
  console.error("missing localPath property");
  usage();
  process.exit(1);
}
if (!localDependencies.originalDependencies || typeof localDependencies.originalDependencies !== "object") {
  console.error("missing originalDependencies property");
  usage();
  process.exit(1);
}
if (!fs.existsSync(localPath)) {
  fs.mkdirSync(localPath, { recursive: true });
}
process.chdir(localPath);

const get_package_string = (name, value) => {
  // if it's a semver value, return this
  if (semver.valid(value)) {
    // package version
    return name + "@" + semver.clean(value);
  } else {
    // all other cases handled by npm pack
    return value;
  }
};

console.log("fetching packages");
for (const [pkg_name, pkg_value] of Object.entries(localDependencies.originalDependencies)) {
  const pkg_string = get_package_string(pkg_name, pkg_value);
  console.log("name:", pkg_name, "value:", pkg_value, "result:", pkg_string);
  exec(`npm pack "${pkg_string}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(
        `failed to npm pack original dependency ${pkg_string} stdout=`,
        stdout,
        "stderr=",
        stderr,
        "error=",
        error
      );
    } else {
      const downloaded_package = stdout.trim();
      console.log("fetched:", downloaded_package, "installing...");
      exec(`cd "${cwd}" && npm i --force ./npm-deps/${downloaded_package}`, (error, stdout, stderr) => {
        if (error) {
          console.error("failed to install local dependency stdout=", stdout, "sterr=", stderr, "error=", error);
        } else {
          const installed_package = stdout.trim();
          console.log("installed:", installed_package);
        }
      });
    }
  });
}
