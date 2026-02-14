import { useState, useEffect, useRef } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'

const SENDER_COLORS = [
  { bg: '#FFCAD4', name: '#F4A3B5' }, // pastel pink
  { bg: '#FFD6A5', name: '#FFBB70' }, // pastel orange
  { bg: '#FFFFFF', name: '#999999' }, // white
]

function getSenderColor(sender) {
  let hash = 0
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length]
}

function QuickChat() {
  const { username } = useUser()
  const { canUseChat, canDeleteOwnMessages, canPauseMuteChat } = usePermissions()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendError, setSendError] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Mark messages from other users as seen
  const markMessagesAsSeen = async (msgs) => {
    if (!username) return
    const unseen = msgs.filter(
      (m) => m.sender !== username && !m.seen_by?.includes(username)
    )
    if (unseen.length === 0) return
    await Promise.all(
      unseen.map((m) =>
        supabase
          .from('messages')
          .update({ seen_by: [...(m.seen_by || []), username] })
          .eq('id', m.id)
      )
    )
  }

  // Load messages on mount with retry for sleeping DB
  useEffect(() => {
    async function loadMessages() {
      for (let i = 0; i < 3; i++) {
        try {
          const { data } = await Promise.race([
            supabase.from('messages').select('id, sender, content, created_at, seen_by').order('created_at', { ascending: false }).limit(100),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))
          ])
          if (data) {
            data.reverse()
            setMessages(data)
            markMessagesAsSeen(data)
            break
          }
        } catch (e) {
          if (i < 2) await new Promise(r => setTimeout(r, 2000))
        }
      }
    }
    loadMessages()
  }, [username])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        markMessagesAsSeen([payload.new])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
    const { error } = await supabase.from('messages').insert(message)
    if (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(m => m.id !== message.id))
      setSendError('Message failed to send. Try again.')
      setTimeout(() => setSendError(null), 4000)
    }
  }

  const handleDelete = async (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await supabase.from('messages').delete().eq('id', msgId)
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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="py-4 px-4 flex items-center">
          {/* Spacer to match hamburger width */}
          <div className="w-10 shrink-0" />
          {/* Centered title */}
          <div className="flex-1 text-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Quick Chat
            </h1>
            <p className="text-sm text-gray-500">Logged in as {username}</p>
          </div>
          {/* Spacer to balance header */}
          <div className="w-10 shrink-0" />
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
                const senderColor = !isOwn ? getSenderColor(msg.sender) : null
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative group max-w-[75%] rounded-2xl px-4 py-2 shadow-sm text-gray-800 ${
                        isOwn
                          ? 'bg-pastel-blue rounded-br-md'
                          : 'rounded-bl-md'
                      }`}
                      style={senderColor ? { backgroundColor: senderColor.bg } : undefined}
                    >
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-white shadow-md opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          title="Delete message"
                        >
                          <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
                        </button>
                      )}
                      <p
                        className={`text-xs font-semibold mb-0.5 ${isOwn ? 'text-pastel-blue-dark' : ''}`}
                        style={senderColor ? { color: senderColor.name } : undefined}
                      >
                        {msg.sender}
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? 'text-gray-500 text-right' : 'text-gray-400 text-right'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                      {isOwn && msg.seen_by?.length > 0 && (
                        <p className="text-[10px] text-gray-400 text-right">Seen</p>
                      )}
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
        {sendError && (
          <p className="text-xs text-red-500 text-center mb-2">{sendError}</p>
        )}
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
