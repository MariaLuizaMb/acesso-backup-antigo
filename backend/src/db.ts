import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida no .env");
}

// Pool de conexões reutilizáveis com o Postgres (Supabase).
// Usar um Pool (em vez de conexões avulsas) é importante para não esgotar
// o limite de conexões simultâneas do plano gratuito do Supabase.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool de conexões do Postgres:", err);
});
