import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Play, ListMusic } from 'lucide-react';

export interface PlayQueueChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayNow: () => void;
  onAddToQueue: () => void;
  fileCount: number;
  isProcessing?: boolean;
}

export function PlayQueueChoiceDialog({
  open,
  onOpenChange,
  onPlayNow,
  onAddToQueue,
  fileCount,
  isProcessing = false,
}: PlayQueueChoiceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Lecture des fichiers</AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            Vous avez sélectionné <span className="font-semibold text-foreground">{fileCount} fichier(s)</span>. 
            Comment voulez-vous les lire ?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-medium text-foreground mb-1">Lire maintenant</p>
            <p className="text-xs text-muted-foreground">
              Commence la lecture immédiatement avec les fichiers sélectionnés
            </p>
          </div>

          <div className="rounded-lg border border-muted p-3">
            <p className="text-sm font-medium text-foreground mb-1">Ajouter à la file d'attente</p>
            <p className="text-xs text-muted-foreground">
              Ajoute à la fin de la file, continue la lecture actuelle
            </p>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={isProcessing}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onPlayNow}
            disabled={isProcessing}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Play className="w-4 h-4" />
            Lire maintenant
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onAddToQueue}
            disabled={isProcessing}
            className="gap-2 bg-secondary hover:bg-secondary/90"
          >
            <ListMusic className="w-4 h-4" />
            Ajouter
          </AlertDialogAction>
        </AlertDialogFooter>

        {isProcessing && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Traitement des fichiers...</span>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
