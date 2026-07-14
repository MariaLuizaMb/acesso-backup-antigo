import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ??
  "12h") as SignOptions["expiresIn"];
const APP_USER = process.env.APP_USER;
const APP_PASSWORD_HASH = process.env.APP_PASSWORD_HASH;

if (!JWT_SECRET || !APP_USER || !APP_PASSWORD_HASH) {
  throw new Error(
    "Configure JWT_SECRET, APP_USER e APP_PASSWORD_HASH no .env antes de iniciar o servidor.",
  );
}

export const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response) => {
  const { usuario, senha } = req.body as { usuario?: string; senha?: string };

  if (!usuario || !senha) {
    return res.status(400).json({ erro: "Informe usuário e senha." });
  }

  if (usuario !== APP_USER) {
    // Resposta genérica de propósito, para não revelar se o usuário existe ou não.
    return res.status(401).json({ erro: "Usuário ou senha inválidos." });
  }

  const senhaValida = await bcrypt.compare(senha, APP_PASSWORD_HASH as string);
  if (!senhaValida) {
    return res.status(401).json({ erro: "Usuário ou senha inválidos." });
  }

  const token = jwt.sign({ usuario }, JWT_SECRET!, {
    expiresIn: JWT_EXPIRES_IN,
  });

  res.json({ token });
});

// Middleware que protege as rotas de dados: exige um token válido no header
// Authorization: Bearer <token>
export function exigirAutenticacao(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const cabecalho = req.headers.authorization;

  if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token de autenticação ausente." });
  }

  const token = cabecalho.slice("Bearer ".length);

  try {
    jwt.verify(token, JWT_SECRET as string);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}
