const localtunnel = require('localtunnel');

(async () => {
  try {
    const sub = 'batates-state-' + Math.floor(1000 + Math.random() * 9000);
    console.log('جاري إنشاء دومين عام مجاني حقيقي لدولة البطاطس المهروسة...');
    const tunnel = await localtunnel({ port: 3000, subdomain: sub });
    
    console.log('\n=============================================================');
    console.log('👑 تم إطلاق الرابط العام الحقيقي لدولة البطاطس المهروسة بنجاح!');
    console.log(`🌐 الدومين المجاني العالمي: ${tunnel.url}`);
    console.log('=============================================================');
    console.log('📍 أرسل هذا الرابط لأي شخص في العالم ليدخل عبر الهاتف أو الكمبيوتر!');
    console.log('⚠️ ملاحظة: عند فتح الموقع عبر localtunnel لأول مرة، قد يظهر زر تأكيد بسيط (Click to continue) ثم يفتح موقع الدولة فوراً.');
    console.log('=============================================================\n');

    tunnel.on('close', () => {
      console.log('تم إغلاق النفق العام.');
    });
  } catch (err) {
    console.error('حدث خطأ في إنشاء الدومين العام:', err);
  }
})();
