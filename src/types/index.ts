export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface FileInfo {
  id: string;
  name: string;
  url: string;
  analysis: AnalysisResult | string;
  uploadDate: string;
  size: string;
  uploadProgress: number;
  status: 'uploading' | 'analyzing' | 'completed' | 'failed';
}

export interface Keyword {
  word: string;
  explanation: string;
}

export interface AnalysisResult {
  summary: string;
  keywords: Keyword[];
  categories: string[];
  tags: string[];
  keyInsights: string[];
  toneAndStyle: string;
  targetAudience: string;
  potentialApplications: string[];
}
