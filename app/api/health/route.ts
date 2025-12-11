// app/api/health/route.ts - Health check endpoint
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cache } from '@/lib/cache'
import { createAPIResponse, performanceMonitor } from '@/lib/utils'

export const runtime = 'edge'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Test KV connection with timeout
    const kvHealthPromise = Promise.race([
      testKVConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ])
    
    const kvHealth = await kvHealthPromise.catch(() => 'unhealthy')
    
    // Get cache statistics
    const cacheStats = cache.getStats()
    
    // Get performance statistics
    const perfStats = performanceMonitor.getStats()
    
    const responseTime = Date.now() - startTime
    const isHealthy = kvHealth === 'healthy'
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      region: process.env.VERCEL_REGION || 'unknown',
      responseTime: `${responseTime}ms`,
      services: {
        kv: kvHealth,
        edge: 'healthy',
        cache: 'healthy',
        runtime: 'edge'
      },
      metrics: {
        uptime: process.uptime ? process.uptime() : 0,
        memoryUsage: process.memoryUsage ? {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        } : null,
        cacheStats: {
          memoryEntries: cacheStats.memoryEntries,
          hitRate: perfStats.cacheHitRate
        },
        performance: {
          averageResponseTime: Math.round(perfStats.averageResponseTime),
          p95ResponseTime: Math.round(perfStats.p95ResponseTime),
          p99ResponseTime: Math.round(perfStats.p99ResponseTime),
          totalRequests: perfStats.count
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        vercelEnv: process.env.VERCEL_ENV || 'unknown',
        deployment: process.env.VERCEL_URL || 'local'
      }
    }
    
    return NextResponse.json(
      createAPIResponse(healthData),
      {
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Response-Time': responseTime.toString(),
          'X-Health-Check': 'true'
        }
      }
    )
    
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    return NextResponse.json(
      createAPIResponse(null, {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Response-Time': responseTime.toString()
        }
      }
    )
  }
}

// Test KV connection
async function testKVConnection(): Promise<string> {
  try {
    // Try a simple ping operation
    await db.set('health:ping', { timestamp: Date.now() }, 10)
    await db.get('health:ping')
    await db.delete('health:ping')
    return 'healthy'
  } catch (error) {
    console.warn('KV health check failed:', error)
    return 'unhealthy'
  }
}

// HEAD method for lightweight health checks
export async function HEAD(request: NextRequest) {
  try {
    const isHealthy = await testKVConnection() === 'healthy'
    
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'X-Health-Status': isHealthy ? 'healthy' : 'unhealthy',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'error',
        'Cache-Control': 'no-store'
      }
    })
  }
}