import { useState } from 'react';
import { Brain, Globe, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { ModelInfo } from '@/lib/types';
import { getModelCapabilities } from '@/lib/openrouter';

interface AdvancedSettingsProps {
  selectedModels: string[];
  models: ModelInfo[];
  // Reasoning settings
  reasoningEnabled: boolean;
  reasoningEffort: 'low' | 'medium' | 'high';
  onReasoningChange: (enabled: boolean, effort: 'low' | 'medium' | 'high') => void;
  // Tools settings (temporarily disabled)
  // Web search settings
  webSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  className?: string;
}


export default function AdvancedSettings({
  selectedModels,
  models,
  reasoningEnabled,
  reasoningEffort,
  onReasoningChange,
  webSearchEnabled,
  onWebSearchChange,
  className = '',
}: AdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check capabilities across selected models
  const capabilities = selectedModels.map(modelId => {
    const model = models.find(m => m.id === modelId);
    return model ? getModelCapabilities(model) : null;
  }).filter(Boolean);

  const supportsReasoning = capabilities.some(cap => cap?.supportsReasoning);
  const supportsTools = false;
  const supportsWebSearch = capabilities.some(cap => cap?.supportsWebSearch);


  if (selectedModels.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
      >
        <Settings className="size-4" />
        <span>Advanced Features</span>
        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {isExpanded && (
        <div className="space-y-4 bg-white/5 rounded-lg p-4 border border-white/10">
          {/* Reasoning Settings */}
          {supportsReasoning && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-purple-400" />
                  <span className="text-sm font-medium">Reasoning Mode</span>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                    EXPERIMENTAL
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reasoningEnabled}
                    onChange={(e) => onReasoningChange(e.target.checked, reasoningEffort)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>
              
              {reasoningEnabled && (
                <div className="ml-6 space-y-2">
                  <p className="text-xs text-gray-400">
                    Enable internal reasoning traces for complex problems
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs">Effort:</label>
                    <select
                      value={reasoningEffort}
                      onChange={(e) => onReasoningChange(reasoningEnabled, e.target.value as 'low' | 'medium' | 'high')}
                      className="text-xs bg-black/20 border border-white/10 rounded px-2 py-1"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Function Calling / Tools */}
          {false && (
            <div />
          )}

          {/* Web Search */}
          {supportsWebSearch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-orange-400" />
                  <span className="text-sm font-medium">Web Search</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webSearchEnabled}
                    onChange={(e) => onWebSearchChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
              
              {webSearchEnabled && (
                <div className="ml-6">
                  <p className="text-xs text-gray-400">
                    Allow models to search the web for current information
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Capability Summary */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Available features:</span>
              {supportsReasoning && (
                <span className="flex items-center gap-1 text-purple-400">
                  <Brain className="size-3" />
                  Reasoning
                </span>
              )}
              {supportsWebSearch && (
                <span className="flex items-center gap-1 text-orange-400">
                  <Globe className="size-3" />
                  Web
                </span>
              )}
              {!supportsReasoning && !supportsTools && !supportsWebSearch && (
                <span className="text-gray-500">No advanced features available for selected models</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
