"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Rocket, ShieldCheck } from "lucide-react";
import { useCloudSync } from "@/hooks/useCloudSync";
import type { ProUploadCtaDetail } from "@/lib/pro-upload-cta";

const SERVER_LABELS: Record<string, string> = {
  cloudinary: "Cloudinary (Serveur 0)",
  bunny: "Bunny CDN (Serveur 1)",
  planethoster: "PlanetHoster SFTP (Serveur 2)",
  nexus: "Nexus Cloud",
};

export const ProUploadCtaModal = () => {
  const { nexusUpgradeToPro } = useCloudSync();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ProUploadCtaDetail | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const serverLabel = useMemo(() => {
    if (detail?.label) return detail.label;
    if (detail?.server && SERVER_LABELS[detail.server]) return SERVER_LABELS[detail.server];
    return "serveur Pro";
  }, [detail]);

  const openModal = useCallback((payload?: ProUploadCtaDetail) => {
    setDetail(payload || null);
    setOpen(true);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ProUploadCtaDetail>;
      openModal(custom.detail);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pro-upload-cta", handler);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pro-upload-cta", handler);
      }
    };
  }, [openModal]);

  const handleOpenPlans = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nexus-nav", { detail: { destination: "settings", section: "subscription" } }));
    }
    setOpen(false);
  }, []);

  const handleUpgrade = useCallback(async () => {
    setIsUpgrading(true);
    try {
      await nexusUpgradeToPro();
      setOpen(false);
    } finally {
      setIsUpgrading(false);
    }
  }, [nexusUpgradeToPro]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="uppercase tracking-wider">Pro</Badge>
            Accès réservé aux comptes Pro
          </DialogTitle>
          <DialogDescription>
            Débloquez les serveurs cloud et les options avancées en un clic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous avez tenté d’uploader vers <span className="font-medium text-foreground">{serverLabel}</span>.
            Ce serveur est réservé aux abonnés Pro.
          </p>

          <div className="rounded-lg border border-border/50 bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Rocket className="h-4 w-4 text-primary" />
              Débloquez tous les serveurs cloud
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pro active Cloudinary, Bunny CDN et PlanetHoster, avec plus de capacité et de stabilité.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/60 p-4">
            <div className="text-sm font-medium mb-2">Avantages inclus</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" />
                Accès aux serveurs Pro (Cloudinary, Bunny, PlanetHoster)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" />
                Upload plus rapide et plus fiable
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" />
                Plus de capacité de stockage et d’upload
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Paiement sécurisé, annulable à tout moment.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Plus tard
            </Button>
            <Button variant="outline" onClick={handleOpenPlans}>
              Voir les plans
            </Button>
            <Button onClick={handleUpgrade} disabled={isUpgrading}>
              {isUpgrading ? "Redirection..." : "Passer au Pro"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
