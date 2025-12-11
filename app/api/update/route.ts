// app/api/update/route.ts - File upload and bulk update endpoint
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cache } from '@/lib/cache'
import { 
  createAPIResponse, 
  validateJSON, 
  formatBytes,
  getClientIP,
  globalRateLimiter 
} from '@/lib/utils'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// POST - Handle file uploads and bulk updates
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const clientIP = getClientIP(request.headers)
    
    // Strict rate limiting for uploads
    if (!globalRateLimiter.isAllowed(`upload:${clientIP}`)) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Upload rate limit exceeded' }),
        { status: 429 }
      )
    }
    
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      return await handleFileUpload(request, startTime)
    } else if (contentType.includes('application/json')) {
      return await handleJSONUpdate(request, startTime)
    } else {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Unsupported content type. Use multipart/form-data or application/json' }),
        { status: 400 }
      )
    }
    
  } catch (error) {
    console.error('Update error:', error)
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json(
      createAPIResponse(null, { 
        error: 'Update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'X-Response-Time': responseTime.toString() }
      }
    )
  }
}

// GET - Get update history and statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const key = searchParams.get('key')
    const action = searchParams.get('action') || 'history'
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const clientIP = getClientIP(request.headers)
    
    // Rate limiting
    if (!globalRateLimiter.isAllowed(`update-get:${clientIP}`)) {
      return NextResponse.json(
        createAPIResponse(null, { error: 'Rate limit exceeded' }),
        { status: 429 }
      )
    }
    
    switch (action) {
      case 'history':
        return await handleUpdateHistory(key, limit)
        
      case 'stats':
        return await handleUpdateStats(key)
        
      default:
        return NextResponse.json(
          createAPIResponse(null, { error: 'Invalid action. Use: history, stats' }),
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('Get update info error:', error)
    return NextResponse.json(
      createAPIResponse(null, { error: 'Failed to fetch update information' }),
      { status: 500 }
    )
  }
}

// Handle file upload
async function handleFileUpload(request: NextRequest, startTime: number) {
  const formData = await request.formData()
  const key = formData.get('key') as string || 'default'
  const file = formData.get('file') as File
  const ttl = formData.get('ttl') as string
  
  if (!file) {
    return NextResponse.json(
      createAPIResponse(null, { error: 'File is required' }),
      { status: 400 }
    )
  }
  
  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      createAPIResponse(null, { 
        error: `File too large. Maximum size: 10MB, received: ${formatBytes(file.size)}` 
      }),
      { status: 413 }
    )
  }
  
  // Check file type
  if (!file.type.includes('json') && !file.name.endsWith('.json')) {
    return NextResponse.json(
      createAPIResponse(null, { error: 'File must be a JSON file' }),
      { status: 400 }
    )
  }
  
  // Read and parse file
  const text = await file.text()
  let data: any
  
  try {
    data = JSON.parse(text)
  } catch (parseError) {
    return NextResponse.json(
      createAPIResponse(null, { 
        error: 'Invalid JSON file',
        message: parseError instanceof Error ? parseError.message : 'JSON parse failed'
      }),
      { status: 400 }
    )
  }
  
  // Validate JSON structure
  const validation = validateJSON(data)
  if (!validation.valid) {
    return NextResponse.json(
      createAPIResponse(null, { error: validation.error }),
      { status: 400 }
    )
  }
  
  // Store data
  const ttlSeconds = ttl ? parseInt(ttl) : undefined
  await db.set(key, data, ttlSeconds)
  
  // Invalidate cache
  await cache.invalidatePattern(`data:${key}:*`)
  
  // Log the update
  await logUpdate(key, {
    type: 'file',
    filename: file.name,
    size: file.size,
    fileType: file.type
  })
  
  const responseTime = Date.now() - startTime
  
  return NextResponse.json(
    createAPIResponse({
      key,
      filename: file.name,
      size: formatBytes(file.size),
      ttl: ttlSeconds || 'permanent',
      url: `/api/data?key=${key}`
    }, {
      message: 'File uploaded and data updated successfully',
      responseTime
    }),
    {
      headers: { 'X-Response-Time': responseTime.toString() }
    }
  )
}

// Handle JSON update
async function handleJSONUpdate(request: NextRequest, startTime: number) {
  const body = await request.json()
  const { key = 'default', data, ttl, bulk = false } = body
  
  if (bulk) {
    return await handleBulkUpdate(body, startTime)
  }
  
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
  
  // Check data size
  const dataSize = JSON.stringify(data).length
  if (dataSize > 10 * 1024 * 1024) {
    return NextResponse.json(
      createAPIResponse(null, { 
        error: `Data too large. Maximum size: 10MB, received: ${formatBytes(dataSize)}` 
      }),
      { status: 413 }
    )
  }
  
  // Store data
  await db.set(key, data, ttl)
  
  // Invalidate cache
  await cache.invalidatePattern(`data:${key}:*`)
  
  // Log the update
  await logUpdate(key, {
    type: 'json',
    size: dataSize
  })
  
  const responseTime = Date.now() - startTime
  
  return NextResponse.json(
    createAPIResponse({
      key,
      size: formatBytes(dataSize),
      ttl: ttl || 'permanent',
      url: `/api/data?key=${key}`
    }, {
      message: 'Data updated successfully',
      responseTime
    }),
    {
      headers: { 'X-Response-Time': responseTime.toString() }
    }
  )
}

