-- =====================================================================
-- MATERIAL DA ATIVIDADE ligado à COMPRA: a situação vem da compra
--
-- POR QUE ISTO EXISTE
-- O gestor lista na Semana o material de que cada atividade precisa
-- (`ops_materials`) e marcava à mão "Pendente / Comprado / Na obra". A mesma
-- informação já existe em Compras (`project_purchases`), mantida por
-- suprimentos. Eram dois lugares para digitar a mesma coisa — e o da Semana
-- ficava para trás, justamente o que decide se a atividade está "pronta" e o
-- que alimenta o aviso de material na tela Hoje e no Painel. A coluna
-- `ops_materials.purchase_id` existia desde a criação da tabela, mas ninguém a
-- usava.
--
-- O QUE FAZ
--   1. `ops_material_status_from_purchase(status, local de entrega)`: a ÚNICA
--      tabela de conversão situação da compra → situação do material. O app
--      tem um espelho dela em `src/lib/opsMaterialPurchase.ts`, com teste que
--      trava as duas iguais — mudou aqui, mude lá.
--   2. Material COM compra vinculada: a situação é sempre a da compra. O que
--      for digitado à mão é ignorado enquanto houver vínculo. A compra tem de
--      ser da mesma obra do material.
--   3. Mudou a situação (ou o local de entrega) da compra: todo material
--      vinculado a ela acompanha, na mesma transação.
--   4. Desvincular, ou apagar a compra, deixa o material com a última situação
--      que tinha — e a partir daí ela volta a ser manual. O material nunca é
--      apagado junto com a compra.
--
-- A CONVERSÃO, E POR QUÊ
-- Lida das telas de Compras (src/pages/compras/types.ts, PurchasesTable,
-- DateLogsModal e Calendário de Compras):
--
--   Compra                               Material
--   -----------------------------------  ---------
--   pending            "Pendente"        pendente
--   awaiting_approval  "Solic. Aprovação" pendente
--   approved           "Aprovado"        pendente   (aprovado ainda não é comprado)
--   delayed            "Atrasado"        pendente   (só o Calendário usa; não diz
--                                                    se já foi comprado — fica no
--                                                    lado seguro)
--   cancelled          "Cancelado"       pendente   (o material continua
--                                                    faltando; a Semana avisa
--                                                    "Compra cancelada")
--   purchased          "Compra Realizada" comprado
--   ordered            "Pedido"          comprado
--   in_transit         "Em Trânsito"     comprado
--   delivered          "Entregue"        na_obra — MENOS quando o local de
--                                        entrega é o estoque ou o escritório:
--                                        aí é comprado
--   sent_to_site       "Enviado p/ Obra" na_obra
--   (qualquer outro valor)               pendente
--
-- "Entregue" não quer dizer sempre "na obra": a compra tem
-- `delivery_location` ('obra' | 'estoque' | 'escritorio' | 'retirada') e, para
-- o que vai ao estoque, um passo a mais — "Enviado p/ Obra", com data de
-- entrada e de saída do estoque. Entregue no estoque ou no escritório da Bwild
-- ainda não está na obra: o material fica "comprado" até a compra virar
-- "Enviado p/ Obra". Entregue na obra, por retirada ou sem local informado (o
-- caso comum: a data pedida na compra é a "Data Necessária na Obra") conta
-- como na obra. "Enviado p/ Obra" é o último passo que Compras registra — não
-- existe "recebido na obra" —, então vale como na obra.
-- Errar para "na obra" é o erro caro (a atividade aparece pronta sem o
-- material); na dúvida a conversão fica em pendente/comprado, que continuam
-- contando como material faltando.
--
-- SEGURANÇA
-- `ops_materials` e `project_purchases` têm a mesma regra: equipe com acesso
-- à obra. O gatilho do material roda com os direitos de quem grava (só lê a
-- compra que a pessoa já enxerga). O gatilho da compra é SECURITY DEFINER
-- porque quem muda a compra (suprimentos, financeiro…) não precisa de nenhum
-- direito sobre a camada de operação para o material acompanhar; ele só
-- atualiza os materiais vinculados àquela compra, nada mais.
--
-- O QUE NÃO MUDA
-- `v_ops_activities` (materials_on_site / materials_missing / is_ready),
-- `v_stage_rollup` e a leitura do Painel continuam contando
-- `ops_materials.status = 'na_obra'` — agora derivado. Nenhuma alteração
-- nelas. Sem carga de dados. Idempotente.
-- =====================================================================

