const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e8 // 100MB for voice clips if needed
});

const PORT = process.env.PORT || 3000;
const MASTER_ADMIN_PASSCODE = 'Nx40FfR'; // كود القيادة العليا السري

// المسارات
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// تهيئة قاعدة البيانات المحلية
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      stateInfo: {
        name: 'دولة البطاطس المهروسة',
        motto: 'القوة في الهرس، والسيادة للزبدة النيرية',
        nationalAnthem: 'عاشت بطاطسنا حرة مهروسة أبية!',
        defenseLevel: 'أقصى درجات التأهب النووي البوريه (DEFCON 1)'
      },
      users: {},
      messages: [
        {
          id: 'welcome-1',
          senderId: 'supreme-cmd',
          senderName: 'القيادة العامة للبطاطس',
          senderRole: 'مشير البطاطس الأعلى',
          isAdmin: true,
          type: 'announcement',
          content: 'أهلاً بكم في المنظومة السرية لدولة البطاطس المهروسة. هنا تسري الأوامر العسكرية وتدار شؤون السيادة الوطنية بكل سرية وقوة.',
          timestamp: new Date().toISOString()
        }
      ],
      logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    console.error('Error parsing db file, resetting backup:', e);
    return { stateInfo: {}, users: {}, messages: [], logs: [] };
  }
}

let db = initDb();

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db file:', err);
  }
}

function addLog(action, details, ip = '127.0.0.1') {
  const logEntry = {
    id: uuidv4(),
    action,
    details,
    ip,
    timestamp: new Date().toISOString()
  };
  db.logs = db.logs || [];
  db.logs.unshift(logEntry);
  if (db.logs.length > 200) db.logs.pop(); // keep last 200
  saveDb();
  io.emit('security:new_log', logEntry);
}