// Handle bulk updates
async function handleBulkUpdate(body: any, startTime: number) {
  const { updates = [], ttl } = body
  
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      createAPIResponse(null, { error: 'Updates array is required for bulk operations' }),
      { status: 400 }
    )
  }
  
  if (updates.length > 100) {
    return NextResponse.json(
      createAPIResponse(null, { error: 'Maximum 100 updates per bulk operation' }),
      { status: 400 }
    )
  }
  
  const results = []
  let totalSize = 0
  
  for (const update of updates) {
    const { key, data } = update
    
    if (!key || !data) {
      results.push({ key, status: 'failed', error: 'Key and data are required' })
      continue
    }
    
    try {
      // Validate JSON
      const validation = validateJSON(data)
      if (!validation.valid) {
        results.push({ key, status: 'failed', error: validation.error })
        continue
      }
      
      const dataSize = JSON.stringify(data).length
      totalSize += dataSize
      
      // Check individual item size
      if (dataSize > 1024 * 1024) { // 1MB per item
        results.push({ key, status: 'failed', error: 'Individual item too large (max 1MB)' })
        continue
      }
      
      // Store data
      await db.set(key, data, ttl)
      
      // Invalidate cache
      await cache.invalidatePattern(`data:${key}:*`)
      
      // Log the update
      await logUpdate(key, {
        type: 'bulk',
        size: dataSize
      })
      
      results.push({ key, status: 'success', size: formatBytes(dataSize) })
      
    } catch (error) {
      results.push({ 
        key, 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  }
  
  const responseTime = Date.now() - startTime
  const successful = results.filter(r => r.status === 'success').length
  
  return NextResponse.json(
    createAPIResponse({
      results,
      summary: {
        total: updates.length,
        successful,
        failed: updates.length - successful,
        totalSize: formatBytes(totalSize)
      }
    }, {
      message: `Bulk update completed: ${successful}/${updates.length} successful`,
      responseTime
    }),
    {
      headers: { 'X-Response-Time': responseTime.toString() }
    }
  )
}

// Handle update history
async function handleUpdateHistory(key: string | null, limit: number) {
  try {
    if (key) {
      // Get history for specific key
      const history = await db.list(`updates:log:${key}`)
      const recentHistory = history.slice(0, limit)
      
      return NextResponse.json(
        createAPIResponse({
          key,
          history: recentHistory,
          total: history.length,
          showing: recentHistory.length
        })
      )
    } else {
      // Get global update statistics
      const allKeys = await db.list('updates:*')
      const updateKeys = allKeys.filter(k => !k.includes(':log:'))
      
      const stats = []
      for (const updateKey of updateKeys.slice(0, limit)) {
        const count = await db.get(updateKey)
        if (count) {
          const key = updateKey.replace('updates:', '')
          stats.push({ key, updates: count })
        }
      }
      
      return NextResponse.json(
        createAPIResponse({
          globalStats: stats,
          total: updateKeys.length,
          showing: stats.length
        })
      )
    }
    
  } catch (error) {
    throw new Error(`Failed to get update history: ${error}`)
  }
}

// Handle update statistics
async function handleUpdateStats(key: string | null) {
  try {
    if (key) {
      // Stats for specific key
      const updateCount = await db.get(`updates:${key}`)
      const history = await db.list(`updates:log:${key}`)
      
      return NextResponse.json(
        createAPIResponse({
          key,
          totalUpdates: updateCount || 0,
          historyEntries: history.length,
          lastUpdate: history[0] || null
        })
      )
    } else {
      // Global stats
      const allUpdateKeys = await db.list('updates:*')
      const logKeys = allUpdateKeys.filter(k => k.includes(':log:'))
      const countKeys = allUpdateKeys.filter(k => !k.includes(':log:'))
      
      return NextResponse.json(
        createAPIResponse({
          totalKeys: countKeys.length,
          totalLogEntries: logKeys.length,
          keysWithHistory: logKeys.map(k => k.replace('updates:log:', '')),
        })
      )
    }
    
  } catch (error) {
    throw new Error(`Failed to get update stats: ${error}`)
  }
}

// Log update activity
async function logUpdate(key: string, details: any) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...details
    }
    
    // Add to log
    await db.set(`updates:log:${key}:${Date.now()}`, logEntry, 7 * 24 * 60 * 60) // 7 days TTL
    
    // Increment counter
    await db.increment(`updates:${key}`)
    
  } catch (error) {
    console.warn('Failed to log update:', error)
    // Don't throw error, as this is non-critical
  }
}