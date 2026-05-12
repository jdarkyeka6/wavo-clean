// src/App.jsx - Updated secure version
import { useState, useRef } from 'react'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [showGiphy, setShowGiphy] = useState(false)
  const [giphySearch, setGiphySearch] = useState('')
  const [giphyResults, setGiphyResults] = useState([])
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [isLoadingGifs, setIsLoadingGifs] = useState(false)
  const fileInputRef = useRef(null)

  // Read API key from environment variables (SECURE - not hardcoded)
  const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY

  // Search GIPHY
  const searchGiphy = async (searchTerm) => {
    if (!searchTerm) return
    
    // Check if API key exists
    if (!GIPHY_API_KEY || GIPHY_API_KEY === 'undefined') {
      console.error('GIPHY API key missing! Add VITE_GIPHY_API_KEY to .env file')
      alert('GIPHY API key not configured. Check .env file.')
      return
    }

    setIsLoadingGifs(true)
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=12&rating=r`
      )
      const data = await response.json()
      
      if (data.meta.status === 200) {
        setGiphyResults(data.data)
      } else {
        console.error('GIPHY API error:', data.meta)
        alert(`GIPHY error: ${data.meta.msg}`)
      }
    } catch (error) {
      console.error('GIPHY search failed:', error)
      alert('Failed to fetch GIFs. Check your internet connection.')
    } finally {
      setIsLoadingGifs(false)
    }
  }

  // Rest of your component remains the same...
  const selectGif = (gifUrl) => {
    setMessage(prev => prev + ` [GIF: ${gifUrl}] `)
    setShowGiphy(false)
    setGiphySearch('')
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large! Max 10MB')
      return
    }
    setAttachment(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setAttachmentPreview(reader.result)
      reader.readAsDataURL(file)
    } else {
      setAttachmentPreview(null)
    }
  }

  const removeAttachment = () => {
    setAttachment(null)
    setAttachmentPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = error => reject(error)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const messageData = {
      username,
      password,
      text: message,
      timestamp: new Date().toISOString(),
      attachment: attachment ? {
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        data: attachment ? await fileToBase64(attachment) : null
      } : null
    }
    console.log('Sending:', messageData)
    setSent(true)
    setMessage('')
    removeAttachment()
    setTimeout(() => setSent(false), 3000)
  }

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return '🖼️'
    if (fileType?.startsWith('video/')) return '🎥'
    if (fileType?.startsWith('audio/')) return '🎵'
    if (fileType === 'application/pdf') return '📄'
    return '📎'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700">
        <h1 className="text-4xl font-bold mb-2 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          wavo
        </h1>
        <p className="text-center text-gray-400 mb-6">No email nonsense. Just messages.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-700/50 border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-700/50 border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            required
          />
          
          <div className="relative">
            <textarea
              placeholder="Type your message... (or add GIF/file)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="3"
              className="w-full p-3 rounded-xl bg-gray-700/50 border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
              required={!attachment}
            />
            
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowGiphy(!showGiphy)}
                className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition text-sm"
                title="Add GIF"
              >
                🎬 GIF
              </button>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                title="Attach file"
              >
                📎 File
              </button>
            </div>
          </div>
          
          {attachment && (
            <div className="p-3 bg-gray-700/50 rounded-xl border border-gray-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(attachment.type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium truncate max-w-[200px]">{attachment.name}</p>
                  <p className="text-xs text-gray-400">
                    {(attachment.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {attachmentPreview && (
                <img src={attachmentPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
              )}
              <button
                type="button"
                onClick={removeAttachment}
                className="text-red-400 hover:text-red-300 text-xl"
              >
                ×
              </button>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          />
          
          {showGiphy && (
            <div className="bg-gray-700 rounded-xl p-4 border border-gray-600">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search GIFs..."
                  value={giphySearch}
                  onChange={(e) => setGiphySearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchGiphy(giphySearch)}
                  className="flex-1 p-2 rounded-lg bg-gray-600 border border-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => searchGiphy(giphySearch)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                  disabled={isLoadingGifs}
                >
                  {isLoadingGifs ? '🔍...' : 'Search'}
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {giphyResults.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => selectGif(gif.images.fixed_height_small.url)}
                    className="hover:scale-105 transition-transform"
                  >
                    <img
                      src={gif.images.fixed_height_small.url}
                      alt={gif.title}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  </button>
                ))}
                {giphyResults.length === 0 && giphySearch && !isLoadingGifs && (
                  <p className="col-span-3 text-center text-gray-400 py-4">
                    No GIFs found. Try another search.
                  </p>
                )}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 p-3 rounded-xl font-semibold transition transform hover:scale-[1.02]"
          >
            Send Message {attachment && '📎'} {message.includes('[GIF:') && '🎬'}
          </button>
        </form>
        
        {sent && (
          <div className="mt-4 p-3 bg-green-600/20 border border-green-600 rounded-xl text-center animate-pulse">
            ✨ Message sent! (demo mode)
          </div>
        )}
        
        <div className="mt-6 text-center text-xs text-gray-500 space-x-4">
          <span>🔒 No email required</span>
          <span>🎬 GIF support</span>
          <span>📎 File sharing (10MB max)</span>
        </div>
      </div>
    </div>
  )
}

export default App