import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

/**
 * Invariante: UMA obra tem NO MÁXIMO UM gestor.
 *
 * O gestor mora em `projects.painel_responsavel_id` — coluna única, então
 * um segundo gestor é impossível por construção. O caminho perigoso seria
 * modelar gestor como linha em `project_members`, que é N-para-N: em
 * produção há obras com 19 linhas `role = 'owner'`, justamente porque essa
 * tabela é o mecanismo de ACESSO (RLS), não de responsabilidade.
 *
 * Estes testes travam a escolha: todo ponto que cadastra gestor escreve a
 * coluna única, e nenhum deles cria linha de membro para isso.
 */
describe("gestor da obra — um por obra", () => {
  const escritas: { arquivo: string; fonte: string }[] = [
    { arquivo: "página da obra", fonte: read("../editar-obra/useEditarObraData.ts") },
    { arquivo: "cadastro de obra", fonte: read("../nova-obra/useNovaObraSubmit.ts") },
    { arquivo: "wizard de edição", fonte: read("../EditarObraWizard.tsx") },
  ];

  it("todo caminho de cadastro grava a coluna única painel_responsavel_id", () => {
    for (const { arquivo, fonte } of escritas) {
      expect(fonte, `${arquivo} não grava o gestor`).toMatch(
        /painel_responsavel_id:/,
      );
    }
  });

  it("nenhum caminho de cadastro de gestor cria linha em project_members", () => {
    for (const { arquivo, fonte } of escritas) {
      // Recorta as linhas que mencionam o gestor e confere que nenhuma delas
      // está inserindo membro — o que abriria espaço para um segundo dono.
      const linhasDoGestor = fonte
        .split("\n")
        .filter((l) => l.includes("painel_responsavel_id"));
      expect(linhasDoGestor.length, `${arquivo}`).toBeGreaterThan(0);
      for (const linha of linhasDoGestor) {
        expect(linha, `${arquivo}: gestor virou membro`).not.toMatch(
          /project_members/,
        );
      }
    }
  });

  it("o seletor da página da obra escreve um valor escalar, nunca uma lista", () => {
    const tabGeral = read("../editar-obra/TabGeral.tsx");
    // Um <Select> simples: sem `multiple`, sem array no onValueChange.
    const bloco = tabGeral.slice(
      tabGeral.indexOf("Gestor da obra"),
      tabGeral.indexOf("Condomínio *"),
    );
    expect(bloco).toContain('onProjectChange(');
    expect(bloco).toContain("painel_responsavel_id");
    expect(bloco).not.toMatch(/multiple/);
    expect(bloco).not.toMatch(/\bpush\(/);
  });

  it("vazio no seletor limpa o vínculo (null), não grava string vazia", () => {
    const dados = read("../editar-obra/useEditarObraData.ts");
    expect(dados).toMatch(/painel_responsavel_id: project\.painel_responsavel_id \|\| null/);
    const submit = read("../nova-obra/useNovaObraSubmit.ts");
    expect(submit).toMatch(/painel_responsavel_id: formData\.painel_responsavel_id \|\| null/);
  });

  it("a aba Equipe não chama nível de acesso de 'Responsável'", () => {
    const equipe = read("../editar-obra/TabEquipe.tsx");
    // `role: owner` admite várias pessoas; chamá-lo de "Responsável" fazia
    // parecer que dava para cadastrar um segundo responsável por ali.
    const bloco = equipe.slice(
      equipe.indexOf("owner: {"),
      equipe.indexOf("engineer: {"),
    );
    expect(bloco).not.toMatch(/label: "Responsável"/);
    expect(bloco).toMatch(/label: "Acesso total"/);
  });

  it("o wizard de edição carrega o gestor atual antes de salvar", () => {
    // Sem isto o formulário abriria vazio e o save apagaria o gestor.
    const loader = read("../nova-obra/useEditProjectLoader.ts");
    expect(loader).toMatch(/painel_responsavel_id/);
  });

  it("a escrita direta do seletor também é escalar e não toca project_members", () => {
    const repo = read("../../infra/repositories/projects.repository.ts");
    const bloco = repo.slice(
      repo.indexOf("export async function setGestorObra"),
      repo.indexOf("Permanently delete a soft-deleted project"),
    );
    expect(bloco).toMatch(/painel_responsavel_id: gestorId/);
    expect(bloco).toMatch(/gestorId: string \| null/);
    expect(bloco).not.toMatch(/project_members/);
    expect(bloco).not.toMatch(/\binsert\(/);
  });
});

/**
 * Regressão do dia 08/09: o campo tinha sido colocado só em /gestao/obra/:id
 * e no wizard de nova obra — telas de cadastro que o time não abre. Da página
 * da obra (/obra/:id), que é onde eles trabalham, o gestor "não aparecia em
 * lugar nenhum". Estes testes travam a presença do controle nas telas de uso.
 */
describe("gestor da obra — visível onde o time trabalha", () => {
  const telas: { arquivo: string; fonte: string }[] = [
    { arquivo: "cockpit da obra (/obra/:id)", fonte: read("../Index.tsx") },
    {
      arquivo: "cabeçalho de todas as páginas da obra",
      fonte: read("../../components/layout/ProjectSlimHeader.tsx"),
    },
    {
      arquivo: "drawer do Painel de Obras",
      fonte: read("../../components/gestao/painel/ObraDetailSheet.tsx"),
    },
  ];

  it("cada tela de uso monta o seletor de gestor", () => {
    for (const { arquivo, fonte } of telas) {
      expect(fonte, `${arquivo} não importa o seletor`).toMatch(
        /import \{ GestorObraSelect \} from "@\/components\/obra\/GestorObraSelect"/,
      );
      expect(fonte, `${arquivo} não renderiza o seletor`).toMatch(
        /<GestorObraSelect/,
      );
    }
  });

  it("cada tela passa o valor atual do gestor, não um placeholder", () => {
    for (const { arquivo, fonte } of telas) {
      expect(fonte, `${arquivo} não passa gestorId`).toMatch(
        /gestorId=\{[^}]*(painel_responsavel_id|responsavel_id)/,
      );
    }
  });

  it("o seletor só aparece para staff", () => {
    const seletor = read("../../components/obra/GestorObraSelect.tsx");
    expect(seletor).toMatch(/if \(roleLoading \|\| !isStaff\) return null;/);
  });
});
