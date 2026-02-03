const storageKey = "mfl_profiles_v1";
const currentUserKey = "mfl_current_user_v1";
const app = document.getElementById("app");
const view = document.getElementById("view");
const status = document.getElementById("status");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

const dayKey = () => new Date().toISOString().slice(0, 10);

const defaultTopicState = () => ({
  correct: 0,
  wrong: 0,
  wrongStreak: 0,
  lastSeen: null,
});

const defaultProfile = (name) => ({
  name,
  createdAt: Date.now(),
  version: 1,
  stats: {
    totalAnswered: 0,
    totalCorrect: 0,
    streak: 0,
    bestStreak: 0,
    totalTimeMs: 0,
    avgTimeMs: 0,
  },
  topics: {},
  topicMistakes: {},
  reviewQueue: [],
  daily: {
    date: null,
    index: 0,
    correct: 0,
  },
  badges: [],
});

const topics = [
  {
    id: "big-multiply",
    label: "大九九",
    generator: () => {
      const a = randInt(11, 19);
      const b = randInt(11, 19);
      return questionCalc(`${a} × ${b} = ?`, a * b, "fill", "big-multiply", ["big-multiply", "multiplication"]);
    },
    identify: () => trueFalseIdentify("big-multiply"),
  },
  {
    id: "number-sense",
    label: "常用数感",
    generator: () => {
      const patterns = [
        { a: 25, b: 4 },
        { a: 125, b: 8 },
        { a: 50, b: 2 },
        { a: 75, b: 4 },
        { a: 20, b: 5 },
        { a: 12.5, b: 8 },
        { a: 0.25, b: 4 },
        { a: 2.5, b: 40 },
        { a: 4, b: 25 },
      ];
      const p = patterns[randInt(0, patterns.length - 1)];
      return questionCalc(`${p.a} × ${p.b} = ?`, p.a * p.b, "fill", "number-sense", ["number-sense", "place-value"]);
    },
    identify: () => trueFalseIdentify("number-sense"),
  },
  {
    id: "decimal-shift",
    label: "小数点移动",
    generator: () => {
      const base = [0.1, 0.01, 0.001][randInt(0, 2)];
      const factor = [10, 100, 1000][randInt(0, 2)];
      const op = Math.random() > 0.5 ? "×" : "÷";
      const answer = op === "×" ? base * factor : base / factor;
      return questionCalc(`${base} ${op} ${factor} = ?`, answer, "fill", "decimal-shift", ["decimal-shift", "place-value"]);
    },
    identify: () => trueFalseIdentify("decimal-shift"),
  },
  {
    id: "fraction-decimal",
    label: "分数小数互换",
    generator: () => {
      const pairs = [
        { frac: "1/2", dec: 0.5 },
        { frac: "1/4", dec: 0.25 },
        { frac: "3/4", dec: 0.75 },
        { frac: "1/5", dec: 0.2 },
        { frac: "2/5", dec: 0.4 },
        { frac: "3/5", dec: 0.6 },
        { frac: "4/5", dec: 0.8 },
        { frac: "1/8", dec: 0.125 },
        { frac: "3/8", dec: 0.375 },
        { frac: "5/8", dec: 0.625 },
        { frac: "7/8", dec: 0.875 },
      ];
      const p = pairs[randInt(0, pairs.length - 1)];
      if (Math.random() > 0.5) {
        return questionCalc(`${p.frac} = ? (小数)`, p.dec, "fill", "fraction-decimal", ["fraction-decimal", "conversion"]);
      }
      return questionCalc(`${p.dec} = ? (分数)`, p.frac, "fill", "fraction-decimal", ["fraction-decimal", "conversion"]);
    },
    match: () => matchQuestion("fraction-decimal"),
    identify: () => trueFalseIdentify("fraction-decimal"),
  },
  {
    id: "unit-convert",
    label: "单位换算",
    generator: () => {
      const items = [
        { q: "300 厘米 = ? 米", a: "3" },
        { q: "2.5 米 = ? 厘米", a: "250" },
        { q: "750 毫升 = ? 升", a: "0.75" },
        { q: "1.2 升 = ? 毫升", a: "1200" },
        { q: "1.5 千克 = ? 克", a: "1500" },
        { q: "900 克 = ? 千克", a: "0.9" },
        { q: "3 元 5 角 = ? 元", a: "3.5" },
        { q: "4.2 元 = ? 角", a: "42" },
        { q: "1 分米 = ? 厘米", a: "10" },
        { q: "2.3 米 = ? 分米", a: "23" },
        { q: "0.8 升 = ? 毫升", a: "800" },
        { q: "250 毫升 = ? 升", a: "0.25" },
      ];
      const item = items[randInt(0, items.length - 1)];
      return questionCalc(item.q, item.a, "fill", "unit-convert", ["unit-convert", "unit"]);
    },
    identify: () => trueFalseIdentify("unit-convert"),
  },
  {
    id: "powers-of-ten",
    label: "数零训练",
    generator: () => {
      const base = [10, 100, 1000][randInt(0, 2)];
      const factor = [10, 100][randInt(0, 1)];
      const op = Math.random() > 0.5 ? "×" : "÷";
      const answer = op === "×" ? base * factor : base / factor;
      return questionCalc(`${base} ${op} ${factor} = ?`, answer, "fill", "powers-of-ten", ["powers-of-ten", "place-value"]);
    },
    identify: () => trueFalseIdentify("powers-of-ten"),
  },
];

