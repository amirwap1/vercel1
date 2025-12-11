// lib/cache.ts - Multi-layer caching
import { db } from './database'

const CACHE_PREFIX = 'cache:'
const DEFAULT_TTL = 60 // 1 minute

export class EdgeCache {
  // Memory cache (in-memory for ultra-fast access)
  private memoryCache = new Map<string, { data: any; expires: number }>()
  
  // Get from cache with fallback
  async get<T>(key: string, fetcher?: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T | null> {
    const cacheKey = `${CACHE_PREFIX}${key}`
    
    // 1. Check memory cache (fastest, <1ms)
    const memoryCached = this.memoryCache.get(cacheKey)
    if (memoryCached && memoryCached.expires > Date.now()) {
      console.log(`[CACHE] Memory hit: ${key}`)
      return memoryCached.data as T
    }
    
    try {
      // 2. Check KV store (fast, ~3ms)
      const kvCached = await db.get(cacheKey)
      if (kvCached && kvCached.data) {
        console.log(`[CACHE] KV hit: ${key}`)
        // Update memory cache
        this.memoryCache.set(cacheKey, {
          data: kvCached.data,
          expires: Date.now() + 10000 // 10 seconds memory cache
        })
        return kvCached.data as T
      }
    } catch (error) {
      console.warn(`[CACHE] KV error for ${key}:`, error)
    }
    
    // 3. Fetch fresh data if fetcher provided
    if (fetcher) {
      console.log(`[CACHE] Miss: ${key}, fetching fresh`)
      try {
        const freshData = await fetcher()
        
        // Store in both caches
        await this.set(key, freshData, ttl)
        
        return freshData
      } catch (error) {
        console.error(`[CACHE] Fetcher error for ${key}:`, error)
        return null
      }
    }
    
    return null
  }
  
  // Set cache
  async set(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}${key}`
    
    try {
      // Store in KV
      await db.set(cacheKey, data, ttl)
      
      // Store in memory with shorter TTL
      this.memoryCache.set(cacheKey, {
        data,
        expires: Date.now() + Math.min(ttl * 1000, 10000)
      })
    } catch (error) {
      console.error(`[CACHE] Set error for ${key}:`, error)
    }
  }
  
  // Invalidate cache
  async invalidate(key: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}${key}`
    
    try {
      await db.delete(cacheKey)
      this.memoryCache.delete(cacheKey)
    } catch (error) {
      console.error(`[CACHE] Invalidate error for ${key}:`, error)
    }
  }
  
  // Invalidate pattern (for wildcards)
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await db.list(`${CACHE_PREFIX}${pattern}`)
      for (const key of keys) {
        await db.delete(key)
        this.memoryCache.delete(key)
      }
    } catch (error) {
      console.error(`[CACHE] Invalidate pattern error for ${pattern}:`, error)
    }
  }
  
  // Clear all caches
  async clear(): Promise<void> {
    try {
      const keys = await db.list(`${CACHE_PREFIX}*`)
      for (const key of keys) {
        await db.delete(key)
      }
      this.memoryCache.clear()
    } catch (error) {
      console.error('[CACHE] Clear error:', error)
    }
  }
  
  // Get cache statistics
  getStats() {
    return {
      memoryEntries: this.memoryCache.size,
      memoryKeys: Array.from(this.memoryCache.keys()),
    }
  }
  
  // Cleanup expired memory cache entries
  cleanupMemory(): void {
    const now = Date.now()
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key)
      }
    }
  }
}

export const cache = new EdgeCache()

// Cleanup memory cache every 30 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanupMemory()
  }, 30000)
}