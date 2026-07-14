/**
 * Script auxiliar: gera o hash bcrypt de uma senha, para colar no .env
 * como valor de APP_PASSWORD_HASH.
 *
 * Uso:
 *   npm run gerar-hash-senha -- MinhaSenhaSegura123
 */
import bcrypt from "bcrypt";

async function main() {
  const senha = process.argv[2];
  if (!senha) {
    console.error("Uso: npm run gerar-hash-senha -- <sua_senha>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(senha, 10);
  console.log("\nCole esta linha no seu .env:\n");
  console.log(`APP_PASSWORD_HASH=${hash}\n`);
}

main();
