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
  const [attachmentName, setAttachmentName] = useState('')
  const fileInputRef = useRef(null)

  const GIPHY_API_KEY = 'YOUR_API_KEY_HERE'

  const searchGiphy = async (searchTerm) => {
    if (!searchTerm) return
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${searchTerm}&limit=12`)
    const data = await response.json()
    setGiphyResults(data.data)
  }

  const selectGif = (gifUrl) => {
    setMessage(prev => prev + `\n[GIF: ${gifUrl}]\n`)
    setShowGiphy(false)
    setGiphySearch('')
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.size <= 10 * 1024 * 1024) {
      setAttachment(file)
      setAttachmentName(file.name)
    } else if (file) {
      alert('File too large! Max 10MB')
    }
  }

  const removeAttachment = () => {
    setAttachment(null)
    setAttachmentName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log({ username, password, message, attachment: attachmentName })
    setSent(true)
    setMessage('')
    setUsername('')
    setPassword('')
    removeAttachment()
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-6xl font-bold mb-8 text-center">wavo</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 bg-black border border-gray-700 rounded focus:outline-none focus:border-gray-500"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-black border border-gray-700 rounded focus:outline-none focus:border-gray-500"
            required
          />
          
          <div className="relative">
            <textarea
              placeholder="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="4"
              className="w-full p-3 bg-black border border-gray-700 rounded focus:outline-none focus:border-gray-500 resize-none"
              required={!attachment}
            />
            
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowGiphy(!showGiphy)}
                className="text-gray-500 hover:text-white text-sm"
              >
                GIF
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-500 hover:text-white text-sm"
              >
                File
              </button>
            </div>
          </div>
          
          {attachmentName && (
            <div className="flex items-center justify-between p-2 border border-gray-700 rounded">
              <span className="text-sm text-gray-400">📎 {attachmentName}</span>
              <button type="button" onClick={removeAttachment} className="text-gray-500 hover:text-white">×</button>
            </div>
          )}
          
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
          
          {showGiphy && (
            <div className="border border-gray-700 rounded p-3">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search GIFs..."
                  value={giphySearch}
                  onChange={(e) => setGiphySearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchGiphy(giphySearch)}
                  className="flex-1 p-2 bg-black border border-gray-700 rounded"
                />
                <button
                  type="button"
                  onClick={() => searchGiphy(giphySearch)}
                  className="px-3 py-2 border border-gray-700 rounded hover:bg-gray-900"
                >
                  Go
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {giphyResults.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => selectGif(gif.images.fixed_height_small.url)}
                    className="hover:opacity-80"
                  >
                    <img src={gif.images.fixed_height_small.url} alt={gif.title} className="w-full rounded" />
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full p-3 bg-white text-black rounded hover:bg-gray-200 font-medium"
          >
            Send
          </button>
        </form>
        
        {sent && (
          <div className="mt-4 p-3 text-center text-green-500">
            sent.
          </div>
        )}
        
        <p className="text-center text-gray-600 text-sm mt-6">
          No email nonsense.
        </p>
      </div>
    </div>
  )
}

export default App