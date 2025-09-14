import { useState, useEffect, useCallback } from 'react';
import { DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import { checkBalance, estimateCost, type BalanceInfo, type CostEstimate } from '@/lib/openrouter';
import type { ModelInfo } from '@/lib/types';

interface BalanceDisplayProps {
  apiKey: string;
  className?: string;
}

interface CostEstimatorProps {
  promptText: string;
  selectedModels: string[];
  models: ModelInfo[];
  maxTokens: number;
  className?: string;
}

export function BalanceDisplay({ apiKey, className = '' }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!apiKey.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await checkBalance(apiKey);
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (!apiKey.trim()) {
    return null;
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-400 ${className}`}>
        <DollarSign className="size-4 animate-pulse" />
        <span>Checking balance...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-400 ${className}`}>
        <AlertTriangle className="size-4" />
        <span>Balance unavailable</span>
        <button
          onClick={fetchBalance}
          className="text-xs underline hover:no-underline"
        >
          retry
        </button>
      </div>
    );
  }

  if (!balance?.data) {
    return null;
  }

  const { data } = balance;
  const remaining = data.limit ? data.limit - data.usage : null;
  const isLowBalance = data.limit && (data.usage / data.limit) > 0.8;
  const usagePercent = data.limit ? Math.round((data.usage / data.limit) * 100) : 0;

  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      <div className="flex items-center gap-2">
        <DollarSign className={`size-4 ${isLowBalance ? 'text-yellow-400' : 'text-gray-400'}`} />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
              ${data.usage.toFixed(3)} used
              {remaining !== null && ` • $${remaining.toFixed(3)} left`}
            </span>
            {data.is_free_tier && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                FREE
              </span>
            )}
          </div>
          {data.limit && (
            <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isLowBalance ? 'bg-yellow-400' : 'bg-green-400'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
      
      {isLowBalance && (
        <div className="flex items-center gap-1 text-yellow-400">
          <AlertTriangle className="size-3" />
          <span className="text-xs">Low balance</span>
        </div>
      )}
      
      <button
        onClick={fetchBalance}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        title="Refresh balance"
      >
        <TrendingUp className="size-3" />
      </button>
    </div>
  );
}

export function CostEstimator({ 
  promptText, 
  selectedModels, 
  models, 
  maxTokens,
  className = '' 
}: CostEstimatorProps) {
  const estimates = selectedModels
    .map(modelId => {
      const model = models.find(m => m.id === modelId);
      if (!model || !model.pricing) return null;
      
      return estimateCost(promptText, maxTokens || 1024, model);
    })
    .filter(Boolean) as CostEstimate[];

  const totalCost = estimates.reduce((sum, est) => sum + est.totalCost, 0);

  if (estimates.length === 0 || totalCost === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-gray-400 ${className}`}>
      <DollarSign className="size-3" />
      <span className="font-mono">
        ~${totalCost < 0.001 ? '<0.001' : totalCost.toFixed(3)}
      </span>
      <span className="text-gray-500">estimated</span>
      {estimates.length > 1 && (
        <span className="text-gray-500">({estimates.length} models)</span>
      )}
    </div>
  );
}

// Compact version for toolbar display
export function CompactBalanceDisplay({ apiKey, className = '' }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiKey.trim()) return;
    
    setLoading(true);
    checkBalance(apiKey)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (!apiKey.trim() || loading || !balance?.data) {
    return null;
  }

  const { data } = balance;
  const remaining = data.limit ? data.limit - data.usage : null;
  const isLowBalance = data.limit && (data.usage / data.limit) > 0.8;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      <DollarSign className={`size-3 ${isLowBalance ? 'text-yellow-400' : 'text-gray-400'}`} />
      <span className="font-mono text-gray-300">
        ${data.usage.toFixed(3)}
        {remaining !== null && ` • $${remaining.toFixed(3)} left`}
      </span>
      {data.is_free_tier && (
        <span className="text-blue-400">FREE</span>
      )}
    </div>
  );
}