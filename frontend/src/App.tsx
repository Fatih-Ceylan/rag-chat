import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
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
      const response = await fetch('http://localhost:4000/api/documents/list');
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
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
        let message = '';
        if (data.newFiles && data.newFiles.length > 0) {
          message += `✅ Yeni yüklenen dosyalar:\n${data.newFiles.join('\n')}\n\n`;
        }
        if (data.skippedFiles && data.skippedFiles.length > 0) {
          message += `⚠️ Zaten yüklü olan dosyalar (hash kontrolü):\n${data.skippedFiles.join('\n')}`;
        }
        if (!data.newFiles?.length && !data.skippedFiles?.length) {
          message = 'ℹ️ İşlenecek PDF dosyası bulunamadı.';
        }
        alert(message);
        fetchDocuments(); // Refresh document list
      } else {
        alert('❌ Dosya yükleme hatası: ' + (data.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('❌ Dosya yükleme sırasında bir hata oluştu');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingProgress(0);

    // Loading animasyonu için interval
    const loadingInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 500);

    try {
      console.log('[Debug] Sending request to chat endpoint');
      const response = await fetch('http://localhost:4000/api/ask', {
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
          content: data.content
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
      clearInterval(loadingInterval);
      setLoadingProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        setLoadingProgress(0);
      }, 500);
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
          <h3>İşlenmiş PDF'ler</h3>
          {documents.length === 0 ? (
            <p className="no-documents">Henüz işlenmiş PDF yok</p>
          ) : (
            <ul>
              {documents.map((doc, index) => (
                <li key={index} className="document-item">
                  <span className="document-icon">📄</span>
                  <span className="document-name">{doc}</span>
                </li>
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
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="loading-container">
                  <div className="loading-bar" style={{ width: `${loadingProgress}%` }}></div>
                  <div className="loading-text">Yanıt hazırlanıyor...</div>
                </div>
              </div>
            </div>
          )}
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
            {isLoading ? 'Gönderiliyor...' : 'Gönder'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
