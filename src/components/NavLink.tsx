// NavLink component - Compatible avec Next.js
// Note: Next.js utilise son propre système de routing, ce composant est conservé pour compatibilité
// mais n'est pas utilisé dans l'application actuelle (Sidebar utilise NavItem avec onClick)

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NavLinkProps {
  href: string;
  className?: string;
  activeClassName?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, href, children, ...props }, ref) => {
    // Pour Next.js, on utilise Link au lieu de react-router-dom
    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, activeClassName)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
