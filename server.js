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
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e8 });

const PORT = process.env.PORT || 3000;
const MASTER_ADMIN_PASSCODE = 'Nx40FfR';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const d = {
      users: {},
      messages: [{
        id: 'w1', senderName: 'القيادة العليا', senderRole: 'مشير البطاطس الأعلى',
        isAdmin: true, type: 'announcement',
        content: 'أهلاً بكم في المنظومة السرية لدولة البطاطس المهروسة. هنا تسري الأوامر وتدار شؤون السيادة.',
        timestamp: new Date().toISOString()
      }]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2));
    return d;
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) { return { users: {}, messages: [] }; }
}
let db = initDb();
function saveDb() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch(e){} }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `v_${Date.now()}_${uuidv4().substring(0,6)}.webm`)
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  res.json({ success: true, audioUrl: `/uploads/${req.file.filename}` });
});

app.post('/api/verify-session', (req, res) => {
  const { token } = req.body;
  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) return res.status(401).json({ valid: false });
  res.json({ valid: true, user });
});

app.post('/api/apply', (req, res) => {
  const { name, codename, note, passcode } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'الاسم مطلوب' });
  const cleanName = name.trim();

  if (passcode && passcode.trim() === MASTER_ADMIN_PASSCODE) {
    const adminUser = {
      id: 'adm_' + uuidv4().substring(0, 8),
      token: 'sec_' + uuidv4(),
      name: cleanName,
      codename: codename ? codename.trim() : 'الصقر المهروس',
      role: 'مشير البطاطس الأعلى',
      isAdmin: true,
      status: 'approved',
      joinedAt: new Date().toISOString()
    };
    db.users[adminUser.id] = adminUser;
    saveDb();
    return res.json({ success: true, user: adminUser, mode: 'admin' });
  }

  const userId = 'usr_' + uuidv4().substring(0, 8);
  const newUser = {
    id: userId,
    token: 'tok_' + uuidv4(),
    name: cleanName,
    codename: codename ? codename.trim() : 'مواطن-' + Math.floor(1000 + Math.random() * 9000),
    note: note ? note.trim() : 'طلب ولاء وانضمام',
    role: 'مواطن قيد الفحص',
    isAdmin: false,
    status: 'pending',
    joinedAt: new Date().toISOString()
  };
  db.users[userId] = newUser;
  saveDb();
  io.to('admin_room').emit('applicant:new', newUser);
  res.json({ success: true, user: newUser, mode: 'pending' });
});

