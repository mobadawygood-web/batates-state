// المنظومة البرمجية الفائقة لدولة البطاطس المهروسة
(function() {
  'use strict';

  // عناصر واجهة المستخدم
  const gatekeeperScreen = document.getElementById('gatekeeperScreen');
  const waitingScreen = document.getElementById('waitingScreen');
  const rejectedScreen = document.getElementById('rejectedScreen');
  const mainDashboard = document.getElementById('mainDashboard');

  const joinForm = document.getElementById('joinForm');
  const applicantName = document.getElementById('applicantName');
  const applicantCodename = document.getElementById('applicantCodename');
  const applicantNote = document.getElementById('applicantNote');
  const toggleAdminPasscodeBtn = document.getElementById('toggleAdminPasscodeBtn');
  const adminPasscodeContainer = document.getElementById('adminPasscodeContainer');
  const adminPasscode = document.getElementById('adminPasscode');

  const waitUserName = document.getElementById('waitUserName');
  const waitUserCode = document.getElementById('waitUserCode');
  const cancelWaitBtn = document.getElementById('cancelWaitBtn');
  const reapplyBtn = document.getElementById('reapplyBtn');
  const rejectReasonText = document.getElementById('rejectReasonText');

  // عناصر الهيدر والشات
  const currentUserName = document.getElementById('currentUserName');
  const currentUserRole = document.getElementById('currentUserRole');
  const adminBadgeIcon = document.getElementById('adminBadgeIcon');
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  const pendingBadge = document.getElementById('pendingBadge');
  const logoutBtn = document.getElementById('logoutBtn');
  const citizensList = document.getElementById('citizensList');
  const onlineCountBadge = document.getElementById('onlineCountBadge');
  const messagesContainer = document.getElementById('messagesContainer');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const recordVoiceNoteBtn = document.getElementById('recordVoiceNoteBtn');
  const audioRecordingBar = document.getElementById('audioRecordingBar');
  const recordingTimer = document.getElementById('recordingTimer');
  const cancelRecordBtn = document.getElementById('cancelRecordBtn');
  const sendRecordBtn = document.getElementById('sendRecordBtn');
  const playAnthemBtn = document.getElementById('playAnthemBtn');
  const adminClearChatBtn = document.getElementById('adminClearChatBtn');

  // الراديو اللاسلكي المباشر
  const toggleVoiceRoomBtn = document.getElementById('toggleVoiceRoomBtn');
  const voiceRoomPanel = document.getElementById('voiceRoomPanel');
  const voiceUsersBadge = document.getElementById('voiceUsersBadge');
  const voiceUsersList = document.getElementById('voiceUsersList');
  const voiceMicToggleBtn = document.getElementById('voiceMicToggleBtn');
  const voiceMicIcon = document.getElementById('voiceMicIcon');
  const voiceMicText = document.getElementById('voiceMicText');
  const leaveVoiceBtn = document.getElementById('leaveVoiceBtn');

  // نافذة القيادة العليا
  const adminModal = document.getElementById('adminModal');
  const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');
  const applicantsListContainer = document.getElementById('applicantsListContainer');
  const approvedMembersContainer = document.getElementById('approvedMembersContainer');
  const securityLogsContainer = document.getElementById('securityLogsContainer');
  const tabPendingCount = document.getElementById('tabPendingCount');
  const refreshApplicantsBtn = document.getElementById('refreshApplicantsBtn');
  const broadcastDecreeBtn = document.getElementById('broadcastDecreeBtn');
  const decreeInput = document.getElementById('decreeInput');
  const stateAlertBanner = document.getElementById('stateAlertBanner');
  const stateAlertText = document.getElementById('stateAlertText');

  // حالة النظام الحالية
  let socket = null;
  let currentUser = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordInterval = null;
  let recordSeconds = 0;
  let isRecording = false;

  // حالة الراديو الصوتي المباشر
  let isInVoiceRoom = false;
  let isMicActive = false;
  let localStream = null;
  let audioContext = null;
  let audioPeerConnections = new Map(); // socketId -> RTCPeerConnection

  // ==========================================
  // نظام المؤثرات الصوتية الملكية (Web Audio API)
  // ==========================================
  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  // صوت نغمة السلام الوطني لدولة البطاطس (Fanfare)
  function playNationalAnthem() {
    try {
      const ctx = getAudioContext();
      const notes = [
        { freq: 440, dur: 0.25 }, // A4
        { freq: 554.37, dur: 0.25 }, // C#5
        { freq: 659.25, dur: 0.35 }, // E5
        { freq: 880, dur: 0.6 },    // A5
        { freq: 740, dur: 0.25 },    // F#5
        { freq: 880, dur: 0.7 }      // A5
      ];
      let startTime = ctx.currentTime;
      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, startTime);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + note.dur);
        startTime += note.dur + 0.05;
      });
    } catch(e) {
      console.log('Audio autoplay prevented:', e);
    }
  }

  // صوت إشعار رسالة
  function playBeep(freq = 700, duration = 0.12) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch(e) {}
  }

  // صوت صفارة الإنذار العسكرية (للفرمان العسكري)
  function playSiren() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.4);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.8);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.6);
    } catch(e) {}
  }

  // صوت كليك اللاسلكي
  function playWalkieClick() {
    playBeep(1200, 0.05);
  }

  // ==========================================
  // فحص الجلسة والبدء
  // ==========================================
  async function checkExistingSession() {
    const savedToken = localStorage.getItem('batates_token');
    if (!savedToken) {
      showScreen('gatekeeper');
      return;
    }

    try {
      const res = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken })
      });
      const data = await res.json();
      if (data.valid && data.user) {
        currentUser = data.user;
        handleUserStatus(currentUser);
      } else {
        localStorage.removeItem('batates_token');
        showScreen('gatekeeper');
      }
    } catch(err) {
      console.error(err);
      showScreen('gatekeeper');
    }
  }

  function handleUserStatus(user) {
    if (user.status === 'approved') {
      showScreen('dashboard');
      setupSocket();
    } else if (user.status === 'pending') {
      waitUserName.textContent = user.name;
      waitUserCode.textContent = user.codename || 'غير محدد';
      showScreen('waiting');
      setupSocket(); // حتى يستلم إشعار الموافقة في الوقت الفعلي
    } else if (user.status === 'rejected') {
      rejectReasonText.textContent = user.rejectReason || 'تم الرفض لدواعٍ أمنية عليا.';
      showScreen('rejected');
    } else {
      showScreen('gatekeeper');
    }
  }

  function showScreen(name) {
    gatekeeperScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    rejectedScreen.classList.add('hidden');
    mainDashboard.classList.add('hidden');

    if (name === 'gatekeeper') gatekeeperScreen.classList.remove('hidden');
    if (name === 'waiting') waitingScreen.classList.remove('hidden');
    if (name === 'rejected') rejectedScreen.classList.remove('hidden');
    if (name === 'dashboard') {
      mainDashboard.classList.remove('hidden');
      updateUserHeader();
    }
  }

  function updateUserHeader() {
    if (!currentUser) return;
    currentUserName.textContent = currentUser.name;
    currentUserRole.textContent = currentUser.role;

    if (currentUser.isAdmin) {
      adminBadgeIcon.classList.remove('hidden');
      adminPanelBtn.classList.remove('hidden');
      adminClearChatBtn.classList.remove('hidden');
    } else {
      adminBadgeIcon.classList.add('hidden');
      adminPanelBtn.classList.add('hidden');
      adminClearChatBtn.classList.add('hidden');
    }
  }

  // ==========================================
  // نموذج التسجيل وطلب الدخول
  // ==========================================
  toggleAdminPasscodeBtn.addEventListener('click', () => {
    adminPasscodeContainer.classList.toggle('hidden');
    if (!adminPasscodeContainer.classList.contains('hidden')) {
      adminPasscode.focus();
    }
  });

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = applicantName.value.trim();
    const codename = applicantCodename.value.trim();
    const note = applicantNote.value.trim();
    const passcode = adminPasscode.value.trim();

    if (!name) return;

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, codename, note, passcode })
      });
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem('batates_token', currentUser.token);

        if (data.mode === 'admin') {
          playNationalAnthem();
          alert(`👑 مرحباً بسيادة المشير القائد: ${currentUser.name}\nتم تفعيل رمز السيادة الكامل بنجاح.`);
        }
        handleUserStatus(currentUser);
      } else {
        alert(data.error || 'حدث خطأ في تقديم الطلب');
      }
    } catch(err) {
      alert('تعذر الاتصال بخادم دولة البطاطس المهروسة');
    }
  });

  cancelWaitBtn.addEventListener('click', () => {
    localStorage.removeItem('batates_token');
    currentUser = null;
    showScreen('gatekeeper');
  });

  reapplyBtn.addEventListener('click', () => {
    localStorage.removeItem('batates_token');
    currentUser = null;
    showScreen('gatekeeper');
  });

  logoutBtn.addEventListener('click', () => {
    if (confirm('هل ترغب بمغادرة الأراضي الرسمية لدولة البطاطس؟')) {
      localStorage.removeItem('batates_token');
      window.location.reload();
    }
  });

  // ==========================================
  // اتصال Socket.io
  // ==========================================
  function setupSocket() {
    if (socket) return;
    socket = io();

    socket.on('connect', () => {
      if (currentUser && currentUser.token) {
        socket.emit('auth:connect', { token: currentUser.token });
      }
    });

    // استلام البيانات الأولية
    socket.on('init:data', (data) => {
      currentUser = data.user;
      updateUserHeader();
      renderMessages(data.messages);
      renderCitizens(data.activeUsers);
      updatePendingBadge(data.pendingCount);
    });

    // استلام رسالة شات جديدة
    socket.on('chat:new_message', (msg) => {
      appendMessage(msg);
      playBeep(850, 0.08);
    });

    // تم مسح الشات بأمر عسكري
    socket.on('chat:cleared', (messages) => {
      renderMessages(messages);
      playBeep(300, 0.3);
    });

    // تغير حالة المواطن (موافقة، رفض، حظر)
    socket.on('applicant:status_changed', (payload) => {
      if (currentUser && currentUser.id === payload.userId) {
        if (payload.status === 'approved') {
          currentUser.status = 'approved';
          currentUser.role = payload.role;
          playNationalAnthem();
          alert(`🎉 تهانينا! وافق مشير البطاطس والقيادة العليا على دخولك!\nتم تعيينك رسمياً في منصب: [${payload.role}]`);
          showScreen('dashboard');
          socket.emit('auth:connect', { token: currentUser.token });
        } else if (payload.status === 'rejected' || payload.status === 'banned') {
          currentUser.status = payload.status;
          currentUser.rejectReason = payload.reason;
          showScreen('rejected');
        }
      }
    });

    // إشعار للأدمن بوصول طلب جديد
    socket.on('applicant:new', (applicant) => {
      if (currentUser && currentUser.isAdmin) {
        playBeep(1100, 0.15);
        if (socket) socket.emit('admin:get_applicants');
      }
    });

    // قائمة المتقدمين للأدمن
    socket.on('admin:applicants_list', (users) => {
      renderApplicantsInModal(users);
    });

    // سجلات الأمان
    socket.on('admin:logs_data', (logs) => {
      renderLogs(logs);
    });

    // فرمان عسكري مع صفارة إنذار
    socket.on('state:siren_alert', ({ message, sender }) => {
      playSiren();
      stateAlertText.textContent = `🚨 [فرمان سيادي من ${sender}]: ${message}`;
      stateAlertBanner.classList.remove('hidden');
    });

    // قائمة متحدثي الراديو
    socket.on('voice:users_list', (vUsers) => {
      renderVoiceUsers(vUsers);
    });

    socket.on('voice:user_state_change', (state) => {
      updateVoiceUserState(state);
    });

    // إشارات WebRTC
    socket.on('voice:signal', async ({ fromSocketId, signalData }) => {
      handleWebRTCSignal(fromSocketId, signalData);
    });
  }

  // ==========================================
  // عرض رسائل الشات
  // ==========================================
  function renderMessages(msgs) {
    messagesContainer.innerHTML = '';
    msgs.forEach(appendMessage);
    scrollToBottom();
  }

  function appendMessage(msg) {
    const isMe = currentUser && currentUser.id === msg.senderId;
    const isAnnouncement = msg.type === 'announcement';

    const div = document.createElement('div');
    div.className = 'w-full transition-all';

    if (isAnnouncement) {
      div.innerHTML = `
        <div class="my-2 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-amber-950/50 to-red-950/60 border border-amber-500/50 text-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <div class="flex items-center justify-center gap-2 text-amber-400 text-xs sm:text-sm font-black mb-1">
            <i class="fa-solid fa-scroll text-yellow-300"></i>
            <span>بيان سيادي رسمي • ${escapeHtml(msg.senderName)} (${escapeHtml(msg.senderRole)})</span>
          </div>
          <p class="text-white text-xs sm:text-sm font-bold leading-relaxed">${escapeHtml(msg.content)}</p>
          <div class="text-[10px] text-gray-400 mt-2">${formatTime(msg.timestamp)}</div>
        </div>
      `;
    } else {
      // رسالة عادية أو صوتية
      const alignClass = isMe ? 'justify-start' : 'justify-end';
      const bubbleBg = isMe 
        ? 'bg-amber-600/20 border border-amber-500/40 text-white' 
        : 'bg-[#161e2e] border border-gray-700/60 text-white';

      let contentHtml = '';
      if (msg.type === 'audio' && msg.audioUrl) {
        // مشغل الصوت الملكي المخصص
        contentHtml = `
          <div class="voice-player flex items-center gap-3 p-2 rounded-xl bg-black/40 border border-amber-500/20 my-1 min-w-[220px]">
            <button class="voice-play-btn w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center shadow transition-transform active:scale-90" data-src="${msg.audioUrl}">
              <i class="fa-solid fa-play text-xs mr-0.5"></i>
            </button>
            <div class="flex-1">
              <div class="flex items-center gap-1 h-5 mb-1 waveform-container">
                <span class="w-1 h-3 bg-amber-400 rounded-full waveform-bar"></span>
                <span class="w-1 h-5 bg-amber-400 rounded-full waveform-bar"></span>
                <span class="w-1 h-2 bg-amber-400 rounded-full waveform-bar"></span>
                <span class="w-1 h-4 bg-amber-400 rounded-full waveform-bar"></span>
                <span class="w-1 h-3 bg-amber-400 rounded-full waveform-bar"></span>
                <span class="w-1 h-5 bg-amber-400 rounded-full waveform-bar"></span>
                <span class="w-1 h-2 bg-amber-400 rounded-full waveform-bar"></span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>برقية صوتية مشفرة</span>
                <span class="voice-duration">00:${String(Math.round(msg.audioDuration || 0)).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        contentHtml = `<p class="text-xs sm:text-sm break-words leading-relaxed">${escapeHtml(msg.content)}</p>`;
      }

      // شارة الرتبة
      const badgeStyle = getRoleBadgeClass(msg.senderRole);

      div.innerHTML = `
        <div class="flex items-start gap-2 ${alignClass} mb-2">
          <div class="max-w-[85%] sm:max-w-md ${bubbleBg} rounded-2xl p-3 shadow-md">
            <div class="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-gray-700/40">
              <span class="text-xs font-black text-amber-300 flex items-center gap-1">
                ${msg.isAdmin ? '<i class="fa-solid fa-crown text-[10px] text-yellow-400"></i>' : ''}
                ${escapeHtml(msg.senderName)}
              </span>
              <span class="text-[10px] px-2 py-0.2 rounded-full ${badgeStyle}">
                ${escapeHtml(msg.senderRole)}
              </span>
            </div>
            ${contentHtml}
            <div class="text-[9px] text-gray-400 mt-1 text-left font-mono">${formatTime(msg.timestamp)}</div>
          </div>
        </div>
      `;
    }

    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  function getRoleBadgeClass(role) {
    if (!role) return 'badge-citizen';
    if (role.includes('مشير') || role.includes('الأعلى')) return 'badge-supreme';
    if (role.includes('وزير') || role.includes('رئيس')) return 'badge-minister';
    if (role.includes('لواء') || role.includes('سلاح') || role.includes('قائد')) return 'badge-general';
    return 'badge-citizen';
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ==========================================
  // إرسال الرسائل النصية
  // ==========================================
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    if (!socket) return;

    socket.emit('chat:message', { text });
    chatInput.value = '';
  });

  // ==========================================
  // تشغيل الرسائل الصوتية (Custom Audio Player)
  // ==========================================
  let currentAudio = null;
  let currentPlayBtn = null;

  messagesContainer.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.voice-play-btn');
    if (!playBtn) return;

    const audioSrc = playBtn.getAttribute('data-src');
    if (!audioSrc) return;

    const playerContainer = playBtn.closest('.voice-player');

    if (currentAudio && currentPlayBtn === playBtn) {
      if (currentAudio.paused) {
        currentAudio.play();
        playBtn.innerHTML = '<i class="fa-solid fa-pause text-xs"></i>';
        playerContainer.classList.add('playing');
      } else {
        currentAudio.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play text-xs mr-0.5"></i>';
        playerContainer.classList.remove('playing');
      }
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      if (currentPlayBtn) {
        currentPlayBtn.innerHTML = '<i class="fa-solid fa-play text-xs mr-0.5"></i>';
        currentPlayBtn.closest('.voice-player')?.classList.remove('playing');
      }
    }

    currentAudio = new Audio(audioSrc);
    currentPlayBtn = playBtn;
    playBtn.innerHTML = '<i class="fa-solid fa-pause text-xs"></i>';
    playerContainer.classList.add('playing');

    currentAudio.play().catch(e => {
      console.error(e);
      playBtn.innerHTML = '<i class="fa-solid fa-play text-xs mr-0.5"></i>';
      playerContainer.classList.remove('playing');
    });

    currentAudio.onended = () => {
      playBtn.innerHTML = '<i class="fa-solid fa-play text-xs mr-0.5"></i>';
      playerContainer.classList.remove('playing');
      currentAudio = null;
      currentPlayBtn = null;
    };
  });

  // ==========================================
  // تسجيل البرقيات الصوتية (Voice Note Recording)
  // ==========================================
  recordVoiceNoteBtn.addEventListener('click', async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      isRecording = true;
      recordSeconds = 0;
      recordingTimer.textContent = '00:00';
      audioRecordingBar.classList.remove('hidden');

      recordInterval = setInterval(() => {
        recordSeconds++;
        const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
        const secs = String(recordSeconds % 60).padStart(2, '0');
        recordingTimer.textContent = `${mins}:${secs}`;
      }, 1000);

      playBeep(900, 0.1);
    } catch(err) {
      alert('يرجى السماح بالوصول للمايكروفون لتسجيل البرقيات الصوتية.');
    }
  });

  cancelRecordBtn.addEventListener('click', () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      clearInterval(recordInterval);
      isRecording = false;
      audioChunks = [];
      audioRecordingBar.classList.add('hidden');
    }
  });

  sendRecordBtn.addEventListener('click', () => {
    if (mediaRecorder && isRecording) {
      clearInterval(recordInterval);
      isRecording = false;

      mediaRecorder.onstop = async () => {
        audioRecordingBar.classList.add('hidden');
        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');

        try {
          const res = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.success && data.audioUrl) {
            socket.emit('chat:message', {
              audioUrl: data.audioUrl,
              audioDuration: recordSeconds
            });
          }
        } catch(err) {
          alert('تعذر إرسال التسجيل الصوتي');
        }
      };

      mediaRecorder.stop();
    }
  });

  // ==========================================
  // قائمة المواطنين ومجلس الدولة
  // ==========================================
  function renderCitizens(users) {
    if (!citizensList) return;
    citizensList.innerHTML = '';
    onlineCountBadge.textContent = `${users.length} متصل`;

    // ترتيب المشير والأدمن في البداية ثم الباقي
    users.sort((a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0));

    users.forEach(u => {
      const card = document.createElement('div');
      card.className = 'flex items-center justify-between p-2 rounded-xl bg-[#0e131d] border border-gray-800 text-xs hover:border-amber-500/40 transition-all';
      
      const badgeStyle = getRoleBadgeClass(u.role);

      card.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-xs">
            ${u.isAdmin ? '👑' : '🥔'}
          </div>
          <div>
            <div class="font-bold text-white flex items-center gap-1">
              ${escapeHtml(u.name)}
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            </div>
            <div class="text-[10px] text-gray-400">${escapeHtml(u.role)}</div>
          </div>
        </div>
        <span class="text-[9px] px-2 py-0.5 rounded-full ${badgeStyle}">
          ${u.isAdmin ? 'سيادة' : 'مواطن'}
        </span>
      `;
      citizensList.appendChild(card);
    });
  }

  // ==========================================
  // الراديو اللاسلكي المباشر (Tactical Voice Room)
  // ==========================================
  toggleVoiceRoomBtn.addEventListener('click', () => {
    voiceRoomPanel.classList.toggle('hidden');
    if (!voiceRoomPanel.classList.contains('hidden') && !isInVoiceRoom) {
      joinVoiceRoom();
    }
  });

  leaveVoiceBtn.addEventListener('click', () => {
    leaveVoiceRoom();
    voiceRoomPanel.classList.add('hidden');
  });

  async function joinVoiceRoom() {
    if (!socket) return;
    isInVoiceRoom = true;
    socket.emit('voice:join');
    playWalkieClick();
  }

  function leaveVoiceRoom() {
    if (!socket) return;
    isInVoiceRoom = false;
    isMicActive = false;
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    voiceMicIcon.className = 'fa-solid fa-microphone-slash';
    voiceMicText.textContent = 'المايكروفون مكتوم';
    voiceMicToggleBtn.className = 'bg-red-600/30 hover:bg-red-600/40 border border-red-500 text-red-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all';
    socket.emit('voice:leave');
    playWalkieClick();
  }

  voiceMicToggleBtn.addEventListener('click', async () => {
    if (!isInVoiceRoom) await joinVoiceRoom();

    if (!isMicActive) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isMicActive = true;
        voiceMicIcon.className = 'fa-solid fa-microphone text-green-400';
        voiceMicText.textContent = 'المايك مفتوح (تحدث الآن)';
        voiceMicToggleBtn.className = 'bg-green-600/30 hover:bg-green-600/40 border border-green-500 text-green-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all';
        socket.emit('voice:speaking_status', { isSpeaking: true, isMuted: false });
        playWalkieClick();
      } catch(e) {
        alert('يرجى تمكين المايكروفون');
      }
    } else {
      isMicActive = false;
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      voiceMicIcon.className = 'fa-solid fa-microphone-slash text-red-400';
      voiceMicText.textContent = 'المايكروفون مكتوم';
      voiceMicToggleBtn.className = 'bg-red-600/30 hover:bg-red-600/40 border border-red-500 text-red-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all';
      socket.emit('voice:speaking_status', { isSpeaking: false, isMuted: true });
      playWalkieClick();
    }
  });

  function renderVoiceUsers(vUsers) {
    voiceUsersBadge.textContent = vUsers.length;
    voiceUsersList.innerHTML = '';
    vUsers.forEach(u => {
      const chip = document.createElement('div');
      chip.id = `vUser_${u.socketId}`;
      chip.className = `flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#141b29] border ${u.isSpeaking ? 'border-green-400 speaking-ring' : 'border-gray-700'} text-xs`;
      chip.innerHTML = `
        <div class="w-2 h-2 rounded-full ${u.isSpeaking ? 'bg-green-400' : 'bg-gray-500'}"></div>
        <span class="text-white font-bold">${escapeHtml(u.name)}</span>
        <span class="text-[9px] text-amber-400 font-mono">(${escapeHtml(u.role)})</span>
      `;
      voiceUsersList.appendChild(chip);
    });
  }

  function updateVoiceUserState(state) {
    const el = document.getElementById(`vUser_${state.socketId}`);
    if (el) {
      if (state.isSpeaking) {
        el.classList.add('border-green-400', 'speaking-ring');
        el.classList.remove('border-gray-700');
      } else {
        el.classList.remove('border-green-400', 'speaking-ring');
        el.classList.add('border-gray-700');
      }
    }
  }

  function handleWebRTCSignal(fromSocketId, signalData) {
    // Signaling placeholders
  }

  // ==========================================
  // نافذة القيادة العليا (Supreme Admin Controls)
  // ==========================================
  adminPanelBtn.addEventListener('click', () => {
    adminModal.classList.remove('hidden');
    if (socket) {
      socket.emit('admin:get_applicants');
      socket.emit('admin:get_logs');
    }
  });

  closeAdminModalBtn.addEventListener('click', () => {
    adminModal.classList.add('hidden');
  });

  // تبديل التبويبات في لوحة الأدمن
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.classList.remove('active', 'border-amber-500', 'text-amber-400');
        b.classList.add('border-transparent', 'text-gray-400');
      });
      btn.classList.add('active', 'border-amber-500', 'text-amber-400');
      btn.classList.remove('border-transparent', 'text-gray-400');

      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
      const target = document.getElementById(btn.getAttribute('data-tab'));
      if (target) target.classList.remove('hidden');
    });
  });

  refreshApplicantsBtn.addEventListener('click', () => {
    if (socket) socket.emit('admin:get_applicants');
  });

  function updatePendingBadge(count) {
    tabPendingCount.textContent = count || 0;
    if (count > 0) {
      pendingBadge.textContent = count;
      pendingBadge.classList.remove('hidden');
    } else {
      pendingBadge.classList.add('hidden');
    }
  }

  // الرتب الرسمية المقترحة
  const STANDARD_RANKS = [
    'مواطن مهروس شريف',
    'مشير البطاطس الأعلى',
    'رئيس وزراء الهرس القومي',
    'وزير الدفاع المقرمش',
    'رئيس المخابرات البوريه',
    'مستشار الزبدة الملكي',
    'لواء أركان حرب الشيبسي',
    'قائد سلاح البطاطس المقلية',
    'عقيد صاعقة الويدجز',
    'سفير النكهات الإمبراطوري'
  ];

  function renderApplicantsInModal(users) {
    const pending = users.filter(u => u.status === 'pending');
    const approved = users.filter(u => u.status === 'approved' && !u.isAdmin);

    updatePendingBadge(pending.length);

    // قائمة المعلقين
    applicantsListContainer.innerHTML = '';
    if (pending.length === 0) {
      applicantsListContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500 text-xs">
          <i class="fa-solid fa-check-double text-2xl text-amber-500/40 mb-2 block"></i>
          لا توجد طلبات تصريح معلقة حالياً. جميع المواطنين مفحوصون!
        </div>
      `;
    } else {
      pending.forEach(u => {
        const card = document.createElement('div');
        card.className = 'p-4 rounded-2xl bg-[#0a0e17] border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4';

        let optionsHtml = STANDARD_RANKS.map(r => `<option value="${r}">${r}</option>`).join('');

        card.innerHTML = `
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-black text-amber-300">${escapeHtml(u.name)}</span>
              <span class="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono">كود: ${escapeHtml(u.codename)}</span>
            </div>
            <p class="text-xs text-gray-300">رسالة الولاء: "${escapeHtml(u.note || 'بدون رسالة')}"</p>
            <div class="text-[10px] text-gray-500 font-mono">تاريخ التقديم: ${formatTime(u.joinedAt)} | IP: ${escapeHtml(u.ip || 'مؤمن')}</div>
          </div>

          <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div class="flex-1 md:flex-initial">
              <label class="block text-[10px] text-amber-300 mb-0.5">تعيين المنصب / الرتبة:</label>
              <select id="role_select_${u.id}" class="bg-[#141b2b] border border-amber-500/40 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400">
                ${optionsHtml}
              </select>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <button class="approve-btn bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow" data-id="${u.id}">
                <i class="fa-solid fa-check"></i> قبول وتعيين
              </button>
              <button class="reject-btn bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1" data-id="${u.id}">
                <i class="fa-solid fa-xmark"></i> رفض
              </button>
            </div>
          </div>
        `;
        applicantsListContainer.appendChild(card);
      });
    }

    // قائمة المواطنين المعتمدين لتعديل مناصبهم
    approvedMembersContainer.innerHTML = '';
    if (approved.length === 0) {
      approvedMembersContainer.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">لا يوجد مواطنون معتمدون حالياً</div>';
    } else {
      approved.forEach(u => {
        const item = document.createElement('div');
        item.className = 'p-3 rounded-xl bg-[#0a0e17] border border-gray-800 flex items-center justify-between text-xs gap-2';
        item.innerHTML = `
          <div>
            <div class="font-bold text-white flex items-center gap-1.5">
              <span>${escapeHtml(u.name)}</span>
              <span class="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">${escapeHtml(u.role)}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input type="text" id="new_role_${u.id}" placeholder="تعديل المنصب..." value="${escapeHtml(u.role)}" class="bg-[#141b2b] border border-gray-700 text-[11px] text-white px-2 py-1 rounded w-36">
            <button class="update-role-btn bg-amber-600 hover:bg-amber-500 text-black font-bold px-2.5 py-1 rounded text-[11px]" data-id="${u.id}">
              ترقية / حفظ
            </button>
            <button class="ban-btn bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-2 py-1 rounded text-[11px]" data-id="${u.id}" title="نفي وحظر">
              <i class="fa-solid fa-user-slash"></i>
            </button>
          </div>
        `;
        approvedMembersContainer.appendChild(item);
      });
    }
  }

  // أحداث لوحة الأدمن (قبول، رفض، ترقية)
  applicantsListContainer.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.approve-btn');
    const rejectBtn = e.target.closest('.reject-btn');

    if (approveBtn) {
      const userId = approveBtn.getAttribute('data-id');
      const select = document.getElementById(`role_select_${userId}`);
      const assignedRole = select ? select.value : 'مواطن مهروس شريف';
      socket.emit('admin:approve_applicant', { userId, assignedRole });
      playBeep(950, 0.1);
    }

    if (rejectBtn) {
      const userId = rejectBtn.getAttribute('data-id');
      const reason = prompt('سبب رفض دخول هذا المتقدم لدولة البطاطس:', 'دواعي أمن قومي') || 'دواعي أمن قومي';
      socket.emit('admin:reject_applicant', { userId, reason });
      playBeep(350, 0.2);
    }
  });

  approvedMembersContainer.addEventListener('click', (e) => {
    const updateBtn = e.target.closest('.update-role-btn');
    const banBtn = e.target.closest('.ban-btn');

    if (updateBtn) {
      const userId = updateBtn.getAttribute('data-id');
      const input = document.getElementById(`new_role_${userId}`);
      const newRole = input ? input.value : '';
      if (newRole) {
        socket.emit('admin:update_role', { userId, newRole });
        alert('تم تعديل المنصب بنجاح!');
      }
    }

    if (banBtn) {
      const userId = banBtn.getAttribute('data-id');
      if (confirm('هل أنت متأكد من نفي وحظر هذا المواطن من دولة البطاطس المهروسة؟')) {
        socket.emit('admin:ban_user', { userId });
      }
    }
  });

  // إصدار فرمان عسكري
  broadcastDecreeBtn.addEventListener('click', () => {
    const text = decreeInput.value.trim();
    if (!text) return;
    if (confirm('هل تؤكد إطلاق هذا الفرمان العسكري لجميع رعايا الدولة فوراً؟')) {
      socket.emit('admin:announcement', { text });
      decreeInput.value = '';
      adminModal.classList.add('hidden');
    }
  });

  // مسح الشات بأمر عسكري
  adminClearChatBtn.addEventListener('click', () => {
    if (confirm('تحذير سيادي: هل تريد مسح وتطهير سجل المحادثات بالكامل؟')) {
      socket.emit('admin:clear_chat');
    }
  });

  function renderLogs(logs) {
    securityLogsContainer.innerHTML = '';
    logs.slice(0, 30).forEach(log => {
      const div = document.createElement('div');
      div.className = 'p-2 rounded bg-[#070a0f] border border-gray-800 flex items-center justify-between text-[11px] text-gray-300';
      div.innerHTML = `
        <div>
          <span class="text-amber-400 font-bold">[${escapeHtml(log.action)}]</span>
          <span>${escapeHtml(log.details)}</span>
        </div>
        <div class="text-[10px] text-gray-500">${formatTime(log.timestamp)}</div>
      `;
      securityLogsContainer.appendChild(div);
    });
  }

  // عزف السلام الوطني
  playAnthemBtn.addEventListener('click', () => {
    playNationalAnthem();
  });

  // مساعدات عامة
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch(e) {
      return '';
    }
  }

  // بدء التطبيق
  checkExistingSession();

})();
