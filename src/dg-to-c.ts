import { macrosC } from "./macros-c.js";

const headers = `
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <inttypes.h>
`;



const intTypes = {
    "i8": "int8_t",
    "i16": "int16_t",
    "i32": "int32_t",
    "i64": "int64_t"
} as const;
const uintTypes = {
    "u8": "uint8_t",
    "u16": "uint16_t",
    "u32": "uint32_t",
    "u64": "uint64_t"
} as const;

const functionDefinitionPattern = /^(\s*)(gext\s+)?(?!static\b)(?!if\b|for\b|while\b|switch\b|else\b)([A-Za-z_]\w*(?:\s*\*+)?)\s+([A-Za-z_]\w*)\s*\(([^;\n{}]*)\)\s*\{/gm;

type DgToCOptions = {
    prelude?: string;
    requireMainReturn?: boolean;
};


export const dgToC = (dg: string, options: DgToCOptions = {}): string => {
    const { prelude = "", requireMainReturn = true } = options;
    let c = `${headers}${macrosC}${prelude}${dg}`;

    c = c.replace(functionDefinitionPattern, (full, indent: string, exportKeyword: string | undefined, returnType: string, functionName: string, args: string) => {
        if (functionName === "main") return full;
        if (exportKeyword) return `${indent}${returnType} ${functionName}(${args}) {`;
        return `${indent}static ${returnType} ${functionName}(${args}) {`;
    });

    c = c.replace(
        /\bgprint\s*\(\s*"((?:\\.|[^"\\])*)"\s*,\s*([A-Za-z_]\w*)\s*\)/g,
        (full, fmt: string, arg: string) => {
            if (!fmt.includes("%b")) return full;

            const newFmt = fmt.replace(/%b/g, "%s");
            return `gprint("${newFmt}", boolToString(${arg}))`;
        }
    );

    c = c.replace(/gstatus/g, "int");
    c = c.replace(/gprint/g, "println");
   
    for (const dgType of Object.keys(intTypes)) {
        const bits = dgType.slice(1);
        c = c.replace(new RegExp(`%${dgType}(?=\\b)`, "g"), `%" PRId${bits} "`);
    }

    for (const dgType of Object.keys(uintTypes)) {
        const bits = dgType.slice(1);
        c = c.replace(new RegExp(`%${dgType}(?=\\b)`, "g"), `%" PRIu${bits} "`);
    }

    for (const [dgType, cType] of Object.entries(intTypes)) {
        c = c.replace(new RegExp(`\\b${dgType}\\b`, "g"), cType);
    }

    for (const [dgType, cType] of Object.entries(uintTypes)) {
        c = c.replace(new RegExp(`\\b${dgType}\\b`, "g"), cType);
    }

    c = c.replace(/str\[\]/g, "char**");

    c = c.replace(/str/g, "char*");


    if (requireMainReturn && !/return\s+(GSUCCESS|GERROR)\s*;?\s*}/.test(c)) { 
        throw new Error("Main function must return a gstatus (GSUCCESS or GERROR)");
    }
    c = c.replace(/GERROR/g, "EXIT_FAILURE");
    c = c.replace(/GSUCCESS/g, "EXIT_SUCCESS");
    return c;
}