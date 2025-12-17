import { Cloud, Zap, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadIndicatorProps {
  provider?: "cloudinary" | "nexus" | "bunny" | "planethoster";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const UploadIndicator = ({ 
  provider, 
  className,
  size = "sm"
}: UploadIndicatorProps) => {
  if (!provider) return null;

  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const getIcon = () => {
    switch (provider) {
      case "cloudinary":
        return <Cloud className={cn(sizeClasses[size], "text-purple-500", className)} />;
      case "bunny":
      case "planethoster":
        return <Zap className={cn(sizeClasses[size], "text-blue-500", className)} />;
      case "nexus":
        return <Server className={cn(sizeClasses[size], "text-green-500", className)} />;
      default:
        return <Cloud className={cn(sizeClasses[size], "text-muted-foreground", className)} />;
    }
  };

  return (
    <span className="inline-flex items-center" title={`Uploadé vers ${provider}`}>
      {getIcon()}
    </span>
  );
};
