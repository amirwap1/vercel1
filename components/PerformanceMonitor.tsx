// components/PerformanceMonitor.tsx - Real-time performance monitoring
'use client'

import { useState, useEffect } from 'react'
import { Activity, Clock, Zap, Globe, AlertTriangle } from 'lucide-react'

type HealthData = {
  status: string
  timestamp: string
  region: string
  responseTime: string
  services: {
    kv: string
    edge: string
    cache: string
    runtime: string
  }
  metrics: {
    uptime: number
    memoryUsage?: {
      heapUsed: number
      heapTotal: number
      external: number
    }
    cacheStats: {
      memoryEntries: number
      hitRate: number
    }
    performance: {
      averageResponseTime: number
      p95ResponseTime: number
      p99ResponseTime: number
      totalRequests: number
    }
  }
}

export default function PerformanceMonitor() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const fetchHealth = async () => {
    try {
      setError(null)
      
      const response = await fetch('/api/health')
      const data = await response.json()
      
      if (response.ok && data.success) {
        setHealthData(data.data)
        setLastCheck(new Date())
      } else {
        setError(data.error || 'Health check failed')
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !healthData) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p className="text-sm text-red-600 font-medium">Monitoring Error</p>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={fetchHealth}
          className="btn-primary text-sm mt-3"
          disabled={loading}
        >
          <Activity className="h-3 w-3 mr-1" />
          Retry
        </button>
      </div>
    )
  }

  if (!healthData) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No monitoring data available</p>
      </div>
    )
  }

  const isHealthy = healthData.status === 'healthy'
  const responseTime = parseInt(healthData.responseTime.replace('ms', '')) || 0
  const uptime = Math.round(healthData.metrics.uptime / 3600) // Convert to hours

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-medium text-gray-900">System Status</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Globe className="h-3 w-3" />
          {healthData.region}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Response Time</div>
              <div className={`stat-value text-lg ${responseTime <= 50 ? 'text-green-600' : responseTime <= 100 ? 'text-yellow-600' : 'text-red-600'}`}>
                {healthData.responseTime}
              </div>
            </div>
            <Clock className="h-5 w-5 text-blue-500" />
          </div>
        </div>

        <div className="stat-item">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Cache Hit Rate</div>
              <div className="stat-value text-lg">
                {Math.round(healthData.metrics.cacheStats.hitRate)}%
              </div>
            </div>
            <Zap className="h-5 w-5 text-green-500" />
          </div>
        </div>

        <div className="stat-item">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Uptime</div>
              <div className="stat-value text-lg">
                {uptime}h
              </div>
            </div>
            <Activity className="h-5 w-5 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Metrics</h4>
        <div className="space-y-3">
          {/* Average Response Time */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Average Response Time</span>
              <span className="font-medium">{Math.round(healthData.metrics.performance.averageResponseTime)}ms</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${Math.min((healthData.metrics.performance.averageResponseTime / 100) * 100, 100)}%`,
                  backgroundColor: healthData.metrics.performance.averageResponseTime <= 50 ? '#10b981' : '#f59e0b'
                }}
              />
            </div>
          </div>

          {/* P95 Response Time */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">P95 Response Time</span>
              <span className="font-medium">{Math.round(healthData.metrics.performance.p95ResponseTime)}ms</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${Math.min((healthData.metrics.performance.p95ResponseTime / 200) * 100, 100)}%`,
                  backgroundColor: healthData.metrics.performance.p95ResponseTime <= 100 ? '#10b981' : '#f59e0b'
                }}
              />
            </div>
          </div>

          {/* Total Requests */}
          <div className="text-sm text-gray-600">
            <span>Total Requests:</span>
            <span className="font-medium ml-1">{healthData.metrics.performance.totalRequests.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Service Health</h4>
        <div className="space-y-2">
          {Object.entries(healthData.services).map(([service, status]) => (
            <div key={service} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 capitalize">{service}</span>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={`text-xs font-medium ${status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                  {status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Memory Usage (if available) */}
      {healthData.metrics.memoryUsage && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Memory Usage</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Heap Used</span>
              <span className="font-medium">{healthData.metrics.memoryUsage.heapUsed} MB</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${(healthData.metrics.memoryUsage.heapUsed / healthData.metrics.memoryUsage.heapTotal) * 100}%`,
                  backgroundColor: (healthData.metrics.memoryUsage.heapUsed / healthData.metrics.memoryUsage.heapTotal) > 0.8 ? '#ef4444' : '#10b981'
                }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {healthData.metrics.memoryUsage.heapUsed} MB / {healthData.metrics.memoryUsage.heapTotal} MB
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {lastCheck && (
        <div className="text-xs text-gray-400 text-center border-t pt-3">
          Last checked: {lastCheck.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}