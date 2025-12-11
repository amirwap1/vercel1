// components/CacheStats.tsx - Cache statistics and management
'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Trash2, Database, MemoryStick, TrendingUp } from 'lucide-react'

type CacheStats = {
  kv: {
    totalEntries: number
    keys: string[]
    hasMore: boolean
  }
  memory: {
    entries: number
    keys: string[]
  }
  summary: {
    totalCacheKeys: number
    kvCacheSize: number
    memoryCacheSize: number
  }
}

export default function CacheStats() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/data/cache?action=stats')
      const data = await response.json()
      
      if (response.ok && data.success) {
        setStats(data.data)
        setLastRefresh(new Date())
      } else {
        setError(data.error || 'Failed to fetch cache stats')
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const clearCache = async () => {
    if (!confirm('Are you sure you want to clear all cache? This action cannot be undone.')) {
      return
    }

    try {
      setClearing(true)
      
      const response = await fetch('/api/data/cache?action=clear')
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Refresh stats after clearing
        await fetchStats()
      } else {
        setError(data.error || 'Failed to clear cache')
      }
    } catch (err) {
      setError('Failed to clear cache: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    fetchStats()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Cache Error</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
        <button
          onClick={fetchStats}
          className="btn-primary text-sm"
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No cache data available</p>
      </div>
    )
  }

  const cacheHitRate = stats.summary.totalCacheKeys > 0 
    ? Math.round((stats.memory.entries / stats.summary.totalCacheKeys) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-gray-900">Cache Overview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="btn-secondary text-xs p-2"
            title="Refresh Stats"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={clearCache}
            disabled={clearing || stats.summary.totalCacheKeys === 0}
            className="btn-danger text-xs p-2"
            title="Clear All Cache"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Total Entries</div>
              <div className="stat-value">{stats.summary.totalCacheKeys}</div>
            </div>
            <TrendingUp className="h-6 w-6 text-blue-500" />
          </div>
        </div>

        <div className="stat-item">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">KV Storage</div>
              <div className="stat-value">{stats.kv.totalEntries}</div>
            </div>
            <Database className="h-6 w-6 text-green-500" />
          </div>
        </div>

        <div className="stat-item">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Memory Cache</div>
              <div className="stat-value">{stats.memory.entries}</div>
            </div>
            <MemoryStick className="h-6 w-6 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Cache Hit Rate */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Cache Efficiency</span>
          <span className="text-sm font-bold text-blue-600">{cacheHitRate}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${cacheHitRate}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Memory cache ratio indicates hot data accessibility
        </p>
      </div>

      {/* Cache Keys Preview */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Cache Keys</h4>
        
        {/* KV Keys */}
        {stats.kv.keys.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Database className="h-3 w-3" />
              KV Store ({stats.kv.totalEntries} total)
            </div>
            <div className="space-y-1">
              {stats.kv.keys.slice(0, 5).map((key, index) => (
                <div key={index} className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                  {key}
                </div>
              ))}
              {stats.kv.hasMore && (
                <div className="text-xs text-gray-400 italic">
                  ... and {stats.kv.totalEntries - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Memory Keys */}
        {stats.memory.keys.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <MemoryStick className="h-3 w-3" />
              Memory Cache ({stats.memory.entries} active)
            </div>
            <div className="space-y-1">
              {stats.memory.keys.slice(0, 3).map((key, index) => (
                <div key={index} className="text-xs bg-green-100 px-2 py-1 rounded font-mono">
                  {key}
                </div>
              ))}
              {stats.memory.keys.length > 3 && (
                <div className="text-xs text-gray-400 italic">
                  ... and {stats.memory.keys.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {stats.kv.keys.length === 0 && stats.memory.keys.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No cache entries found
          </div>
        )}
      </div>

      {/* Last Updated */}
      {lastRefresh && (
        <div className="text-xs text-gray-400 text-center">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}