-- 1) A conversão, num lugar só -----------------------------------------
CREATE OR REPLACE FUNCTION public.ops_material_status_from_purchase(
  p_status text,
  p_delivery_location text DEFAULT NULL
)
RETURNS public.ops_material_status
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status = 'sent_to_site' THEN 'na_obra'::public.ops_material_status
    WHEN p_status = 'delivered' THEN
      CASE
        WHEN p_delivery_location IN ('estoque', 'escritorio') THEN 'comprado'::public.ops_material_status
        ELSE 'na_obra'::public.ops_material_status
      END
    WHEN p_status IN ('purchased', 'ordered', 'in_transit') THEN 'comprado'::public.ops_material_status
    ELSE 'pendente'::public.ops_material_status
  END
$$;

REVOKE ALL ON FUNCTION public.ops_material_status_from_purchase(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_material_status_from_purchase(text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.ops_material_status_from_purchase(text, text) IS
  'Situação do material (ops_materials.status) a partir da situação e do local de entrega da compra vinculada. Espelhada em src/lib/opsMaterialPurchase.ts.';

-- 2) Apagar a compra não apaga o material -------------------------------
-- A FK já nasceu ON DELETE SET NULL (20261011150000_ops_layer.sql). Aqui só
-- garantimos: se em algum banco ela estiver diferente (ou faltando), fica
-- SET NULL.
DO $$
DECLARE
  v_name text;
  v_on_delete "char";
BEGIN
  SELECT c.conname, c.confdeltype
    INTO v_name, v_on_delete
    FROM pg_constraint c
   WHERE c.conrelid = 'public.ops_materials'::regclass
     AND c.confrelid = 'public.project_purchases'::regclass
     AND c.contype = 'f'
     AND c.conkey = ARRAY[(
           SELECT a.attnum FROM pg_attribute a
            WHERE a.attrelid = 'public.ops_materials'::regclass AND a.attname = 'purchase_id'
         )]
   LIMIT 1;

  IF v_name IS NOT NULL AND v_on_delete = 'n' THEN
    RETURN; -- já é SET NULL
  END IF;

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ops_materials DROP CONSTRAINT %I', v_name);
  END IF;
  ALTER TABLE public.ops_materials
    ADD CONSTRAINT ops_materials_purchase_id_fkey
    FOREIGN KEY (purchase_id) REFERENCES public.project_purchases(id) ON DELETE SET NULL;
END $$;

-- 3) Material: com compra vinculada, a situação é a da compra ------------
-- Roda com os direitos de quem grava: a compra é lida pelas mesmas policies
-- que a pessoa já tem em Compras. Compra que ela não enxerga é, para ela,
-- compra que não existe.
CREATE OR REPLACE FUNCTION public.ops_materials_sync_purchase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_material_project uuid;
  v_purchase_project uuid;
  v_status           text;
  v_location         text;
BEGIN
  -- A obra do material é sempre a da atividade. O gatilho que copia
  -- project_id só roda quando activity_id muda; sem isto, um UPDATE direto em
  -- project_id deixaria o material "em outra obra" (e fora da regra de acesso
  -- certa) — e escaparia da conferência de obra da compra, logo abaixo.
  SELECT a.project_id INTO v_material_project
    FROM public.ops_activities a
   WHERE a.id = NEW.activity_id;
  IF v_material_project IS NOT NULL THEN
    NEW.project_id := v_material_project;
  END IF;

  -- Sem vínculo (ou desvinculado nesta gravação — inclusive quando a compra é
  -- apagada e a FK zera a coluna): a situação é manual e fica como veio.
  IF NEW.purchase_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.purchase_id IS DISTINCT FROM OLD.purchase_id
     OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
     OR NEW.project_id  IS DISTINCT FROM OLD.project_id THEN
    -- Vínculo novo (ou material mudando de lugar): confere a obra.
    -- FOR SHARE segura a compra até o fim desta transação: se alguém estiver
    -- mudando a situação dela agora, um espera o outro — sem isto o material
    -- podia nascer com a situação antiga e não ser alcançado pela propagação
    -- (que ainda não o enxergava como vinculado).
    SELECT p.project_id, p.status, p.delivery_location
      INTO v_purchase_project, v_status, v_location
      FROM public.project_purchases p
     WHERE p.id = NEW.purchase_id
       FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Compra não encontrada' USING ERRCODE = '23514';
    END IF;

    -- A obra do material (já acertada acima pela atividade) tem de ser a da compra.
    IF v_purchase_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'A compra vinculada é de outra obra' USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Vínculo que já existia: só relê a situação. Sem travar a compra — quem
    -- muda a compra atualiza este material logo em seguida, e travar aqui
    -- faria as duas gravações esperarem uma pela outra.
    SELECT p.status, p.delivery_location
      INTO v_status, v_location
      FROM public.project_purchases p
     WHERE p.id = NEW.purchase_id;

    IF NOT FOUND THEN
      -- Não deveria acontecer (mesma regra de acesso nas duas tabelas). Sem a
      -- compra não há de onde derivar: mantém a situação que estava gravada.
      NEW.status := OLD.status;
      RETURN NEW;
    END IF;
  END IF;

  -- O que veio digitado em `status` é ignorado enquanto houver vínculo.
  NEW.status := public.ops_material_status_from_purchase(v_status, v_location);
  RETURN NEW;