// تخزين الملفات الصوتية المسجلة
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`);
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max audio

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// رفع التسجيل الصوتي
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'لم يتم استلام أي ملف صوتي' });
  }
  const audioUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, audioUrl, filename: req.file.filename });
});

// إحصائيات الدولة العامة
app.get('/api/state-info', (req, res) => {
  const approvedCount = Object.values(db.users).filter(u => u.status === 'approved').length;
  const pendingCount = Object.values(db.users).filter(u => u.status === 'pending').length;
  res.json({
    stateInfo: db.stateInfo,
    stats: {
      citizensCount: approvedCount,
      pendingRequests: pendingCount,
      onlineCount: io.engine.clientsCount
    }
  });
});

// فحص الجلسة الحالية
app.post('/api/verify-session', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ valid: false });
  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) return res.status(401).json({ valid: false });
  res.json({ valid: true, user });
});

// تقديم طلب انضمام مواطن جديد أو تسجيل دخول بالرمز السري
app.post('/api/apply', (req, res) => {
  const { name, codename, note, passcode } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'الاسم مطلوب لدخول أراضي الدولة' });
  }

  const cleanName = name.trim();

  // فحص هل كتب الرمز السري للقيادة العليا
  if (passcode && passcode.trim() === MASTER_ADMIN_PASSCODE) {
    // دخول كأدمن مباشر (مشير البطاطس الأعلى)
    const adminUser = {
      id: 'admin_' + uuidv4().substring(0, 8),
      token: 'sec_' + uuidv4(),
      name: cleanName,
      codename: codename ? codename.trim() : 'الصقر المهروس',
      role: 'مشير البطاطس الأعلى',
      isAdmin: true,
      status: 'approved',
      joinedAt: new Date().toISOString(),
      avatarColor: '#F59E0B'
    };
    db.users[adminUser.id] = adminUser;
    saveDb();
    addLog('تسجيل دخول القيادة العليا', `دخل المشير: ${cleanName} برمز السيادة الكامل`, ip);
    return res.json({ success: true, user: adminUser, mode: 'admin' });
  }

  // مستخدم عادي -> طلب دخول قيد المراجعة
  const userId = 'usr_' + uuidv4().substring(0, 8);
  const newUser = {
    id: userId,
    token: 'tok_' + uuidv4(),
    name: cleanName,
    codename: codename ? codename.trim() : 'مواطن-' + Math.floor(1000 + Math.random() * 9000),
    note: note ? note.trim() : 'طلب ولاء وانضمام لدولة البطاطس المهروسة',
    role: 'مواطن قيد الفحص',
    isAdmin: false,
    status: 'pending',
    ip,
    joinedAt: new Date().toISOString(),
    avatarColor: '#D97706'
  };

  db.users[userId] = newUser;
  saveDb();
  addLog('طلب تصريح دخول جديد', `المواطن: ${cleanName} تقدم بطلب للمراجعة`, ip);

  // إشعار فوري لجميع القادة المتصلين
  io.to('admin_room').emit('applicant:new', newUser);

  res.json({ success: true, user: newUser, mode: 'pending' });
});

// تتبع المتصلين بالصوت والراديو
const activeVoiceUsers = new Map(); // socketId -> user details

io.on('connection', (socket) => {
  let currentUser = null;

  // تسجيل اتصال المستخدم بالسوكت
  socket.on('auth:connect', ({ token }) => {
    if (!token) return;
    const user = Object.values(db.users).find(u => u.token === token);
    if (!user) {
      socket.emit('auth:invalid');
      return;
    }
    currentUser = user;
    socket.userId = user.id;

    if (user.isAdmin) {
      socket.join('admin_room');
    }

    if (user.status === 'approved') {
      socket.join('citizens_room');
      socket.emit('init:data', {
        user,
        messages: db.messages.slice(-100),
        activeUsers: getOnlineCitizens(),
        stateInfo: db.stateInfo,
        pendingCount: Object.values(db.users).filter(u => u.status === 'pending').length
      });
      // إبلاغ الجميع بالاتصال
      io.to('citizens_room').emit('presence:online', {
        id: user.id,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin
      });
    } else {
      // المستخدم قيد الانتظار أو مرفوض
      socket.emit('auth:status_update', user);
    }
  });

  // إرسال رسالة في الشات (نصية أو صوتية)
  socket.on('chat:message', (payload) => {
    if (!currentUser || currentUser.status !== 'approved') {
      socket.emit('error', 'غير مصرح لك بنشر رسائل');
      return;
    }

    const { text, audioUrl, audioDuration, isSecret } = payload;
    if (!text && !audioUrl) return;

    const msg = {
      id: uuidv4(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      isAdmin: currentUser.isAdmin,
      type: audioUrl ? 'audio' : 'text',
      content: text || '',
      audioUrl: audioUrl || null,
      audioDuration: audioDuration || 0,
      isSecret: !!isSecret,
      timestamp: new Date().toISOString()
    };

    db.messages.push(msg);
    if (db.messages.length > 500) db.messages.shift();
    saveDb();

    io.to('citizens_room').emit('chat:new_message', msg);
  });

  // إصدار فرمان عسكري أو إعلان رسمي من الأدمن
  socket.on('admin:announcement', ({ text }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    if (!text || !text.trim()) return;

    const announcement = {
      id: uuidv4(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: '👑 ' + currentUser.role,
      isAdmin: true,
      type: 'announcement',
      content: text.trim(),
      timestamp: new Date().toISOString()
    };

    db.messages.push(announcement);
    saveDb();
    addLog('إصدار فرمان سيادي', `الزعيم: ${currentUser.name} أصدر فرماناً عاماً`, socket.handshake.address);
    io.to('citizens_room').emit('chat:new_message', announcement);
    io.to('citizens_room').emit('state:siren_alert', { message: text.trim(), sender: currentUser.name });
  });

  // مسح الشات (للأدمن فقط)
  socket.on('admin:clear_chat', () => {
    if (!currentUser || !currentUser.isAdmin) return;
    db.messages = [
      {
        id: uuidv4(),
        senderId: currentUser.id,
        senderName: 'القيادة العليا',
        senderRole: currentUser.role,
        isAdmin: true,
        type: 'announcement',
        content: 'تم تطهير وتشفير سجل المحادثات بالكامل بأمر القيادة العليا.',
        timestamp: new Date().toISOString()
      }
    ];
    saveDb();
    addLog('مسح سجل المحادثات', `قام المشير ${currentUser.name} بمسح الشات`, socket.handshake.address);
    io.to('citizens_room').emit('chat:cleared', db.messages);
  });

  // جلب قائمة طالبي الانضمام للأدمن
  socket.on('admin:get_applicants', () => {
    if (!currentUser || !currentUser.isAdmin) return;
    const allUsers = Object.values(db.users);
    socket.emit('admin:applicants_list', allUsers);
  });

  // قبول طالب انضمام وتعيين منصبه
  socket.on('admin:approve_applicant', ({ userId, assignedRole }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    const targetUser = db.users[userId];
    if (!targetUser) return;

    targetUser.status = 'approved';
    targetUser.role = assignedRole && assignedRole.trim() ? assignedRole.trim() : 'مواطن مهروس شريف';
    saveDb();

    addLog('موافقة على مواطن ومنحه منصباً', `تم قبول ${targetUser.name} برتبة: ${targetUser.role}`, socket.handshake.address);

    // إشعار الهدف فوراً
    io.emit('applicant:status_changed', {
      userId: targetUser.id,
      status: 'approved',
      role: targetUser.role
    });

    // تحديث قائمة المتقدمين لدى جميع الأدمنز
    io.to('admin_room').emit('admin:applicants_list', Object.values(db.users));
  });

  // رفض طالب انضمام
  socket.on('admin:reject_applicant', ({ userId, reason }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    const targetUser = db.users[userId];
    if (!targetUser) return;

    targetUser.status = 'rejected';
    targetUser.rejectReason = reason || 'دواعي أمن قومي لدولة البطاطس';
    saveDb();

    addLog('رفض تصريح مواطن', `تم رفض دخول ${targetUser.name} - السبب: ${targetUser.rejectReason}`, socket.handshake.address);

    io.emit('applicant:status_changed', {
      userId: targetUser.id,
      status: 'rejected',
      reason: targetUser.rejectReason
    });

    io.to('admin_room').emit('admin:applicants_list', Object.values(db.users));
  });

  // تعديل منصب مواطن قائم
  socket.on('admin:update_role', ({ userId, newRole }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    const targetUser = db.users[userId];
    if (!targetUser) return;

    const oldRole = targetUser.role;
    targetUser.role = newRole.trim();
    saveDb();

    addLog('ترقية / تعديل منصب', `تم تغيير منصب ${targetUser.name} من [${oldRole}] إلى [${targetUser.role}]`, socket.handshake.address);

    io.emit('user:role_updated', {
      userId: targetUser.id,
      name: targetUser.name,
      newRole: targetUser.role
    });

    io.to('admin_room').emit('admin:applicants_list', Object.values(db.users));
  });

  // طرد أو حظر مستخدم
  socket.on('admin:ban_user', ({ userId }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    const targetUser = db.users[userId];
    if (!targetUser || targetUser.isAdmin) return;

    targetUser.status = 'banned';
    saveDb();

    addLog('نفي وحظر مواطن', `تم طرد ونفي ${targetUser.name} من الدولة`, socket.handshake.address);

    io.emit('applicant:status_changed', {
      userId: targetUser.id,
      status: 'banned',
      reason: 'تم نفيك رسمياً بقرار أمني'
    });

    io.to('admin_room').emit('admin:applicants_list', Object.values(db.users));
  });

  // طلب سجلات الأمان
  socket.on('admin:get_logs', () => {
    if (!currentUser || !currentUser.isAdmin) return;
    socket.emit('admin:logs_data', db.logs || []);
  });

  // =================== غرفة الصوت المباشر (WebRTC / Voice Room) ===================
  socket.on('voice:join', () => {
    if (!currentUser || currentUser.status !== 'approved') return;
    activeVoiceUsers.set(socket.id, {
      socketId: socket.id,
      userId: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      isAdmin: currentUser.isAdmin,
      isSpeaking: false,
      isMuted: false
    });

    socket.join('voice_room');
    io.to('voice_room').emit('voice:users_list', Array.from(activeVoiceUsers.values()));
  });

  socket.on('voice:leave', () => {
    activeVoiceUsers.delete(socket.id);
    socket.leave('voice_room');
    io.to('voice_room').emit('voice:users_list', Array.from(activeVoiceUsers.values()));
  });

  socket.on('voice:speaking_status', ({ isSpeaking, isMuted }) => {
    const vUser = activeVoiceUsers.get(socket.id);
    if (vUser) {
      vUser.isSpeaking = !!isSpeaking;
      vUser.isMuted = !!isMuted;
      io.to('voice_room').emit('voice:user_state_change', {
        socketId: socket.id,
        isSpeaking: vUser.isSpeaking,
        isMuted: vUser.isMuted
      });
    }
  });

  // إشارات WebRTC
  socket.on('voice:signal', ({ targetSocketId, signalData }) => {
    io.to(targetSocketId).emit('voice:signal', {
      fromSocketId: socket.id,
      signalData
    });
  });

  // قطع الاتصال
  socket.on('disconnect', () => {
    if (activeVoiceUsers.has(socket.id)) {
      activeVoiceUsers.delete(socket.id);
      io.to('voice_room').emit('voice:users_list', Array.from(activeVoiceUsers.values()));
    }
    if (currentUser) {
      io.to('citizens_room').emit('presence:offline', { id: currentUser.id });
    }
  });
});

function getOnlineCitizens() {
  const online = [];
  const sockets = io.sockets.sockets;
  sockets.forEach((s) => {
    if (s.userId && db.users[s.userId] && db.users[s.userId].status === 'approved') {
      const u = db.users[s.userId];
      if (!online.some(o => o.id === u.id)) {
        online.push({ id: u.id, name: u.name, role: u.role, isAdmin: u.isAdmin });
      }
    }
  });
  return online;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🥔 سيادة دولة البطاطس المهروسة انطلقت بنجاح! 🥔`);
  console.log(`🌐 الخادم يعمل على: http://localhost:${PORT}`);
  console.log(`🔐 كود القيادة العليا السري: ${MASTER_ADMIN_PASSCODE}`);
  console.log(`=======================================================`);
});
