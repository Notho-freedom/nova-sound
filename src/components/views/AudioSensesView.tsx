"use client";

import { useRef, useEffect, useMemo } from 'react';
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
import { useI18n } from '@/i18n';

interface AudioSensesViewProps {
  audioElement: HTMLAudioElement | null;
}

/**
 * Vue complète pour visualiser tous les sens audio
 */
export function AudioSensesView({ audioElement }: AudioSensesViewProps) {
  const { t } = useI18n();
  const sensesData = useAudioSenses(audioElement, {
    enablePitchDetection: true,
    enableBPMDetection: true,
  });

  const canvasWaveformRef = useRef<HTMLCanvasElement>(null);
  const canvasFFTRef = useRef<HTMLCanvasElement>(null);
  const canvasEnergyBandsRef = useRef<HTMLCanvasElement>(null);
  const canvasPeakHistoryRef = useRef<HTMLCanvasElement>(null);
  const canvasEnvelopeRef = useRef<HTMLCanvasElement>(null);

  const energyBandLabels = useMemo(() => ({
    bass: t('audioSensesBandBass'),
    lowMid: t('audioSensesBandLowMid'),
    mid: t('audioSensesBandMid'),
    highMid: t('audioSensesBandHighMid'),
    treble: t('audioSensesBandTreble'),
  }), [t]);

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
      { name: energyBandLabels.bass, value: sensesData.energyBands.bass, color: '#ef4444' },
      { name: energyBandLabels.lowMid, value: sensesData.energyBands.lowMid, color: '#f97316' },
      { name: energyBandLabels.mid, value: sensesData.energyBands.mid, color: '#3b82f6' },
      { name: energyBandLabels.highMid, value: sensesData.energyBands.highMid, color: '#8b5cf6' },
      { name: energyBandLabels.treble, value: sensesData.energyBands.treble, color: '#ec4899' },
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
  }, [sensesData, energyBandLabels]);

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
    <div className="p-6 space-y-6 overflow-y-auto h-full animate-in fade-in duration-300">
      {/* Header - Vision Pro style */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 backdrop-blur-xl border border-white/[0.1] flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
            <Radio className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">
              {t('audioSensesTitle')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('audioSensesSubtitle')}
            </p>
          </div>
        </div>
        <HelpButton
          title={t('audioSensesHelpTitle')}
          description={t('audioSensesHelpDescription')}
          size="icon-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Waveform */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {t('audioSensesWaveformTitle')}
              <HelpIcon description={t('audioSensesWaveformHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasWaveformRef}
              className="w-full rounded-xl bg-white/[0.02] border border-white/[0.05]"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('audioSensesMaxAmplitude')}</span>
                <span className="ml-2 font-mono">
                  {Math.max(...sensesData.waveform.map(v => Math.abs(v - 128))).toFixed(0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('audioSensesSamples')}</span>
                <span className="ml-2 font-mono">{sensesData.waveform.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. FFT Spectrum */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RadioIcon className="w-5 h-5 text-primary" />
              {t('audioSensesFftTitle')}
              <HelpIcon description={t('audioSensesFftHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasFFTRef}
              className="w-full rounded-xl bg-white/[0.02] border border-white/[0.05]"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-destructive">●</span>
                <span className="ml-2">{t('audioSensesFftBass')}</span>
                <div className="font-mono text-xs mt-1">
                  {Math.round(sensesData.bass)}
                </div>
              </div>
              <div>
                <span className="text-primary">●</span>
                <span className="ml-2">{t('audioSensesFftMid')}</span>
                <div className="font-mono text-xs mt-1">
                  {Math.round(sensesData.mid)}
                </div>
              </div>
              <div>
                <span className="text-accent">●</span>
                <span className="ml-2">{t('audioSensesFftHigh')}</span>
                <div className="font-mono text-xs mt-1">
                  {Math.round(sensesData.treble)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Energy Bands */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              {t('audioSensesEnergyTitle')}
              <HelpIcon description={t('audioSensesEnergyHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasEnergyBandsRef}
              className="w-full rounded-xl bg-white/[0.02] border border-white/[0.05]"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
              {[
                { name: energyBandLabels.bass, value: sensesData.energyBands.bass },
                { name: energyBandLabels.lowMid, value: sensesData.energyBands.lowMid },
                { name: energyBandLabels.mid, value: sensesData.energyBands.mid },
                { name: energyBandLabels.highMid, value: sensesData.energyBands.highMid },
                { name: energyBandLabels.treble, value: sensesData.energyBands.treble },
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
        <Card className="bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              {t('audioSensesVolumeTitle')}
              <HelpIcon description={t('audioSensesVolumeHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{t('audioSensesVolumeLabel')}</span>
                <span className="font-mono">{(sensesData.volume * 100).toFixed(1)}%</span>
              </div>
              <Progress value={sensesData.volume * 100} className="h-3 bg-white/[0.05]" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{t('audioSensesRmsLabel')}</span>
                <span className="font-mono">{(sensesData.rms * 100).toFixed(1)}%</span>
              </div>
              <Progress value={sensesData.rms * 100} className="h-3 bg-white/[0.05]" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{t('audioSensesGlobalEnergy')}</span>
                <span className="font-mono">{Math.round(sensesData.energy)}</span>
              </div>
              <Progress value={(sensesData.energy / 255) * 100} className="h-3 bg-white/[0.05]" />
            </div>
          </CardContent>
        </Card>

        {/* 5. Peak Detection */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              {t('audioSensesPeakTitle')}
              <HelpIcon description={t('audioSensesPeakHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasPeakHistoryRef}
              className="w-full rounded-xl bg-white/[0.02] border border-white/[0.05]"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('audioSensesPeakCurrent')}</span>
                <div className="font-mono text-lg font-bold text-primary">
                  {(sensesData.peak * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('audioSensesPeakDetected')}</span>
                <div className="font-mono text-lg">
                  {sensesData.peakHistory.filter(p => p > 0.7).length}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('audioSensesPeakHistory')}</span>
                <div className="font-mono text-lg">
                  {t('audioSensesSamplesCount', { count: sensesData.peakHistory.length })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Envelope Following */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('audioSensesEnvelopeTitle')}
              <HelpIcon description={t('audioSensesEnvelopeHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <canvas
              ref={canvasEnvelopeRef}
              className="w-full rounded-xl bg-white/[0.02] border border-white/[0.05]"
              width={800}
              height={200}
            />
            <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-green-500">●</span>
                <span className="ml-2">{t('audioSensesAttack')}</span>
                <div className="font-mono text-xs mt-1">
                  {sensesData.envelope.attack}ms
                </div>
              </div>
              <div>
                <span className="text-orange-500">●</span>
                <span className="ml-2">{t('audioSensesDecay')}</span>
                <div className="font-mono text-xs mt-1">
                  {sensesData.envelope.decay}ms
                </div>
              </div>
              <div>
                <span className="text-blue-500">●</span>
                <span className="ml-2">{t('audioSensesSustain')}</span>
                <div className="font-mono text-xs mt-1">
                  {(sensesData.envelope.sustain * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-red-500">●</span>
                <span className="ml-2">{t('audioSensesRelease')}</span>
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
              {t('audioSensesPitchTitle')}
              <HelpIcon description={t('audioSensesPitchHelp')} />
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
                <span className="text-muted-foreground">{t('audioSensesFrequency')}</span>
                <div className="font-mono text-lg">
                  {sensesData.pitch.frequency.toFixed(2)} Hz
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('audioSensesConfidence')}</span>
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
              {t('audioSensesTempoTitle')}
              <HelpIcon description={t('audioSensesTempoHelp')} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-6 bg-muted rounded-lg">
              <div className="text-5xl font-bold mb-2 text-primary">
                {Math.round(sensesData.tempo.bpm)}
              </div>
              <div className="text-sm text-muted-foreground">{t('audioSensesBpmLabel')}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('audioSensesConfidence')}</span>
                <div className="font-mono text-lg">
                  {(sensesData.tempo.confidence * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('audioSensesBeatPhase')}</span>
                <div className="font-mono text-lg">
                  {(sensesData.tempo.beatPhase * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{t('audioSensesBeatPhaseLabel')}</span>
                <span className="font-mono">
                  {(sensesData.tempo.beatPhase * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={sensesData.tempo.beatPhase * 100} className="h-3" />
            </div>
            {sensesData.tempo.beatPhase > 0.9 && (
              <div className="text-center text-primary font-bold animate-pulse">
                {t('audioSensesBeatPulse')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Résumé en bas */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('audioSensesSummaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {Math.round(sensesData.energyBands.bass)}
              </div>
              <div className="text-muted-foreground">{t('audioSensesBandBass')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {Math.round(sensesData.energyBands.mid)}
              </div>
              <div className="text-muted-foreground">{t('audioSensesBandMid')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {Math.round(sensesData.energyBands.treble)}
              </div>
              <div className="text-muted-foreground">{t('audioSensesBandTreble')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {(sensesData.volume * 100).toFixed(0)}%
              </div>
              <div className="text-muted-foreground">{t('audioSensesVolumeLabel')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {(sensesData.peak * 100).toFixed(0)}%
              </div>
              <div className="text-muted-foreground">{t('audioSensesPeakLabel')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {sensesData.pitch.note}{sensesData.pitch.octave}
              </div>
              <div className="text-muted-foreground">{t('audioSensesNoteLabel')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Math.round(sensesData.tempo.bpm)}
              </div>
              <div className="text-muted-foreground">{t('audioSensesBpmLabel')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {sensesData.pitch.frequency.toFixed(0)}Hz
              </div>
              <div className="text-muted-foreground">{t('audioSensesFrequencyLabel')}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

