
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <inttypes.h>

#define println(...) do {     printf(__VA_ARGS__);     printf("\n"); } while(0);

#define boolToString(b) ((b) ? "true" : "false")
static int8_t fazsoma(int8_t n1, int8_t n2) {
    return n1 + n2;
}

int8_t somar(int8_t n1, int8_t n2) {
    return fazsoma(n1, n2);
}