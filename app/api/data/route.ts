// app/api/data/route.ts - Main JSON data endpoint
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cache } from '@/lib/cache'
import { 
  createAPIResponse, 
  getClientIP, 
  getClientRegion, 
  validateJSON,
  globalRateLimiter,
  performanceMonitor,
  measureTime
} from '@/lib/utils'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const maxDuration = 5

// GET - Fetch JSON data with caching
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get('key') || 'default'
    const nocache = searchParams.get('nocache') === 'true'
    const format = searchParams.get('format') || 'json'
    
    // Get client info
    const clientIP = getClientIP(request.headers)
    const region = getClientRegion(request.headers)
    const city = request.headers.get('x-vercel-ip-city') || 'unknown'
    
    // Rate limiting
    if (!globalRateLimiter.isAllowed(clientIP)) {
      return NextResponse.json(
        createAPIResponse(null, {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.'
        }),
        { 
          status: 429,
          headers: {
            'Retry-After': '60'
          }
        }
      )
    }
    
    // Generate cache key with region context
    const cacheKey = `data:${key}:${region}`
    
    let data: any = null
    let cacheStatus: 'hit' | 'miss' | 'stale' = 'miss'
    
    // If nocache, fetch fresh
    if (nocache) {
      const { result } = await measureTime(() => fetchFreshData(key, region, city))
      data = result
      cacheStatus = 'miss'
    } else {
      // Try cache first
      const { result: cachedData } = await measureTime(() => 
        cache.get(cacheKey, () => fetchFreshData(key, region, city), 30)
      )
      
      if (cachedData) {
        data = cachedData
        cacheStatus = 'hit'
      } else {
        // Fetch fresh data as fallback
        const { result: freshData } = await measureTime(() => fetchFreshData(key, region, city))
        data = freshData
        cacheStatus = 'miss'
      }
    }
    
    const responseTime = Date.now() - startTime
    
    // Record performance metrics
    performanceMonitor.addMetric({
      responseTime,
      cacheStatus,
      region,
      timestamp: new Date().toISOString()
    })
    
    // Format response based on requested format
    if (format === 'raw' && data?.data) {
      return NextResponse.json(data.data, {
        headers: createResponseHeaders(cacheStatus, responseTime)
      })
    }
    
    return NextResponse.json(
      createAPIResponse(data, {
        cacheStatus,
        region,
        responseTime
      }),
      {
        headers: createResponseHeaders(cacheStatus, responseTime)
      }
    )
    
  } catch (error) {
    console.error('API Error:', error)
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json(
      createAPIResponse(null, {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Response-Time': responseTime.toString()
        }
      }
    )
  }
}

// POST - Update JSON data
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const clientIP = getClientIP(request.headers)
    
    // Rate limiting for updates (stricter)
    if (!globalRateLimiter.isAllowed(`update:${clientIP}`)) {
      return NextResponse.json(
        createAPIResponse(null, {
          error: 'Rate limit exceeded for updates'
        }),
        { status: 429 }
      )
    }
    
    const contentType = request.headers.get('content-type') || ''
    let body: any
    
    // Handle different content types
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = {
        key: formData.get('key'),
        data: formData.get('data')
      }
      
      // Handle file upload
      const file = formData.get('file') as File
      if (file) {
        const text = await file.text()
        try {
          body.data = JSON.parse(text)
        } catch {
          return NextResponse.json(
            createAPIResponse(null, { error: 'Invalid JSON file' }),
            { status: 400 }
          )
        }
      }
    } else {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Unsupported content type' }),
        { status: 400 }
      )
    }
    
    const { key = 'default', data, ttl } = body
    
    if (!data) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Data is required' }),
        { status: 400 }
      )
    }
    
    // Validate JSON
    const validation = validateJSON(data)
    if (!validation.valid) {
      return NextResponse.json(
        createAPIResponse(null, { error: validation.error }),
        { status: 400 }
      )
    }
    
    // Check data size (max 10MB)
    const dataSize = JSON.stringify(data).length
    if (dataSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Data too large (max 10MB)' }),
        { status: 413 }
      )
    }
    
    // Store in database
    await db.set(key, data, ttl)
    
    // Invalidate cache for this key (all regions)
    await cache.invalidatePattern(`data:${key}:*`)
    
    // Track update
    await db.increment(`updates:${key}`)
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json(
      createAPIResponse(
        {
          key,
          size: dataSize,
          ttl: ttl || 'permanent',
          url: `/api/data?key=${key}`
        },
        {
          message: 'Data updated successfully',
          responseTime
        }
      ),
      {
        headers: {
          'X-Response-Time': responseTime.toString()
        }
      }
    )
    
  } catch (error) {
    console.error('Update error:', error)
    
    return NextResponse.json(
      createAPIResponse(null, { error: 'Update failed' }),
      { status: 500 }
    )
  }
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}

// Helper function to fetch fresh data
async function fetchFreshData(key: string, region: string, city: string) {
  // Try to get from database first
  const dbData = await db.get(key)
  
  if (dbData) {
    return {
      ...dbData,
      metadata: {
        ...dbData.metadata,
        cacheStatus: 'fresh',
        region,
        city,
        servedFrom: 'database'
      }
    }
  }
  
  // Return default data if key doesn't exist
  return {
    id: key,
    data: {
      message: `Hello from ${city}, ${region}!`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      region,
      city,
      servedFrom: 'default',
      performance: {
        responseTime: '1-50ms',
        cache: 'miss'
      }
    },
    timestamp: new Date().toISOString(),
    version: 1,
    metadata: {
      generatedAt: new Date().toISOString(),
      cacheStatus: 'fresh',
      size: 0,
      format: 'json',
      region,
      city
    }
  }
}

// Helper to create consistent response headers
function createResponseHeaders(cacheStatus: 'hit' | 'miss' | 'stale', responseTime: number) {
  const headers: Record<string, string> = {
    'X-Edge-Runtime': 'true',
    'X-Cache-Status': cacheStatus,
    'X-Response-Time': responseTime.toString(),
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8'
  }
  
  if (cacheStatus === 'hit') {
    headers['Cache-Control'] = 'public, s-maxage=30, stale-while-revalidate=59'
  } else {
    headers['Cache-Control'] = 'public, s-maxage=10, stale-while-revalidate=50'
  }
  
  headers['CDN-Cache-Control'] = 'public, s-maxage=60'
  headers['Vercel-CDN-Cache-Control'] = 'public, s-maxage=3600'
  
  return headers
}