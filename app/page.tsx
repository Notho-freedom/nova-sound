'use client';

import { DesktopApp } from "@/components/DesktopApp";
import { useEffect, useState } from "react";

// Suppression des warnings Next.js 15+ concernant les params
export default function Home({
  params,
  searchParams,
}: {
  params?: Promise<any>;
  searchParams?: Promise<any>;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <DesktopApp />;
}

