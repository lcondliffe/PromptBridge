import { useMemo } from 'react';
import { Clock, Zap, BarChart3, Server } from 'lucide-react';
import type { ResponseMetrics } from '@/lib/types';

interface PerformanceMetricsProps {
  metrics: Partial<ResponseMetrics> | null;
  isStreaming?: boolean;
  className?: string;
}

export default function PerformanceMetrics({ 
  metrics, 
  isStreaming = false, 
  className = '' 
}: PerformanceMetricsProps) {
  const displayMetrics = useMemo(() => {
    if (!metrics) return null;

    const formatDuration = (ms: number | undefined) => {
      if (ms === undefined) return '—';
      if (ms < 1000) return `${Math.round(ms)}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatTokensPerSec = (tps: number | undefined) => {
      if (tps === undefined || tps === 0) return '—';
      return `${tps.toFixed(1)} t/s`;
    };

    const formatTokens = (tokens: number | undefined) => {
      if (tokens === undefined) return '—';
      return tokens.toString();
    };

    return {
      firstTokenLatency: formatDuration(metrics.firstTokenLatency),
      totalDuration: formatDuration(metrics.totalDuration),
      tokensPerSecond: formatTokensPerSec(metrics.tokensPerSecond),
      totalTokens: formatTokens(metrics.totalTokens),
      provider: metrics.provider || '—',
      isComplete: Boolean(metrics.endTime),
    };
  }, [metrics]);

  if (!displayMetrics) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-gray-400 ${className}`}>
      {/* First Token Latency */}
      <div className="flex items-center gap-1.5">
        <Clock className="size-3" />
        <span className="font-mono">
          {displayMetrics.firstTokenLatency}
        </span>
        <span className="text-gray-500">TTFT</span>
      </div>

      {/* Tokens per Second */}
      {displayMetrics.tokensPerSecond !== '—' && (
        <div className="flex items-center gap-1.5">
          <Zap className="size-3" />
          <span className="font-mono">
            {displayMetrics.tokensPerSecond}
          </span>
        </div>
      )}

      {/* Total Duration */}
      {displayMetrics.isComplete && (
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-3" />
          <span className="font-mono">
            {displayMetrics.totalDuration}
          </span>
          <span className="text-gray-500">total</span>
        </div>
      )}

      {/* Token Count */}
      {displayMetrics.totalTokens !== '—' && (
        <div className="flex items-center gap-1.5">
          <span className="font-mono">
            {displayMetrics.totalTokens}
          </span>
          <span className="text-gray-500">tokens</span>
        </div>
      )}

      {/* Provider */}
      {displayMetrics.provider !== '—' && (
        <div className="flex items-center gap-1.5">
          <Server className="size-3" />
          <span className="text-gray-500">{displayMetrics.provider}</span>
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center gap-1.5">
          <div className="size-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400">streaming</span>
        </div>
      )}
    </div>
  );
}

// Compact version for inline display
export function CompactPerformanceMetrics({ 
  metrics, 
  isStreaming = false,
  className = '' 
}: PerformanceMetricsProps) {
  if (!metrics) return null;

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTokensPerSec = (tps: number | undefined) => {
    if (tps === undefined || tps === 0) return null;
    return `${tps.toFixed(1)}t/s`;
  };

  return (
    <div className={`flex items-center gap-2 text-xs text-gray-500 font-mono ${className}`}>
      <span>{formatDuration(metrics.firstTokenLatency)}</span>
      {metrics.tokensPerSecond && (
        <>
          <span>•</span>
          <span>{formatTokensPerSec(metrics.tokensPerSecond)}</span>
        </>
      )}
      {metrics.provider && (
        <>
          <span>•</span>
          <span className="text-gray-400">{metrics.provider}</span>
        </>
      )}
      {isStreaming && (
        <div className="size-1.5 bg-green-400 rounded-full animate-pulse ml-1" />
      )}
    </div>
  );
}