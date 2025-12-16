import { useState, useEffect, useCallback, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Save, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// 10-band equalizer frequencies (Hz)
const FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const FREQUENCY_LABELS = ["32", "64", "125", "250", "500", "1K", "2K", "4K", "8K", "16K"];

interface EqualizerPreset {
  name: string;
  bands: number[];
  preamp: number;
  isCustom: boolean;
}

interface EqualizerProps {
  audioContext?: AudioContext;
  sourceNode?: AudioNode;
  onConnect?: (outputNode: AudioNode) => void;
  className?: string;
}

export const Equalizer = ({ audioContext, sourceNode, onConnect, className }: EqualizerProps) => {
  const [enabled, setEnabled] = useState(false);
  const [bands, setBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [preamp, setPreamp] = useState(0);
  const [presets, setPresets] = useState<EqualizerPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("Flat");
  
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Load presets from Electron if available
  useEffect(() => {
    const loadPresets = async () => {
      if (window.electronAPI?.getEqualizerPresets) {
        const loadedPresets = await window.electronAPI.getEqualizerPresets();
        setPresets(loadedPresets);
      } else {
        // Default presets for web mode
        setPresets([
          { name: "Flat", bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0, isCustom: false },
          { name: "Rock", bands: [5, 4, 3, 1, -1, -1, 0, 2, 3, 4], preamp: 0, isCustom: false },
          { name: "Pop", bands: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2], preamp: 0, isCustom: false },
          { name: "Jazz", bands: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4], preamp: 0, isCustom: false },
          { name: "Bass Boost", bands: [6, 5, 4, 3, 1, 0, 0, 0, 0, 0], preamp: 0, isCustom: false },
          { name: "Treble Boost", bands: [0, 0, 0, 0, 0, 1, 3, 4, 5, 6], preamp: 0, isCustom: false },
        ]);
      }
    };
    
    loadPresets();
  }, []);

  // Create and connect filter nodes
  useEffect(() => {
    if (!audioContext || !sourceNode) return;

    // Clean up existing filters
    filtersRef.current.forEach(filter => filter.disconnect());
    gainNodeRef.current?.disconnect();

    // Create preamp gain node
    const gainNode = audioContext.createGain();
    gainNode.gain.value = Math.pow(10, preamp / 20);
    gainNodeRef.current = gainNode;

    // Create filters for each frequency band
    const filters = FREQUENCIES.map((freq, index) => {
      const filter = audioContext.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1.4; // Bandwidth
      filter.gain.value = enabled ? bands[index] : 0;
      return filter;
    });

    filtersRef.current = filters;

    // Connect the chain
    if (enabled) {
      sourceNode.connect(gainNode);
      gainNode.connect(filters[0]);
      
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }

      if (onConnect) {
        onConnect(filters[filters.length - 1]);
      }
    } else {
      // Bypass equalizer
      if (onConnect) {
        onConnect(sourceNode);
      }
    }

    return () => {
      filters.forEach(filter => filter.disconnect());
      gainNode.disconnect();
    };
  }, [audioContext, sourceNode, enabled, onConnect]);

  // Update filter gains when bands change
  useEffect(() => {
    filtersRef.current.forEach((filter, index) => {
      if (filter) {
        filter.gain.setValueAtTime(enabled ? bands[index] : 0, audioContext?.currentTime || 0);
      }
    });
  }, [bands, enabled, audioContext]);

  // Update preamp gain
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        Math.pow(10, preamp / 20),
        audioContext?.currentTime || 0
      );
    }
  }, [preamp, audioContext]);

  const handleBandChange = useCallback((index: number, value: number[]) => {
    const newBands = [...bands];
    newBands[index] = value[0];
    setBands(newBands);
    setSelectedPreset("Custom");
  }, [bands]);

  const handlePresetChange = useCallback((presetName: string) => {
    const preset = presets.find(p => p.name === presetName);
    if (preset) {
      setBands([...preset.bands]);
      setPreamp(preset.preamp);
      setSelectedPreset(presetName);
    }
  }, [presets]);

  const handleReset = useCallback(() => {
    setBands([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setPreamp(0);
    setSelectedPreset("Flat");
  }, []);

  const handleSavePreset = useCallback(async () => {
    const name = prompt("Nom du préréglage :");
    if (name) {
      if (window.electronAPI?.saveEqualizerPreset) {
        await window.electronAPI.saveEqualizerPreset(name, bands);
        const loadedPresets = await window.electronAPI.getEqualizerPresets();
        setPresets(loadedPresets);
        setSelectedPreset(name);
      }
    }
  }, [bands]);

  return (
    <div className={cn("glass rounded-xl p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg tracking-wider">ÉGALISEUR</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="eq-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="eq-enabled" className="text-sm text-muted-foreground">
              {enabled ? "Activé" : "Désactivé"}
            </Label>
          </div>
        </div>
      </div>

      {/* Preset selector */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sélectionner un préréglage" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.name} value={preset.name}>
                {preset.name}
                {preset.isCustom && " ★"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">Réinitialiser</div>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleSavePreset}>
              <Save className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">Sauvegarder</div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Preamp */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm text-muted-foreground">Préamplificateur</Label>
          <span className="text-sm font-mono text-primary">
            {preamp > 0 ? "+" : ""}{preamp} dB
          </span>
        </div>
        <Slider
          value={[preamp]}
          min={-12}
          max={12}
          step={0.5}
          onValueChange={(v) => setPreamp(v[0])}
          disabled={!enabled}
          className="w-full"
        />
      </div>

      {/* EQ Bands */}
      <div className="grid grid-cols-10 gap-2">
        {bands.map((gain, index) => (
          <div key={index} className="flex flex-col items-center">
            <span className="text-xs font-mono text-primary mb-2">
              {gain > 0 ? "+" : ""}{gain}
            </span>
            <div className="h-40 flex items-center">
              <Slider
                value={[gain]}
                min={-12}
                max={12}
                step={0.5}
                orientation="vertical"
                onValueChange={(v) => handleBandChange(index, v)}
                disabled={!enabled}
                className={cn(
                  "h-full",
                  !enabled && "opacity-50"
                )}
              />
            </div>
            <span className="text-xs text-muted-foreground mt-2">
              {FREQUENCY_LABELS[index]}
            </span>
          </div>
        ))}
      </div>

      {/* Visual curve (optional) */}
      <div className="mt-6 h-16 rounded-lg bg-muted/20 overflow-hidden">
        <svg viewBox="0 0 100 20" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="eqGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d={`M 0,10 ${bands.map((gain, i) => {
              const x = (i / (bands.length - 1)) * 100;
              const y = 10 - (gain / 12) * 8;
              return `L ${x},${y}`;
            }).join(" ")} L 100,10`}
            fill="url(#eqGradient)"
            strokeWidth="0.5"
            stroke="hsl(var(--primary))"
            className={cn(!enabled && "opacity-30")}
          />
        </svg>
      </div>
    </div>
  );
};

