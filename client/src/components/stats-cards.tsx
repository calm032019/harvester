import { useQuery } from "@tanstack/react-query";
import { Download, Clock, HardDrive } from "lucide-react";
import type { Stats } from "@shared/schema";

const statConfig = [
  {
    icon: Download,
    label: "Total Harvested",
    key: "totalDownloads" as keyof Stats,
    format: (v: string | number) => String(v ?? "0"),
    gradient: "linear-gradient(135deg, rgba(255,210,0,0.15), rgba(255,210,0,0.05))",
    iconColor: "#FFD200",
    glowColor: "rgba(255,210,0,0.08)",
  },
  {
    icon: Clock,
    label: "Avg Process Time",
    key: "avgProcessTime" as keyof Stats,
    format: (v: string | number) => String(v ?? "—"),
    gradient: "linear-gradient(135deg, rgba(139,69,19,0.25), rgba(139,69,19,0.08))",
    iconColor: "#FFD200",
    glowColor: "rgba(139,69,19,0.15)",
  },
  {
    icon: HardDrive,
    label: "Library Size",
    key: "totalSize" as keyof Stats,
    format: (v: string | number) => String(v ?? "0 MB"),
    gradient: "linear-gradient(135deg, rgba(79,106,143,0.3), rgba(79,106,143,0.1))",
    iconColor: "#FFD200",
    glowColor: "rgba(79,106,143,0.15)",
  },
];

export default function StatsCards() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 10000,
  });

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5">
      {statConfig.map(({ icon: Icon, label, key, format, gradient, iconColor, glowColor }) => {
        const value = stats ? format(stats[key] as string | number) : "—";
        return (
          <div
            key={label}
            className="glass glass-hover rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-all duration-300"
            style={{ boxShadow: `0 4px 24px ${glowColor}, 0 1px 0 rgba(255,255,255,0.05) inset` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: gradient }}
            >
              <Icon size={20} style={{ color: iconColor }} strokeWidth={1.8} />
            </div>
            <div>
              <p
                className="text-xl sm:text-2xl font-bold leading-none"
                style={{ fontFamily: "'Space Grotesk',sans-serif", color: "white" }}
              >
                {value}
              </p>
              <p className="text-xs mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.38)" }}>
                {label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
