"use client"

import { useState, useEffect, useRef } from "react"
import { X, Mic, MicOff, Volume2, VolumeX, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Track } from "@/types/music"
import { useCloudSync } from "@/hooks/useCloudSync"

interface KaraokePanelProps {
  isOpen: boolean
  onClose: () => void
  currentTrack: Track | null
  audioElement: HTMLAudioElement | null
}

/**
 * Panneau de karaoké avec suppression de voix
 * - Version gratuite : Web Audio API (filtrage fréquentiel)
 * - Version Pro : Service payant (AssemblyAI ou autre)
 */
export function KaraokePanel({
  isOpen,
  onClose,
  currentTrack,
  audioElement,
}: KaraokePanelProps) {
  const { nexusIsPro } = useCloudSync()
  const [isEnabled, setIsEnabled] = useState(false)
  const [vocalRemovalLevel, setVocalRemovalLevel] = useState([80]) // 0-100
  const [isProcessing, setIsProcessing] = useState(false)
  const [useProService, setUseProService] = useState(false)
  
  // Références pour le traitement audio
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const biquadFilterRef = useRef<BiquadFilterNode[]>([])
  const originalVolumeRef = useRef<number>(1) // Sauvegarder le volume original

  // Initialiser le contexte audio et les filtres
  useEffect(() => {
    if (!audioElement || !isOpen) {
      return
    }

    try {
      // Créer le contexte audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      // Sauvegarder le volume original
      originalVolumeRef.current = audioElement.volume

      // Créer la source depuis l'élément audio
      // Note: Si l'élément est déjà connecté, on ne peut pas créer une nouvelle source
      // Dans ce cas, on utilisera captureStream() comme fallback
      let source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode
      
      // Utiliser captureStream() car l'élément est probablement déjà connecté
      if ('captureStream' in audioElement && typeof (audioElement as any).captureStream === 'function') {
        const stream = (audioElement as any).captureStream()
        // Vérifier que le stream a des pistes audio
        if (stream.getAudioTracks().length === 0) {
          console.warn('Karaoké non disponible: pas de piste audio dans le stream')
          toast.error("Karaoké non disponible", {
            description: "Impossible de capturer l'audio de cette source."
          })
          return
        }
        source = audioContext.createMediaStreamSource(stream)
        sourceNodeRef.current = source
      } else {
        // Essayer de créer une source directe (peut échouer si déjà connecté)
        try {
          const directSource = audioContext.createMediaElementSource(audioElement)
          sourceNodeRef.current = directSource
          source = directSource as any
        } catch (error: any) {
          if (error.name === 'InvalidStateError') {
            console.warn('Karaoké non disponible: élément audio déjà utilisé')
            toast.error("Karaoké non disponible", {
              description: "L'élément audio est déjà utilisé par un autre système."
            })
            return
          }
          throw error
        }
      }

      // Créer un nœud de gain pour contrôler le volume
      const gainNode = audioContext.createGain()
      gainNodeRef.current = gainNode

      // Créer des filtres pour supprimer les fréquences vocales
      // Les voix sont généralement dans la plage 300-3400 Hz
      // Technique : utiliser un filtre notch pour supprimer les fréquences vocales
      // tout en gardant les basses (rythme) et les aigus (instruments)
      const filters: BiquadFilterNode[] = []
      
      // Filtre passe-bas pour garder les basses et médiums (rythme et instruments bas)
      const lowPass = audioContext.createBiquadFilter()
      lowPass.type = 'lowpass'
      lowPass.frequency.value = 4000
      lowPass.Q.value = 1
      
      // Filtre passe-haut pour garder les médiums et aigus (instruments)
      const highPass = audioContext.createBiquadFilter()
      highPass.type = 'highpass'
      highPass.frequency.value = 200
      highPass.Q.value = 1
      
      // Filtre notch pour supprimer la fréquence centrale vocale (~1-2 kHz)
      // C'est le filtre principal pour la suppression de voix
      const notch = audioContext.createBiquadFilter()
      notch.type = 'notch'
      notch.frequency.value = 1500 // Fréquence centrale vocale
      notch.Q.value = 5 // Q modéré pour une suppression plus large
      notch.gain.value = 0 // Pas de gain initial
      
      filters.push(lowPass, highPass, notch)
      biquadFilterRef.current = filters

      // Connecter la chaîne : source -> filtres -> gain
      source.connect(filters[0])
      filters[0].connect(filters[1])
      filters[1].connect(filters[2])
      filters[2].connect(gainNode)
      
      // Ne pas connecter à destination pour l'instant
      // On connectera seulement quand le karaoké sera activé

    } catch (error) {
      console.error('Erreur lors de l\'initialisation du karaoké:', error)
      toast.error("Erreur", {
        description: "Impossible d'initialiser le karaoké."
      })
    }

    return () => {
      // Nettoyage
      if (gainNodeRef.current && audioContextRef.current) {
        try {
          gainNodeRef.current.disconnect()
        } catch {}
      }
      biquadFilterRef.current.forEach(filter => {
        try {
          filter.disconnect()
        } catch {}
      })
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect()
        } catch {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      sourceNodeRef.current = null
      gainNodeRef.current = null
      biquadFilterRef.current = []
      
      // Restaurer le volume original
      if (audioElement) {
        audioElement.volume = originalVolumeRef.current
      }
    }
  }, [audioElement, isOpen])

  // Appliquer les filtres quand l'état change
  useEffect(() => {
    if (!audioContextRef.current || !gainNodeRef.current || biquadFilterRef.current.length === 0) {
      return
    }

    const level = vocalRemovalLevel[0] / 100 // 0-1

    if (isEnabled) {
      // Activer la suppression de voix
      const filters = biquadFilterRef.current
      
      // Technique de suppression de voix : on supprime les fréquences vocales (300-3400 Hz)
      // En utilisant un filtre notch (réjection) sur la plage vocale
      // Plus le niveau est élevé, plus on supprime agressivement
      
      // Filtre notch principal pour supprimer la voix (fréquence centrale ~1.5 kHz)
      filters[2].frequency.value = 1500
      filters[2].Q.value = 2 + (level * 8) // Q: 2-10 (plus élevé = suppression plus étroite mais plus profonde)
      filters[2].gain.value = -level * 30 // Gain négatif pour supprimer (jusqu'à -30 dB)
      
      // Ajuster les filtres passe-bas et passe-haut pour compléter la suppression
      // Low pass : garder les basses et médiums (rythme)
      filters[0].frequency.value = 4000 + (level * 2000) // 4000-6000 Hz (plus on supprime, plus on garde de fréquences)
      filters[0].Q.value = 1
      
      // High pass : garder les médiums et aigus (instruments)
      filters[1].frequency.value = 200 - (level * 100) // 200-100 Hz (plus on supprime, plus on garde de basses)
      filters[1].Q.value = 1

      // Connecter à la destination si pas déjà connecté
      try {
        gainNodeRef.current.connect(audioContextRef.current.destination)
      } catch {
        // Déjà connecté, c'est OK
      }
      
      // Réduire le volume de l'audio original pour éviter la double lecture
      if (audioElement) {
        audioElement.volume = originalVolumeRef.current * 0.1 // Réduire à 10% du volume original
      }
    } else {
      // Désactiver : déconnecter de la destination pour revenir à l'audio original
      try {
        gainNodeRef.current.disconnect()
      } catch {
        // Pas connecté, c'est OK
      }
      
      // Restaurer le volume original
      if (audioElement) {
        audioElement.volume = originalVolumeRef.current
      }
    }
  }, [isEnabled, vocalRemovalLevel, audioElement])

  // Fonction pour utiliser le service Pro (si disponible)
  const handleProVocalRemoval = async () => {
    if (!nexusIsPro) {
      toast.info("Fonctionnalité Pro", {
        description: "Passez à Pro pour accéder à la suppression de voix avancée."
      })
      return
    }

    if (!currentTrack || !audioElement) {
      toast.error("Erreur", {
        description: "Aucune piste en cours de lecture."
      })
      return
    }

    setIsProcessing(true)
    try {
      // TODO: Implémenter l'appel au service Pro
      // Pour l'instant, on utilise la méthode gratuite
      toast.info("Service Pro", {
        description: "La suppression de voix Pro sera disponible prochainement."
      })
      setUseProService(true)
    } catch (error) {
      console.error('Erreur service Pro:', error)
      toast.error("Erreur", {
        description: "Impossible d'utiliser le service Pro."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="w-80 h-full bg-card/95 backdrop-blur-md border-l border-border flex flex-col shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm tracking-wider text-foreground">
            KARAOKÉ
          </h2>
          {nexusIsPro && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
              PRO
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          title="Fermer le karaoké"
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-all duration-200 ease-out active:scale-95 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        >
          <X className="w-4 h-4 hover:scale-105 transition-transform duration-200 ease-out" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {!currentTrack ? (
            <div className="text-center py-8 text-muted-foreground">
              <MicOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Aucune piste en cours de lecture</p>
            </div>
          ) : (
            <>
              {/* Track Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{currentTrack.title}</h3>
                <p className="text-xs text-muted-foreground">{currentTrack.artist}</p>
              </div>

            {/* Enable/Disable */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isEnabled ? (
                    <Mic className="w-4 h-4 text-primary" />
                  ) : (
                    <MicOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {isEnabled ? "Karaoké activé" : "Karaoké désactivé"}
                  </span>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isEnabled
                  ? "La voix est supprimée, vous pouvez chanter par-dessus"
                  : "Activez pour supprimer la voix de la piste"}
              </p>
            </div>

            {/* Vocal Removal Level */}
            {isEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Intensité de suppression</span>
                  <span className="text-xs text-muted-foreground">{vocalRemovalLevel[0]}%</span>
                </div>
                <Slider
                  value={vocalRemovalLevel}
                  onValueChange={setVocalRemovalLevel}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ajustez l'intensité de suppression de la voix (0% = faible, 100% = maximum)
                </p>
              </div>
            )}

            {/* Pro Service (si Pro) */}
            {nexusIsPro && (
              <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Service Pro</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Utilisez notre service IA avancé pour une suppression de voix de qualité supérieure
                </p>
                <Button
                  onClick={handleProVocalRemoval}
                  disabled={isProcessing}
                  variant="outline"
                  size="sm"
                  className="w-full bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Activer le service Pro
                    </>
                  )}
                </Button>
              </div>
            )}

              {/* Info pour utilisateurs gratuits */}
              {!nexusIsPro && (
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Version gratuite : Suppression de voix basique via Web Audio API
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Passez à Pro pour une suppression de voix de qualité professionnelle avec IA
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

