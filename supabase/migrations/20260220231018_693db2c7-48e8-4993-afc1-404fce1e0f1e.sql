
CREATE OR REPLACE FUNCTION public.initialize_project_journey(p_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_name TEXT;
  v_default_description TEXT;
BEGIN
  -- Get project name
  SELECT name INTO v_project_name FROM projects WHERE id = p_project_id;

  -- Insert hero if not exists
  INSERT INTO journey_hero (project_id, title, subtitle, badge_text)
  VALUES (
    p_project_id,
    'Sua jornada com a Bwild começou!',
    'Acompanhe aqui cada etapa do desenvolvimento do seu projeto. Sempre que houver novidades ou ações necessárias, você será notificado.',
    'Fase de Projeto'
  )
  ON CONFLICT (project_id) DO NOTHING;

  -- Insert CSM if not exists
  INSERT INTO journey_csm (project_id)
  VALUES (p_project_id)
  ON CONFLICT (project_id) DO NOTHING;

  -- Insert footer if not exists
  INSERT INTO journey_footer (project_id, text)
  VALUES (
    p_project_id,
    'Estamos aqui para transformar seu espaço em algo único. Qualquer dúvida, entre em contato com nossa equipe!'
  )
  ON CONFLICT (project_id) DO NOTHING;

  -- Insert default stages if none exist
  IF NOT EXISTS (SELECT 1 FROM journey_stages WHERE project_id = p_project_id) THEN
    INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description) VALUES
    (p_project_id, 1, 'Briefing de Arquitetura', 'clipboard-list', 'in_progress', 'Reunião inicial para entender suas necessidades e preferências.'),
    (p_project_id, 2, 'Projeto 3D', 'cube', 'pending', 'Desenvolvimento da proposta visual em 3D.'),
    (p_project_id, 3, 'Medição Técnica', 'ruler', 'pending', 'Visita técnica para medições precisas do espaço.'),
    (p_project_id, 4, 'Projeto Executivo', 'file-text', 'pending', 'Detalhamento técnico para execução da obra.'),
    (p_project_id, 5, 'Aprovações', 'check-circle', 'pending', 'Aprovação dos projetos e orçamentos.'),
    (p_project_id, 6, 'Liberação', 'building', 'pending', 'Liberação da obra junto ao condomínio.');
  END IF;

  -- Insert default team member (Lorena Alves) if none exist
  IF NOT EXISTS (SELECT 1 FROM journey_team_members WHERE project_id = p_project_id) THEN
    v_default_description := '<p>Lorena é a mente criativa e estratégica por trás de projetos que não apenas transformam espaços, mas aumentam valor, performance e experiência de ambientes.</p>'
      || '<p>Com formação e especializações em instituições de prestígio — <strong>Polo.Design (Milão), USP, FGV e UFU</strong> — Lorena une repertório internacional e solidez técnica.</p>'
      || '<p>São mais de 16 anos de experiência em projetar, com uma marca muito clara: enxergar potencial onde muitos veem apenas metragem.</p>'
      || '<p><strong>Ela é responsável por:</strong><br>'
      || '• Definir as diretrizes arquitetônicas do seu projeto e assegurar excelência estética e técnica<br>'
      || '• Traduzir suas necessidades em soluções inteligentes, funcionais e com alto impacto visual<br>'
      || '• Liderar o time de arquitetura e garantir alinhamento com engenharia, fornecedores e execução<br>'
      || '• Garantir consistência do conceito do 3D ao executivo, com foco em viabilidade, prazos e orçamento<br>'
      || '• Cuidar da qualidade final das escolhas (layout, materiais, detalhes e acabamentos), para maximizar resultado e durabilidade</p>'
      || '<p>Na prática, Lorena é a guardiã do conceito e do valor do seu projeto dentro da Bwild — alguém que conduz decisões arquitetônicas com visão, critério e liderança, para que cada etapa gere um resultado à altura do que você imaginou (e, muitas vezes, acima disso).</p>';

    INSERT INTO journey_team_members (project_id, display_name, role_title, description, email, phone, photo_url, sort_order)
    VALUES (
      p_project_id,
      'Lorena Alves',
      'Head de Arquitetura (Sócia)',
      v_default_description,
      'lorena@bwild.com.br',
      '11964158215',
      'https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/project-documents/team-photos/defaults/lorena-alves.png',
      0
    );
  END IF;
END;
$function$;
