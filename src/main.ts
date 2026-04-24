#!/usr/bin/env node

import { readFile, writeFile, unlink } from "node:fs/promises";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { dgToC } from "./dg-to-c.js";

const importPattern = /^\s*gimp\s+"([^"]+)"\s*$/gm;
const exportFunctionPattern = /^\s*gext\s+([A-Za-z_]\w*(?:\s*\*+)?)\s+([A-Za-z_]\w*)\s*\(([^;\n{}]*)\)\s*\{/gm;

type ModuleNode = {
  dgPath: string;
  content: string;
  imports: string[];
  exportedPrototypes: string[];
};

function toDgPath(moduleRef: string, parentDir: string): string {
  const withExtension = moduleRef.endsWith(".dg") ? moduleRef : `${moduleRef}.dg`;
  return normalize(isAbsolute(withExtension) ? withExtension : join(parentDir, withExtension));
}

function parseImports(content: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function stripImports(content: string): string {
  return content.replace(importPattern, "").trimStart();
}

function convertDgTypeToC(signature: string): string {
  const intTypes: Record<string, string> = {
    i8: "int8_t",
    i16: "int16_t",
    i32: "int32_t",
    i64: "int64_t",
  };
  const uintTypes: Record<string, string> = {
    u8: "uint8_t",
    u16: "uint16_t",
    u32: "uint32_t",
    u64: "uint64_t",
  };

  let cType = signature;
  cType = cType.replace(/\bgstatus\b/g, "int");

  for (const [dgType, cMapped] of Object.entries(intTypes)) {
    cType = cType.replace(new RegExp(`\\b${dgType}\\b`, "g"), cMapped);
  }

  for (const [dgType, cMapped] of Object.entries(uintTypes)) {
    cType = cType.replace(new RegExp(`\\b${dgType}\\b`, "g"), cMapped);
  }

  cType = cType.replace(/str\[\]/g, "char**");
  cType = cType.replace(/\bstr\b/g, "char*");
  return cType;
}

function parseExportedPrototypes(content: string): string[] {
  const exported: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = exportFunctionPattern.exec(content)) !== null) {
    const dgSignature = `${match[1]} ${match[2]}(${match[3]});`;
    exported.push(convertDgTypeToC(dgSignature));
  }

  return exported;
}

async function loadModuleGraph(filePaths: string[]): Promise<Map<string, ModuleNode>> {
  const modules = new Map<string, ModuleNode>();

  for (const dgPath of filePaths) {
    const content = await readFile(dgPath, "utf-8");
    const imports = parseImports(content);
    const exportedPrototypes = parseExportedPrototypes(content);
    modules.set(dgPath, { dgPath, content, imports, exportedPrototypes });
  }

  return modules;
}

function validateImports(modules: Map<string, ModuleNode>) {
  for (const node of modules.values()) {
    const parentDir = dirname(node.dgPath);
    for (const moduleRef of node.imports) {
      const importedPath = toDgPath(moduleRef, parentDir);
      if (!modules.has(importedPath)) {
        throw new Error(`Imported module ${moduleRef} not provided. Pass it with -f ${importedPath}`);
      }
    }
  }
}

function buildPrelude(node: ModuleNode, modules: Map<string, ModuleNode>): string {
  if (node.imports.length === 0) return "";

  const parentDir = dirname(node.dgPath);
  const declarations: string[] = [];

  for (const moduleRef of node.imports) {
    const importedPath = toDgPath(moduleRef, parentDir);
    const importedModule = modules.get(importedPath);

    if (!importedModule) {
      throw new Error(`Imported module not found: ${moduleRef}`);
    }

    declarations.push(...importedModule.exportedPrototypes);
  }

  if (declarations.length === 0) return "";
  return `${declarations.join("\n")}\n\n`;
}

function run(command: string, args: string[], allowExitCodeOne = false) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else if (allowExitCodeOne && code === 1) {
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
    main: {
      type: "string",
      short: "m",
      long: "main",
      description: "Entry file (.dg)",
    },
    file: {
      type: "string",
      multiple: true,
      short: "f",
      long: "file",
      description: "Additional files to compile (.dg)",
    },
    temp: {
        type: "boolean",
        short: "d",
        description: "Whether to keep the generated files (for debugging)"
    }
  },
});

const { main, file, temp } = values;
if (!main) {
  console.error("Please provide the entry file with -m");
  process.exit(1);
}

const inputFiles = [main, ...(file ?? [])].map((dgPath) => normalize(dgPath));
if (inputFiles.some((dgPath) => !dgPath.endsWith(".dg"))) {
  console.error("All -m/-f arguments must be .dg files");
  process.exit(1);
}

const entryFile = normalize(main);
const modules = await loadModuleGraph(inputFiles);
validateImports(modules);

const generatedCFiles: string[] = [];

for (const node of modules.values()) {
  const isEntry = node.dgPath === entryFile;
  const prelude = buildPrelude(node, modules);
  const contentWithoutImports = stripImports(node.content);
  const cCode = dgToC(contentWithoutImports, {
    prelude,
    requireMainReturn: isEntry,
  });

  const generatedCPath = node.dgPath.replace(/\.dg$/, ".c");
  generatedCFiles.push(generatedCPath);
  await writeFile(generatedCPath, cCode);
}

const fileOut = entryFile.replace(/\.dg$/, ".c");
const executableOutBase = fileOut.replace(/\.c$/, "");
const executableOut =
  process.platform === "win32" ? `${executableOutBase}.exe` : executableOutBase;
const executableRunPath =
  process.platform === "win32" ? executableOut : `./${executableOut}`;

const compiler = process.env.CC ?? "cc";

try {
  await run(compiler, ["-std=c23", "-Werror=implicit-function-declaration", ...generatedCFiles, "-o", executableOut]);
  await run(executableRunPath, [], true);
} finally {
    if (!temp) {
        await Promise.allSettled([
          ...generatedCFiles.map((generatedCPath) => unlink(generatedCPath)),
          unlink(executableOut),
        ]);
    }
}