import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SecurityOverlay() {
  const { settings, isUnlocked, setUnlocked } = useSettings();
  const [pin, setPin] = useState("");
  const [isPwa, setIsPwa] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkPwa = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone 
        || document.referrer.includes('android-app://');
      setIsPwa(!!isStandalone);
    };
    checkPwa();
  }, []);

  // Only show if security is enabled, it's a PWA, and we are locked
  if (!settings?.securityEnabled || !isPwa || isUnlocked) return null;

  const handleVerify = async () => {
    if (pin.length !== 4) return;

    try {
      const res = await apiRequest("POST", "/api/settings/verify-pin", { pin });
      const data = await res.json();
      
      if (data.success) {
        setUnlocked(true);
        toast({ title: "Unlocked", description: "Welcome back to Harvester." });
      } else {
        setError(true);
        setPin("");
        setTimeout(() => setError(false), 1000);
      }
    } catch (err) {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-2xl">
      <div className="w-full max-w-sm p-8 text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
            <Lock size={32} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>App Locked</h2>
            <p className="text-white/40 text-sm mt-1">Enter your Harvester PIN to continue</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                pin.length > i ? "bg-amber-500 scale-125 shadow-[0_0_15px_rgba(255,210,0,0.5)]" : "bg-white/10"
              } ${error ? "bg-red-500 animate-bounce" : ""}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "enter"].map((val) => (
            <button
              key={val}
              onClick={() => {
                if (val === "clear") setPin("");
                else if (val === "enter") handleVerify();
                else if (typeof val === "number" && pin.length < 4) {
                  const newPin = pin + val;
                  setPin(newPin);
                  if (newPin.length === 4) {
                    // Auto-verify when 4 digits are entered
                    setTimeout(() => handleVerify(), 300);
                  }
                }
              }}
              className={`h-16 rounded-2xl flex items-center justify-center text-xl font-semibold transition-all ${
                val === "enter" || val === "clear" 
                  ? "bg-white/5 hover:bg-white/10 text-white/60 text-sm" 
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
            >
              {val === "clear" ? "C" : val === "enter" ? "OK" : val}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-white/20 text-xs uppercase tracking-widest">
          <ShieldCheck size={12} /> Secure Session
        </div>
      </div>
    </div>
  );
}
