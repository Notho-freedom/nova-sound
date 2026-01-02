import { Button } from '@/components/ui/button';
import { useCoachmarkContext } from './CoachmarkProvider';
import { Play } from 'lucide-react';

interface CoachmarkTriggerProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showIcon?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function CoachmarkTrigger({
  variant = 'outline',
  size = 'default',
  showIcon = true,
  className,
  children,
}: CoachmarkTriggerProps) {
  const { start } = useCoachmarkContext();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={start}
      className={className}
    >
      {showIcon && <Play className="mr-2 h-4 w-4" />}
      {children || 'Recommencer le coachmark'}
    </Button>
  );
}