// الراديو اللاسلكي المباشر
io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('auth:connect', ({ token }) => {
    if (!token) return;
    const user = Object.values(db.users).find(u => u.token === token);
    if (!user) return;
    currentUser = user;
    socket.userId = user.id;

    if (user.isAdmin) socket.join('admin_room');
    if (user.status === 'approved') {
      socket.join('citizens_room');
      socket.emit('init:data', {
        user,
        messages: db.messages.slice(-70),
        activeUsers: getOnlineUsers(),
        pendingCount: Object.values(db.users).filter(u => u.status === 'pending').length
      });
      io.to('citizens_room').emit('presence:online', getOnlineUsers());
    } else {
      socket.emit('auth:status_update', user);
    }
  });

  socket.on('chat:message', (payload) => {
    if (!currentUser || currentUser.status !== 'approved') return;
    const { text, audioUrl, audioDuration } = payload;
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
      timestamp: new Date().toISOString()
    };
    db.messages.push(msg);
    if (db.messages.length > 300) db.messages.shift();
    saveDb();
    io.to('citizens_room').emit('chat:new_message', msg);
  });

  socket.on('admin:announcement', ({ text }) => {
    if (!currentUser || !currentUser.isAdmin || !text) return;
    const announcement = {
      id: uuidv4(),
      senderName: currentUser.name,
      senderRole: '👑 ' + currentUser.role,
      isAdmin: true,
      type: 'announcement',
      content: text.trim(),
      timestamp: new Date().toISOString()
    };
    db.messages.push(announcement);
    saveDb();
    io.to('citizens_room').emit('chat:new_message', announcement);
    io.to('citizens_room').emit('state:siren_alert', { message: text.trim(), sender: currentUser.name });
  });

  socket.on('admin:get_applicants', () => {
    if (!currentUser || !currentUser.isAdmin) return;
    socket.emit('admin:applicants_list', Object.values(db.users));
  });

  socket.on('admin:approve_applicant', ({ userId, assignedRole }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    const target = db.users[userId];
    if (!target) return;
    target.status = 'approved';
    target.role = assignedRole || 'مواطن مهروس شريف';
    saveDb();
    io.emit('applicant:status_changed', { userId: target.id, status: 'approved', role: target.role });
    io.to('admin_room').emit('admin:applicants_list', Object.values(db.users));
  });

  socket.on('admin:reject_applicant', ({ userId }) => {
    if (!currentUser || !currentUser.isAdmin) return;
    const target = db.users[userId];
    if (!target) return;
    target.status = 'rejected';
    saveDb();
    io.emit('applicant:status_changed', { userId: target.id, status: 'rejected' });
    io.to('admin_room').emit('admin:applicants_list', Object.values(db.users));
  });

  // بث صوت الراديو اللاسلكي المباشر فوري
  socket.on('radio:join', () => {
    if (!currentUser || currentUser.status !== 'approved') return;
    socket.join('live_radio');
    io.to('live_radio').emit('radio:status', { count: io.sockets.adapter.rooms.get('live_radio')?.size || 1 });
  });

  socket.on('radio:leave', () => {
    socket.leave('live_radio');
    io.to('live_radio').emit('radio:status', { count: io.sockets.adapter.rooms.get('live_radio')?.size || 0 });
  });

  socket.on('radio:stream_chunk', (chunkData) => {
    socket.to('live_radio').emit('radio:incoming_audio', {
      senderName: currentUser ? currentUser.name : 'مواطن',
      audio: chunkData.audio
    });
  });

  socket.on('radio:speaking_status', ({ isSpeaking }) => {
    socket.to('live_radio').emit('radio:speaker_changed', {
      isSpeaking,
      senderName: currentUser ? currentUser.name : ''
    });
  });

  socket.on('disconnect', () => {
    io.to('live_radio').emit('radio:status', { count: io.sockets.adapter.rooms.get('live_radio')?.size || 0 });
    io.to('citizens_room').emit('presence:online', getOnlineUsers());
  });
});

function getOnlineUsers() {
  const users = [];
  io.sockets.sockets.forEach((s) => {
    if (s.userId && db.users[s.userId] && db.users[s.userId].status === 'approved') {
      const u = db.users[s.userId];
      if (!users.some(x => x.id === u.id)) users.push({ id: u.id, name: u.name, role: u.role, isAdmin: u.isAdmin });
    }
  });
  return users;
}

