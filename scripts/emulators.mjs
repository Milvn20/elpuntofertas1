import { existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

function portableJdk21() {
  const base = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "elpuntofertas-jdk");
  if (!existsSync(base)) return null;
  const dir = readdirSync(base, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.startsWith("jdk-21"));
  return dir ? join(base, dir.name) : null;
}

const env = { ...process.env };
const jdk = portableJdk21();
if (jdk) {
  env.JAVA_HOME = jdk;
  const bin = join(jdk, "bin");
  env.Path = `${bin};${env.Path ?? ""}`;
  env.PATH = env.Path;
}

const args = [
  "--yes",
  "firebase-tools",
  "emulators:start",
  "--project",
  "elpuntofertas-local",
  "--export-on-exit=./firebase-emulator-data",
];
if (existsSync("firebase-emulator-data/firebase-export-metadata.json")) {
  args.push("--import=./firebase-emulator-data");
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npx, args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
