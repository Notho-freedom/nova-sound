import * as React from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

interface HelpButtonProps {
  title?: string;
  description: string | React.ReactNode;
  children?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  size?: 'sm' | 'icon' | 'icon-sm';
  className?: string;
  variant?: 'ghost' | 'outline' | 'default';
  showInModal?: boolean;
  delayDuration?: number;
}

/**
 * Composant HelpButton réutilisable
 * Affiche une infobulle ou une modale avec des informations d'aide
 * 
 * @example
 * <HelpButton 
 *   description="Ceci est une aide contextuelle"
 *   title="Titre de l'aide"
 * />
 */
export const HelpButton = React.memo(
  ({
    title,
    description,
    children,
    side = 'top',
    size = 'icon-sm',
    className = '',
    variant = 'ghost',
    showInModal = false,
    delayDuration = 200,
  }: HelpButtonProps) => {
    const [open, setOpen] = React.useState(false);

    // Pour les descriptions longues, afficher une modale
    const isLongDescription =
      typeof description === 'string' && description.length > 150;
    const shouldShowModal = showInModal || isLongDescription;

    if (shouldShowModal) {
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={`inline-flex items-center justify-center rounded-full ${className}`}
              aria-label="Aide"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                {title || 'Aide'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-foreground/80 leading-relaxed">
                {description}
              </div>
              {children && <div className="mt-4 pt-4 border-t">{children}</div>}
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    // Pour les descriptions courtes, afficher une infobulle
    return (
      <TooltipProvider delayDuration={delayDuration}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={`inline-flex items-center justify-center rounded-full ${className}`}
              aria-label={title ? `Aide: ${title}` : 'Aide'}
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side} className="max-w-xs text-sm">
            {title && <div className="font-semibold mb-1">{title}</div>}
            <div>{description}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

HelpButton.displayName = 'HelpButton';

/**
 * Composant HelpIcon pour intégration minimaliste
 */
export const HelpIcon = React.memo(
  ({ 
    description, 
    title, 
    className = '' 
  }: Omit<HelpButtonProps, 'size' | 'variant'>) => (
    <HelpButton
      description={description}
      title={title}
      size="icon-sm"
      variant="ghost"
      className={`w-5 h-5 text-muted-foreground hover:text-foreground transition-colors ${className}`}
    />
  ),
);

HelpIcon.displayName = 'HelpIcon';

/**
 * Composant HelpSection pour des sections d'aide plus grandes
 */
interface HelpSectionProps {
  title: string;
  description: string | React.ReactNode;
  className?: string;
}

export const HelpSection = React.memo(
  ({ title, description, className = '' }: HelpSectionProps) => (
    <div className={`flex gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-200/30 ${className}`}>
      <div className="flex-shrink-0 pt-0.5">
        <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-300 mb-1">
          {title}
        </h4>
        <p className="text-xs text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  ),
);

HelpSection.displayName = 'HelpSection';
