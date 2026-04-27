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
      estoque: getProjectPath('/estoque'),
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
