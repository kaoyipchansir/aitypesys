// ==========================================
// 1. 初始化 Supabase
// ==========================================
const supabaseUrl = 'https://dezzirmgreqnzwsgyvck.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlenppcm1ncmVxbnp3c2d5dmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODI2NTEsImV4cCI6MjA5NzE1ODY1MX0.BsEuciSKYE5338KFsqZOFN8tXrKJBpywThFevvPV_XM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. 全域狀態與變數
// ==========================================
let currentText = "";
let startTime = null;
let timerInterval = null;
let timeLimit = 0; 
let timeRemaining = 0;
let currentMode = 'article'; 
let currentUser = { name: '', class: '', role: '' };
let currentTasks = []; 
let currentExerciseTitle = "綜合練習";

let currentWpm = 0;
let currentAcc = 0;
let currentLbFilterType = 'ALL'; 

let adminTasks = []; 
let editingExerciseId = null;

const cjDict = { philosophy: '日月金木水火土', strokes: '竹戈十大中一弓', body: '人心手口', shape: '尸廿山女田卜' };
const cjLetterMap = { '日':'a', '月':'b', '金':'c', '木':'d', '水':'e', '火':'f', '土':'g', '竹':'h', '戈':'i', '十':'j', '大':'k', '中':'l', '一':'m', '弓':'n', '人':'o', '心':'p', '手':'q', '口':'r', '尸':'s', '廿':'t', '山':'u', '女':'v', '田':'w', '卜':'y' };
const engToCjMap = { 'a':'日', 'b':'月', 'c':'金', 'd':'木', 'e':'水', 'f':'火', 'g':'土', 'h':'竹', 'i':'戈', 'j':'十', 'k':'大', 'l':'中', 'm':'一', 'n':'弓', 'o':'人', 'p':'心', 'q':'手', 'r':'口', 's':'尸', 't':'廿', 'u':'山', 'v':'女', 'w':'田', 'x':'難', 'y':'卜', 'z':'重' };

// ==========================================
// 3. 系統初始化與登入邏輯
// ==========================================
window.onload = () => { checkLoginStatus(); };

function checkLoginStatus() {
    const savedName = sessionStorage.getItem('user_name');
    const savedClass = sessionStorage.getItem('user_class');
    const savedRole = sessionStorage.getItem('user_role');

    if (savedName && savedClass) {
        currentUser = { name: savedName, class: savedClass, role: savedRole };
        
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('user-controls').style.display = 'block';
        document.getElementById('leaderboard-section').style.display = 'block';

        if (currentUser.role === 'admin') {
            document.getElementById('admin-section').style.display = 'block';
            document.getElementById('practice-section').style.display = 'none'; 
            toggleAdminTools(); 
            loadAdminExercises(); 
        } else {
            document.getElementById('admin-section').style.display = 'none';
            document.getElementById('practice-section').style.display = 'block'; 
            switchMainTab('assigned'); 
            switchMode('article');     
        }
        
        injectLeaderboardFilters(); 
        loadLeaderboardExerciseDropdown(); 
        fetchLeaderboard('ALL');
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('practice-section').style.display = 'none';
        document.getElementById('leaderboard-section').style.display = 'none';
        document.getElementById('admin-section').style.display = 'none';
        document.getElementById('user-controls').style.display = 'none';
    }
}

function login() {
    const account = document.getElementById('account-id').value.trim().toUpperCase(); 
    const pwd = document.getElementById('password').value;
    if (!account || !pwd) return alert("請輸入帳號與密碼！");

    if (account === 'ADMIN') {
        sessionStorage.setItem('user_name', '管理員');
        sessionStorage.setItem('user_class', 'ADMIN');
        sessionStorage.setItem('user_role', 'admin');
    } else {
        sessionStorage.setItem('user_name', '學生_' + account);
        sessionStorage.setItem('user_class', account.substring(0, 2));
        sessionStorage.setItem('user_role', 'student');
    }
    checkLoginStatus();
}

function guestLogin() {
    sessionStorage.setItem('user_name', '訪客');
    sessionStorage.setItem('user_class', 'GUEST');
    sessionStorage.setItem('user_role', 'student');
    checkLoginStatus();
}

function logout() {
    if (!checkAndStopTyping()) return; 
    sessionStorage.clear();
    location.reload();
}

// ==========================================
// 4. UI 面板切換功能與防護機制
// ==========================================
function checkAndStopTyping() {
    const typingInput = document.getElementById('typing-input');
    if (startTime && typingInput && !typingInput.disabled) {
        const confirmStop = confirm("⚠️ 練習正在進行中！\n確定要切換任務或畫面嗎？（未打完的字將視為錯誤，這會大幅降低您的準確率）");
        if (confirmStop) {
            clearInterval(timerInterval);
            finishTyping(typingInput, true); 
            return true;
        } else {
            typingInput.focus(); 
            return false;
        }
    }
    clearInterval(timerInterval);
    return true;
}

