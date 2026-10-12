/**
 * Copia texto para a área de transferência.
 *
 * Usa `navigator.clipboard` quando existe (HTTPS, navegador recente); senão,
 * o caminho antigo com um <textarea> escondido e `execCommand("copy")`, que
 * ainda funciona em navegadores de celular mais velhos e em WebViews.
 * Devolve false quando nenhum dos dois deu certo (a tela avisa a pessoa).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* sem permissão: tenta o caminho antigo */
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
