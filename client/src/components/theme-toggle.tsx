import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";

const OPTIONS = [
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "auto" as const, icon: Monitor, label: "Auto" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const idx = OPTIONS.findIndex((o) => o.value === theme);
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    setTheme(next.value);
  };

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <button
      id="btn-theme-toggle"
      onClick={cycle}
      title={`Theme: ${current.label} — click to switch`}
      className="flex items-center gap-1.5 px-3 h-8 rounded-full transition-all duration-300"
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.65)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.95)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)";
      }}
    >
      <Icon size={13} />
      <span className="text-xs font-medium hidden sm:inline">{current.label}</span>
    </button>
  );
}
