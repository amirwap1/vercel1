// app/page.tsx - Homepage with API tester and monitoring
import { Suspense } from 'react'
import ApiTester from '@/components/ApiTester'
import CacheStats from '@/components/CacheStats'
import PerformanceMonitor from '@/components/PerformanceMonitor'
import { Activity, Zap, Globe, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Zap className="h-12 w-12 text-blue-600" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full animate-pulse" />
            </div>
            <h1 className="text-5xl font-bold text-gradient">
              Vercel Edge JSON API
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
            High-performance JSON API with Edge Runtime, Vercel KV, and Server Rendering. 
            Built for <span className="font-semibold text-blue-600">global sub-50ms</span> response times.
          </p>
          
          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="badge badge-success flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Response: &lt;50ms globally
            </div>
            <div className="badge badge-info flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Edge Runtime
            </div>
            <div className="badge bg-purple-100 text-purple-800 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Server Rendered
            </div>
            <div className="badge bg-emerald-100 text-emerald-800 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Production Ready
            </div>
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - API Tester */}
          <div className="xl:col-span-2 space-y-8">
            <div className="card animate-slide-up">
              <div className="card-header">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                  <Activity className="h-6 w-6 text-blue-600" />
                  Interactive API Tester
                </h2>
                <p className="text-gray-600 mt-1">
                  Test your JSON API endpoints with real-time responses and performance metrics
                </p>
              </div>
              <div className="card-body">
                <Suspense fallback={<LoadingSkeleton />}>
                  <ApiTester />
                </Suspense>
              </div>
            </div>

            {/* API Endpoints Documentation */}
            <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="card-header">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Available Endpoints
                </h2>
                <p className="text-gray-600 mt-1">
                  Complete API reference with examples and response formats
                </p>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {endpoints.map((endpoint, index) => (
                    <div 
                      key={endpoint.name} 
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors group"
                      style={{ animationDelay: `${0.2 + index * 0.05}s` }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`badge ${endpoint.method === 'GET' ? 'badge-success' : 
                            endpoint.method === 'POST' ? 'badge-info' : 'badge-warning'}`}>
                            {endpoint.method}
                          </span>
                          <span className="text-sm font-medium group-hover:text-blue-600 transition-colors">
                            {endpoint.name}
                          </span>
                        </div>
                        {endpoint.responseTime && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            ~{endpoint.responseTime}
                          </span>
                        )}
                      </div>
                      <code className="text-xs text-gray-600 block break-all bg-gray-100 p-2 rounded mb-2">
                        {endpoint.path}
                      </code>
                      <p className="text-sm text-gray-500">
                        {endpoint.description}
                      </p>
                      {endpoint.example && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                            View example →
                          </summary>
                          <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded mt-2 overflow-x-auto">
                            {endpoint.example}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Monitoring & Stats */}
          <div className="space-y-6">
            <div className="card animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Cache Statistics
                </h2>
              </div>
              <div className="card-body">
                <Suspense fallback={<LoadingSkeleton />}>
                  <CacheStats />
                </Suspense>
              </div>
            </div>

            <div className="card animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-600" />
                  Performance Monitor
                </h2>
              </div>
              <div className="card-body">
                <Suspense fallback={<LoadingSkeleton />}>
                  <PerformanceMonitor />
                </Suspense>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-800">
                  Quick Actions
                </h2>
              </div>
              <div className="card-body space-y-3">
                <button 
                  onClick={() => window.location.href = '/api/health'} 
                  className="btn-secondary w-full justify-start flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Check System Health
                </button>
                <button 
                  onClick={() => window.location.href = '/api/data/cache'} 
                  className="btn-secondary w-full justify-start flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  View Cache Stats
                </button>
                <button 
                  onClick={() => navigator.clipboard.writeText(window.location.origin + '/api/data')} 
                  className="btn-secondary w-full justify-start flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Copy API URL
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="border-t border-gray-200 pt-8">
            <p className="text-sm">
              Built with ❤️ using <strong>Vercel Edge Runtime</strong> • 
              <a href="https://github.com/yourusername/vercel-edge-json-api" className="text-blue-600 hover:text-blue-800 ml-1">
                View on GitHub
              </a>
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <span>Deployed on Vercel</span>
              <span>•</span>
              <span>TypeScript Ready</span>
              <span>•</span>
              <span>Edge Runtime</span>
              <span>•</span>
              <span>MIT License</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  )
}

// API endpoints data
const endpoints = [
  {
    name: 'Get JSON Data',
    method: 'GET',
    path: '/api/data?key={key}&format={format}',
    description: 'Fetch JSON data with edge caching and regional optimization',
    responseTime: '5-50ms',
    example: `curl "https://your-api.vercel.app/api/data?key=users"

Response:
{
  "success": true,
  "data": {
    "id": "users",
    "data": {...},
    "timestamp": "2023-12-11T10:00:00Z"
  },
  "cacheStatus": "hit",
  "responseTime": "12ms"
}`
  },
  {
    name: 'Update Data',
    method: 'POST',
    path: '/api/data',
    description: 'Update JSON data with automatic cache invalidation',
    responseTime: '50-150ms',
    example: `curl -X POST "https://your-api.vercel.app/api/data" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "users", "data": {...}}'

Response:
{
  "success": true,
  "data": {
    "key": "users",
    "size": "1.2 KB",
    "url": "/api/data?key=users"
  },
  "message": "Data updated successfully"
}`
  },
  {
    name: 'File Upload',
    method: 'POST',
    path: '/api/update',
    description: 'Upload JSON files with validation and processing',
    responseTime: '100-300ms',
    example: `curl -X POST "https://your-api.vercel.app/api/update" \\
  -F "key=config" \\
  -F "file=@data.json"

Response:
{
  "success": true,
  "data": {
    "key": "config",
    "filename": "data.json",
    "size": "5.7 KB"
  }
}`
  },
  {
    name: 'Cache Management',
    method: 'GET',
    path: '/api/data/cache?action={action}',
    description: 'View cache statistics and management operations',
    responseTime: '10-30ms',
  },
  {
    name: 'Health Check',
    method: 'GET',
    path: '/api/health',
    description: 'System health, metrics, and service status',
    responseTime: '5-15ms',
    example: `curl "https://your-api.vercel.app/api/health"

Response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "responseTime": "12ms",
    "services": {
      "kv": "healthy",
      "edge": "healthy"
    }
  }
}`
  },
  {
    name: 'Update History',
    method: 'GET',
    path: '/api/update?key={key}&action=history',
    description: 'View update history and statistics for data keys',
    responseTime: '20-50ms',
  },
]