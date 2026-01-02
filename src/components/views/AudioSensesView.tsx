"use client";

import { useRef, useEffect, useState } from 'react';
import { useAudioSenses, type AudioSensesData } from '@/hooks/useAudioSenses';
import { useQueue } from '@/hooks/useQueue';
import { cn } from '@/lib/utils';
import { 
  Music, 
  Volume2, 
  Radio, 
  Zap, 
  Activity,
  Gauge,
  TrendingUp,
  RadioIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpButton, HelpIcon } from '@/components/ui/HelpButton';

interface AudioSensesViewProps {
  audioElement: HTMLAudioElement | null;
}

/**
 * Vue complète pour visualiser tous les sens audio
 */
export function AudioSensesView({ audioElement }: AudioSensesViewProps) {
  const sensesData = useAudioSenses(audioElement, {
    enablePitchDetection: true,
    enableBPMDetection: true,
  });

  const canvasWaveformRef = useRef<HTMLCanvasElement>(null);
  const canvasFFTRef = useRef<HTMLCanvasElement>(null);
  const canvasEnergyBandsRef = useRef<HTMLCanvasElement>(null);
  const canvasPeakHistoryRef = useRef<HTMLCanvasElement>(null);
  const canvasEnvelopeRef = useRef<HTMLCanvasElement>(null);

  // Dessiner Waveform
  useEffect(() => {
    const canvas = canvasWaveformRef.current;
    if (!canvas || !sensesData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / sensesData.waveform.length;
    const centerY = height / 2;
    let x = 0;

    sensesData.waveform.forEach((value, index) => {
      const v = (value - 128) / 128;
      const y = centerY + v * (height / 2);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    });

    ctx.stroke();
  }, [sensesData]);

  // Dessiner FFT Spectrum
  useEffect(() => {
    const canvas = canvasFFTRef.current;
    if (!canvas || !sensesData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Basses (rouge)
    const bassBins = Math.floor(sensesData.frequency.length * 0.1);
    ctx.fillStyle = '#ef4444';
    for (let i = 0; i < bassBins; i++) {
      const value = sensesData.frequency[i] || 0;
      const barHeight = (value / 255) * height;
      const x = (i / bassBins) * width;
      ctx.fillRect(x, height - barHeight, width / bassBins, barHeight);
    }

    // Mids (bleu)
    const midBins = Math.floor(sensesData.frequency.length * 0.4);
    ctx.fillStyle = '#3b82f6';
    for (let i = bassBins; i < midBins; i++) {
      const value = sensesData.frequency[i] || 0;
      const barHeight = (value / 255) * height;
      const x = (i / sensesData.frequency.length) * width;
      ctx.fillRect(x, height - barHeight, width / sensesData.frequency.length, barHeight);
    }

    // Highs (violet)
    ctx.fillStyle = '#8b5cf6';
    for (let i = midBins; i < sensesData.frequency.length; i++) {
      const value = sensesData.frequency[i] || 0;
      const barHeight = (value / 255) * height;
      const x = (i / sensesData.frequency.length) * width;
      ctx.fillRect(x, height - barHeight, width / sensesData.frequency.length, barHeight);
    }
  }, [sensesData]);

  // Dessiner Energy Bands
  useEffect(() => {
    const canvas = canvasEnergyBandsRef.current;
    if (!canvas || !sensesData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const bands = [
      { name: 'Bass', value: sensesData.energyBands.bass, color: '#ef4444' },
      { name: 'Low-Mid', value: sensesData.energyBands.lowMid, color: '#f97316' },
      { name: 'Mid', value: sensesData.energyBands.mid, color: '#3b82f6' },
      { name: 'High-Mid', value: sensesData.energyBands.highMid, color: '#8b5cf6' },
      { name: 'Treble', value: sensesData.energyBands.treble, color: '#ec4899' },
    ];

    const barWidth = width / bands.length;
    bands.forEach((band, index) => {
      const barHeight = (band.value / 255) * height;
      const x = index * barWidth;
      const y = height - barHeight;

      // Gradient
      const gradient = ctx.createLinearGradient(x, y, x, height);
      gradient.addColorStop(0, band.color);
      gradient.addColorStop(1, band.color + '80');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 2, barHeight);

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(band.name, x + barWidth / 2, height - 5);
      ctx.fillText(Math.round(band.value).toString(), x + barWidth / 2, height - 20);
    });
  }, [sensesData]);

  // Dessiner Peak History
  useEffect(() => {
    const canvas = canvasPeakHistoryRef.current;
    if (!canvas || !sensesData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const history = sensesData.peakHistory;
    const sliceWidth = width / history.length;

    history.forEach((value, index) => {
      const x = index * sliceWidth;
      const y = height - (value * height);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Marquer les pics
    ctx.fillStyle = '#ef4444';
    history.forEach((value, index) => {
      if (value > 0.7) {
        const x = index * sliceWidth;
        const y = height - (value * height);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [sensesData]);

  // Dessiner Envelope
  useEffect(() => {
    const canvas = canvasEnvelopeRef.current;
    if (!canvas || !sensesData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const { attack, decay, sustain, release } = sensesData.envelope;
    const total = attack + decay + release || 1;

    // Attack (vert)
    if (attack > 0) {
      const attackWidth = (attack / total) * width;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, height - 50, attackWidth, 50);
    }

    // Decay (orange)
    if (decay > 0) {
      const decayWidth = (decay / total) * width;
      const decayX = (attack / total) * width;
      ctx.fillStyle = '#f97316';
      ctx.fillRect(decayX, height - 40, decayWidth, 40);
    }

    // Sustain (bleu)
    if (sustain > 0) {
      const sustainWidth = width * 0.3;
      const sustainX = ((attack + decay) / total) * width;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(sustainX, height - (sustain * 50), sustainWidth, sustain * 50);
    }

    // Release (rouge)
    if (release > 0) {
      const releaseWidth = (release / total) * width;
      const releaseX = width - releaseWidth;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(releaseX, height - 30, releaseWidth, 30);
    }

    // Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('A', 5, height - 5);
    ctx.fillText('D', (attack / total) * width + 5, height - 5);
    ctx.fillText('S', ((attack + decay) / total) * width + 5, height - 5);
    ctx.fillText('R', width - 20, height - 5);
  }, [sensesData]);

  if (!sensesData) {
    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full">
        <div className="mb-6">
          <Skeleton className="h-9 w-96 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Radio className="w-8 h-8 text-primary" />
            Sens Audio - Analyse en Temps Réel
          </h1>
          <p className="text-muted-foreground">
            Visualisation complète de tous les paramètres audio détectés
          </p>
        </div>
        <HelpButton
          title="Audio Senses"
          description="Explorez les différentes dimensions de votre audio en temps réel : forme d'onde, spectre de fréquence, énergie des bandes, pics et analyse ADSR. Comprenez la composition acoustique de votre musique."
          size="icon-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Waveform */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Waveform (Amplitude Temporelle)
              <HelpIcon description="La forme d'onde montre l'amplitude du signal audio au fil du temps. Les pics rouges indiquent les moments les plus forts." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasWaveformRef}
              className="w-full rounded-lg bg-muted"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Amplitude max:</span>
                <span className="ml-2 font-mono">
                  {Math.max(...sensesData.waveform.map(v => Math.abs(v - 128))).toFixed(0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Échantillons:</span>
                <span className="ml-2 font-mono">{sensesData.waveform.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. FFT Spectrum */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RadioIcon className="w-5 h-5" />
              FFT Spectrum (20Hz - 20kHz)
              <HelpIcon description="Le spectre FFT analyse les fréquences présentes dans l'audio. Rouge=basses, Bleu=mids, Violet=aigus." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasFFTRef}
              className="w-full rounded-lg bg-muted"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-red-500">●</span>
                <span className="ml-2">Basses (20-200Hz)</span>
                <div className="font-mono text-xs mt-1">
                  {Math.round(sensesData.bass)}
                </div>
              </div>
              <div>
                <span className="text-blue-500">●</span>
                <span className="ml-2">Mids (200-2kHz)</span>
                <div className="font-mono text-xs mt-1">
                  {Math.round(sensesData.mid)}
                </div>
              </div>
              <div>
                <span className="text-purple-500">●</span>
                <span className="ml-2">Highs (2k-20kHz)</span>
                <div className="font-mono text-xs mt-1">
                  {Math.round(sensesData.treble)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Energy Bands */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Energy Bands (5 Bandes)
              <HelpIcon description="Analyse d'énergie dans 5 bandes de fréquence : basses, bas-mediums, mediums, haut-mediums et aigus." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasEnergyBandsRef}
              className="w-full rounded-lg bg-muted"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
              {[
                { name: 'Bass', value: sensesData.energyBands.bass },
                { name: 'Low-Mid', value: sensesData.energyBands.lowMid },
                { name: 'Mid', value: sensesData.energyBands.mid },
                { name: 'High-Mid', value: sensesData.energyBands.highMid },
                { name: 'Treble', value: sensesData.energyBands.treble },
              ].map((band) => (
                <div key={band.name} className="text-center">
                  <div className="font-mono font-bold">{Math.round(band.value)}</div>
                  <div className="text-muted-foreground">{band.name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Volume & RMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Volume & RMS
              <HelpIcon description="Volume mesuré (0-100%), RMS (niveau d'énergie effective) et énergie globale du signal." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Volume</span>
                <span className="font-mono">{(sensesData.volume * 100).toFixed(1)}%</span>
              </div>
              <Progress value={sensesData.volume * 100} className="h-3" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>RMS (Root Mean Square)</span>
                <span className="font-mono">{(sensesData.rms * 100).toFixed(1)}%</span>
              </div>
              <Progress value={sensesData.rms * 100} className="h-3" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Énergie Globale</span>
                <span className="font-mono">{Math.round(sensesData.energy)}</span>
              </div>
              <Progress value={(sensesData.energy / 255) * 100} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* 5. Peak Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Peak Detection
              <HelpIcon description="Détection des pics acoustiques au fil du temps. Montre quand et où les moments forts se produisent." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasPeakHistoryRef}
              className="w-full rounded-lg bg-muted"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Pic actuel:</span>
                <div className="font-mono text-lg font-bold text-primary">
                  {(sensesData.peak * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Pics détectés:</span>
                <div className="font-mono text-lg">
                  {sensesData.peakHistory.filter(p => p > 0.7).length}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Historique:</span>
                <div className="font-mono text-lg">
                  {sensesData.peakHistory.length} échantillons
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Envelope Following */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Envelope Following (ADSR)
              <HelpIcon description="Analyse ADSR : Attack (montée), Decay (descente initiale), Sustain (soutien), Release (libération). Révèle le caractère dynamique du son." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasEnvelopeRef}
              className="w-full rounded-lg bg-muted"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-green-500">●</span>
                <span className="ml-2">Attack</span>
                <div className="font-mono text-xs mt-1">
                  {sensesData.envelope.attack}ms
                </div>
              </div>
              <div>
                <span className="text-orange-500">●</span>
                <span className="ml-2">Decay</span>
                <div className="font-mono text-xs mt-1">
                  {sensesData.envelope.decay}ms
                </div>
              </div>
              <div>
                <span className="text-blue-500">●</span>
                <span className="ml-2">Sustain</span>
                <div className="font-mono text-xs mt-1">
                  {(sensesData.envelope.sustain * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-red-500">●</span>
                <span className="ml-2">Release</span>
                <div className="font-mono text-xs mt-1">
                  {sensesData.envelope.release}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7. Pitch Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Pitch Detection / Note Detection
              <HelpIcon description="Détection automatique de la note musicale fondamentale et de sa fréquence en Hz. La confiance indique la certitude de la détection." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-6 bg-muted rounded-lg">
              <div className="text-4xl font-bold mb-2">
                {sensesData.pitch.note}
                <span className="text-2xl text-muted-foreground">
                  {sensesData.pitch.octave}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {sensesData.pitch.frequency.toFixed(1)} Hz
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fréquence:</span>
                <div className="font-mono text-lg">
                  {sensesData.pitch.frequency.toFixed(2)} Hz
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Confiance:</span>
                <div className="font-mono text-lg">
                  {(sensesData.pitch.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <Progress 
              value={sensesData.pitch.confidence * 100} 
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* 8. Tempo / BPM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Tempo / BPM Estimation
              <HelpIcon description="Estimation du tempo en BPM (battements par minute) et de la phase du beat. Synchronisez avec le rythme musical." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-6 bg-muted rounded-lg">
              <div className="text-5xl font-bold mb-2 text-primary">
                {Math.round(sensesData.tempo.bpm)}
              </div>
              <div className="text-sm text-muted-foreground">BPM</div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Confiance:</span>
                <div className="font-mono text-lg">
                  {(sensesData.tempo.confidence * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Phase du beat:</span>
                <div className="font-mono text-lg">
                  {(sensesData.tempo.beatPhase * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Beat Phase</span>
                <span className="font-mono">
                  {(sensesData.tempo.beatPhase * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={sensesData.tempo.beatPhase * 100} className="h-3" />
            </div>
            {sensesData.tempo.beatPhase > 0.9 && (
              <div className="text-center text-primary font-bold animate-pulse">
                ● BEAT
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Résumé en bas */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Résumé des Sens Audio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {Math.round(sensesData.energyBands.bass)}
              </div>
              <div className="text-muted-foreground">Bass</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {Math.round(sensesData.energyBands.mid)}
              </div>
              <div className="text-muted-foreground">Mid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {Math.round(sensesData.energyBands.treble)}
              </div>
              <div className="text-muted-foreground">Treble</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {(sensesData.volume * 100).toFixed(0)}%
              </div>
              <div className="text-muted-foreground">Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {(sensesData.peak * 100).toFixed(0)}%
              </div>
              <div className="text-muted-foreground">Peak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {sensesData.pitch.note}{sensesData.pitch.octave}
              </div>
              <div className="text-muted-foreground">Note</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Math.round(sensesData.tempo.bpm)}
              </div>
              <div className="text-muted-foreground">BPM</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {sensesData.pitch.frequency.toFixed(0)}Hz
              </div>
              <div className="text-muted-foreground">Freq</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

