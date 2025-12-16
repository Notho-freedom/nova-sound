import { useState } from "react";
import { Bell, Check, AlertCircle, Info, X, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface NotificationsPanelProps {
  className?: string;
  onClose?: () => void;
}

export const NotificationsPanel = ({ className, onClose }: NotificationsPanelProps) => {
  const { notifications, clearNotifications, enabled, setEnabled } = useNotifications();
  const [filter, setFilter] = useState<"all" | "success" | "error" | "warning" | "info">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotifications = notifications.filter((notif) => {
    // Filter by type
    if (filter !== "all" && notif.type !== filter) return false;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        notif.title.toLowerCase().includes(query) ||
        notif.description?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case "success":
        return <Check className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type?: string) => {
    switch (type) {
      case "success":
        return "border-green-500/20 bg-green-500/5";
      case "error":
        return "border-red-500/20 bg-red-500/5";
      case "warning":
        return "border-yellow-500/20 bg-yellow-500/5";
      case "info":
        return "border-blue-500/20 bg-blue-500/5";
      default:
        return "border-border/50 bg-card/50";
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-card border-l border-border/50", className)}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Notifications</h2>
            {notifications.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary">
                {notifications.length}
              </span>
            )}
          </div>
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                  <X className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">Fermer</div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "success", "error", "warning", "info"] as const).map((filterType) => (
            <Tooltip key={filterType}>
              <TooltipTrigger asChild>
                <Button
                  variant={filter === filterType ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(filterType)}
                  className="h-7 text-xs capitalize transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                  {filterType === "all" ? "Toutes" : filterType}
                  {filterType !== "all" && (
                    <span className="ml-1 text-xs opacity-70">
                      ({notifications.filter((n) => n.type === filterType).length})
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  {filterType === "all" 
                    ? "Afficher toutes les notifications" 
                    : `Afficher uniquement les notifications ${filterType}`}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearNotifications}
                  className="h-7 text-xs gap-1.5 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                  <Trash2 className="w-3 h-3 hover:scale-105 transition-transform duration-200 ease-out" />
                  Effacer tout
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">Supprimer toutes les notifications</div>
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Notifications:</span>
              <span className={enabled ? "text-green-500" : "text-muted-foreground"}>
                {enabled ? "Activées" : "Désactivées"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery.trim()
                  ? "Aucune notification trouvée"
                  : filter === "all"
                  ? "Aucune notification"
                  : `Aucune notification ${filter}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "Essayez avec d'autres mots-clés"
                  : filter === "all"
                  ? "Vous n'avez pas encore de notifications"
                  : `Aucune notification de type "${filter}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3 rounded-lg border transition-all duration-200 ease-out hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                    getNotificationColor(notification.type)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
                      {notification.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                          {notification.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.timestamp).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

