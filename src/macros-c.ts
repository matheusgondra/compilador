const printlnMacro = `
#define println(...) do { \
    printf(__VA_ARGS__); \
    printf("\\n"); \
} while(0);
`;

const boolToStringMacro = `
#define boolToString(b) ((b) ? "true" : "false")
`;

const macros = [printlnMacro, boolToStringMacro];

export const macrosC = macros.join("");