let state = loadProfiles();
let currentUser = state.currentUser;
let session = {
  mode: "practice",
  currentQuestion: null,
  waitingNext: false,
  questionStart: null,
  matchState: null,
  viewMode: "practice",
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function questionCalc(prompt, answer, type, topicId, tags = []) {
  return {
    id: `q_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    topicId,
    type,
    prompt,
    answer: String(answer),
    tags,
  };
}

function matchQuestion(topicId) {
  const pairs = [
    { left: "1/2", right: "0.5" },
    { left: "1/4", right: "0.25" },
    { left: "3/4", right: "0.75" },
    { left: "1/5", right: "0.2" },
    { left: "2/5", right: "0.4" },
    { left: "3/5", right: "0.6" },
    { left: "4/5", right: "0.8" },
    { left: "1/8", right: "0.125" },
  ];
  const sample = shuffle(pairs).slice(0, 3);
  const left = sample.map((p) => p.left);
  const right = shuffle(sample.map((p) => p.right));
  return {
    id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    topicId,
    type: "match",
    prompt: "把分数和小数配对",
    pairs: sample,
    left,
    right,
    tags: ["fraction-decimal", "conversion"],
  };
}

function trueFalseIdentify(topicId) {
  const sample = topics.find((t) => t.id === topicId).generator();
  const isTrue = Math.random() > 0.5;
  const statement = isTrue
    ? sample.prompt.replace("= ?", `= ${sample.answer}`)
    : sample.prompt.replace("= ?", `= ${Number(sample.answer) + randInt(1, 6)}`);
  return {
    id: `id_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    topicId,
    type: "choice",
    prompt: `判断正误: ${statement}`,
    answer: isTrue ? "对" : "错",
    choices: ["对", "错"],
  };
}

function ensureMistakeBucket(profile, topicId) {
  if (!profile.topicMistakes[topicId]) {
    profile.topicMistakes[topicId] = {};
  }
  return profile.topicMistakes[topicId];
}

function recordMistake(profile, question) {
  const bucket = ensureMistakeBucket(profile, question.topicId);
  question.tags.forEach((tag) => {
    bucket[tag] = (bucket[tag] || 0) + 1;
  });
}

function loadProfiles() {
  const stored = localStorage.getItem(storageKey);
  const profiles = stored ? JSON.parse(stored) : {};
  const currentUser = localStorage.getItem(currentUserKey);
  return { profiles, currentUser };
}

function saveProfiles() {
  localStorage.setItem(storageKey, JSON.stringify(state.profiles));
  if (currentUser) {
    localStorage.setItem(currentUserKey, currentUser);
  }
}

function getProfile() {
  return currentUser ? state.profiles[currentUser] : null;
}

function ensureTopic(profile, topicId) {
  if (!profile.topics[topicId]) {
    profile.topics[topicId] = defaultTopicState();
  }
  return profile.topics[topicId];
}

function setStatus(text) {
  status.textContent = text || "";
}

function render() {
  if (!currentUser) {
    renderLogin();
    return;
  }
  const profile = getProfile();
  if (!profile) {
    currentUser = null;
    saveProfiles();
    renderLogin();
    return;
  }
  if (session.viewMode === "knowledge") {
    renderKnowledge(profile);
    return;
  }
  if (!session.currentQuestion) {
    session.currentQuestion = nextQuestion();
  }
  renderPractice(profile, session.currentQuestion);
}

function renderLogin() {
  view.innerHTML = `
    <div class="card grid">
      <div>
        <div class="badge">开始你的训练</div>
        <h2>输入唯一用户名</h2>
        <p class="notice">我们只在本地保存进度，随时可导出或删除。</p>
      </div>
      <div class="input-row">
        <input id="nameInput" type="text" placeholder="例如: 甜甜" />
        <button id="enterBtn">进入</button>
      </div>
      <div class="notice">已有用户: ${Object.keys(state.profiles).join("、") || "暂无"}</div>
    </div>
  `;
  document.getElementById("enterBtn").onclick = () => {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) return alert("请输入用户名");
    if (!state.profiles[name]) {
      state.profiles[name] = defaultProfile(name);
    }
    currentUser = name;
    saveProfiles();
    render();
  };
  setStatus("");
}