function resetTypingArea() {
    document.getElementById('text-display').innerHTML = '';
    const typingInput = document.getElementById('typing-input');
    if (typingInput) {
        typingInput.value = '';
        typingInput.disabled = true;
    }
    document.getElementById('status-display').innerText = '';
    document.getElementById('timer-display').style.display = 'none';
    document.getElementById('exercise-title-display').innerText = '';
    currentText = ""; 
    currentWpm = 0;
    currentAcc = 0;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    startTime = null;
}

function switchMainTab(tabName) {
    if (!checkAndStopTyping()) return; 

    document.getElementById('tab-assigned').classList.remove('active');
    document.getElementById('tab-self').classList.remove('active');
    document.getElementById('assigned-ui').style.display = 'none';
    document.getElementById('self-ui').style.display = 'none';

    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`${tabName}-ui`).style.display = 'block';
    resetTypingArea(); 
}

function toggleAdminGoalUnit() {
    document.getElementById('admin-goal-unit').innerText = document.getElementById('admin-goal-type').value === 'time' ? '秒' : '個字';
}
function toggleSelfGoalInput() {
    document.getElementById('self-goal-unit').innerText = document.getElementById('self-goal').value === 'time' ? '秒' : '個字';
}

function toggleSelfStudyTools() {
    const type = document.getElementById('self-type').value;
    document.getElementById('self-article-tools').style.display = type === 'article' ? 'block' : 'none';
    document.getElementById('self-ai-tools').style.display = type === 'ai-gen' ? 'block' : 'none';
    document.getElementById('self-category-tools').style.display = (type === 'root' || type === 'auxiliary') ? 'block' : 'none';
    document.getElementById('btn-self-start').style.display = type !== 'ai-gen' ? 'block' : 'none';
}

function toggleAdminTools() {
    const type = document.getElementById('admin-type').value;
    const artTools = document.getElementById('admin-article-tools');
    const rootTools = document.getElementById('admin-root-tools');
    const auxTools = document.getElementById('admin-aux-tools');
    
    if (artTools) artTools.style.display = type === 'article' ? 'block' : 'none';
    if (rootTools) rootTools.style.display = type === 'root' ? 'block' : 'none';
    if (auxTools) auxTools.style.display = type === 'auxiliary' ? 'block' : 'none';
    
    updateAdminPreview(); 
}

// ==========================================
// 5. 學生任務中心
// ==========================================
async function switchMode(mode) {
    if (!checkAndStopTyping()) return; 

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (mode === 'article' && btn.innerText.includes('文章')) btn.classList.add('active');
        if (mode === 'root' && btn.innerText.includes('字根')) btn.classList.add('active');
        if (mode === 'auxiliary' && btn.innerText.includes('輔助')) btn.classList.add('active');
    });

    currentMode = mode;
    resetTypingArea(); 

    const select = document.getElementById('exercise-select');
    select.style.display = 'inline-block';
    select.innerHTML = '<option value="">🔄 正在尋找任務...</option>';

    try {
        const { data, error } = await supabaseClient.from('exercises').select('*').overlaps('target_classes', [currentUser.class, 'ALL']).order('created_at', { ascending: false });
        if (error) throw error;
        currentTasks = data.filter(task => task.exercise_type === mode);

        if (currentTasks.length === 0) return select.innerHTML = '<option value="">目前沒有指派的任務</option>';

        select.innerHTML = '<option value="">👇 請選擇要挑戰的任務</option>';
        currentTasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task.id; 
            option.innerText = task.title;
            select.appendChild(option);
        });
    } catch (err) { select.innerHTML = '<option value="">❌ 載入失敗</option>'; }
}

function onExerciseChange() {
    if (!checkAndStopTyping()) return; 

    const selectedId = document.getElementById('exercise-select').value;
    if (!selectedId) { resetTypingArea(); return; }

    const selectedTask = currentTasks.find(t => t.id == selectedId);
    if (selectedTask) {
        currentExerciseTitle = selectedTask.title; 
        document.getElementById('exercise-title-display').innerText = `📋 挑戰任務：${selectedTask.title}`;
        startTypingSession(selectedTask.content);
    }
}

