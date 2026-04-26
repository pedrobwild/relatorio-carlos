import { useParams } from 'react-router-dom';

export function useProjectNavigation() {
  const { projectId } = useParams<{ projectId: string }>();

  const getProjectPath = (path: string) => {
    if (!projectId) return path;
    return `/obra/${projectId}${path}`;
  };

  return {
    projectId,
    getProjectPath,
    paths: {
      // Client home (list of obras). Used by CLIENT_NAV's "Início".
      clientHome: '/minhas-obras',
      // Staff home — `/gestao` redirects to `/gestao/painel-obras`. Used by STAFF_NAV's "Início".
      staffHome: '/gestao',
      // Staff obras index. Used by STAFF_NAV's "Obras".
      obrasIndex: '/gestao/painel-obras',
      // Staff activities. Used by STAFF_NAV's "Atividades".
      gestaoAtividades: '/gestao/atividades',
      // The Hub da Obra — landing page that aggregates next-action + section status.
      obraHub: getProjectPath('/hub'),
      // Project-scoped paths
      relatorio: getProjectPath('/relatorio'),
      contrato: getProjectPath('/contrato'),
      projeto3D: getProjectPath('/projeto-3d'),
      executivo: getProjectPath('/executivo'),
      financeiro: getProjectPath('/financeiro'),
      pendencias: getProjectPath('/pendencias'),
      documentos: getProjectPath('/documentos'),
      formalizacoes: getProjectPath('/formalizacoes'),
      formalizacoesNova: getProjectPath('/formalizacoes/nova'),
      cronograma: getProjectPath('/cronograma'),
      compras: getProjectPath('/compras'),
      comprasProdutos: getProjectPath('/compras/produtos'),
      comprasPrestadores: getProjectPath('/compras/prestadores'),
      vistorias: getProjectPath('/vistorias'),
      jornada: getProjectPath('/jornada'),
      dadosCliente: getProjectPath('/dados-cliente'),
      atividades: getProjectPath('/atividades'),
      naoConformidades: getProjectPath('/nao-conformidades'),
      orcamento: getProjectPath('/orcamento'),
    }
  };
}
