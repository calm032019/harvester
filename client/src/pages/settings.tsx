import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, Shield, Sparkles, Moon, Sun, Monitor, Lock, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ACCENT_COLORS = [
  { name: "Amber", value: "#FFD200" },
  { name: "Terracotta", value: "#8B4513" },
  { name: "Moss", value: "#4F7942" },
  { name: "Stormy Blue", value: "#4F6A8F" },
  { name: "Crimson", value: "#DC2626" },
  { name: "Indigo", value: "#4F46E5" },
];

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [pin, setPin] = useState("");

  if (!settings) return null;

  const handleSavePin = () => {
    if (pin.length !== 4 || isNaN(Number(pin))) {
      toast({ title: "Invalid PIN", description: "Please enter a 4-digit numeric PIN", variant: "destructive" });
      return;
    }
    updateSettings({ pin });
    setPin("");
    toast({ title: "PIN Set", description: "Security has been enabled for this device." });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Settings</h1>
        <p className="text-white/40">Customize your Harvester experience and secure your media.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Appearance */}
        <Card className="glass shimmer-border overflow-hidden border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Palette size={18} className="text-amber-500" /> Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-white/60">Theme Mode</Label>
              <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
                {[
                  { id: "light", icon: Sun, label: "Light" },
                  { id: "dark", icon: Moon, label: "Dark" },
                  { id: "system", icon: Monitor, label: "System" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ theme: t.id as any })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                      settings.theme === t.id ? "bg-amber-500 text-amber-950" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <t.icon size={14} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white/60">Accent Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateSettings({ accentColor: c.value })}
                    className={`w-full aspect-square rounded-full border-2 transition-all ${
                      settings.accentColor === c.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    style={{ background: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-white/60">Glass Blur Intensity</Label>
                <span className="text-xs text-amber-500 font-mono">{settings.glassIntensity}px</span>
              </div>
              <Slider
                value={[settings.glassIntensity || 40]}
                min={0}
                max={100}
                step={1}
                onValueChange={([val]) => updateSettings({ glassIntensity: val })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white">Fluid Animations</Label>
                <p className="text-xs text-white/40">Enable smooth transitions and micro-interactions.</p>
              </div>
              <Switch
                checked={settings.animations ?? true}
                onCheckedChange={(val) => updateSettings({ animations: val })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="glass shimmer-border overflow-hidden border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield size={18} className="text-red-500" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-200 leading-relaxed">
                Security locks are session-based and activate only when Harvester is running as a 
                <strong> PWA (Standalone)</strong> app.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-white/60">App PIN Code</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  maxLength={4}
                  placeholder="Set 4-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="bg-black/20 border-white/10 rounded-xl"
                />
                <Button 
                  onClick={handleSavePin}
                  className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl"
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white flex items-center gap-2">
                  <Fingerprint size={14} /> Biometric Unlock
                </Label>
                <p className="text-xs text-white/40">Use TouchID or FaceID (requires PWA).</p>
              </div>
              <Switch
                disabled // We'll enable this if WebAuthn is supported
                checked={false}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white">Force Session Lock</Label>
                <p className="text-xs text-white/40">Require PIN every time the app is launched.</p>
              </div>
              <Switch
                checked={settings.securityEnabled ?? false}
                onCheckedChange={(val) => updateSettings({ securityEnabled: val })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
