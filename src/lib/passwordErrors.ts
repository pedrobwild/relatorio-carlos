/** Traduz o erro do Supabase ao salvar a nova senha. */
export function describeUpdatePasswordError(err: unknown): string {
  const e = (err ?? {}) as {
    code?: string;
    name?: string;
    message?: string;
    reasons?: string[];
  };
  const msg = (e.message ?? "").toLowerCase();

  if (e.code === "same_password" || msg.includes("different from the old")) {
    return "A nova senha precisa ser diferente da senha atual.";
  }
  if (e.code === "weak_password" || msg.includes("password should")) {
    const reasons = e.reasons ?? [];
    if (reasons.includes("pwned")) {
      return "Essa senha aparece em vazamentos conhecidos. Escolha outra senha.";
    }
    if (reasons.includes("characters")) {
      return "A senha precisa ter letras maiúsculas, minúsculas, números e símbolos.";
    }
    return "Senha fraca. Use pelo menos 8 caracteres misturando letras, números e símbolos.";
  }
  if (
    e.name === "AuthSessionMissingError" ||
    e.code === "session_not_found" ||
    e.code === "session_expired" ||
    msg.includes("expired") ||
    msg.includes("session missing")
  ) {
    return "O link expirou. Solicite um novo link de recuperação.";
  }
  return "Não foi possível atualizar a senha. Tente novamente.";
}
