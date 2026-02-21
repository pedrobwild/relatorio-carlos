import { test, expect } from './fixtures/auth';

/**
 * Regressão: "Solicitar revisão" no Projeto 3D não pode travar a UI (tela preta)
 *
 * Bug original:
 * - AlertDialog abria "atrás" do overlay do Dialog principal (z-index menor),
 *   prendia foco/inert e o app parecia travado.
 *
 * Fix aplicado:
 * - Confirmação agora é inline (dentro da lista de versões), sem AlertDialog aninhado.
 *
 * Este teste garante que:
 * - Ao clicar "Solicitar revisão", o confirm inline abre
 * - É possível clicar "Cancelar" (não está coberto por overlay)
 * - O modal principal continua utilizável
 */

test.describe('Projeto 3D — Solicitar revisão não trava', () => {
  test('cliente consegue abrir confirm e clicar Cancelar', async ({ customerPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip(true, 'TEST_PROJECT_ID not set');
      return;
    }

    await customerPage.goto(`/obra/${testProjectId}/jornada`);
    await customerPage.waitForLoadState('networkidle');

    // Navegar para a etapa "Projeto 3D" na timeline (se disponível)
    const projeto3dBtn = customerPage.getByRole('button', { name: /projeto 3d/i }).first();
    const hasProjeto3d = await projeto3dBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasProjeto3d) {
      test.skip(true, 'Etapa "Projeto 3D" não encontrada na jornada');
      return;
    }

    await projeto3dBtn.scrollIntoViewIfNeeded();
    await projeto3dBtn.click();

    // Card de versões do 3D deve aparecer quando a etapa está aberta
    const versoesHeading = customerPage.getByRole('heading', { name: /versões do projeto 3d/i }).first();
    const stageOpened = await versoesHeading.isVisible({ timeout: 8000 }).catch(() => false);
    if (!stageOpened) {
      test.skip(true, 'Etapa "Projeto 3D" não abriu (pode estar bloqueada para o cliente)');
      return;
    }

    // Abrir o modal de versões (para cliente, o botão costuma ser "Visualizar")
    const visualizarBtn = customerPage.getByRole('button', { name: /visualizar|gerenciar/i }).first();
    await visualizarBtn.click();

    // Modal principal de versões
    await expect(customerPage.getByText(/versões do projeto 3d/i).first()).toBeVisible({ timeout: 10000 });

    // Se não tiver versões, não dá pra solicitar revisão -> skip (ambiente pode não ter seed)
    const emptyState = customerPage.getByText(/nenhuma versão cadastrada/i).first();
    if (await emptyState.isVisible({ timeout: 1500 }).catch(() => false)) {
      test.skip(true, 'Ambiente sem versões 3D cadastradas para testar "Solicitar revisão"');
      return;
    }

    // Botão "Solicitar revisão" (aparece somente para cliente e somente se ainda não solicitado)
    const solicitarBtn = customerPage.getByRole('button', { name: /solicitar revis/i }).first();
    const hasSolicitar = await solicitarBtn.isVisible({ timeout: 4000 }).catch(() => false);
    if (!hasSolicitar) {
      test.skip(true, 'Nenhuma versão disponível com botão "Solicitar revisão" (talvez já esteja solicitada)');
      return;
    }

    await solicitarBtn.click();

    // Confirmação inline (não é AlertDialog — é um div dentro da lista de versões)
    const confirmPanel = customerPage.getByText(/você já fez todos os apontamentos/i).first();
    await expect(confirmPanel).toBeVisible({ timeout: 5000 });

    // A asserção que pega o bug: conseguir clicar "Cancelar" (não pode estar coberto por overlay)
    const cancelarBtn = customerPage.getByRole('button', { name: /^cancelar$/i });
    await cancelarBtn.click();

    // Painel de confirm fecha e o modal principal continua utilizável
    await expect(confirmPanel).toBeHidden({ timeout: 5000 });

    // Garante que ainda dá para interagir com o modal principal (ex: abrir carrossel)
    const abrirBtn = customerPage.getByRole('button', { name: /abrir/i }).first();
    const canOpenCarousel = await abrirBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (canOpenCarousel) {
      await abrirBtn.click();
      // O carrossel/modal grande deve abrir (título varia; checamos presença de algo típico)
      const carouselHint = customerPage.getByText(/imagem\s+\d+\/\d+/i).first();
      // Se não existir indicador, não falha o teste — só garante que não travou
      await carouselHint.isVisible({ timeout: 3000 }).catch(() => true);
      // Fechar com ESC para não bloquear o restante do teste
      await customerPage.keyboard.press('Escape');
    }

    // Fechar modal principal também
    await customerPage.keyboard.press('Escape');
    await customerPage.waitForTimeout(300);
  });
});
