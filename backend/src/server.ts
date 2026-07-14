import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { authRouter, exigirAutenticacao } from "./auth";
import { tabelasRouter } from "./tabelas";
import { atualizarCacheDeTabelas } from "./schema";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

// Rota de login é pública
app.use("/api", authRouter);

// A partir daqui, todas as rotas exigem token válido
app.use("/api/tabelas", exigirAutenticacao, tabelasRouter);

// Permite forçar a releitura do cache de tabelas (por exemplo, depois de rodar
// o script de migração de novo e adicionar dados a uma tabela que antes estava vazia)
app.post(
  "/api/admin/atualizar-cache",
  exigirAutenticacao,
  async (_req, res) => {
    await atualizarCacheDeTabelas();
    res.json({ ok: true });
  },
);

app.get("/api/saude", (_req, res) => {
  res.json({ status: "ok" });
});

async function iniciar() {
  await atualizarCacheDeTabelas();
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

iniciar().catch((erro) => {
  console.error("Erro ao iniciar o servidor:", erro);
  process.exit(1);
});
