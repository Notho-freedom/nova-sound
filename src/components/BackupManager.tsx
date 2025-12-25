import React, { useState, useEffect } from 'react';
import { firebaseSyncService } from '@/services/firebase-sync';
import { authService } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Download, Clock } from 'lucide-react';

interface Backup {
  id: string;
  timestamp: number;
  date: string;
}

export function BackupManager() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        console.error('No user logged in');
        return;
      }

      const backupList = await firebaseSyncService.listBackups(currentUser.uid);
      setBackups(backupList);
    } catch (error) {
      console.error('Error loading backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }

    if (!confirm(`Restaurer depuis ce backup ?\n\n${backupId}\n\nCette action remplacera vos données actuelles.`)) {
      return;
    }

    setRestoring(backupId);
    try {
      const success = await firebaseSyncService.restoreFromBackup(currentUser.uid, backupId);
      if (success) {
        alert('✅ Backup restauré avec succès !');
        // Recharger la page pour afficher les données restaurées
        window.location.reload();
      } else {
        alert('❌ Erreur lors de la restauration du backup');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('❌ Erreur lors de la restauration du backup');
    } finally {
      setRestoring(null);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    return 'Récent';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backups automatiques
            </CardTitle>
            <CardDescription>
              Backups créés automatiquement toutes les heures
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadBackups}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun backup disponible</p>
            <p className="text-sm mt-1">Les backups seront créés automatiquement</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {backups.map((backup, index) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Backup #{backups.length - index}
                      </span>
                      {index === 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Plus récent
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatDate(backup.timestamp)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getRelativeTime(backup.timestamp)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(backup.id)}
                    disabled={restoring !== null}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {restoring === backup.id ? 'Restauration...' : 'Restaurer'}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
