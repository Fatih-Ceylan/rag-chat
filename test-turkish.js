// test-turkish.js - Türkçe RAG sistemi test scripti
import { ask } from './backend/src/services/rag.service.js';

// Test soruları
const testQuestions = [
  "Öğrenci işleri nerede?",
  "Kayıt yenileme nasıl yapılır?",
  "Ders seçimi ne zaman?",
  "Burs başvurusu için gerekli belgeler nelerdir?",
  "Mezuniyet şartları nelerdir?",
  "Staj başvurusu nasıl yapılır?",
  "Ders kredisi nedir?",
  "Final sınavı tarihleri ne zaman açıklanır?"
];

async function testTurkishRAG() {
  console.log("🇹🇷 Türkçe RAG Sistemi Test Başlıyor...\n");
  
  // Test edilecek üniversite
  const university = "arel"; // Mevcut üniversite ID'nizi buraya yazın
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log(`\n📝 Test ${i + 1}: "${question}"`);
    console.log("=" * 50);
    
    try {
      const startTime = Date.now();
      const response = await ask(question, [], university);
      const endTime = Date.now();
      
      console.log(`⏱️  Süre: ${endTime - startTime}ms`);
      console.log(`📊 Bulunan kaynak sayısı: ${response.sources?.length || 0}`);
      
      if (response.sources && response.sources.length > 0) {
        console.log("🎯 En iyi eşleşme skorları:");
        response.sources.slice(0, 3).forEach((source, idx) => {
          console.log(`   ${idx + 1}. Skor: ${(source.metadata.score * 100).toFixed(1)}% - ${source.metadata.source}`);
        });
      } else {
        console.log("❌ Hiç kaynak bulunamadı!");
      }
      
      console.log(`💬 Yanıt: ${response.content.substring(0, 200)}...`);
      
    } catch (error) {
      console.error(`❌ Hata: ${error.message}`);
    }
    
    // Testler arası bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n✅ Test tamamlandı!");
}

// Test çalıştır
testTurkishRAG().catch(console.error);