function renderPractice(profile, question) {
  const topic = topics.find((t) => t.id === question.topicId);
  const total = profile.stats.totalAnswered;
  const accuracy = total ? Math.round((profile.stats.totalCorrect / total) * 100) : 0;
  const avgTime = profile.stats.avgTimeMs ? `${profile.stats.avgTimeMs}ms` : "--";
  const topicSummary = topics
    .map((t) => {
      const st = ensureTopic(profile, t.id);
      const totalTopic = st.correct + st.wrong;
      const acc = totalTopic ? Math.round((st.correct / totalTopic) * 100) : 0;
      return `<div class="panel">${t.label}: ${acc}%</div>`;
    })
    .join("");

  view.innerHTML = `
    <div class="grid" style="gap: 20px;">
      <div class="card">
        <div class="progress-row">
          <div class="panel">用户: ${profile.name}</div>
          <div class="panel">准确率: ${accuracy}%</div>
          <div class="panel">连对: ${profile.stats.streak}</div>
          <div class="panel">最佳连对: ${profile.stats.bestStreak}</div>
          <div class="panel">平均用时: ${avgTime}</div>
          <div class="panel">模式: ${session.mode === "daily" ? "每日挑战" : "自由练习"}</div>
        </div>
      </div>

      <div class="card">
        <div class="badge">学习进度卡片</div>
        <div class="progress-row">${topicSummary}</div>
      </div>

      <div class="card">
        <div class="badge">${topic ? topic.label : "练习"}</div>
        <div class="question">${question.prompt}</div>
        <div id="answerArea"></div>
        <div id="feedback" class="notice" style="margin-top: 10px;"></div>
      </div>

      <div class="card grid grid-2">
        <button id="practiceBtn">自由练习</button>
        <button class="secondary" id="dailyBtn">每日挑战</button>
        <button class="ghost" id="knowledgeBtn">知识点复习</button>
        <button class="ghost" id="resetUserBtn">删除当前用户</button>
      </div>
    </div>
  `;

  const answerArea = document.getElementById("answerArea");
  session.questionStart = Date.now();
  if (question.type === "choice") {
    answerArea.innerHTML = `
      <div class="choice-list">
        ${question.choices
          .map((c) => `<div class="choice" data-choice="${c}">${c}</div>`)
          .join("")}
      </div>
    `;
    document.querySelectorAll(".choice").forEach((node) => {
      node.onclick = () => handleAnswer(node.dataset.choice);
    });
  } else if (question.type === "match") {
    session.matchState = { selectedLeft: null, pairs: {} };
    answerArea.innerHTML = `
      <div class="match-grid">
        <div class="match-col">
          ${question.left.map((item) => `<div class="match-item" data-side="left" data-value="${item}">${item}</div>`).join("")}
        </div>
        <div class="match-col">
          ${question.right.map((item) => `<div class="match-item" data-side="right" data-value="${item}">${item}</div>`).join("")}
        </div>
      </div>
      <div class="input-row" style="margin-top: 12px;">
        <button id="matchSubmit">提交配对</button>
      </div>
    `;
    document.querySelectorAll(".match-item").forEach((node) => {
      node.onclick = () => handleMatchSelect(node.dataset.side, node.dataset.value);
    });
    document.getElementById("matchSubmit").onclick = () => handleMatchSubmit(question);
  } else {
    answerArea.innerHTML = `
      <div class="input-row">
        <input id="answerInput" type="text" placeholder="请输入答案" />
        <button id="submitBtn">提交</button>
      </div>
    `;
    document.getElementById("submitBtn").onclick = () => {
      const val = document.getElementById("answerInput").value.trim();
      handleAnswer(val);
    };
  }

  document.getElementById("practiceBtn").onclick = () => {
    session.viewMode = "practice";
    session.mode = "practice";
    session.currentQuestion = nextQuestion();
    render();
  };
  document.getElementById("dailyBtn").onclick = () => {
    session.viewMode = "practice";
    session.mode = "daily";
    session.currentQuestion = nextQuestion();
    render();
  };
  document.getElementById("knowledgeBtn").onclick = () => {
    session.viewMode = "knowledge";
    render();
  };
  document.getElementById("resetUserBtn").onclick = () => {
    if (confirm("确定删除当前用户和本地进度吗？")) {
      delete state.profiles[profile.name];
      currentUser = null;
      saveProfiles();
      render();
    }
  };

  setStatus(`进度本地保存 | 题目数 ${total}`);
}

