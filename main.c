
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <inttypes.h>

#define println(...) do {     printf(__VA_ARGS__);     printf("\n"); } while(0);

#define boolToString(b) ((b) ? "true" : "false")
int8_t somar(int8_t n1, int8_t n2);

int main() {
    // inteiro com sinal 8bit
    int8_t int8 = 127;

    // inteiro com sinal 16bit
    int16_t value = 1000;
    if (value < 1000) {
        println("Encerrando com codigo %d", EXIT_FAILURE);
        return EXIT_FAILURE;
    }

    // função de print
    println("Inteiro 8 bits: %" PRId8 " algo", int8);
    println("Inteiro 16 bits: %" PRId16 " algo", value);

    // tipo char*ing
    char* texto = "Numero %" PRIu64 " é 64bit sem sinal";
    
    // inteiro sem sinal 64bit
    uint64_t numero = 213124380235;

    println(texto, numero);

    // booleano e print do booleano
    bool match = true;
    println("o valor deu match: %s", boolToString(match));

    println("Valor da soma 2+2: %" PRId8 "", somar(2, 2));

    println("Encerrando com codigo %d", EXIT_SUCCESS);
    return EXIT_SUCCESS;
}