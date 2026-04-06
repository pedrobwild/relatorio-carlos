import { Navigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';

export default function Compras() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/obra/${projectId}/compras/produtos`} replace />;
}
