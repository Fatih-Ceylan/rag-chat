import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  // Her üniversite için ayrı chat history tutma
  const [universityMessages, setUniversityMessages] = useState<Record<string, Message[]>>({});
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

  // Mevcut üniversite için mesajları al
  const messages = useMemo(() => universityMessages[selectedUniversity] || [], [universityMessages, selectedUniversity]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch(`http://localhost:4000/api/documents/list?university=${selectedUniversity}`);
      const data = await response.json();
      setDocuments(data.success ? data.documents : []);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [selectedUniversity]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Üniversite değiştiğinde dokümanları yükle ve chat history'yi başlat
  useEffect(() => {
    if (selectedUniversity) {
      fetchDocuments();
      if (!universityMessages[selectedUniversity]) {
        setUniversityMessages(prev => ({ ...prev, [selectedUniversity]: [] }));
      }
    }
  }, [selectedUniversity, universityMessages, fetchDocuments]);

  // PDF dosyasını yeni sekmede açma (popup blocker bypass)
  const handlePdfClick = (filename: string) => {
    if (!selectedUniversity) return alert('Lütfen önce bir üniversite seçin');

    const pdfUrl = `http://localhost:4002/api/documents/pdf/${selectedUniversity}/${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  // Basit dosya yükleme fonksiyonu (sadece vektör DB hash kontrolü)
  const handleFileUpload = () => {
    if (!selectedUniversity) {
      alert('Lütfen önce bir üniversite seçin');
      return;
    }

    // File input oluştur
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;

      if (!files || files.length === 0) {
        alert('Lütfen en az bir PDF dosyası seçin');
        return;
      }

      setIsUploading(true);
      try {
        // Dosya boyutu kontrolü (max 10MB per file)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const oversizedFiles = Array.from(files).filter(f => f.size > maxSize);
        if (oversizedFiles.length > 0) {
          alert(`❌ Çok büyük dosyalar (max 10MB):\n${oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')}`);
          return;
        }

        // Dosyaları base64'e çevir (güvenli yöntem)
        const fileData = await Promise.all(
          Array.from(files).map(async (file) => {
            return new Promise<{name: string, data: string, size: number}>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const result = reader.result as string;
                  // data:application/pdf;base64, kısmını kaldır
                  const base64 = result.split(',')[1];
                  resolve({
                    name: file.name,
                    data: base64,
                    size: file.size
                  });
                } catch (error) {
                  reject(error);
                }
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
          })
        );

        // Upload endpoint'e gönder
        const response = await fetch('http://localhost:4000/api/documents/upload-combined', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ university: selectedUniversity, files: fileData }),
        });

        const result = await response.json();
        if (result.success) {
          let message = `✅ ${result.message}`;
          if (result.newFiles && result.newFiles.length > 0) {
            message += `\n\n📄 Yeni dosyalar:\n${result.newFiles.join('\n')}`;
          }
          if (result.skippedFiles && result.skippedFiles.length > 0) {
            message += `\n\n⏭️ Atlanan dosyalar (zaten mevcut):\n${result.skippedFiles.join('\n')}`;
          }
          if (result.errorFiles && result.errorFiles.length > 0) {
            message += `\n\n❌ Hatalı dosyalar:\n${result.errorFiles.map((f: any) => `${f.name}: ${f.error}`).join('\n')}`;
          }
          alert(message);
          fetchDocuments(); // Listeyi yenile
        } else {
          alert(`❌ İşlem hatası: ${result.error}`);
        }
      } catch (error) {
        alert(`❌ İşlem hatası: ${error}`);
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };

  // Soru gönderme ve RAG sistemi ile yanıt alma
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedUniversity) return;

    // Kullanıcı mesajını seçili üniversitenin chat'ine ekle
    const userMessage: Message = { role: 'user', content: input };
    setUniversityMessages(prev => ({
      ...prev,
      [selectedUniversity]: [...(prev[selectedUniversity] || []), userMessage]
    }));
    setInput('');
    setIsAsking(true);

    // Loading progress animasyonu
    const loadingInterval = setInterval(() => {
      setLoadingProgress(prev => prev >= 90 ? prev : prev + 10);
    }, 500);

    try {
      const response = await fetch('http://localhost:4000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input, history: messages, university: selectedUniversity }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      const assistantMessage: Message = { role: 'assistant', content: data.success ? data.content : 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.' };
      setUniversityMessages(prev => ({
        ...prev,
        [selectedUniversity]: [...(prev[selectedUniversity] || []), assistantMessage]
      }));
    } catch {
      setUniversityMessages(prev => ({
        ...prev,
        [selectedUniversity]: [...(prev[selectedUniversity] || []), {
          role: 'assistant',
          content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.'
        }]
      }));
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
          <button onClick={handleFileUpload} className="upload-button" disabled={isUploading || !selectedUniversity}>
            {isUploading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              "Upload Documents"
            )}
          </button>
        </div>
        <div className="documents-list">
          <h3>Yüklenmiş PDF'ler</h3>
          {isLoadingDocuments ? (
            <div className="loading-spinner">⏳</div>
          ) : documents.length === 0 ? (
            <p className="no-documents">Henüz yüklenmiş PDF yok</p>
          ) : (
            <ul>
              {documents.map((doc, index) => (
                <li key={index} className="document-item clickable" onClick={() => handlePdfClick(doc)} title={`${doc} dosyasını açmak için tıklayın`}>
                  <span className="document-icon">📄</span>
                  <span className="document-name">{doc}</span>
                  <span className="document-action">🔗 Aç</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="chat-container">
        <div className="chat-header">
          <h3>{universities.find(u => u.id === selectedUniversity)?.name} - Chat</h3>
          <p className="chat-info">Bu chat geçmişi sadece seçili üniversiteye aittir. Üniversite değiştirdiğinizde farklı chat geçmişi görürsünüz.</p>
        </div>
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h4>🎓 {universities.find(u => u.id === selectedUniversity)?.name} Öğrenci İşleri Asistanı</h4>
              <p>Merhaba! Size nasıl yardımcı olabilirim? Üniversite ile ilgili sorularınızı sorabilirsiniz.</p>
              {documents.length > 0 && (
                <p><strong>📚 Yüklü dokümanlar:</strong> {documents.length} PDF dosyası</p>
              )}
            </div>
          )}
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
            placeholder={`${universities.find(u => u.id === selectedUniversity)?.name} hakkında soru sorun...`}
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
