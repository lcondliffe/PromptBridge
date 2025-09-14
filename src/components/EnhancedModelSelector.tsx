import { useState, useMemo } from 'react';
import { Search, Filter, Image as ImageIcon, Wrench, Brain, Globe, DollarSign } from 'lucide-react';
import { getModelCapabilities } from '@/lib/openrouter';
import type { ModelInfo } from '@/lib/types';

interface EnhancedModelSelectorProps {
  models: ModelInfo[];
  selectedModels: string[];
  onSelectionChange: (modelIds: string[]) => void;
  className?: string;
}

type FilterType = 'all' | 'tools' | 'images' | 'reasoning' | 'web_search' | 'free';

export default function EnhancedModelSelector({
  models,
  selectedModels,
  onSelectionChange,
  className = '',
}: EnhancedModelSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showDetails, setShowDetails] = useState(false);

  const filteredModels = useMemo(() => {
    const filtered = models.filter(model => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        model.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Capability filter
      if (activeFilter === 'all') return true;

      const capabilities = getModelCapabilities(model);
      
      switch (activeFilter) {
        case 'tools':
          return capabilities.supportsTools;
        case 'images':
          return capabilities.supportsImages;
        case 'reasoning':
          return capabilities.supportsReasoning;
        case 'web_search':
          return capabilities.supportsWebSearch;
        case 'free':
          return model.pricing?.prompt === '0' && model.pricing?.completion === '0';
        default:
          return true;
      }
    });

    // Sort by provider, then by name
    return filtered.sort((a, b) => {
      const providerA = a.provider || '';
      const providerB = b.provider || '';
      
      if (providerA !== providerB) {
        return providerA.localeCompare(providerB);
      }
      
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
  }, [models, searchTerm, activeFilter]);

  const handleModelToggle = (modelId: string) => {
    const isSelected = selectedModels.includes(modelId);
    if (isSelected) {
      onSelectionChange(selectedModels.filter(id => id !== modelId));
    } else {
      onSelectionChange([...selectedModels, modelId]);
    }
  };

  const handleSelectAll = () => {
    const allVisible = filteredModels.map(m => m.id);
    onSelectionChange(allVisible);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const filterOptions = [
    { key: 'all', label: 'All Models', icon: null },
    { key: 'tools', label: 'Function Calling', icon: Wrench },
    { key: 'images', label: 'Vision/Images', icon: ImageIcon },
    { key: 'reasoning', label: 'Reasoning', icon: Brain },
    { key: 'web_search', label: 'Web Search', icon: Globe },
    { key: 'free', label: 'Free', icon: DollarSign },
  ] as const;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeFilter === key
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {Icon && <Icon className="size-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-purple-400 hover:text-purple-300 underline"
          >
            Select All ({filteredModels.length})
          </button>
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-400 hover:text-gray-300 underline"
          >
            Clear All
          </button>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
        >
          <Filter className="size-3" />
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Model List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredModels.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No models match your criteria</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveFilter('all');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 underline mt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredModels.map((model) => {
            const isSelected = selectedModels.includes(model.id);
            const capabilities = getModelCapabilities(model);
            const isFree = model.pricing?.prompt === '0' && model.pricing?.completion === '0';
            
            return (
              <div
                key={model.id}
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                onClick={() => handleModelToggle(model.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleModelToggle(model.id)}
                      className="mt-1 size-4 rounded border-white/20 bg-transparent"
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {model.name || model.id}
                        </h4>
                        {model.provider && (
                          <span className="text-xs bg-gray-700/50 text-gray-300 px-1.5 py-0.5 rounded shrink-0">
                            {model.provider}
                          </span>
                        )}
                        {isFree && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded shrink-0">
                            FREE
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        {model.id}
                      </p>
                      
                      {/* Capabilities */}
                      <div className="flex items-center gap-2 mb-2">
                        {capabilities.supportsTools && (
                          <div className="flex items-center gap-1 text-xs text-blue-400">
                            <Wrench className="size-3" />
                            <span>Tools</span>
                          </div>
                        )}
                        {capabilities.supportsImages && (
                          <div className="flex items-center gap-1 text-xs text-green-400">
                            <ImageIcon className="size-3" />
                            <span>Vision</span>
                          </div>
                        )}
                        {capabilities.supportsReasoning && (
                          <div className="flex items-center gap-1 text-xs text-purple-400">
                            <Brain className="size-3" />
                            <span>Reasoning</span>
                          </div>
                        )}
                        {capabilities.supportsWebSearch && (
                          <div className="flex items-center gap-1 text-xs text-orange-400">
                            <Globe className="size-3" />
                            <span>Web</span>
                          </div>
                        )}
                      </div>
                      
                      {showDetails && (
                        <div className="space-y-2 text-xs text-gray-400">
                          {model.description && (
                            <p className="line-clamp-2">{model.description}</p>
                          )}
                          
                          <div className="flex items-center gap-4">
                            {model.context_length && (
                              <div className="flex items-center gap-1">
                                <span>Context:</span>
                                <span className="font-mono">
                                  {model.context_length.toLocaleString()}
                                </span>
                              </div>
                            )}
                            
                            {model.pricing && !isFree && (
                              <div className="flex items-center gap-2">
                                <span>Input:</span>
                                <span className="font-mono">
                                  ${parseFloat(model.pricing.prompt || '0').toFixed(6)}
                                </span>
                                <span>Output:</span>
                                <span className="font-mono">
                                  ${parseFloat(model.pricing.completion || '0').toFixed(6)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selection Summary */}
      <div className="text-xs text-gray-400 bg-white/5 rounded-lg p-2">
        {selectedModels.length === 0 ? (
          'No models selected'
        ) : (
          `${selectedModels.length} model${selectedModels.length === 1 ? '' : 's'} selected`
        )}
      </div>
    </div>
  );
}