// ==========================================
// 6. 管理員：發佈、列表、編輯與刪除
// ==========================================
async function loadAdminExercises() {
    const list = document.getElementById('admin-exercise-list');
    if (!list) return; 
    list.innerHTML = '<li>讀取中...</li>';
    try {
        const { data, error } = await supabaseClient.from('exercises').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        list.innerHTML = '';
        if(data.length === 0) return list.innerHTML = '<li>目前沒有發佈的練習</li>';
        adminTasks = data; 

        data.forEach(ex => {
            const li = document.createElement('li');
            const typeText = ex.exercise_type === 'root' ? '字根' : ex.exercise_type === 'auxiliary' ? '輔助字型' : '文章';
            li.innerHTML = `
                <span><strong>${ex.title}</strong> <span style="font-size:12px; color:#666;">(對象:${ex.target_classes.join(',')} | 模式:${typeText})</span></span>
                <div>
                    <button class="admin-action-btn btn-edit" onclick="editExercise('${ex.id}')">✏️ 編輯</button>
                    <button class="admin-action-btn btn-delete" onclick="deleteExercise('${ex.id}')">🗑️ 刪除</button>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (err) { list.innerHTML = `<li>載入失敗：${err.message}</li>`; }
}

function editExercise(id) {
    const ex = adminTasks.find(t => t.id == id);
    if (!ex) return;
    editingExerciseId = ex.id;
    
    document.getElementById('admin-title').value = ex.title;
    document.getElementById('admin-classes').value = ex.target_classes.join(',');
    document.getElementById('admin-content').value = ex.content;
    document.getElementById('admin-type').value = ex.exercise_type;
    document.getElementById('admin-goal-type').value = ex.goal_type;
    
    toggleAdminTools();
    updateAdminPreview();
    
    const pubBtn = document.getElementById('btn-publish');
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (pubBtn) pubBtn.innerHTML = "💾 儲存修改";
    if (cancelBtn) cancelBtn.style.display = "inline-block";
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    editingExerciseId = null;
    document.getElementById('admin-title').value = '';
    document.getElementById('admin-classes').value = '';
    document.getElementById('admin-content').value = '';
    
    const pubBtn = document.getElementById('btn-publish');
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (pubBtn) pubBtn.innerHTML = "🚀 發佈練習";
    if (cancelBtn) cancelBtn.style.display = "none";
    updateAdminPreview();
}

async function deleteExercise(id) {
    if(!confirm('確定要刪除這筆任務嗎？學生將無法再看到。')) return;
    try {
        const { error } = await supabaseClient.from('exercises').delete().eq('id', id);
        if (error) throw error;
        alert('任務已成功刪除！');
        loadAdminExercises();
        loadLeaderboardExerciseDropdown(); 
    } catch (err) { alert('刪除失敗：' + err.message); }
}

async function publishExercise() {
    const title = document.getElementById('admin-title').value.trim();
    let targetClassesInput = document.getElementById('admin-classes').value.trim().toUpperCase();
    const content = document.getElementById('admin-content').value.trim();
    const exerciseType = document.getElementById('admin-type').value; 
    const goalType = document.getElementById('admin-goal-type').value; 

    if (!title || !targetClassesInput || !content) return alert("請填寫完整資訊！");
    let targetClassesArray = targetClassesInput === 'ALL' ? ['ALL'] : targetClassesInput.endsWith('*') ? ['A','B','C','D','E'].map(l => targetClassesInput.replace('*','') + l) : targetClassesInput.split(',').map(c => c.trim());

    try {
        if (editingExerciseId) {
            const { error } = await supabaseClient.from('exercises').update({ title, target_classes: targetClassesArray, content, exercise_type: exerciseType, goal_type: goalType }).eq('id', editingExerciseId);
            if (error) throw error;
            alert(`🎉 任務修改成功！`);
            cancelEdit();
        } else {
            const { error } = await supabaseClient.from('exercises').insert([{ title, target_classes: targetClassesArray, content, exercise_type: exerciseType, goal_type: goalType }]);
            if (error) throw error;
            alert(`🎉 任務已成功發佈！`);
            document.getElementById('admin-title').value = '';
            document.getElementById('admin-classes').value = '';
            document.getElementById('admin-content').value = '';
            updateAdminPreview(); 
        }
        loadAdminExercises(); 
        loadLeaderboardExerciseDropdown(); 
    } catch (err) { alert("操作失敗：" + err.message); }
}

// ==========================================
// 7. 管理員即時預覽與生成
// ==========================================
function updateAdminPreview() {
    const type = document.getElementById('admin-type').value;
    const content = document.getElementById('admin-content').value;
    const previewBox = document.getElementById('admin-preview-box');

    if (!previewBox) return; 

    if (type === 'auxiliary' && content) {
        previewBox.style.display = 'block';
        previewBox.innerHTML = '<strong style="display:block; margin-bottom:5px; font-size:14px; color:#28a745;">👀 學生端真實畫面預覽：</strong>';
        content.split('').forEach(char => {
            if (cjLetterMap[char]) {
                const letter = cjLetterMap[char];
                previewBox.innerHTML += `<img src="typingimg/aux_${letter}_1.png" style="height: 28px; margin: 0 4px; vertical-align: middle;">`;
            } else {
                previewBox.innerHTML += char;
            }
        });
    } else { previewBox.style.display = 'none'; }
}

function generateAdminRoots() {
    const count = parseInt(document.getElementById('admin-root-count').value) || 50;
    const chks = document.querySelectorAll('.root-chk:checked'); 
    if(chks.length === 0) return alert('請至少勾選一個類別！');
    let pool = '';
    chks.forEach(chk => pool += cjDict[chk.value]);
    let result = '';
    for(let i=0; i<count; i++) result += pool[Math.floor(Math.random() * pool.length)];
    document.getElementById('admin-content').value = result;
    updateAdminPreview();
}

function generateAdminAuxiliary() {
    const count = parseInt(document.getElementById('admin-aux-count').value) || 50;
    const chks = document.querySelectorAll('.aux-chk:checked');
    if(chks.length === 0) return alert('請至少勾選一個類別！');
    let pool = '';
    chks.forEach(chk => pool += cjDict[chk.value]);
    let result = '';
    for(let i=0; i<count; i++) result += pool[Math.floor(Math.random() * pool.length)];
    document.getElementById('admin-content').value = result;
    updateAdminPreview(); 
}

// ==========================================
// 8. 自學模式工具與 AI 生成
// ==========================================
function startSelfStudy() {
    if (!checkAndStopTyping()) return; 
    const type = document.getElementById('self-type').value;
    currentMode = type; 
    
    if (type === 'article') {
        if (!currentText) return alert("請先上傳文章 txt 檔案！");
        currentExerciseTitle = "自學：上傳文章";
        startTypingSession(currentText);
    } 
    else if (type === 'root' || type === 'auxiliary') {
        const count = parseInt(document.getElementById('self-goal-value').value) || 50;
        const chks = document.querySelectorAll('.self-chk:checked');
        if(chks.length === 0) return alert('請至少勾選一個分類範圍！');
        
        let pool = '';
        chks.forEach(chk => pool += cjDict[chk.value]);
        let result = '';
        for(let i=0; i<count; i++) result += pool[Math.floor(Math.random() * pool.length)];
        
        currentExerciseTitle = type === 'root' ? '自學：字根特訓' : '自學：輔助字型特訓'; 
        document.getElementById('exercise-title-display').innerText = `📝 ${currentExerciseTitle}`;
        startTypingSession(result);
    }
}

function handleAdminFileUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { document.getElementById('admin-content').value = e.target.result.trim(); updateAdminPreview(); }
    reader.readAsText(file);
}

function handleSelfFileUpload(event) {
    if (!checkAndStopTyping()) { event.target.value = ''; return; } 
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { currentText = e.target.result.trim(); alert("文章上傳成功，請點擊「開始自學挑戰」！"); };
    reader.readAsText(file);
}

function setAIPrompt(text) { document.getElementById('ai-prompt').value = text; }

async function generateAIContent() {
    if (!checkAndStopTyping()) return; 
    const prompt = document.getElementById('ai-prompt').value.trim();
    if (!prompt) return alert("請輸入您的 AI 要求！");

    const goalVal = document.getElementById('self-goal-value').value || 100;
    const enhancedPrompt = prompt + `\n(💡 重要指示：字數請務必精準控制在約 ${goalVal} 字左右，結尾請自然結束語句，絕對不允許無限重複同一個字！)`;

    const btn = document.getElementById('btn-ai-gen'); 
    btn.innerText = "🔮 思索中..."; btn.disabled = true;

    clearInterval(timerInterval); 
    document.getElementById('timer-display').style.display = 'none';
    currentExerciseTitle = `AI文章：${prompt.substring(0,10)}...`; 
    document.getElementById('exercise-title-display').innerText = `🤖 ${currentExerciseTitle}`;

    const displayDiv = document.getElementById('text-display');
    displayDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #007bff; animation: pulse 1.5s infinite;">⏳ AI 撰寫中，請稍候...</div>`;
    document.getElementById('typing-input').disabled = true;

    try {
        const { data, error } = await supabaseClient.functions.invoke('ai-typing-gen', { body: { prompt: enhancedPrompt } });
        if (error) throw error;
        startTypingSession(data.text.trim());
    } catch (err) {
        displayDiv.innerHTML = `<div style="color: #dc3545; text-align: center;">❌ 產生失敗: ${err.message}</div>`;
    } finally { btn.innerText = "🔮 產生文章"; btn.disabled = false; }
}

// ==========================================
// 9. 核心打字引擎 
// ==========================================
function getEarlySubmitBtnHTML() {
    return `<button onclick="submitEarly()" style="margin-left:15px; padding:3px 12px; background-color:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow:0px 2px 4px rgba(0,0,0,0.2);">🛑 提前提交</button>`;
}

window.submitEarly = function() {
    if (!startTime) return alert("您還沒開始打字喔！");
    const typingInput = document.getElementById('typing-input');
    if (typingInput.disabled) return; 

    if (confirm("⚠️ 確定要提前提交嗎？\n(未打完的字將全部視為錯誤，這會大幅降低您的最終準確率，系統規定需達 95% 準確率才可上榜)")) {
        clearInterval(timerInterval);
        finishTyping(typingInput, true); 
    }
};

window.restartExercise = function() {
    if (!currentText) return;
    startTypingSession(currentText);
};

function startTypingSession(text) {
    if(!text) return;
    currentText = text;
    currentWpm = 0; 
    currentAcc = 0; 
    
    const goalType = document.getElementById('self-goal').value;
    const goalVal = parseInt(document.getElementById('self-goal-value').value);
    const timerDisplay = document.getElementById('timer-display');
    
    if (document.getElementById('self-ui').style.display !== 'none' && goalType === 'time') {
        timeLimit = goalVal;
        timeRemaining = timeLimit;
        timerDisplay.style.display = 'block';
        timerDisplay.innerText = `剩餘時間：${timeRemaining}秒`;
    } else {
        timeLimit = 0;
        timerDisplay.style.display = 'none';
    }

    const displayDiv = document.getElementById('text-display');
    displayDiv.innerHTML = ''; 
    displayDiv.className = `mode-${currentMode}`;

    text.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.id = `char-${index}`;
        if (currentMode === 'auxiliary' && cjLetterMap[char]) {
            const letter = cjLetterMap[char];
            let imgNum = Math.floor(Math.random() * 2) + 1; 
            if (letter === 'r') imgNum = 1; 
            span.innerHTML = `<img src="typingimg/aux_${letter}_${imgNum}.png" class="cangjie-img" alt="${char}"><span class="ans-hint">${char}</span>`;
        } else {
            span.innerHTML = `${char}<span class="ans-hint">${char}</span>`;
        }
        if (index === 0) span.classList.add('current-char');
        displayDiv.appendChild(span);
    });

    const typingInput = document.getElementById('typing-input');
    typingInput.disabled = false;
    typingInput.value = '';
    
    startTime = null; 
    clearInterval(timerInterval);
    timerInterval = null;
    
    document.getElementById('status-display').innerHTML = `準備好請直接開始打字... ${getEarlySubmitBtnHTML()}`;
    setupTypingLogic();
}

function setupTypingLogic() {
    const inputArea = document.getElementById('typing-input');
    const newArea = inputArea.cloneNode(true);
    inputArea.parentNode.replaceChild(newArea, inputArea);
    
    newArea.focus();
    setTimeout(() => newArea.focus(), 50);

    let isComposing = false; 

    function handleTypingCheck() {
        if (currentMode === 'root' || currentMode === 'auxiliary') {
            let originalValue = newArea.value;
            let convertedValue = originalValue.toLowerCase().split('').map(c => engToCjMap[c] || c).join('');
            if (originalValue !== convertedValue) newArea.value = convertedValue;
        }

        const typed = newArea.value; 
        const typedArray = typed.split('');
        const textArray = currentText.split('');

        if (typed.length > 0 && !startTime) {
            startTime = new Date();
            if (timeLimit > 0 && !timerInterval) {
                timerInterval = setInterval(() => {
                    timeRemaining--;
                    document.getElementById('timer-display').innerText = `剩餘時間：${timeRemaining}秒`;
                    if (timeRemaining <= 0) {
                        clearInterval(timerInterval);
                        finishTyping(newArea, true); 
                    }
                }, 1000);
            }
        }

        textArray.forEach((char, index) => {
            const span = document.getElementById(`char-${index}`);
            if (span) span.className = ''; 
        });

        let correctCount = 0;
        typedArray.forEach((typedChar, index) => {
            if (index >= textArray.length) return;
            const span = document.getElementById(`char-${index}`);
            if (!span) return;
            if (typedChar === textArray[index]) { 
                span.classList.add('correct'); correctCount++; 
            } else { span.classList.add('incorrect'); }
        });

        if (typed.length < textArray.length) {
            const currentSpan = document.getElementById(`char-${typed.length}`);
            if (currentSpan) {
                currentSpan.classList.add('current-char');
                currentSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        if (startTime && typed.length > 0) {
            const timeMins = (new Date() - startTime) / 60000;
            currentWpm = Math.round((typed.length / 5) / timeMins);
            currentAcc = Math.round((correctCount / typed.length) * 100);
            document.getElementById('status-display').innerHTML = `速度：<span style="color:#007bff">${currentWpm > 0 ? currentWpm : 0} WPM</span> | 準確度：<span style="color:#28a745">${currentAcc}%</span> ${getEarlySubmitBtnHTML()}`;
        }

        if (typed.length === textArray.length) {
            clearInterval(timerInterval);
            finishTyping(newArea, false);
        }
    }

    newArea.addEventListener('compositionstart', () => { isComposing = true; }); 
    newArea.addEventListener('compositionend', () => { 
        isComposing = false; 
        handleTypingCheck(); 
    }); 
    
    newArea.addEventListener('input', () => {
        if (isComposing) return; 
        handleTypingCheck();
    });
}

function finishTyping(inputArea, isForcedEnd) {
    inputArea.disabled = true;
    
    const typed = inputArea.value;
    const typedArray = typed.split('');
    const textArray = currentText.split('');

    let correctCount = 0;
    typedArray.forEach((typedChar, index) => {
        if (index < textArray.length && typedChar === textArray[index]) {
            correctCount++; 
        }
    });

    const timeMins = startTime ? ((new Date() - startTime) / 60000) : 0;
    const finalWpm = timeMins > 0 ? Math.round((typed.length / 5) / timeMins) : 0;
    const finalAcc = textArray.length > 0 ? Math.round((correctCount / textArray.length) * 100) : 0;

    currentWpm = finalWpm;
    currentAcc = finalAcc;

    const msg = isForcedEnd ? "⏳ 測驗提前結束！" : "🎉 練習完成！";
    document.getElementById('status-display').innerHTML = `速度：<span style="color:#007bff">${finalWpm} WPM</span> | 嚴格結算準確率：<span style="color:#28a745">${finalAcc}%</span> <br>${msg} 正在處理成績...`;
    
    uploadScore(finalWpm, finalAcc);
}

// 🌟 暱稱上傳與審核防呆
async function uploadScore(wpm, accuracy) {
    const appendRestartBtn = () => {
        document.getElementById('status-display').innerHTML += ` <br><button onclick="restartExercise()" style="margin-top:10px; padding:6px 16px; background-color:#ffc107; color:#333; border:none; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow:0px 2px 4px rgba(0,0,0,0.2);">🔄 再挑戰一次</button>`;
    };

    if (currentUser.role === 'admin') {
        document.getElementById('status-display').innerHTML = document.getElementById('status-display').innerHTML.replace("正在處理成績...", "");
        document.getElementById('status-display').innerHTML += `ℹ️ 管理員測試，成績不上傳。`;
        appendRestartBtn();
        return;
    }

    if (accuracy < 95) {
        document.getElementById('status-display').innerHTML = document.getElementById('status-display').innerHTML.replace("正在處理成績...", "");
        document.getElementById('status-display').innerHTML += `<span style="color:#dc3545; font-weight:bold;">⚠️ 您的最終結算準確率為 ${accuracy}%。<br>💡 系統規定：為求公平，整體完成度與準確率需達 95% 以上方可進入龍虎榜紀錄！請繼續加油！</span>`;
        appendRestartBtn();
        return; 
    }

    let finalUsername = currentUser.name.replace('學生_', '');
    let isWaitingApprove = false;

    // 真正將資料寫入雲端的函式
    const doUpload = async () => {
        let insertData = { wpm: wpm || 0, accuracy: accuracy || 0, class: currentUser.class, username: finalUsername, exercise_title: currentExerciseTitle };
        try {
            const { error } = await supabaseClient.from('leaderboard').insert([insertData]);
            if (error) throw error;
            
            let currentHTML = document.getElementById('status-display').innerHTML.replace("正在處理成績...", "");
            
            if (isWaitingApprove) {
                currentHTML += `✅ 成績已記錄！<br><span style="color:#6f42c1; font-weight:bold;">⏳ 您的暱稱「${finalUsername.replace('UNFIRM_','')}」已送出，請耐心等待管理員確認後，即會顯示大名。</span>`;
            } else {
                currentHTML += `✅ 成績已成功記錄！`;
            }
            
            document.getElementById('status-display').innerHTML = currentHTML;

            if (!currentExerciseTitle.startsWith('自學：') && !currentExerciseTitle.startsWith('AI文章：')) {
                fetchLeaderboard(currentLbFilterType); 
            }
        } catch (err) { 
            let currentHTML = document.getElementById('status-display').innerHTML.replace("正在處理成績...", "");
            document.getElementById('status-display').innerHTML = currentHTML + `❌ 上傳失敗: ${err.message}`; 
        }
        appendRestartBtn();
    };

    // 🌟 若為訪客且達標，請求輸入暱稱
    if (currentUser.class === 'GUEST') {
        // 使用 setTimeout 讓瀏覽器有時間先印出前面的過關提示，再彈出輸入框
        setTimeout(() => {
            const nickname = prompt("🎉 恭喜完成挑戰！\n\n請輸入您的專屬暱稱：\n(耐心等待管理員確認後，即可在排行榜顯示大名)\n\n※ 若留空，則將以「訪客」身份上傳成績");
            if (nickname && nickname.trim() !== '') {
                finalUsername = 'UNFIRM_' + nickname.trim();
                isWaitingApprove = true;
            }
            doUpload();
        }, 100);
    } else {
        doUpload();
    }
}

// ==========================================
// 10. 智慧分級龍虎榜 + 管理員審核與刪除機制
// ==========================================
function injectLeaderboardFilters() {
    const lbSection = document.getElementById('leaderboard-section');
    const title = document.getElementById('leaderboard-title');
    if (!lbSection || !title) return;
    
    if (!document.getElementById('lb-filters')) {
        const filtersDiv = document.createElement('div');
        filtersDiv.id = 'lb-filters';
        filtersDiv.style.marginBottom = '15px';
        
        filtersDiv.innerHTML = `
            <div style="margin-bottom: 8px;">
                <button onclick="setLbFilterType('ALL')" style="margin-right:5px; background-color:#6c757d;">🏆 打字龍虎榜</button>
                <button onclick="setLbFilterType('GRADE')" style="margin-right:5px; background-color:#17a2b8;">👥 同年級排行</button>
                <button onclick="setLbFilterType('CLASS')" style="margin-right:5px; background-color:#28a745;">📖 本班排行</button>
                <button onclick="fetchPersonalHistory()" style="background-color:#6f42c1; color:white;">📜 個人歷程</button>
            </div>
            <div>
                <label style="font-size:14px; font-weight:bold; color:#555;">🔍 篩選考題：</label>
                <select id="lb-exercise-select" onchange="onLbExerciseChange()" style="padding: 4px; font-size: 14px;">
                    <option value="ALL">所有指定任務 (排除個人自學)</option>
                </select>
            </div>
        `;
        lbSection.insertBefore(filtersDiv, title.nextSibling); 
    }
}

async function loadLeaderboardExerciseDropdown() {
    const select = document.getElementById('lb-exercise-select');
    if (!select) return;
    try {
        const { data, error } = await supabaseClient.from('exercises').select('title');
        if (error) throw error;
        
        select.innerHTML = '<option value="ALL">所有指定任務 (排除個人自學)</option>';
        const uniqueTitles = [];
        data.forEach(ex => {
            if (ex.title && !uniqueTitles.includes(ex.title)) uniqueTitles.push(ex.title);
        });
        uniqueTitles.forEach(title => {
            const option = document.createElement('option');
            option.value = title; option.innerText = title;
            select.appendChild(option);
        });
    } catch (err) { console.error(err); }
}

function setLbFilterType(type) {
    currentLbFilterType = type;
    fetchLeaderboard(type);
}

function onLbExerciseChange() {
    fetchLeaderboard(currentLbFilterType);
}

// 🌟 全局註冊：管理員核准暱稱功能
window.approveNickname = async function(id, rawUsername) {
    if (!confirm("確定要批准這個暱稱顯示在排行榜上嗎？")) return;
    const newName = rawUsername.replace('UNFIRM_', '');
    try {
        const { error } = await supabaseClient.from('leaderboard').update({ username: newName }).eq('id', id);
        if (error) throw error;
        alert("✅ 暱稱批准成功！");
        fetchLeaderboard(currentLbFilterType);
    } catch (err) {
        alert("❌ 批准失敗：" + err.message);
    }
};

async function fetchLeaderboard(filterType = 'ALL') {
    currentLbFilterType = filterType;
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = `<li style="justify-content:center; color:#007bff;">📊 正在讀取最新排名...</li>`;

    const exFilter = document.getElementById('lb-exercise-select')?.value || 'ALL';

    try {
        const { data, error } = await supabaseClient.rpc('get_smart_leaderboard', {
            p_role: currentUser.role, 
            p_user_class: currentUser.class, 
            p_filter_type: filterType, 
            p_admin_target: '',
            p_exercise_filter: exFilter 
        });

        if (error) throw error;
        list.innerHTML = '';
        if (!data || data.length === 0) return list.innerHTML = `<li style="justify-content:center; color:#999;">該考題目前尚無成績紀錄</li>`;

        data.forEach((row, index) => {
            let rankMedal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
            const li = document.createElement('li');
            li.style.cssText = "display:flex; justify-content:space-between; width:100%; align-items:center; padding:8px 0; border-bottom:1px dashed #ccc;";
            
            // 🌟 智慧判斷顯示邏輯與按鈕
            let displayUsername = row.username;
            let actionBtns = '';

            if (row.username.startsWith('UNFIRM_')) {
                if (currentUser.role === 'admin') {
                    displayUsername = `🔒 <span style="text-decoration:line-through; color:#999;">訪客</span> ➡️ <span style="font-weight:bold; color:#6f42c1;">${row.username.replace('UNFIRM_', '')}</span>`;
                    if (row.id) {
                        actionBtns += `<button onclick="approveNickname('${row.id}', '${row.username}')" style="background-color:#28a745; color:white; padding:3px 8px; font-size:12px; margin-left:10px; border:none; border-radius:4px; cursor:pointer;">✅ 批准</button>`;
                    }
                } else {
                    displayUsername = `👻 訪客`;
                }
            }

            if (currentUser.role === 'admin' && row.id) {
                actionBtns += `<button onclick="deleteLeaderboardRecord('${row.id}')" style="background-color:#dc3545; color:white; padding:3px 8px; font-size:12px; margin-left:5px; border:none; border-radius:4px; cursor:pointer;">🗑️ 刪除</button>`;
            }

            li.innerHTML = `
                <span style="font-weight:bold; font-size:16px; flex-grow:1;">
                    ${rankMedal}${displayUsername} 
                    <span style="font-size:12px; background:#17a2b8; color:white; padding:2px 6px; border-radius:10px;">${row.class}</span>
                    <span style="font-size:12px; background:#6c757d; color:white; padding:2px 6px; border-radius:10px; margin-left:5px;">${row.exercise_title}</span>
                </span>
                <span style="font-weight:bold; color:#28a745;">
                    ${row.wpm} WPM / ${Math.round(row.accuracy)}%
                    ${actionBtns}
                </span>
            `;
            list.appendChild(li); 
        });
    } catch (err) { 
        list.innerHTML = `<li style="justify-content:center; color:#dc3545;">❌ 載入失敗: ${err.message}</li>`; 
        console.error("Leaderboard Error:", err);
    }
}

async function deleteLeaderboardRecord(id) {
    if (!confirm("⚠️ 確定要刪除這筆學生的龍虎榜成績紀錄嗎？此操作無法還原。")) return;
    try {
        const { error } = await supabaseClient.from('leaderboard').delete().eq('id', id);
        if (error) throw error;
        alert("🎉 成績紀錄已成功刪除！");
        fetchLeaderboard(currentLbFilterType); 
    } catch (err) {
        alert("❌ 刪除失敗：" + err.message);
    }
}

async function fetchPersonalHistory() {
    const list = document.getElementById('leaderboard-list');
    
    // 🌟 訪客不提供個人歷程
    if (currentUser.class === 'GUEST') {
        list.innerHTML = `<li style="justify-content:center; color:#dc3545;">ℹ️ 訪客模式不提供專屬個人歷程，如需記錄請使用正式帳號登入。</li>`;
        return;
    }
    
    list.innerHTML = `<li style="justify-content:center; color:#6f42c1;">📜 正在讀取您的個人打字歷程...</li>`;
    const myName = currentUser.name.replace('學生_', '');
    
    if (currentUser.role === 'admin') {
        list.innerHTML = `<li style="justify-content:center; color:#dc3545;">ℹ️ 管理員帳號沒有個人歷程記錄。</li>`;
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('leaderboard')
            .select('*')
            .eq('username', myName)
            .order('created_at', { ascending: false });

        if (error) throw error;
        list.innerHTML = '';
        if (!data || data.length === 0) {
            list.innerHTML = `<li style="justify-content:center; color:#999;">您目前尚無任何練習記錄</li>`;
            return;
        }

        const headLi = document.createElement('li');
        headLi.style.cssText = "display:flex; justify-content:space-between; width:100%; font-weight:bold; color:#6f42c1; border-bottom:2px solid #6f42c1; padding-bottom:5px; margin-bottom:5px; font-size:14px;";
        headLi.innerHTML = `<span>📅 測試時間 / 題目名稱</span><span>速度與準確度</span>`;
        list.appendChild(headLi);

        data.forEach((row) => {
            const dateStr = new Date(row.created_at).toLocaleDateString('zh-TW', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
            const li = document.createElement('li');
            li.style.cssText = "display:flex; justify-content:space-between; width:100%; align-items:center; padding:8px 0; border-bottom:1px dashed #ccc;";
            li.innerHTML = `
                <span style="font-size:15px; flex-grow:1; color:#333;">
                    <small style="color:#888; margin-right:5px; font-family:monospace;">[${dateStr}]</small> 
                    <strong>${row.exercise_title}</strong>
                </span>
                <span style="font-weight:bold; color:#6f42c1;">${row.wpm} WPM / ${Math.round(row.accuracy)}%</span>
            `;
            list.appendChild(li); 
        });
    } catch (err) { 
        list.innerHTML = `<li style="justify-content:center; color:#dc3545;">❌ 載入歷程失敗: ${err.message}</li>`; 
        console.error("History Error:", err);
    }
}
