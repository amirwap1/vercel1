// app/api/data/cache/route.ts - Cache management endpoint
import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/cache'
import { db } from '@/lib/database'
import { createAPIResponse, getClientIP, globalRateLimiter } from '@/lib/utils'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action') || 'stats'
    const clientIP = getClientIP(request.headers)
    
    // Rate limiting for cache operations
    if (!globalRateLimiter.isAllowed(`cache:${clientIP}`)) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Rate limit exceeded' }),
        { status: 429 }
      )
    }
    
    switch (action) {
      case 'stats':
        return await handleCacheStats()
        
      case 'clear':
        return await handleCacheClear()
        
      case 'keys':
        return await handleCacheKeys(searchParams)
        
      case 'info':
        return await handleCacheInfo(searchParams)
        
      default:
        return NextResponse.json(
          createAPIResponse(null, { error: 'Invalid action. Use: stats, clear, keys, info' }),
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Cache operation failed:', error)
    return NextResponse.json(
      createAPIResponse(null, { error: 'Cache operation failed' }),
      { status: 500 }
    )
  }
}

// POST - Cache management operations
export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request.headers)
    
    // Strict rate limiting for POST operations
    if (!globalRateLimiter.isAllowed(`cache-post:${clientIP}`)) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Rate limit exceeded' }),
        { status: 429 }
      )
    }
    
    const body = await request.json()
    const { action, key, pattern } = body
    
    switch (action) {
      case 'invalidate':
        if (!key) {
          return NextResponse.json(
            createAPIResponse(null, { error: 'Key is required for invalidation' }),
            { status: 400 }
          )
        }
        
        await cache.invalidate(key)
        
        return NextResponse.json(
          createAPIResponse({ key }, { message: `Cache invalidated for key: ${key}` })
        )
        
      case 'invalidatePattern':
        if (!pattern) {
          return NextResponse.json(
            createAPIResponse(null, { error: 'Pattern is required for pattern invalidation' }),
            { status: 400 }
          )
        }
        
        await cache.invalidatePattern(pattern)
        
        return NextResponse.json(
          createAPIResponse({ pattern }, { message: `Cache invalidated for pattern: ${pattern}` })
        )
        
      case 'warmup':
        return await handleCacheWarmup(body)
        
      default:
        return NextResponse.json(
          createAPIResponse(null, { error: 'Invalid action. Use: invalidate, invalidatePattern, warmup' }),
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Cache POST operation failed:', error)
    return NextResponse.json(
      createAPIResponse(null, { error: 'Cache operation failed' }),
      { status: 500 }
    )
  }
}

// Handle cache statistics
async function handleCacheStats() {
  try {
    const kvKeys = await db.list('cache:*')
    const memoryStats = cache.getStats()
    
    const stats = {
      kv: {
        totalEntries: kvKeys.length,
        keys: kvKeys.slice(0, 20), // Show first 20 keys
        hasMore: kvKeys.length > 20
      },
      memory: {
        entries: memoryStats.memoryEntries,
        keys: memoryStats.memoryKeys.slice(0, 10) // Show first 10 memory keys
      },
      summary: {
        totalCacheKeys: kvKeys.length + memoryStats.memoryEntries,
        kvCacheSize: kvKeys.length,
        memoryCacheSize: memoryStats.memoryEntries
      }
    }
    
    return NextResponse.json(createAPIResponse(stats))
    
  } catch (error) {
    throw new Error(`Failed to get cache stats: ${error}`)
  }
}

// Handle cache clear
async function handleCacheClear() {
  try {
    await cache.clear()
    
    return NextResponse.json(
      createAPIResponse(
        { cleared: true },
        { message: 'All caches cleared successfully' }
      )
    )
    
  } catch (error) {
    throw new Error(`Failed to clear cache: ${error}`)
  }
}

// Handle cache keys listing
async function handleCacheKeys(searchParams: URLSearchParams) {
  try {
    const pattern = searchParams.get('pattern') || 'cache:*'
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const keys = await db.list(pattern)
    const limitedKeys = keys.slice(0, limit)
    
    return NextResponse.json(
      createAPIResponse({
        pattern,
        keys: limitedKeys,
        total: keys.length,
        showing: limitedKeys.length,
        hasMore: keys.length > limit
      })
    )
    
  } catch (error) {
    throw new Error(`Failed to list cache keys: ${error}`)
  }
}

// Handle cache info for specific key
async function handleCacheInfo(searchParams: URLSearchParams) {
  try {
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Key parameter is required' }),
        { status: 400 }
      )
    }
    
    const cacheKey = key.startsWith('cache:') ? key : `cache:${key}`
    const data = await db.get(cacheKey)
    
    if (!data) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Cache entry not found' }),
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      createAPIResponse({
        key: cacheKey,
        data: data.data,
        metadata: data.metadata,
        timestamp: data.timestamp,
        version: data.version
      })
    )
    
  } catch (error) {
    throw new Error(`Failed to get cache info: ${error}`)
  }
}

// Handle cache warmup
async function handleCacheWarmup(body: any) {
  try {
    const { keys = [] } = body
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Keys array is required for warmup' }),
        { status: 400 }
      )
    }
    
    const results = []
    
    for (const key of keys) {
      try {
        // Trigger cache population by requesting the data
        await cache.get(`data:${key}`, async () => {
          const data = await db.get(key)
          return data?.data || { message: `Default data for ${key}` }
        })
        
        results.push({ key, status: 'warmed' })
      } catch (error) {
        results.push({ 
          key, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
    
    return NextResponse.json(
      createAPIResponse({
        warmup: results,
        summary: {
          total: keys.length,
          successful: results.filter(r => r.status === 'warmed').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      })
    )
    
  } catch (error) {
    throw new Error(`Cache warmup failed: ${error}`)
  }
}