// الواجهة المدمجة المتجاوبة مع الموبايل والكمبيوتر
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>دولة البطاطس المهروسة</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    body { font-family: 'Cairo', sans-serif; height: 100dvh; }
    .radar { animation: spin 2.5s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  </style>
</head>
<body class="bg-[#090c12] text-white flex flex-col overflow-hidden select-none">

  <!-- 1. شاشة البوابة -->
  <div id="gatekeeperScreen" class="h-full flex items-center justify-center p-3 overflow-y-auto">
    <div class="max-w-md w-full bg-[#121722]/95 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl text-center my-auto">
      <div class="w-28 h-18 mx-auto rounded-xl overflow-hidden border-2 border-amber-400 mb-2">
        <img src="/assets/flag.jpg" alt="العلم" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400'">
      </div>
      <h1 class="text-xl sm:text-2xl font-black text-amber-400">دولة البطاطس المهروسة</h1>
      <p class="text-xs text-amber-300/80 mb-3">بوابة الأمن القومي • مشفر 256-bit</p>

      <form id="joinForm" class="space-y-3 text-right">
        <div>
          <label class="block text-xs font-bold text-amber-300 mb-1">اسمك الكامل:</label>
          <input type="text" id="applicantName" required placeholder="مثال: القائد أحمد" class="w-full bg-[#080b10] border border-amber-500/40 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
        </div>
        <div>
          <label class="block text-xs font-bold text-amber-300 mb-1">الاسم الحركي (اختياري):</label>
          <input type="text" id="applicantCodename" placeholder="مثال: الصقر المقرمش" class="w-full bg-[#080b10] border border-amber-500/40 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
        </div>
        <div>
          <button type="button" id="toggleAdminPasscodeBtn" class="text-xs text-amber-400 hover:underline">هل أنت قائد القيادة العليا؟ (رمز السيادة) 🔐</button>
          <div id="adminPasscodeContainer" class="hidden mt-1 p-2 bg-amber-950/40 border border-amber-500/40 rounded-xl">
            <input type="password" id="adminPasscode" placeholder="كود القيادة السري..." class="w-full bg-black border border-amber-500/50 rounded-lg px-2.5 py-1 text-amber-300 text-sm tracking-widest font-mono focus:outline-none">
          </div>
        </div>
        <button type="submit" class="w-full bg-gradient-to-r from-amber-600 to-yellow-500 text-black font-black py-2.5 rounded-xl text-sm shadow">
          طلب تصريح الدخول 🥔
        </button>
      </form>
    </div>
  </div>

  <!-- 2. شاشة الانتظار -->
  <div id="waitingScreen" class="hidden h-full flex items-center justify-center p-4">
    <div class="max-w-sm w-full bg-[#121722] border-2 border-amber-500/50 rounded-3xl p-6 text-center shadow-2xl">
      <div class="relative w-20 h-20 mx-auto mb-3 border-2 border-amber-500/40 rounded-full flex items-center justify-center overflow-hidden">
        <div class="radar absolute inset-0 bg-[conic-gradient(from_0deg,rgba(245,158,11,0.5)_0deg,transparent_60deg)]"></div>
        <i class="fa-solid fa-fingerprint text-2xl text-amber-400 relative z-10 animate-pulse"></i>
      </div>
      <h2 class="text-base font-black text-amber-300 mb-1">قيد الفحص لدى القيادة العليا</h2>
      <p class="text-xs text-gray-300 mb-3">لا تغلق الصفحة، ستدخل فور قبولك!</p>
      <button id="cancelWaitBtn" class="text-xs text-gray-400 hover:text-red-400 underline">إلغاء والعودة</button>
    </div>
  </div>

  <!-- 3. شاشة الرفض -->
  <div id="rejectedScreen" class="hidden h-full flex items-center justify-center p-4">
    <div class="max-w-sm w-full bg-[#1a0c0e] border-2 border-red-500 rounded-3xl p-6 text-center">
      <i class="fa-solid fa-ban text-3xl text-red-500 mb-2"></i>
      <h2 class="text-base font-black text-red-400 mb-2">تم رفض الدخول لدواعٍ أمنية!</h2>
      <button id="reapplyBtn" class="w-full bg-red-600 text-white font-bold py-2 rounded-xl text-xs">إعادة المحاولة</button>
    </div>
  </div>

  <!-- 4. البوابة الرئيسية المتوافقة مع الموبايل والكمبيوتر -->
  <div id="mainDashboard" class="hidden h-full flex flex-col overflow-hidden">
    
    <header class="bg-[#0f1420] border-b border-amber-500/30 px-3 py-2 shrink-0 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <img src="/assets/flag.jpg" alt="العلم" class="w-8 h-5 rounded border border-amber-400 object-cover" onerror="this.src='https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=100'">
        <span class="text-xs font-black text-amber-400">دولة البطاطس المهروسة</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="bg-[#172030] border border-amber-500/40 rounded-xl px-2 py-0.5 text-right">
          <div class="text-[10px] font-bold text-white flex items-center gap-1">
            <span id="currentUserName">المواطن</span>
            <span id="adminBadgeIcon" class="hidden text-amber-400 text-[9px]"><i class="fa-solid fa-crown"></i></span>
          </div>
          <div class="text-[8px] text-amber-400" id="currentUserRole">مواطن</div>
        </div>
        <button id="adminPanelBtn" class="hidden bg-amber-500 text-black px-2 py-1 rounded-xl text-xs font-bold">
          <i class="fa-solid fa-crown"></i> القيادة
        </button>
        <button id="logoutBtn" class="text-gray-400 p-1 text-xs"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    </header>

    <!-- شريط الراديو اللاسلكي المباشر -->
    <div class="bg-[#0b1019] border-b border-amber-500/30 px-3 py-1.5 shrink-0 flex items-center justify-between">
      <div>
        <div class="text-xs font-bold text-amber-300 flex items-center gap-1">
          <i class="fa-solid fa-tower-broadcast animate-pulse"></i>
          <span>الراديو اللاسلكي</span>
          <span id="radioStatusIndicator" class="text-[8px] bg-red-500/20 text-red-400 px-1 rounded">غير متصل</span>
        </div>
        <p id="whoIsSpeakingText" class="text-[9px] text-gray-400">تحدث واستمع مباشرة مع الجميع</p>
      </div>
      <div class="flex items-center gap-1">
        <button id="joinVoiceRadioBtn" class="bg-amber-600 text-black font-black text-xs px-2.5 py-1.5 rounded-xl">دخول الراديو</button>
        <button id="talkRadioBtn" class="hidden bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-xl">
          <i class="fa-solid fa-microphone"></i> <span id="talkBtnText">تحدث 🎙️</span>
        </button>
      </div>
    </div>

    <!-- الجسم الرئيسي (شات + مواطنين) -->
    <div class="flex-1 max-w-7xl w-full mx-auto p-2 grid grid-cols-1 lg:grid-cols-4 gap-2 overflow-hidden min-h-0">
      <div id="citizensCol" class="hidden lg:flex flex-col bg-[#111724] border border-amber-500/20 rounded-2xl p-2.5 overflow-hidden h-full">
        <div class="pb-1 border-b border-gray-800 flex items-center justify-between">
          <span class="text-xs font-bold text-amber-300">المواطنون والمناصب</span>
          <span id="onlineCountBadge" class="text-[9px] text-green-400">0 متصل</span>
        </div>
        <div id="citizensList" class="flex-1 overflow-y-auto space-y-1 mt-2"></div>
      </div>

      <div id="chatCol" class="lg:col-span-3 flex flex-col bg-[#111724] border border-amber-500/25 rounded-2xl overflow-hidden h-full min-h-0">
        <div id="messagesContainer" class="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[#0a0d14]"></div>

        <div class="p-1.5 bg-[#131926] border-t border-amber-500/20 shrink-0">
          <form id="chatForm" class="flex items-center gap-1">
            <input type="text" id="chatInput" placeholder="اكتب برقية سرية..." class="flex-1 bg-[#090d14] border border-amber-500/30 rounded-xl px-3 py-2 text-white text-xs focus:outline-none">
            <button type="submit" class="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold">
              <i class="fa-solid fa-paper-plane text-xs transform -rotate-45"></i>
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- أزرار التنقل السفلي للموبايل -->
    <div class="lg:hidden bg-[#0a0d14] border-t border-amber-500/30 py-1.5 flex items-center justify-around shrink-0 text-xs">
      <button id="mobileTabChat" class="text-amber-400 font-bold flex flex-col items-center">
        <i class="fa-solid fa-comments text-sm"></i>
        <span class="text-[9px]">الشات</span>
      </button>
      <button id="mobileTabCitizens" class="text-gray-400 flex flex-col items-center">
        <i class="fa-solid fa-users text-sm"></i>
        <span class="text-[9px]">المواطنين</span>
      </button>
      <button id="mobileTabAdmin" class="hidden text-amber-400 flex flex-col items-center">
        <i class="fa-solid fa-crown text-sm"></i>
        <span class="text-[9px]">القيادة</span>
      </button>
    </div>
  </div>

  <!-- لوحة الأدمن -->
  <div id="adminModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/85 backdrop-blur-md">
    <div class="w-full max-w-lg bg-[#111724] border-2 border-amber-500 rounded-2xl p-4 flex flex-col max-h-[85vh]">
      <div class="flex items-center justify-between pb-2 border-b border-gray-800">
        <span class="text-xs font-black text-amber-400">👑 غرفة العمليات والمناصب</span>
        <button id="closeAdminModalBtn" class="text-gray-400 p-1"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="applicantsListContainer" class="flex-1 overflow-y-auto space-y-2 mt-3"></div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    (function() {
      let socket = null, currentUser = null;
      let isRadioConnected = false, isTalking = false, liveRecorder = null, liveStream = null;

      async function checkSession() {
        const token = localStorage.getItem('batates_token');
        if (!token) return show('gatekeeper');
        const res = await fetch('/api/verify-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        const d = await res.json();
        if (d.valid) { currentUser = d.user; handleStatus(currentUser); } else show('gatekeeper');
      }

      function handleStatus(u) {
        if (u.status === 'approved') { show('dashboard'); setupSocket(); }
        else if (u.status === 'pending') show('waiting');
        else show('rejected');
      }

      function show(n) {
        ['gatekeeperScreen','waitingScreen','rejectedScreen','mainDashboard'].forEach(id => document.getElementById(id).classList.add('hidden'));
        if (n === 'gatekeeper') document.getElementById('gatekeeperScreen').classList.remove('hidden');
        if (n === 'waiting') document.getElementById('waitingScreen').classList.remove('hidden');
        if (n === 'rejected') document.getElementById('rejectedScreen').classList.remove('hidden');
        if (n === 'dashboard') {
          document.getElementById('mainDashboard').classList.remove('hidden');
          document.getElementById('currentUserName').textContent = currentUser.name;
          document.getElementById('currentUserRole').textContent = currentUser.role;
          if (currentUser.isAdmin) {
            document.getElementById('adminBadgeIcon').classList.remove('hidden');
            document.getElementById('adminPanelBtn').classList.remove('hidden');
            document.getElementById('mobileTabAdmin').classList.remove('hidden');
          }
        }
      }

      document.getElementById('toggleAdminPasscodeBtn').onclick = () => document.getElementById('adminPasscodeContainer').classList.toggle('hidden');

      document.getElementById('joinForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('applicantName').value.trim();
        const codename = document.getElementById('applicantCodename').value.trim();
        const passcode = document.getElementById('adminPasscode').value.trim();
        const res = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, codename, passcode }) });
        const d = await res.json();
        if (d.success) { currentUser = d.user; localStorage.setItem('batates_token', currentUser.token); handleStatus(currentUser); }
      };

      document.getElementById('cancelWaitBtn').onclick = () => { localStorage.removeItem('batates_token'); show('gatekeeper'); };
      document.getElementById('reapplyBtn').onclick = () => { localStorage.removeItem('batates_token'); show('gatekeeper'); };
      document.getElementById('logoutBtn').onclick = () => { localStorage.removeItem('batates_token'); window.location.reload(); };

      // تبويبات الموبايل
      document.getElementById('mobileTabChat').onclick = () => {
        document.getElementById('chatCol').classList.remove('hidden'); document.getElementById('citizensCol').classList.add('hidden');
        document.getElementById('mobileTabChat').className = 'text-amber-400 font-bold flex flex-col items-center';
        document.getElementById('mobileTabCitizens').className = 'text-gray-400 flex flex-col items-center';
      };
      document.getElementById('mobileTabCitizens').onclick = () => {
        document.getElementById('chatCol').classList.add('hidden'); document.getElementById('citizensCol').classList.remove('hidden');
        document.getElementById('mobileTabCitizens').className = 'text-amber-400 font-bold flex flex-col items-center';
        document.getElementById('mobileTabChat').className = 'text-gray-400 flex flex-col items-center';
      };
      document.getElementById('mobileTabAdmin').onclick = () => {
        document.getElementById('adminModal').classList.remove('hidden');
        if (socket) socket.emit('admin:get_applicants');
      };

      function setupSocket() {
        if (socket) return;
        socket = io();
        socket.on('connect', () => { if (currentUser) socket.emit('auth:connect', { token: currentUser.token }); });
        socket.on('init:data', d => { renderMsgs(d.messages); renderCitizens(d.activeUsers); });
        socket.on('chat:new_message', appendMsg);
        socket.on('presence:online', renderCitizens);
        socket.on('applicant:status_changed', p => {
          if (currentUser && currentUser.id === p.userId) {
            if (p.status === 'approved') { currentUser.status = 'approved'; currentUser.role = p.role; show('dashboard'); socket.emit('auth:connect', { token: currentUser.token }); }
            else show('rejected');
          }
        });
        socket.on('applicant:new', () => { if (currentUser && currentUser.isAdmin) socket.emit('admin:get_applicants'); });
        socket.on('admin:applicants_list', renderApplicants);

        // تشغيل صوت الراديو المستلم فوراً
        socket.on('radio:incoming_audio', d => {
          document.getElementById('whoIsSpeakingText').textContent = '🎙️ ' + d.senderName + ' يتحدث الآن...';
          try { new Audio(d.audio).play(); } catch(e){}
        });
        socket.on('radio:speaker_changed', d => {
          if (!d.isSpeaking) document.getElementById('whoIsSpeakingText').textContent = 'الراديو متصل وجاهز للاستماع والتحدث';
        });
      }

      // أزرار الراديو
      const joinBtn = document.getElementById('joinVoiceRadioBtn');
      const talkBtn = document.getElementById('talkRadioBtn');

      joinBtn.onclick = () => {
        if (!isRadioConnected) {
          isRadioConnected = true; socket.emit('radio:join');
          joinBtn.textContent = 'مغادرة'; joinBtn.className = 'bg-gray-800 text-gray-300 text-xs px-2.5 py-1.5 rounded-xl';
          talkBtn.classList.remove('hidden');
          document.getElementById('radioStatusIndicator').textContent = 'متصل 🟢';
        } else {
          stopTalk(); isRadioConnected = false; socket.emit('radio:leave');
          joinBtn.textContent = 'دخول الراديو'; joinBtn.className = 'bg-amber-600 text-black font-black text-xs px-2.5 py-1.5 rounded-xl';
          talkBtn.classList.add('hidden');
          document.getElementById('radioStatusIndicator').textContent = 'غير متصل';
        }
      };

      talkBtn.onclick = () => { if (!isTalking) startTalk(); else stopTalk(); };

      async function startTalk() {
        try {
          liveStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          liveRecorder = new MediaRecorder(liveStream);
          liveRecorder.ondataavailable = e => {
            if (e.data.size > 0 && isTalking) {
              const r = new FileReader();
              r.onloadend = () => socket.emit('radio:stream_chunk', { audio: r.result });
              r.readAsDataURL(e.data);
            }
          };
          liveRecorder.start(300);
          isTalking = true;
          document.getElementById('talkBtnText').textContent = 'تتحدث 🔴';
          talkBtn.className = 'bg-green-600 text-white font-black text-xs px-3 py-1.5 rounded-xl animate-pulse';
          socket.emit('radio:speaking_status', { isSpeaking: true });
        } catch(e) { alert('يرجى السماح بالمايكروفون'); }
      }

      function stopTalk() {
        if (liveRecorder && isTalking) {
          liveRecorder.stop();
          if (liveStream) liveStream.getTracks().forEach(t => t.stop());
          isTalking = false;
          document.getElementById('talkBtnText').textContent = 'تحدث 🎙️';
          talkBtn.className = 'bg-red-600 text-white font-black text-xs px-3 py-1.5 rounded-xl';
          socket.emit('radio:speaking_status', { isSpeaking: false });
        }
      }

      function renderMsgs(m) { const b = document.getElementById('messagesContainer'); b.innerHTML = ''; m.forEach(appendMsg); }
      function appendMsg(m) {
        const b = document.getElementById('messagesContainer');
        const isMe = currentUser && currentUser.id === m.senderId;
        const d = document.createElement('div');
        d.className = 'flex ' + (isMe ? 'justify-start' : 'justify-end');
        d.innerHTML = '<div class="max-w-[85%] ' + (isMe ? 'bg-amber-600/20 border-amber-500/40' : 'bg-[#151c2b] border-gray-800') + ' border rounded-xl p-2"><div class="flex items-center justify-between gap-2 mb-0.5"><span class="text-[10px] font-bold text-amber-300">' + m.senderName + '</span><span class="text-[8px] px-1 rounded bg-black/50 text-amber-400">' + m.senderRole + '</span></div><p class="text-xs">' + m.content + '</p></div>';
        b.appendChild(d); b.scrollTop = b.scrollHeight;
      }

      document.getElementById('chatForm').onsubmit = e => {
        e.preventDefault();
        const i = document.getElementById('chatInput');
        if (i.value.trim() && socket) { socket.emit('chat:message', { text: i.value.trim() }); i.value = ''; }
      };

      function renderCitizens(u) {
        const l = document.getElementById('citizensList'); l.innerHTML = '';
        document.getElementById('onlineCountBadge').textContent = u.length + ' متصل';
        u.forEach(x => {
          const d = document.createElement('div'); d.className = 'p-1.5 rounded-lg bg-black/40 border border-gray-800 text-xs flex items-center justify-between';
          d.innerHTML = '<span class="text-[10px] font-bold">' + x.name + ' (' + x.role + ')</span><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>';
          l.appendChild(d);
        });
      }

      document.getElementById('adminPanelBtn').onclick = () => { document.getElementById('adminModal').classList.remove('hidden'); socket.emit('admin:get_applicants'); };
      document.getElementById('closeAdminModalBtn').onclick = () => document.getElementById('adminModal').classList.add('hidden');

      const RANKS = ['مواطن مهروس شريف','مشير البطاطس الأعلى','رئيس وزراء الهرس القومي','وزير الدفاع المقرمش','رئيس المخابرات البوريه','مستشار الزبدة الملكي','لواء أركان حرب الشيبسي'];

      function renderApplicants(users) {
        const p = users.filter(x => x.status === 'pending');
        const box = document.getElementById('applicantsListContainer'); box.innerHTML = '';
        if (p.length === 0) box.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">لا توجد طلبات معلقة</div>';
        else {
          p.forEach(u => {
            const d = document.createElement('div'); d.className = 'p-2 rounded-xl bg-black border border-amber-500/30 flex items-center justify-between text-xs';
            const opts = RANKS.map(r => '<option value="' + r + '">' + r + '</option>').join('');
            d.innerHTML = '<div><div class="font-bold text-amber-300">' + u.name + '</div></div><div class="flex items-center gap-1"><select id="sel_' + u.id + '" class="bg-gray-800 text-white text-[10px] p-1 rounded">' + opts + '</select><button onclick="window.approveUser(\\'' + u.id + '\\')" class="bg-green-600 text-white text-[10px] px-2 py-1 rounded">قبول</button><button onclick="window.rejectUser(\\'' + u.id + '\\')" class="bg-red-600 text-white text-[10px] px-2 py-1 rounded">رفض</button></div>';
            box.appendChild(d);
          });
        }
      }
      window.approveUser = id => socket.emit('admin:approve_applicant', { userId: id, assignedRole: document.getElementById('sel_' + id)?.value });
      window.rejectUser = id => socket.emit('admin:reject_applicant', { userId: id });

      checkSession();
    })();
  </script>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => console.log(`الخادم يعمل على: ${PORT}`));
