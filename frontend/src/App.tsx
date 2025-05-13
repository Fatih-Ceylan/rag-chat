import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    content: string;
    metadata: any;
  }>;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch documents on component mount
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/documents');
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleUpload = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/documents/upload', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('Documents processed successfully');
        fetchDocuments(); // Refresh document list
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Error processing documents');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('[Debug] Sending request to chat endpoint');
      const response = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: input,
          history: messages,
        }),
      });

      console.log('[Debug] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log('[Debug] Response data:', data);

      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.data.content,
          sources: data.data.sources
        }]);
      } else {
        throw new Error(data.error || 'Bir hata oluştu');
      }
    } catch (error) {
      console.error('[Debug] Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>RAG Chat</h2>
          <button onClick={handleUpload} className="upload-button">
            Upload Documents
          </button>
        </div>
        <div className="documents-list">
          <h3>Processed Documents</h3>
          {documents.length === 0 ? (
            <p className="no-documents">No documents processed yet</p>
          ) : (
            <ul>
              {documents.map((doc, index) => (
                <li key={index}>{doc}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-content">{message.content}</div>
              {message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <h4>Kaynaklar:</h4>
                  {message.sources.map((source, idx) => (
                    <div key={idx} className="source">
                      <div className="source-content">{source.content}</div>
                      {source.metadata && (
                        <div className="source-metadata">
                          {Object.entries(source.metadata).map(([key, value]) => (
                            <div key={key} className="metadata-item">
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
