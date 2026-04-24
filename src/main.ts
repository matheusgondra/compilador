#!/usr/bin/env node

import { readFile, writeFile, unlink } from "node:fs/promises";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { dgToC } from "./dg-to-c.js";

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else if (code === 1) {
        resolve();
      }else {
        reject(new Error("Command failed with exit code " + code));
      }
    });
  });
}

const { values } = parseArgs({
  allowPositionals: true,
  options: {
    file: {
      type: "string",
      short: "f",
      long: "file",
      description: "The file to read",
    },
    temp: {
        type: "boolean",
        short: "d",
        description: "Whether to keep the generated files (for debugging)"
    }
  },
});

const { file, temp } = values;
if (!file || !file.endsWith(".dg")) {
  console.error("Please provide a .dg file to read");
  process.exit(1);
}

const content = await readFile(file, "utf-8");
const cCode = dgToC(content);

const fileOut = file.replace(/\.dg$/, ".c");
const executableOutBase = fileOut.replace(/\.c$/, "");
const executableOut =
  process.platform === "win32" ? `${executableOutBase}.exe` : executableOutBase;
const executableRunPath =
  process.platform === "win32" ? executableOut : `./${executableOut}`;

const compiler = process.env.CC ?? "cc";

try {
  await writeFile(fileOut, cCode);

  await run(compiler, [fileOut, "-o", executableOut]);
  await run(executableRunPath, []);
} finally {
    if (!temp) {
        await Promise.allSettled([
          unlink(fileOut),
          unlink(executableOut),
        ]);
    }
}