function renderKnowledge(profile) {
  const masteryClass = (topicId) => {
    const st = ensureTopic(profile, topicId);
    const total = st.correct + st.wrong;
    if (!total) return "mastery-unknown";
    const acc = Math.round((st.correct / total) * 100);
    if (acc >= 85) return "mastery-strong";
    if (acc >= 65) return "mastery-mid";
    return "mastery-weak";
  };
  const items = [
    {
      title: "大九九",
      topicId: "big-multiply",
      points: [
        "11×11=121，12×12=144，13×13=169",
        "14×14=196，15×15=225",
        "16×16=256，17×17=289，18×18=324，19×19=361",
      ],
    },
    {
      title: "常用数感",
      topicId: "number-sense",
      points: [
        "25×4=100，75×4=300",
        "125×8=1000，12.5×8=100",
        "2.5×40=100，4×25=100",
      ],
    },
    {
      title: "小数点移动",
      topicId: "decimal-shift",
      points: [
        "0.1 = 十分之一，0.01 = 百分之一，0.001 = 千分之一",
        "0.几 就是 十分之几，比如 0.3 = 3/10",
        "0.0几 就是 百分之几，比如 0.07 = 7/100",
        "×10 小数点向右移一位",
        "×100 小数点向右移两位",
        "÷10 小数点向左移一位",
      ],
    },
    {
      title: "分数小数互换",
      topicId: "fraction-decimal",
      points: [
        "1/2=0.5，1/4=0.25，3/4=0.75",
        "1/5=0.2，2/5=0.4，3/5=0.6，4/5=0.8",
        "1/8=0.125，3/8=0.375，5/8=0.625，7/8=0.875",
      ],
    },
    {
      title: "单位换算",
      topicId: "unit-convert",
      points: [
        "1 米=10 分米=100 厘米",
        "1 升=1000 毫升",
        "1 千克=1000 克",
        "1 元=10 角=100 分",
      ],
    },
    {
      title: "数零训练",
      topicId: "powers-of-ten",
      points: [
        "10×10=100，100×10=1000",
        "1000÷10=100，100÷10=10",
        "先数零位数，再判断小数点位置",
      ],
    },
  ];

  view.innerHTML = `
    <div class="grid" style="gap: 20px;">
      <div class="card">
        <div class="badge">知识点复习</div>
        <h2>集中复习卡片</h2>
        <p class="notice">适合集中记忆与快速回顾，按模块梳理。</p>
      </div>
      <div class="knowledge-grid">
        ${items
          .map(
            (item) => `
          <div class="card knowledge-card">
            <div class="badge ${masteryClass(item.topicId)}">${item.title}</div>
            <ul class="knowledge-list">
              ${item.points.map((p) => `<li>${p}</li>`).join("")}
            </ul>
          </div>
        `
          )
          .join("")}
      </div>
      <div class="card">
        <button id="backToPractice">返回练习</button>
      </div>
    </div>
  `;
  document.getElementById("backToPractice").onclick = () => {
    session.viewMode = "practice";
    render();
  };
  setStatus(`知识点复习 | 用户 ${profile.name}`);
}

