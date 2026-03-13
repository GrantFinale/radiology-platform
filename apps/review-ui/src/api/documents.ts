import apiClient from './client';

export interface Document {
  id: string;
  orderId: string;
  fileName: string;
  mimeType: string;
  size: number;
  ocrText?: string;
  ocrConfidence?: number;
  nlpExtractions?: NlpExtraction[];
  uploadedAt: string;
}

export interface NlpExtraction {
  field: string;
  value: string;
  confidence: number;
  source: string;
}

export async function getDocuments(orderId: string): Promise<Document[]> {
  const { data } = await apiClient.get(`/api/documents`, { params: { orderId } });
  return data;
}

export async function getDocument(id: string): Promise<Document> {
  const { data } = await apiClient.get(`/api/documents/${id}`);
  return data;
}

export function getDocumentUrl(id: string): string {
  const token = localStorage.getItem('access_token');
  return `/api/documents/${id}/file?token=${token}`;
}

export async function getOcrResult(documentId: string): Promise<{ text: string; confidence: number; regions: unknown[] }> {
  const { data } = await apiClient.get(`/api/documents/${documentId}/ocr`);
  return data;
}

export async function getNlpExtractions(documentId: string): Promise<NlpExtraction[]> {
  const { data } = await apiClient.get(`/api/nlp/extractions`, { params: { documentId } });
  return data;
}
