import { useState, useEffect, useRef } from 'react'
import { Send, User } from 'lucide-react'
import { supabase } from '../supabase'

function QuickChat() {
  const [username, setUsername] = useState(() => localStorage.getItem('chat-username') || '')
  const [isSettingName, setIsSettingName] = useState(() => !localStorage.getItem('chat-username'))
  const [nameInput, setNameInput] = useState('')
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load messages on mount
  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }
    loadMessages()
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSetName = (e) => {
    e.preventDefault()
    if (!nameInput.trim()) return
    const name = nameInput.trim()
    localStorage.setItem('chat-username', name)
    setUsername(name)
    setIsSettingName(false)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const message = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      sender: username,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
    }

    setNewMessage('')
    setMessages(prev => [...prev, message])
    await supabase.from('messages').insert(message)
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  if (isSettingName) {
    return (
      <div className="flex-1 flex items-center justify-center min-w-0">
        <form onSubmit={handleSetName} className="bg-white rounded-xl shadow-lg p-6 w-72 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 text-center">What's your name?</h2>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-lg font-medium transition-colors"
          >
            Join Chat
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between pl-10 md:pl-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Quick Chat
            </h1>
            <p className="text-sm text-gray-500">Logged in as {username}</p>
          </div>
          <button
            onClick={() => {
              setIsSettingName(true)
              setNameInput(username)
            }}
            className="p-2 hover:bg-pastel-blue/30 rounded-lg transition-colors"
            title="Change name"
          >
            <User size={18} className="text-gray-500" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 mt-20">No messages yet. Say something!</p>
          )}

          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex justify-center my-4">
                <span className="text-xs text-gray-400 bg-white/80 px-3 py-1 rounded-full shadow-sm">
                  {date}
                </span>
              </div>
              {msgs.map((msg) => {
                const isOwn = msg.sender === username
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                        isOwn
                          ? 'bg-pastel-blue text-gray-800 rounded-br-md'
                          : 'bg-white text-gray-800 rounded-bl-md'
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-0.5 ${isOwn ? 'text-pastel-blue-dark' : 'text-pastel-pink-dark'}`}>{msg.sender}</p>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? 'text-gray-500 text-right' : 'text-gray-400 text-right'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="bg-white/80 backdrop-blur-sm border-t p-3">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-full focus:ring-2 focus:ring-pastel-blue focus:border-transparent"
          />
          <button
            type="submit"
            className="p-2 bg-pastel-pink hover:bg-pastel-pink-dark rounded-full transition-colors"
          >
            <Send size={18} className="text-gray-700" />
          </button>
        </form>
      </div>
    </div>
  )
}

export default QuickChat
