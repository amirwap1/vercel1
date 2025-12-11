// components/ApiTester.tsx - Interactive API testing component
'use client'

import { useState, useRef } from 'react'
import { Play, Upload, Copy, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

export default function ApiTester() {
  const [key, setKey] = useState('default')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [nocache, setNocache] = useState(false)
  const [format, setFormat] = useState('json')
  const [jsonInput, setJsonInput] = useState(`{
  "message": "Hello World",
  "timestamp": "${new Date().toISOString()}",
  "version": "1.0.0"
}`)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'get' | 'post' | 'upload'>('get')

  const testApi = async () => {
    setLoading(true)
    setResponse(null)
    const startTime = Date.now()
    
    try {
      const params = new URLSearchParams({ key })
      if (nocache) params.append('nocache', 'true')
      if (format !== 'json') params.append('format', format)
      
      const url = `/api/data?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      
      const endTime = Date.now()
      
      setResponse({
        data,
        headers: {
          'x-cache-status': res.headers.get('x-cache-status'),
          'x-response-time': res.headers.get('x-response-time'),
          'content-type': res.headers.get('content-type'),
        },
        status: res.status,
        clientResponseTime: endTime - startTime,
        url
      })
    } catch (error) {
      setResponse({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const updateData = async () => {
    setLoading(true)
    setResponse(null)
    const startTime = Date.now()
    
    try {
      let data: any
      try {
        data = JSON.parse(jsonInput)
      } catch (parseError) {
        throw new Error('Invalid JSON format')
      }
      
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, data }),
      })
      
      const result = await res.json()
      const endTime = Date.now()
      
      setResponse({
        data: result,
        status: res.status,
        clientResponseTime: endTime - startTime,
        operation: 'update'
      })
    } catch (error) {
      setResponse({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
        operation: 'update'
      })
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async () => {
    if (!file) {
      setResponse({ error: 'Please select a file first' })
      return
    }

    setLoading(true)
    setResponse(null)
    const startTime = Date.now()
    
    try {
      const formData = new FormData()
      formData.append('key', key)
      formData.append('file', file)
      
      const res = await fetch('/api/update', {
        method: 'POST',
        body: formData,
      })
      
      const result = await res.json()
      const endTime = Date.now()
      
      setResponse({
        data: result,
        status: res.status,
        clientResponseTime: endTime - startTime,
        operation: 'upload'
      })
    } catch (error) {
      setResponse({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
        operation: 'upload'
      })
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = async () => {
    if (response) {
      await navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    }
  }

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      setJsonInput(JSON.stringify(parsed, null, 2))
    } catch (error) {
      // Invalid JSON, do nothing
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setFile(selectedFile || null)
  }

  const clearFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'get', label: 'GET Data', icon: Download },
          { key: 'post', label: 'POST Update', icon: Upload },
          { key: 'upload', label: 'File Upload', icon: Upload }
        ].map(({ key: tabKey, label, icon: Icon }) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tabKey
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Common Key Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Key
        </label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="input-field"
          placeholder="Enter data key (e.g., users, config)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Unique identifier for your JSON data
        </p>
      </div>

      {/* GET Tab */}
      {activeTab === 'get' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Response Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="input-field"
              >
                <option value="json">Full JSON Response</option>
                <option value="raw">Raw Data Only</option>
              </select>
            </div>
            
            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="nocache"
                checked={nocache}
                onChange={(e) => setNocache(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="nocache" className="ml-2 text-sm text-gray-700">
                Bypass cache (force fresh data)
              </label>
            </div>
          </div>

          <button
            onClick={testApi}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="loading-spinner" />
                Testing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Test GET Request
              </>
            )}
          </button>
        </div>
      )}

      {/* POST Tab */}
      {activeTab === 'post' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                JSON Data
              </label>
              <button
                onClick={formatJSON}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Format
              </button>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={8}
              className="textarea-field"
              placeholder='Enter JSON data'
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter valid JSON data to store
            </p>
          </div>

          <button
            onClick={updateData}
            disabled={loading}
            className="btn-success flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="loading-spinner" />
                Updating...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Update Data
              </>
            )}
          </button>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              JSON File
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose File
              </button>
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{file.name}</span>
                  <span className="text-xs">({Math.round(file.size / 1024)} KB)</span>
                  <button
                    onClick={clearFile}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select a JSON file to upload and store (max 10MB)
            </p>
          </div>

          <button
            onClick={uploadFile}
            disabled={loading || !file}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="loading-spinner" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload File
              </>
            )}
          </button>
        </div>
      )}

      {/* Response Section */}
      {response && (
        <div className="mt-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
              {response.error ? (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Error Response
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Response
                </>
              )}
            </h3>
            <button
              onClick={copyResponse}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>

          <div className="code-block">
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>

          {/* Response metadata */}
          {response.headers && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Response Metadata</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className={`ml-1 ${response.status >= 200 && response.status < 300 ? 'text-green-600' : 'text-red-600'}`}>
                    {response.status}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Cache:</span>
                  <span className={`ml-1 font-semibold ${
                    response.headers['x-cache-status'] === 'HIT' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {response.headers['x-cache-status'] || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Server Time:</span>
                  <span className="ml-1 font-semibold">{response.headers['x-response-time'] || 'N/A'}ms</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Total Time:</span>
                  <span className="ml-1 font-semibold">{response.clientResponseTime || 0}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}