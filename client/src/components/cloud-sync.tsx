import { Cloud, Download, Upload, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CloudSync() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/sync/export");
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mediavault-sync-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast({ title: "Backup Created", description: "Your library has been exported successfully." });
    } catch (err) {
      toast({ title: "Export Failed", description: "Could not create backup file.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const res = await apiRequest("POST", "/api/sync/import", data);
      const result = await res.json();
      
      toast({ title: "Sync Complete", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
    } catch (err) {
      toast({ title: "Import Failed", description: "Invalid backup file format.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="mt-8 glass shimmer-border rounded-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.05) 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
            <Cloud size={16} className="text-blue-400" />
          </div>
          <h3 className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Cloud Sync
          </h3>
        </div>
      </div>

      <div className="p-6">
        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          Keep your media library in sync across devices. Export your data to a JSON backup or import an existing library state.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Backup Library
          </button>
          
          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20">
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import Library
            <input type="file" accept=".json" className="hidden" onChange={handleImport} disabled={isImporting} />
          </label>
        </div>
      </div>
    </div>
  );
}
