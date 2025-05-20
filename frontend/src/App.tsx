import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface University {
  id: string;
  name: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [documents, setDocuments] = useState<string[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<string>('');
  const [universities] = useState<University[]>([
    { id: 'arel', name: 'İstanbul Arel Üniversitesi' },
    { id: 'selcuk', name: 'Selcuk Üniversitesi' },
    { id: 'istanbul', name: 'İstanbul Üniversitesi' },
    { id: 'marmara', name: 'Marmara Üniversitesi' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedUniversity) {
      fetchDocuments();
    }
  }, [selectedUniversity]);

  const fetchDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch(`http://localhost:4000/api/documents/list?university=${selectedUniversity}`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      } else {
        console.error('Error fetching documents:', data.error);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedUniversity) {
      alert('Lütfen önce bir üniversite seçin');
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch('http://localhost:4000/api/documents/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ university: selectedUniversity })
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
        fetchDocuments();
      } else {
        alert('❌ Dosya yükleme hatası: ' + (data.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('❌ Dosya yükleme sırasında bir hata oluştu');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedUniversity) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsAsking(true);
    setLoadingProgress(0);

    const loadingInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 500);

    try {
      const response = await fetch('http://localhost:4000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: input,
          history: messages,
          university: selectedUniversity
        }),
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.content
        }]);
      } else {
        throw new Error(data.error || 'Bir hata oluştu');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.' 
      }]);
    } finally {
      clearInterval(loadingInterval);
      setLoadingProgress(100);
      setTimeout(() => {
        setIsAsking(false);
        setLoadingProgress(0);
      }, 500);
    }
  };

  if (!selectedUniversity) {
    return (
      <div className="university-selector">
        <h2>Üniversite Seçin</h2>
        <select 
          value={selectedUniversity} 
          onChange={(e) => setSelectedUniversity(e.target.value)}
          className="university-select"
        >
          <option value="">Üniversite Seçin</option>
          {universities.map(uni => (
            <option key={uni.id} value={uni.id}>
              {uni.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>RAG Chat</h2>
          <div className="university-info">
            <select 
              value={selectedUniversity} 
              onChange={(e) => setSelectedUniversity(e.target.value)}
              className="university-select"
            >
              {universities.map(uni => (
                <option key={uni.id} value={uni.id}>
                  {uni.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleUpload} className="upload-button" disabled={isUploading || !selectedUniversity}>
            {isUploading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              "Upload Documents"
            )}
          </button>
        </div>
        <div className="documents-list">
          <h3>İşlenmiş PDF'ler</h3>
          {isLoadingDocuments ? (
            <div className="loading-spinner">⏳</div>
          ) : documents.length === 0 ? (
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
          {isAsking && (
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
            disabled={isAsking || !selectedUniversity}
          />
          <button type="submit" disabled={isAsking || !input.trim() || !selectedUniversity}>
            {isAsking ? <span className="loading-spinner">⏳</span> : 'Gönder'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
