import { redirect } from 'next/navigation';

// Rediriger immédiatement vers la racine pour toutes les pages 404
export default function NotFound() {
  redirect('/');
}