function handleAnswer(raw) {
  const profile = getProfile();
  if (!profile || !session.currentQuestion) return;

  const question = session.currentQuestion;
  const topicState = ensureTopic(profile, question.topicId);
  const answer = normalizeAnswer(raw);
  const correct = normalizeAnswer(question.answer) === answer;
  const elapsed = session.questionStart ? Date.now() - session.questionStart : 0;

  profile.stats.totalAnswered += 1;
  profile.stats.totalTimeMs += elapsed;
  profile.stats.avgTimeMs = Math.round(
    profile.stats.totalTimeMs / profile.stats.totalAnswered
  );
  if (correct) {
    profile.stats.totalCorrect += 1;
    profile.stats.streak += 1;
    profile.stats.bestStreak = Math.max(profile.stats.bestStreak, profile.stats.streak);
    topicState.correct += 1;
    topicState.wrongStreak = 0;
  } else {
    profile.stats.streak = 0;
    topicState.wrong += 1;
    topicState.wrongStreak += 1;
    recordMistake(profile, question);
    profile.reviewQueue.push({
      question,
      dueIn: 3,
    });
  }

  topicState.lastSeen = Date.now();
  awardBadges(profile);
  saveProfiles();

  showFeedback(correct, question.answer);
}

function handleMatchSelect(side, value) {
  if (!session.matchState) return;
  if (side === "left") {
    session.matchState.selectedLeft = value;
    highlightMatch();
    return;
  }
  if (side === "right" && session.matchState.selectedLeft) {
    session.matchState.pairs[session.matchState.selectedLeft] = value;
    session.matchState.selectedLeft = null;
    highlightMatch();
  }
}

function highlightMatch() {
  document.querySelectorAll(".match-item").forEach((node) => {
    const side = node.dataset.side;
    const value = node.dataset.value;
    const isSelected = side === "left" && session.matchState?.selectedLeft === value;
    const paired = Object.values(session.matchState?.pairs || {}).includes(value);
    node.classList.toggle("active", isSelected);
    node.classList.toggle("paired", paired);
  });
}

function handleMatchSubmit(question) {
  const profile = getProfile();
  if (!profile) return;
  const mapping = session.matchState?.pairs || {};
  const allMatched = question.left.every((left) => mapping[left]);
  if (!allMatched) {
    alert("请先完成所有配对");
    return;
  }
  const correct = question.pairs.every((p) => mapping[p.left] === p.right);
  const elapsed = session.questionStart ? Date.now() - session.questionStart : 0;
  const topicState = ensureTopic(profile, question.topicId);

  profile.stats.totalAnswered += 1;
  profile.stats.totalTimeMs += elapsed;
  profile.stats.avgTimeMs = Math.round(
    profile.stats.totalTimeMs / profile.stats.totalAnswered
  );
  if (correct) {
    profile.stats.totalCorrect += 1;
    profile.stats.streak += 1;
    profile.stats.bestStreak = Math.max(profile.stats.bestStreak, profile.stats.streak);
    topicState.correct += 1;
    topicState.wrongStreak = 0;
  } else {
    profile.stats.streak = 0;
    topicState.wrong += 1;
    topicState.wrongStreak += 1;
    recordMistake(profile, question);
    profile.reviewQueue.push({ question, dueIn: 3 });
  }
  topicState.lastSeen = Date.now();
  awardBadges(profile);
  saveProfiles();
  showFeedback(correct, "请核对配对关系");
}