END $$;

-- O nome ordena DEPOIS de ops_materials_set_project_trg (gatilhos BEFORE
-- rodam em ordem alfabética): quando este roda, project_id já foi preenchido.
DROP TRIGGER IF EXISTS ops_materials_sync_purchase_trg ON public.ops_materials;
CREATE TRIGGER ops_materials_sync_purchase_trg
  BEFORE INSERT OR UPDATE ON public.ops_materials
  FOR EACH ROW EXECUTE FUNCTION public.ops_materials_sync_purchase();

-- 4) Compra: mudou a situação, os materiais vinculados acompanham --------
-- SECURITY DEFINER: quem atualiza a compra não precisa de direito nenhum
-- sobre ops_materials. A função só toca nos materiais vinculados A ESTA
-- compra — não lê nem devolve nada a quem chamou.
CREATE OR REPLACE FUNCTION public.project_purchases_sync_ops_materials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.ops_material_status;
BEGIN
  -- Compra levada para outra obra: o vínculo deixa de valer (material e
  -- compra têm de ser da mesma obra). O material fica com a situação que
  -- tinha, como em qualquer desvínculo.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    UPDATE public.ops_materials
       SET purchase_id = NULL
     WHERE purchase_id = NEW.id
       AND project_id IS DISTINCT FROM NEW.project_id;
  END IF;

  v_status := public.ops_material_status_from_purchase(NEW.status, NEW.delivery_location);

  -- Só grava onde a situação muda de fato (não mexe em updated_at à toa).
  UPDATE public.ops_materials
     SET status = v_status
   WHERE purchase_id = NEW.id
     AND status IS DISTINCT FROM v_status;

  RETURN NULL; -- AFTER: o retorno é ignorado.
END $$;

REVOKE ALL ON FUNCTION public.project_purchases_sync_ops_materials() FROM PUBLIC, anon, authenticated;

-- Sem lista de colunas de propósito: o WHEN pega a mudança mesmo quando ela
-- vem de outro gatilho, e não só quando a coluna está no SET do UPDATE.
DROP TRIGGER IF EXISTS trg_project_purchases_sync_ops_materials ON public.project_purchases;
CREATE TRIGGER trg_project_purchases_sync_ops_materials
  AFTER UPDATE ON public.project_purchases
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        OR OLD.delivery_location IS DISTINCT FROM NEW.delivery_location
        OR OLD.project_id IS DISTINCT FROM NEW.project_id)
  EXECUTE FUNCTION public.project_purchases_sync_ops_materials();

-- 5) Documentação das colunas -------------------------------------------
COMMENT ON COLUMN public.ops_materials.purchase_id IS
  'Compra (project_purchases) que atende este material — sempre da mesma obra. Com vínculo, status é derivado da compra. Apagar a compra zera esta coluna e mantém o material.';
COMMENT ON COLUMN public.ops_materials.status IS
  'pendente | comprado | na_obra. Manual quando purchase_id é NULL; com compra vinculada é sempre ops_material_status_from_purchase(compra.status, compra.delivery_location).';
