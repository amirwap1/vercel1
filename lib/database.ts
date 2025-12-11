// lib/database.ts - Vercel KV (Redis) setup
import { kv } from '@vercel/kv'

export type JSONData = {
  id: string
  data: any
  timestamp: string
  version: number
  metadata?: {
    size: number
    format: string
    expires?: string
    region?: string
  }
}

// Initialize KV store
export const db = {
  // Store JSON data
  async set(key: string, data: any, ttlSeconds?: number): Promise<void> {
    const jsonData: JSONData = {
      id: key,
      data,
      timestamp: new Date().toISOString(),
      version: 1,
      metadata: {
        size: JSON.stringify(data).length,
        format: 'json',
        expires: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : undefined
      }
    }
    
    if (ttlSeconds) {
      await kv.setex(key, ttlSeconds, jsonData)
    } else {
      await kv.set(key, jsonData)
    }
  },
  
  // Get JSON data
  async get(key: string): Promise<JSONData | null> {
    return await kv.get<JSONData>(key)
  },
  
  // Delete data
  async delete(key: string): Promise<void> {
    await kv.del(key)
  },
  
  // List all keys with pattern
  async list(pattern: string = '*'): Promise<string[]> {
    return await kv.keys(pattern)
  },
  
  // Increment counter
  async increment(key: string): Promise<number> {
    return await kv.incr(key)
  },
  
  // Check if key exists
  async exists(key: string): Promise<boolean> {
    return (await kv.exists(key)) === 1
  },
  
  // Set with JSON string
  async setJson(key: string, jsonString: string, ttl?: number): Promise<void> {
    try {
      const data = JSON.parse(jsonString)
      await this.set(key, data, ttl)
    } catch (error) {
      throw new Error('Invalid JSON string')
    }
  },
  
  // Get multiple keys
  async mget(keys: string[]): Promise<(JSONData | null)[]> {
    return await kv.mget<JSONData>(...keys)
  },
  
  // Set multiple keys
  async mset(entries: Array<[string, any]>, ttl?: number): Promise<void> {
    const pipeline = kv.pipeline()
    
    entries.forEach(([key, data]) => {
      const jsonData: JSONData = {
        id: key,
        data,
        timestamp: new Date().toISOString(),
        version: 1,
        metadata: {
          size: JSON.stringify(data).length,
          format: 'json'
        }
      }
      
      if (ttl) {
        pipeline.setex(key, ttl, jsonData)
      } else {
        pipeline.set(key, jsonData)
      }
    })
    
    await pipeline.exec()
  }
}

// Edge Config for fast reads
let edgeConfig: any = null

try {
  if (process.env.EDGE_CONFIG) {
    const { get } = require('@vercel/edge-config')
    edgeConfig = {
      async getConfig(key: string): Promise<any> {
        return await get(key)
      }
    }
  }
} catch (error) {
  console.warn('Edge Config not available:', error)
}

export { edgeConfig }