function showFeedback(correct, answer) {
  const feedback = document.getElementById("feedback");
  feedback.textContent = correct ? "答对啦！继续保持。" : `答错了，正确答案是 ${answer}`;
  feedback.style.color = correct ? "var(--good)" : "var(--bad)";

  session.currentQuestion = nextQuestion();
  setTimeout(render, 600);
}

function normalizeAnswer(val) {
  return String(val).trim().replace(/\s+/g, "").toLowerCase();
}

function nextQuestion() {
  const profile = getProfile();
  if (!profile) return topics[0].generator();

  if (session.mode === "daily") {
    return nextDailyQuestion(profile);
  }

  profile.reviewQueue.forEach((item) => (item.dueIn -= 1));
  const dueIndex = profile.reviewQueue.findIndex((item) => item.dueIn <= 0);
  if (dueIndex >= 0) {
    const [item] = profile.reviewQueue.splice(dueIndex, 1);
    return item.question;
  }

  const forcedTopic = topics.find((t) => {
    const st = ensureTopic(profile, t.id);
    return st.wrongStreak >= 2;
  });
  if (forcedTopic) {
    ensureTopic(profile, forcedTopic.id).wrongStreak = 0;
    return forcedTopic.identify();
  }

  if (Math.random() > 0.82) {
    const matchTopic = topics.find((t) => t.id === "fraction-decimal");
    return matchTopic.match();
  }

  const weights = topics.map((t) => {
    const st = ensureTopic(profile, t.id);
    const mistakes = ensureMistakeBucket(profile, t.id);
    const mistakeScore = Object.values(mistakes).reduce((sum, v) => sum + v, 0);
    const speedPenalty = profile.stats.avgTimeMs > 5000 ? 0.8 : 0.2;
    return 1 + st.wrong * 1.5 + mistakeScore * 0.4 + speedPenalty;
  });
  const pick = weightedPick(topics, weights);
  return pick.generator();
}

function nextDailyQuestion(profile) {
  const today = dayKey();
  if (profile.daily.date !== today) {
    profile.daily.date = today;
    profile.daily.index = 0;
    profile.daily.correct = 0;
  }
  const seed = Number(today.replace(/-/g, "")) + 7;
  const random = mulberry32(seed);
  const dailyTopics = topics.slice();
  const index = profile.daily.index % dailyTopics.length;
  const topic = dailyTopics[index];
  profile.daily.index += 1;
  saveProfiles();
  if (random() > 0.7) {
    return topic.identify();
  }
  return topic.generator();
}

function weightedPick(items, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[0];
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function awardBadges(profile) {
  const badges = profile.badges;
  if (profile.stats.bestStreak >= 5 && !badges.includes("连对5")) {
    badges.push("连对5");
  }
  if (profile.stats.bestStreak >= 10 && !badges.includes("连对10")) {
    badges.push("连对10");
  }
}

exportBtn.onclick = () => {
  if (!currentUser) return alert("暂无用户");
  const data = state.profiles[currentUser];
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `math-fluency-${currentUser}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

importInput.onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.name || !data.stats || !data.topics) throw new Error("无效数据");
      if (state.profiles[data.name] && !confirm("已有同名用户，是否覆盖？")) {
        return;
      }
      state.profiles[data.name] = data;
      currentUser = data.name;
      saveProfiles();
      render();
    } catch (err) {
      alert("导入失败，请确认文件格式。");
    }
  };
  reader.readAsText(file);
};

render();
