import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Download, DownloadForm } from "@shared/schema";

export function useDownloads() {
  return useQuery<Download[]>({
    queryKey: ["/api/downloads"],
    refetchInterval: 2000,
  });
}

export function useCreateDownload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: DownloadForm) => {
      const response = await apiRequest("POST", "/api/downloads", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
    },
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: async (downloadId: number) => {
      const response = await fetch(`/api/downloads/${downloadId}/file`);
      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      const fileName = contentDisposition?.match(/filename="([^"]+)"/)?.[1] || 'download';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}

export function useClearCompleted() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/downloads/completed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
    },
  });
}
