// lib/utils.ts - Helper functions and utilities
export type APIResponse<T = any> = {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
  responseTime?: string
  cacheStatus?: 'hit' | 'miss' | 'stale'
  region?: string
}

export type PerformanceMetrics = {
  responseTime: number
  cacheStatus: 'hit' | 'miss' | 'stale'
  region: string
  timestamp: string
}

// Create standardized API response
export function createAPIResponse<T>(
  data?: T,
  options?: {
    success?: boolean
    error?: string
    message?: string
    cacheStatus?: 'hit' | 'miss' | 'stale'
    region?: string
    responseTime?: number
  }
): APIResponse<T> {
  return {
    success: options?.success ?? !options?.error,
    ...(data && { data }),
    ...(options?.error && { error: options.error }),
    ...(options?.message && { message: options.message }),
    timestamp: new Date().toISOString(),
    ...(options?.responseTime && { responseTime: `${options.responseTime}ms` }),
    ...(options?.cacheStatus && { cacheStatus: options.cacheStatus }),
    ...(options?.region && { region: options.region }),
  }
}

// Validate JSON data
export function validateJSON(data: any): { valid: boolean; error?: string } {
  try {
    if (data === null || data === undefined) {
      return { valid: false, error: 'Data cannot be null or undefined' }
    }

    // Try to stringify and parse to check if it's valid JSON
    JSON.stringify(data)
    
    return { valid: true }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON' 
    }
  }
}

// Generate cache key with region/user context
export function generateCacheKey(
  baseKey: string, 
  context?: { region?: string; userId?: string }
): string {
  let key = baseKey
  
  if (context?.region) {
    key += `:${context.region}`
  }
  
  if (context?.userId) {
    key += `:${context.userId}`
  }
  
  return key
}

// Format bytes to human readable string
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Rate limiting utility
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requestTimes = this.requests.get(identifier) || []
    
    // Remove requests outside the window
    const validRequests = requestTimes.filter(time => now - time < this.windowMs)
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return true
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now()
    const requestTimes = this.requests.get(identifier) || []
    const validRequests = requestTimes.filter(time => now - time < this.windowMs)
    
    return Math.max(0, this.maxRequests - validRequests.length)
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetrics: number = 100

  addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric)
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getStats() {
    if (this.metrics.length === 0) {
      return {
        count: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      }
    }

    const responseTimes = this.metrics.map(m => m.responseTime).sort((a, b) => a - b)
    const cacheHits = this.metrics.filter(m => m.cacheStatus === 'hit').length
    
    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)

    return {
      count: this.metrics.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      cacheHitRate: (cacheHits / this.metrics.length) * 100,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
    }
  }

  getRecentMetrics(limit: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-limit)
  }

  clear(): void {
    this.metrics = []
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter(1000, 60000) // 1000 requests per minute

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Utility to get client IP from headers
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('x-real-ip') ||
    headers.get('x-vercel-forwarded-for') ||
    'unknown'
  )
}

// Utility to get region from headers
export function getClientRegion(headers: Headers): string {
  return (
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    'unknown'
  )
}

// Utility to measure execution time
export function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve, reject) => {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      resolve({ result, duration })
    } catch (error) {
      reject(error)
    }
  })
}

// Retry utility with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (i === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 100
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}