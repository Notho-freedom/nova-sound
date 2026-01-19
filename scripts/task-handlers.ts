/**
 * Task handlers pour le worker Upstash
 * Chaque handler traite un type de tâche spécifique
 */

import type { TaskSnapshot } from "@/lib/task-store"

export type TaskHandlerMeta = {
  id: string
  type: string
  source?: string
  version?: string
}

export type TaskHandler = (
  payload: any,
  meta: TaskHandlerMeta
) => Promise<any>

/**
 * Handler pour open-files: traiter les fichiers audio sélectionnés
 * Payload: { fileCount, files: [{name, size, lastModified, type}], action }
 */
export const handleOpenFiles: TaskHandler = async (payload, meta) => {
  const { fileCount, files, action } = payload
  
  console.log(`[handler:open-files] Processing ${fileCount} files (action: ${action})`)
  
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("No files provided")
  }
  
  // En production, ces fichiers seraient téléchargés depuis un blob storage
  // ou traités via des chunks uploadés en parallèle
  // Pour now, on traite les métadonnées et on retourne les IDs
  const processedFiles = files.map((f: any, idx: number) => ({
    index: idx,
    name: f.name,
    size: f.size,
    type: f.type,
    id: `file-${Date.now()}-${idx}`,
  }))
  
  return {
    processed: processedFiles.length,
    action,
    files: processedFiles,
    timestamp: Date.now(),
  }
}

/**
 * Handler pour youtube-recovery: récupérer les tracks YouTube manquants
 * Payload: { trackIds: string[] }
 */
export const handleYouTubeRecovery: TaskHandler = async (payload, meta) => {
  const { trackIds } = payload
  
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return { recovered: 0, failed: 0, results: [] }
  }
  
  console.log(`[handler:youtube-recovery] Recovering ${trackIds.length} tracks`)
  
  // Dynamically import YouTube recovery (avoid circular deps at module level)
  const { recoverMissingYouTubeTracks } = await import("@/lib/youtube-track-recovery")
  
  try {
    const recoveredMap = await recoverMissingYouTubeTracks(trackIds)
    const recovered = recoveredMap.size
    const failed = trackIds.length - recovered
    
    const results = Array.from(recoveredMap.values()).map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      youtubeVideoId: track.youtubeVideoId,
    }))
    
    console.log(`[handler:youtube-recovery] ✅ Recovered ${recovered}/${trackIds.length}`)
    
    return {
      recovered,
      failed,
      results,
      timestamp: Date.now(),
    }
  } catch (err: any) {
    console.error(`[handler:youtube-recovery] Error:`, err)
    return {
      recovered: 0,
      failed: trackIds.length,
      results: [],
      error: String(err?.message ?? err),
    }
  }
}

/**
 * Handler pour import-library: scanner la bibliothèque locale
 * Payload: { scan: boolean }
 */
export const handleImportLibrary: TaskHandler = async (payload, meta) => {
  const { scan = true } = payload
  
  console.log(`[handler:import-library] Starting library import (scan: ${scan})`)
  
  // Placeholder: en production, cela déclencherait un scanner SFTP/local
  // Pour now, on retourne un signal que le client peut écouter
  return {
    status: "initiated",
    scan,
    timestamp: Date.now(),
    note: "Library scan initiated; client should poll library state",
  }
}

/**
 * Handler par défaut pour tâches inconnues
 */
export const defaultHandler: TaskHandler = async (payload, meta) => {
  console.log(`[handler:default] Unknown task type: ${meta.type}`)
  return {
    ok: true,
    message: `Task type '${meta.type}' not yet implemented`,
    receivedPayload: payload,
  }
}

/**
 * Registre des handlers
 */
export const TASK_HANDLERS: Record<string, TaskHandler> = {
  "open-files": handleOpenFiles,
  "youtube-recovery": handleYouTubeRecovery,
  "import-library": handleImportLibrary,
}
