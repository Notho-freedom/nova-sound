import { useState } from "react";
import { 
  Volume2, 
  Palette, 
  Music, 
  Bell, 
  Keyboard, 
  HardDrive,
  Monitor,
  Info,
  ChevronRight
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  icon: typeof Volume2;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SettingsSection = ({ icon: Icon, title, description, children }: SettingsSectionProps) => (
  <div className="glass rounded-xl p-6">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-medium text-foreground mb-1">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
        {children}
      </div>
    </div>
  </div>
);

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow = ({ label, description, children }: SettingRowProps) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    {children}
  </div>
);

export const SettingsView = () => {
  const [settings, setSettings] = useState({
    crossfade: 5,
    gapless: true,
    normalize: true,
    highQuality: true,
    notifications: true,
    discordRPC: false,
    autoPlay: true,
    hardware: true,
    minimizeToTray: true,
    startWithSystem: false,
  });

  const updateSetting = (key: keyof typeof settings, value: boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
          Paramètres
        </h1>
        <p className="text-muted-foreground">
          Personnalisez votre expérience NEXUS
        </p>
      </div>

      {/* Audio Settings */}
      <SettingsSection
        icon={Volume2}
        title="Audio"
        description="Configurez la lecture audio"
      >
        <div className="space-y-1">
          <SettingRow label="Crossfade" description="Transition fluide entre les pistes">
            <div className="flex items-center gap-3">
              <Slider
                value={[settings.crossfade]}
                max={12}
                step={1}
                onValueChange={(v) => updateSetting('crossfade', v[0])}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground w-8">
                {settings.crossfade}s
              </span>
            </div>
          </SettingRow>
          
          <SettingRow label="Lecture sans interruption" description="Supprime les silences entre les pistes">
            <Switch
              checked={settings.gapless}
              onCheckedChange={(v) => updateSetting('gapless', v)}
            />
          </SettingRow>
          
          <SettingRow label="Normalisation du volume" description="Égalise le volume de toutes les pistes">
            <Switch
              checked={settings.normalize}
              onCheckedChange={(v) => updateSetting('normalize', v)}
            />
          </SettingRow>
          
          <SettingRow label="Qualité audio élevée" description="Utilise plus de bande passante pour une meilleure qualité">
            <Switch
              checked={settings.highQuality}
              onCheckedChange={(v) => updateSetting('highQuality', v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Display Settings */}
      <SettingsSection
        icon={Palette}
        title="Affichage"
        description="Personnalisez l'apparence"
      >
        <div className="space-y-1">
          <SettingRow label="Thème">
            <div className="flex gap-2">
              {['Sombre', 'Clair', 'Système'].map((theme, idx) => (
                <button
                  key={theme}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm transition-colors",
                    idx === 0
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </SettingRow>
          
          <SettingRow label="Accélération matérielle" description="Utilise le GPU pour les effets visuels">
            <Switch
              checked={settings.hardware}
              onCheckedChange={(v) => updateSetting('hardware', v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Application Settings */}
      <SettingsSection
        icon={Monitor}
        title="Application"
        description="Comportement de l'application"
      >
        <div className="space-y-1">
          <SettingRow label="Réduire dans la barre système" description="Continue la lecture en arrière-plan">
            <Switch
              checked={settings.minimizeToTray}
              onCheckedChange={(v) => updateSetting('minimizeToTray', v)}
            />
          </SettingRow>
          
          <SettingRow label="Démarrer avec le système" description="Lancer automatiquement au démarrage">
            <Switch
              checked={settings.startWithSystem}
              onCheckedChange={(v) => updateSetting('startWithSystem', v)}
            />
          </SettingRow>
          
          <SettingRow label="Lecture automatique" description="Joue automatiquement le prochain titre">
            <Switch
              checked={settings.autoPlay}
              onCheckedChange={(v) => updateSetting('autoPlay', v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection
        icon={Bell}
        title="Notifications"
        description="Gérez les notifications"
      >
        <div className="space-y-1">
          <SettingRow label="Notifications de bureau" description="Affiche les infos du titre en cours">
            <Switch
              checked={settings.notifications}
              onCheckedChange={(v) => updateSetting('notifications', v)}
            />
          </SettingRow>
          
          <SettingRow label="Discord Rich Presence" description="Affiche ce que vous écoutez sur Discord">
            <Switch
              checked={settings.discordRPC}
              onCheckedChange={(v) => updateSetting('discordRPC', v)}
            />
          </SettingRow>
        </div>
      </SettingsSection>

      {/* Keyboard Shortcuts */}
      <SettingsSection
        icon={Keyboard}
        title="Raccourcis clavier"
      >
        <div className="space-y-1">
          {[
            { action: 'Lecture/Pause', shortcut: 'Espace' },
            { action: 'Titre suivant', shortcut: 'Ctrl + →' },
            { action: 'Titre précédent', shortcut: 'Ctrl + ←' },
            { action: 'Augmenter le volume', shortcut: 'Ctrl + ↑' },
            { action: 'Baisser le volume', shortcut: 'Ctrl + ↓' },
            { action: 'Muet', shortcut: 'Ctrl + M' },
            { action: 'Plein écran', shortcut: 'F11' },
          ].map(({ action, shortcut }) => (
            <SettingRow key={action} label={action}>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground">
                {shortcut}
              </kbd>
            </SettingRow>
          ))}
        </div>
      </SettingsSection>

      {/* Storage */}
      <SettingsSection
        icon={HardDrive}
        title="Stockage"
        description="Gérez le cache et les fichiers locaux"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Cache audio</p>
              <p className="text-xs text-muted-foreground">256 MB utilisés</p>
            </div>
            <button className="px-3 py-1.5 rounded-lg text-sm bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
              Vider le cache
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Dossier des téléchargements</p>
              <p className="text-xs text-muted-foreground">~/Music/NEXUS</p>
            </div>
            <button className="text-sm text-primary hover:underline flex items-center gap-1">
              Modifier <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection icon={Info} title="À propos">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm text-foreground">1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Build</span>
            <span className="text-sm text-foreground font-mono">2024.12.08</span>
          </div>
          <div className="pt-3 flex gap-3">
            <button className="px-4 py-2 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors">
              Rechercher des mises à jour
            </button>
            <button className="px-4 py-2 rounded-lg text-sm text-primary hover:underline">
              Licences
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
