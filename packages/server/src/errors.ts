/** Erro com status HTTP; as rotas convertem em resposta JSON. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = 'Entre na sua conta para continuar.') => new HttpError(401, m);
export const forbidden = (m = 'Você não tem permissão para isso.') => new HttpError(403, m);
export const notFound = (m = 'Não encontrado.') => new HttpError(404, m);
