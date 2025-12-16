import { useState } from "react";
import { Bell, Check, AlertCircle, Info, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export const NotificationsView = () => {
  const { notifications, clearNotifications, enabled, setEnabled } = useNotifications();
  const [filter, setFilter] = useState<"all" | "success" | "error" | "warning" | "info">("all");

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "all") return true;
    return notif.type === filter;
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
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 border-b border-border/30">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Notifications
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {notifications.length} notification{notifications.length > 1 ? "s" : ""}
              </p>
            </div>
            {notifications.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearNotifications}
                    className="gap-2 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Effacer tout
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">Supprimer toutes les notifications</div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-4">
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
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {filter === "all" ? "Aucune notification" : `Aucune notification ${filter}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filter === "all"
                  ? "Vous n'avez pas encore de notifications"
                  : `Aucune notification de type "${filter}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all hover:shadow-md",
                    getNotificationColor(notification.type)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
                          {notification.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {notification.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
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

