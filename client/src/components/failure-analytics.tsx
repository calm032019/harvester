import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FailureData {
  error: string;
  count: number;
}

export default function FailureAnalytics() {
  const { data: analytics = [], isLoading } = useQuery<FailureData[]>({
    queryKey: ["/api/analytics/failures"],
    refetchInterval: 10000,
  });

  if (isLoading || analytics.length === 0) return null;

  return (
    <div className="mt-8 glass shimmer-border rounded-2xl overflow-hidden mb-6">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
            <BarChart3 size={16} className="text-amber-500" />
          </div>
          <h3 className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            Error Distribution
          </h3>
        </div>
        <div className="flex items-center gap-1.5 opacity-40">
          <Info size={12} className="text-white" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-white">Top issues</span>
        </div>
      </div>

      <div className="p-6">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.slice(0, 5)} layout="vertical" margin={{ left: -20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="error" 
                type="category" 
                width={120} 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ 
                  background: 'rgba(15,15,20,0.95)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '11px'
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {analytics.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsla(${30 + (index * 20)}, 80%, 60%, 0.8)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 space-y-2">
          {analytics.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-500/10">
                <AlertTriangle size={12} className="text-amber-500" />
              </div>
              <p className="text-[11px] text-white/70 flex-1 truncate">{item.error}</p>
              <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
