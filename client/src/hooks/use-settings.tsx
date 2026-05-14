import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings } from "@shared/schema";

interface SettingsContextType {
  settings: UserSettings | undefined;
  updateSettings: (updates: Partial<UserSettings> & { pin?: string }) => void;
  isUnlocked: boolean;
  setUnlocked: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isUnlocked, setUnlocked] = useState(() => {
    // Check if security is even enabled before deciding if we're "unlocked"
    return sessionStorage.getItem("harvester_unlocked") === "true";
  });

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<UserSettings> & { pin?: string }) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  useEffect(() => {
    if (settings) {
      // Apply accent color
      document.documentElement.style.setProperty("--amber", settings.accentColor || "#FFD200");
      
      // Apply glass intensity
      const blur = settings.glassIntensity ?? 40;
      document.documentElement.style.setProperty("--glass-blur", `${blur}px`);
      
      // Apply theme
      const root = window.document.documentElement;
      root.setAttribute("data-theme", settings.theme);
      
      // Apply animations
      if (!settings.animations) {
        document.body.classList.add("no-animations");
      } else {
        document.body.classList.remove("no-animations");
      }
    }
  }, [settings]);

  const updateSettings = (updates: Partial<UserSettings> & { pin?: string }) => {
    mutation.mutate(updates);
  };

  const handleSetUnlocked = (val: boolean) => {
    setUnlocked(val);
    if (val) sessionStorage.setItem("harvester_unlocked", "true");
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isUnlocked, setUnlocked: handleSetUnlocked }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
