import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const DOCUMENT_CATEGORIES = {
  contrato: { label: 'Contrato', icon: 'FileText' },
  aditivo: { label: 'Aditivos', icon: 'FilePlus' },
  projeto_3d: { label: 'Projeto 3D', icon: 'Box' },
  executivo: { label: 'Projeto Executivo', icon: 'Ruler' },
  art_rrt: { label: 'ART/RRT', icon: 'Award' },
  plano_reforma: { label: 'Plano de Reforma', icon: 'ClipboardList' },
  nota_fiscal: { label: 'Notas Fiscais', icon: 'Receipt' },
  garantia: { label: 'Garantias', icon: 'Shield' },
  as_built: { label: 'As Built', icon: 'Building' },
  termo_entrega: { label: 'Termo de Entrega', icon: 'CheckSquare' },
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;
export type DocumentStatus = 'pending' | 'approved';

export interface ProjectDocument {
  id: string;
  project_id: string;
  document_type: DocumentCategory;
  name: string;
  description: string | null;
  storage_path: string;
  storage_bucket: string;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  status: DocumentStatus;
  uploaded_by: string;
  approved_at: string | null;
  approved_by: string | null;
  parent_document_id: string | null;
  created_at: string;
  url?: string;
}

export function useDocuments(projectId: string | undefined) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !user) {
      setLoading(false);
      return;
    }

    async function fetchDocuments() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('project_documents')
          .select('*')
          .eq('project_id', projectId)
          .order('document_type')
          .order('version', { ascending: false });

        if (fetchError) throw fetchError;

        // Get signed URLs for each document
        const docsWithUrls = await Promise.all(
          (data || []).map(async (doc) => {
            const { data: urlData } = await supabase.storage
              .from(doc.storage_bucket)
              .createSignedUrl(doc.storage_path, 3600); // 1 hour

            return {
              ...doc,
              document_type: doc.document_type as DocumentCategory,
              status: doc.status as DocumentStatus,
              url: urlData?.signedUrl || null,
            } as ProjectDocument;
          })
        );

        setDocuments(docsWithUrls);
      } catch (err: any) {
        console.error('Error fetching documents:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [projectId, user]);

  const getDocumentsByCategory = (category: DocumentCategory) => {
    return documents.filter(doc => doc.document_type === category);
  };

  const getLatestByCategory = (category: DocumentCategory) => {
    const docs = getDocumentsByCategory(category);
    // Get the latest version of each unique document
    const latestDocs = docs.reduce((acc, doc) => {
      if (!doc.parent_document_id) {
        // This is a root document, check if we have a newer version
        const newerVersions = docs.filter(d => d.parent_document_id === doc.id);
        if (newerVersions.length > 0) {
          // Use the newest version
          const newest = newerVersions.sort((a, b) => b.version - a.version)[0];
          acc.push(newest);
        } else {
          acc.push(doc);
        }
      }
      return acc;
    }, [] as ProjectDocument[]);
    
    return latestDocs.length > 0 ? latestDocs : docs.filter(d => !d.parent_document_id);
  };

  const getVersionHistory = (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return [];
    
    const rootId = doc.parent_document_id || doc.id;
    return documents
      .filter(d => d.id === rootId || d.parent_document_id === rootId)
      .sort((a, b) => b.version - a.version);
  };

  return {
    documents,
    loading,
    error,
    getDocumentsByCategory,
    getLatestByCategory,
    getVersionHistory,
    refetch: () => {
      if (projectId && user) {
        setLoading(true);
      }
    }
  };
}
