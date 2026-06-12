const DATA_PATH = "data/lp_avaliacoes_escrita.json";
const SYSTEM_LEVELS = ["PS", "SSVC", "SCVC", "SA", "A"];
const RUBRIC_LEVELS = ["PS", "SSVC", "SCVC", "SA", "Nível 01", "Nível 02", "Nível 03", "Nível 04"];
const READING_LEVELS = ["Sem preenchimento", "Não respondeu", "Inadequada", "Adequada"];
const LEVEL_COLORS = {
  PS: "#c43d3d",
  SSVC: "#d9851f",
  SCVC: "#d4ad26",
  SA: "#1f9a7a",
  A: "#1f6feb",
  "Nível 01": "#a5d6a7",
  "Nível 02": "#66bb6a",
  "Nível 03": "#43a047",
  "Nível 04": "#2e7d32",
  "Adequada": "#76d650",
  "Inadequada": "#ffda55",
  "Não respondeu": "#ef7f84",
  "Sem preenchimento": "#ffffff",
};
const EVALUATIONS = {
  se1: {
    id: "se1",
    label: "Sistema de escrita",
    title: "Sistema de Escrita",
    domain: "Escrita",
    year: "1",
    levels: SYSTEM_LEVELS,
    questions: ["Sistema de escrita"],
    targetLevel: "A",
    targetLabel: "Alfabéticos",
    targetTooltip: "alunos na hipótese A",
  },
  esc2: {
    id: "esc2",
    label: "Escrita",
    domain: "Escrita",
    year: "2",
    levels: RUBRIC_LEVELS,
    questions: ["Escrita"],
    targetLevel: "Nível 04",
    targetLabel: "Nível 04",
    targetTooltip: "alunos classificados no Nível 04",
  },
  pt3: {
    id: "pt3",
    label: "Produção de Texto",
    domain: "Escrita",
    year: "3",
    levels: RUBRIC_LEVELS,
    questions: ["Produção de Texto"],
    targetLevel: "Nível 04",
    targetLabel: "Nível 04",
    targetTooltip: "alunos classificados no Nível 04",
  },
  lei1: {
    id: "lei1",
    label: "Leitura - 1º ano",
    domain: "Leitura",
    year: "1",
    levels: READING_LEVELS,
    questions: ["Localização"],
    targetLevel: "Adequada",
    targetLabel: "Adequadas",
    targetTooltip: "respostas adequadas",
    countBlankAsLevel: true,
  },
  lei2: {
    id: "lei2",
    label: "Leitura - 2º ano",
    domain: "Leitura",
    year: "2",
    levels: READING_LEVELS,
    questions: ["Localização", "Inferência"],
    targetLevel: "Adequada",
    targetLabel: "Adequadas",
    targetTooltip: "respostas adequadas",
    countBlankAsLevel: true,
  },
  lei3: {
    id: "lei3",
    label: "Leitura - 3º ano",
    domain: "Leitura",
    year: "3",
    levels: READING_LEVELS,
    questions: ["Localização", "Inferência", "Apreciação e Réplica"],
    targetLevel: "Adequada",
    targetLabel: "Adequadas",
    targetTooltip: "respostas adequadas",
    countBlankAsLevel: true,
  },
};
const STATUS_COLORS = {
  "Alta evolução": "#1a8f5a",
  "Evolução média": "#1f6feb",
  "Estável": "#b36b00",
  "Baixa": "#c43d3d",
};
const COMPACT_SCHEMA = {
  evaluation: 0,
  dre: 1,
  schoolCode: 2,
  school: 3,
  className: 4,
  studentId: 5,
  studentName: 6,
  response: 7,
  ano: 8,
  bimestre: 9,
};
const COMPACT_SCHEMA_WITH_QUESTION = {
  evaluation: 0,
  question: 1,
  dre: 2,
  schoolCode: 3,
  school: 4,
  className: 5,
  studentId: 6,
  studentName: 7,
  response: 8,
  ano: 9,
  bimestre: 10,
};

const state = {
  rawRows: [],
  records: [],
  schools: [],
  dres: [],
  anos: [],
  selectedEvaluation: "se1",
  selectedQuestion: "__all__",
  selectedDre: "__all__",
  selectedSchool: "__all__",
  selectedAno: "1",
  scatterXLevel: "PS",
  scatterYLevel: "A",
  dreRankingSortBy: "avgGain",
  dreRankingSortDir: "desc",
  rankingSortBy: "avgGain",
  rankingSortDir: "desc",
  classesSortBy: "school",
  classesSortDir: "asc",
  studentSortBy: "gain",
  studentSortDir: "asc",
  classroomTabs: [],
  activeClassroomTabId: null,
  viewMode: "evolucao",
  consolidadoDrePeriod: "final",
  consolidadoSchoolPeriod: "final",
  consolidadoSchoolSortBy: "A",
  consolidadoSchoolSortDir: "desc",
  consolidadoChartPeriod: "final",
  consolidadoDonutPeriod: "final",
};

const formatPct = (value) => `${Math.round(value * 100)}%`;
const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(value);
const formatDecimal = (value) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const unformatLabel = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char]));

function getEvaluationConfig() {
  return EVALUATIONS[state.selectedEvaluation] || EVALUATIONS.se1;
}

function isReadingEvaluation() {
  return getEvaluationConfig().domain === "Leitura";
}

function getRecordNoun() {
  return isReadingEvaluation() ? "respostas" : "alunos";
}

function getRecordNounTitle() {
  return isReadingEvaluation() ? "Respostas" : "Alunos";
}

function getQuestions() {
  return getEvaluationConfig().questions || [getEvaluationConfig().label];
}

function getLevels() {
  return getEvaluationConfig().levels;
}

function getVisualLevels() {
  return [...getLevels()].reverse();
}

function getLevelScore() {
  return Object.fromEntries(getLevels().map((level, index) => [level, index + 1]));
}

function getTargetLevel() {
  return getEvaluationConfig().targetLevel;
}

function getTargetLabel() {
  return getEvaluationConfig().targetLabel;
}

function getEvaluationYear() {
  return getEvaluationConfig().year;
}

function getCategoryLabel() {
  if (isReadingEvaluation()) return "Resultado";
  return state.selectedEvaluation === "se1" ? "Hipótese" : "Categoria";
}

function parseJsonRows(text) {
  const payload = JSON.parse(text);
  return payload.rows || payload;
}

function normalizeLevel(value) {
  const text = (value || "").trim();
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (getEvaluationConfig().countBlankAsLevel) {
    if (!text || normalized === "SEM PREENCHIMENTO") return "Sem preenchimento";
    if (normalized === "NAO RESPONDEU") return "Não respondeu";
    if (normalized === "INADEQUADA") return "Inadequada";
    if (normalized === "ADEQUADA") return "Adequada";
  }
  if (!text || normalized === "SEM PREENCHIMENTO") return null;
  const nivel = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/^NIVEL\s*0?([1-4])$/i);
  if (nivel) return `Nível 0${nivel[1]}`;
  const raw = text.toUpperCase().replace(/_+$/, "");
  if (raw === "SSCV") return "SSVC";
  if (getLevelScore()[raw]) return raw;
  return null;
}

function classifyGain(gain) {
  if (gain >= 2) return "Alta evolução";
  if (gain === 1) return "Evolução média";
  if (gain === 0) return "Estável";
  return "Baixa";
}

function readSourceRow(row) {
  if (Array.isArray(row)) {
    const hasQuestion = row.length > COMPACT_SCHEMA.bimestre + 1;
    const hasEvaluation = row.length > 9;
    const schema = hasQuestion ? COMPACT_SCHEMA_WITH_QUESTION : COMPACT_SCHEMA;
    return {
      evaluation: hasEvaluation ? row[schema.evaluation] : "se1",
      question: hasQuestion ? row[schema.question] : hasEvaluation ? getEvaluationConfig().label : "Sistema de escrita",
      studentId: hasEvaluation ? row[schema.studentId] : row[4],
      response: hasEvaluation ? row[schema.response] : row[6],
      bimestre: hasEvaluation ? row[schema.bimestre] : row[8],
      studentName: hasEvaluation ? row[schema.studentName] : row[5],
      schoolCode: hasEvaluation ? row[schema.schoolCode] : row[1],
      school: hasEvaluation ? row[schema.school] : row[2],
      dre: hasEvaluation ? row[schema.dre] : row[0],
      ano: hasEvaluation ? row[schema.ano] : row[7],
      className: hasEvaluation ? row[schema.className] : row[3],
    };
  }

  return {
    evaluation: row["Avaliação"] || "se1",
    question: row["Questão"],
    studentId: row["Código EOL Estudante"],
    response: row["Resposta"],
    bimestre: row["Bimestre"],
    studentName: row["Nome Estudante"],
    schoolCode: row["Código EOL Escola"],
    school: row["Nome Escola"],
    dre: row["Nome DRE"],
    ano: row["Ano"],
    className: row["Nome Turma"],
  };
}

function buildStudentRecords(rows) {
  const byStudent = new Map();
  const invalid = { initial: 0, final: 0 };

  rows.forEach((row) => {
    const source = readSourceRow(row);
    if (source.evaluation && source.evaluation !== state.selectedEvaluation) return;
    if (!source.evaluation && source.question && source.question !== "Sistema de escrita") return;
    if (state.selectedQuestion !== "__all__" && source.question !== state.selectedQuestion) return;
    const studentId = source.studentId;
    if (!studentId) return;
    const level = normalizeLevel(source.response);
    const period = source.bimestre === "Inicial" ? "initial" : source.bimestre === "1° bimestre" ? "final" : null;
    if (!period) return;
    const recordKey = `${studentId}::${source.question || ""}`;

    if (!byStudent.has(recordKey)) {
      byStudent.set(recordKey, {
        id: studentId,
        name: source.studentName,
        question: source.question,
        schoolCode: source.schoolCode,
        school: source.school,
        dre: source.dre,
        ano: source.ano,
        className: source.className,
        initial: null,
        final: null,
      });
    }

    const record = byStudent.get(recordKey);
    if (level) {
      record[period] = level;
      record.question = source.question || record.question;
      record.school = source.school || record.school;
      record.schoolCode = source.schoolCode || record.schoolCode;
      record.className = source.className || record.className;
    } else {
      invalid[period] += 1;
    }
  });

  const records = Array.from(byStudent.values()).map((record) => {
    const hasPair = Boolean(record.initial && record.final);
    const score = getLevelScore();
    const gain = hasPair ? score[record.final] - score[record.initial] : null;
    const missingInitial = !record.initial;
    const missingFinal = !record.final;
    return {
      ...record,
      missingInitial,
      missingFinal,
      hasPair,
      gain,
      status: hasPair ? classifyGain(gain) : "Sem par válido",
    };
  });

  records.invalid = invalid;
  return records;
}

function filterRecords(records, options = {}) {
  const { includeMissing = false, includeSchool = true } = typeof options === "boolean"
    ? { includeMissing: options }
    : options;
  return records.filter((record) => {
    if (!includeMissing && !record.hasPair) return false;
    if (state.selectedDre !== "__all__" && record.dre !== state.selectedDre) return false;
    if (state.selectedAno !== "__all__" && record.ano !== state.selectedAno) return false;
    if (includeSchool && state.selectedSchool !== "__all__" && record.schoolCode !== state.selectedSchool) return false;
    return true;
  });
}

function summarize(records) {
  const paired = records.filter((record) => record.hasPair);
  const total = paired.length || 1;
  const improved = paired.filter((record) => record.gain > 0).length;
  const stable = paired.filter((record) => record.gain === 0).length;
  const regressed = paired.filter((record) => record.gain < 0).length;
  const avgGain = paired.reduce((sum, record) => sum + record.gain, 0) / total;
  const target = getTargetLevel();
  const initialAlpha = paired.filter((record) => record.initial === target).length / total;
  const finalAlpha = paired.filter((record) => record.final === target).length / total;
  return { paired, total, improved, stable, regressed, avgGain, initialAlpha, finalAlpha };
}

function schoolStats(records) {
  const grouped = new Map();
  records.filter((record) => record.hasPair).forEach((record) => {
    if (!grouped.has(record.schoolCode)) {
      grouped.set(record.schoolCode, {
        code: record.schoolCode,
        school: record.school,
        records: [],
      });
    }
    grouped.get(record.schoolCode).records.push(record);
  });

  return Array.from(grouped.values()).map((school) => {
    const summary = summarize(school.records);
    const target = getTargetLevel();
    const finalAlphaCount = summary.paired.filter((record) => record.final === target).length;
    const initialAlphaCount = summary.paired.filter((record) => record.initial === target).length;
    return {
      ...school,
      total: summary.total,
      improvedPct: summary.improved / summary.total,
      stablePct: summary.stable / summary.total,
      regressedPct: summary.regressed / summary.total,
      avgGain: summary.avgGain,
      initialPsPct: summary.paired.filter((record) => record.initial === getLevels()[0]).length / summary.total,
      finalAlphaCount,
      initialAlphaCount,
      finalAlphaPct: summary.finalAlpha,
      alphaDeltaCount: finalAlphaCount - initialAlphaCount,
      alphaDeltaPct: summary.finalAlpha - summary.initialAlpha,
    };
  }).sort((a, b) => b.avgGain - a.avgGain || b.improvedPct - a.improvedPct);
}

function groupedStats(records, getKey, getName) {
  const grouped = new Map();
  records.filter((record) => record.hasPair).forEach((record) => {
    const key = getKey(record);
    if (!grouped.has(key)) {
      grouped.set(key, {
        code: key,
        name: getName(record),
        records: [],
      });
    }
    grouped.get(key).records.push(record);
  });

  return Array.from(grouped.values()).map((group) => {
    const summary = summarize(group.records);
    const target = getTargetLevel();
    const finalAlphaCount = summary.paired.filter((record) => record.final === target).length;
    const initialAlphaCount = summary.paired.filter((record) => record.initial === target).length;
    return {
      ...group,
      total: summary.total,
      improvedPct: summary.improved / summary.total,
      stablePct: summary.stable / summary.total,
      regressedPct: summary.regressed / summary.total,
      avgGain: summary.avgGain,
      finalAlphaCount,
      initialAlphaCount,
      finalAlphaPct: summary.finalAlpha,
      alphaDeltaCount: finalAlphaCount - initialAlphaCount,
      alphaDeltaPct: summary.finalAlpha - summary.initialAlpha,
    };
  });
}

function dreStats(records) {
  return groupedStats(records, (record) => record.dre, (record) => record.dre);
}

function countByLevel(records, field) {
  const counts = Object.fromEntries(getLevels().map((level) => [level, 0]));
  records.forEach((record) => {
    if (record[field]) counts[record[field]] += 1;
  });
  return counts;
}

function renderKpis(records) {
  const summary = summarize(records);
  const missingPair = filterRecords(state.records, { includeMissing: true }).filter((record) => !record.hasPair).length;
  const totalStudentsInScope = summary.paired.length + missingPair || 1;
  const target = getTargetLevel();
  const targetLabel = getTargetLabel();
  const finalAlphaCount = summary.paired.filter((record) => record.final === target).length;
  const initialAlphaCount = summary.paired.filter((record) => record.initial === target).length;
  const alphaCountDelta = finalAlphaCount - initialAlphaCount;
  const alphaDelta = summary.finalAlpha - summary.initialAlpha;
  const noun = getRecordNoun();
  const nounTitle = getRecordNounTitle();
  const scoreHint = isReadingEvaluation()
    ? "Média dos ganhos: Sem preenchimento=1, Não respondeu=2, Inadequada=3 e Adequada=4."
    : "Média dos ganhos de nível: PS=1, SSVC=2, SCVC=3, SA=4 e A=5.";

  const items = [
    [`${targetLabel} (1ºBI)`, formatPct(summary.finalAlpha), `${formatNumber(finalAlphaCount)} ${noun}`, `Percentual e quantidade de ${getEvaluationConfig().targetTooltip} no 1º bimestre, entre ${noun} com par válido.`],
    [`${targetLabel} (diferença)`, `${alphaDelta >= 0 ? "+" : ""}${formatPct(alphaDelta)}`, `${alphaCountDelta >= 0 ? "+" : ""}${formatNumber(alphaCountDelta)} ${noun}`, `Diferença entre ${getEvaluationConfig().targetTooltip} no 1º bimestre e na avaliação inicial, em percentual e quantidade.`],
    [`${nounTitle} com par válido`, formatPct(summary.paired.length / totalStudentsInScope), `${formatNumber(summary.paired.length)} ${noun}`, `${nounTitle} com resultado válido na avaliação inicial e no 1º bimestre; são usadas nos cálculos de evolução.`],
    ["Sem par válido", formatPct(missingPair / totalStudentsInScope), `${formatNumber(missingPair)} ${noun}`, `${nounTitle} sem resultado válido em um dos dois períodos; ficam fora dos cálculos de evolução.`],
    ["Melhoraram", formatPct(summary.improved / summary.total), `${formatNumber(summary.improved)} ${noun}`, `${nounTitle} cujo nível numérico aumentou entre a inicial e o 1º bimestre.`],
    ["Mantiveram", formatPct(summary.stable / summary.total), `${formatNumber(summary.stable)} ${noun}`, `${nounTitle} que permaneceram na mesma categoria entre a inicial e o 1º bimestre.`],
    ["Baixaram", formatPct(summary.regressed / summary.total), `${formatNumber(summary.regressed)} ${noun}`, `${nounTitle} cujo nível numérico diminuiu entre a inicial e o 1º bimestre.`],
    ["Índice de Evolução", formatDecimal(summary.avgGain), "Ganho médio de níveis", scoreHint],
  ];

  document.querySelector("#kpis").innerHTML = items.map(([label, value, note, tooltip]) => `
    <article class="kpi">
      <span>${label}<span class="info-tip kpi-tip" tabindex="0" aria-label="Ajuda: ${tooltip}" data-tooltip="${tooltip}">?</span></span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `).join("");
}

function renderSankey(records) {
  const flows = [];
  const levels = getLevels();
  const visualLevels = getVisualLevels();
  const many = levels.length > 5;
  const halfH = many ? 22 : 28;
  const blockH = halfH * 2;
  const rowGap = blockH + (many ? 10 : 2);
  const maxStroke = many ? 24 : 34;
  const nameFontSize = many ? 13 : 16;
  const nameOffY = many ? -4 : -5;
  const metaOffY = many ? 12 : 15;

  const leftCounts = countByLevel(records, "initial");
  const rightCounts = countByLevel(records, "final");
  const matrix = levels.flatMap((initial) =>
    levels.map((final) => ({
      initial,
      final,
      count: records.filter((record) => record.initial === initial && record.final === final).length,
    })).filter((flow) => flow.count > 0)
  );
  const maxFlow = Math.max(1, ...matrix.map((flow) => flow.count));
  const top = 68;
  const height = top * 2 + (visualLevels.length - 1) * rowGap;
  const y = Object.fromEntries(visualLevels.map((level, index) => [level, top + index * rowGap]));

  matrix.forEach((flow) => {
    const stroke = 2 + (flow.count / maxFlow) * maxStroke;
    const x1 = 150;
    const x2 = 630;
    const y1 = y[flow.initial];
    const y2 = y[flow.final];
    flows.push(`
      <path d="M ${x1} ${y1} C 300 ${y1}, 448 ${y2}, ${x2} ${y2}"
        fill="none" stroke="${LEVEL_COLORS[flow.final]}" stroke-width="${stroke}"
        stroke-opacity="${flow.initial === flow.final ? 0.34 : 0.2}">
        <title>${flow.initial} para ${flow.final}: ${flow.count}</title>
      </path>
    `);
  });

  const total = records.length || 1;
  const nodeFg = (hex) => {
    const [r, g, b] = [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)].map(h => parseInt(h, 16));
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.52 ? '#18212f' : '#ffffff';
  };
  const maxTextW = 100;
  const nodeBlock = (level, x, count) => {
    const bg = LEVEL_COLORS[level];
    const fg = nodeFg(bg);
    const fgMeta = fg === '#ffffff' ? 'rgba(255,255,255,0.88)' : 'rgba(24,33,47,0.68)';
    const stroke = level === "Sem preenchimento" ? ' stroke="#d8e0ec"' : "";
    const approxW = level.length * nameFontSize * 0.65;
    const fitAttr = approxW > maxTextW ? ` textLength="${maxTextW}" lengthAdjust="spacingAndGlyphs"` : "";
    return `
    <rect x="${x}" y="${y[level] - halfH}" width="116" height="${blockH}" rx="7" fill="${bg}" opacity="0.96"${stroke}></rect>
    <text x="${x + 58}" y="${y[level] + nameOffY}" text-anchor="middle" fill="${fg}" font-size="${nameFontSize}" font-weight="850"${fitAttr}>${level}</text>
    <text class="node-meta" x="${x + 58}" y="${y[level] + metaOffY}" text-anchor="middle" fill="${fgMeta}">${formatNumber(count)} · ${formatPct(count / total)}</text>
  `;
  };
  const nodes = visualLevels.map((level) => `
    <g>
      ${nodeBlock(level, 18, leftCounts[level])}
      ${nodeBlock(level, 646, rightCounts[level])}
    </g>
  `).join("");

  document.querySelector("#pairCount").textContent = `${formatNumber(records.length)} pares de ${getRecordNoun()}`;
  document.querySelector("#sankey").innerHTML = `
    <svg viewBox="0 0 780 ${height}" preserveAspectRatio="xMidYMid meet">
      <text class="node-label" x="18" y="28">Inicial</text>
      <text class="node-label" x="646" y="28">1º bimestre</text>
      ${flows.join("")}
      ${nodes}
    </svg>
  `;
}

function renderHeatmap(records) {
  const initial = countByLevel(records, "initial");
  const final = countByLevel(records, "final");
  const total = Math.max(1, records.length);
  const visualLevels = getVisualLevels();

  const renderPeriod = (title, counts) => `
    <div class="heatmap-period">
      <p class="mini-title">${title}</p>
      <table>
        <thead>
          <tr>
            <th>${getCategoryLabel()}</th>
            <th>Alunos</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          ${visualLevels.map((level) => {
            const count = counts[level];
            const pct = count / total;
            return `
              <tr>
                <th>
                  <span class="level-swatch" style="background:${LEVEL_COLORS[level]}"></span>
                  ${level}
                </th>
                <td>
                  <div class="heat-cell" style="background:${LEVEL_COLORS[level]}; opacity:${0.22 + pct * 0.68}">
                    ${formatNumber(count)}
                  </div>
                </td>
                <td><strong>${formatPct(pct)}</strong></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelector("#heatmap").innerHTML = `
    ${renderPeriod("Inicial", initial)}
    ${renderPeriod("1º bimestre", final)}
  `;
}

function renderRanking(records) {
  const stats = sortRankingStats(
    schoolStats(records).map((school) => ({ ...school, name: school.school })),
    state.rankingSortBy,
    state.rankingSortDir
  );
  const rows = stats.map((school) => `
    <tr class="clickable-row ${state.selectedSchool === school.code ? "selected-row" : ""}" data-school-code="${escapeHtml(school.code)}" title="Filtrar ${escapeHtml(school.school)}">
      <td class="school-name">${escapeHtml(school.school)}</td>
      <td>${formatNumber(school.total)}</td>
      <td>${formatPct(school.finalAlphaPct)} <small>${formatNumber(school.finalAlphaCount)}</small></td>
      <td>${school.alphaDeltaPct >= 0 ? "+" : ""}${formatPct(school.alphaDeltaPct)} <small>${school.alphaDeltaCount >= 0 ? "+" : ""}${formatNumber(school.alphaDeltaCount)}</small></td>
      <td>${formatPct(school.improvedPct)}</td>
      <td>${formatPct(school.stablePct)}</td>
      <td>${formatPct(school.regressedPct)}</td>
      <td><strong>${formatDecimal(school.avgGain)}</strong></td>
    </tr>
  `).join("");
  document.querySelector("#rankingTable tbody").innerHTML = rows;
}

function sortRankingStats(stats, sortBy, sortDir) {
  return [...stats].sort((a, b) => {
    const direction = sortDir === "asc" ? 1 : -1;
    const key = sortBy;
    const aValue = key === "school" ? a.name : a[key];
    const bValue = key === "school" ? b.name : b[key];
    if (typeof aValue === "string" || typeof bValue === "string") {
      return direction * String(aValue).localeCompare(String(bValue), "pt-BR");
    }
    return direction * ((aValue || 0) - (bValue || 0));
  });
}

function renderDreRanking(records) {
  const panel = document.querySelector("#dreRankingPanel");
  panel.hidden = state.selectedDre !== "__all__" || state.selectedSchool !== "__all__";
  if (panel.hidden) return;

  const rows = sortRankingStats(dreStats(records), state.dreRankingSortBy, state.dreRankingSortDir).map((dre) => `
    <tr class="clickable-row" data-dre="${escapeHtml(dre.code)}" title="Filtrar ${escapeHtml(dre.name)}">
      <td class="school-name">${escapeHtml(dre.name)}</td>
      <td>${formatNumber(dre.total)}</td>
      <td>${formatPct(dre.finalAlphaPct)} <small>${formatNumber(dre.finalAlphaCount)}</small></td>
      <td>${dre.alphaDeltaPct >= 0 ? "+" : ""}${formatPct(dre.alphaDeltaPct)} <small>${dre.alphaDeltaCount >= 0 ? "+" : ""}${formatNumber(dre.alphaDeltaCount)}</small></td>
      <td>${formatPct(dre.improvedPct)}</td>
      <td>${formatPct(dre.stablePct)}</td>
      <td>${formatPct(dre.regressedPct)}</td>
      <td><strong>${formatDecimal(dre.avgGain)}</strong></td>
    </tr>
  `).join("");

  document.querySelector("#dreRankingTable tbody").innerHTML = rows;
}

function renderDistribution(records) {
  const initial = countByLevel(records, "initial");
  const final = countByLevel(records, "final");
  const total = Math.max(1, records.length);
  const visualLevels = getVisualLevels();

  const renderBars = (title, counts) => `
    <div>
      <p class="mini-title">${title}</p>
      ${visualLevels.map((level) => {
        const pct = counts[level] / total;
        return `
          <div class="bar-row">
            <strong>${level}</strong>
            <div class="bar-track"><div class="bar" style="width:${pct * 100}%; background:${LEVEL_COLORS[level]}"></div></div>
            <span>${formatPct(pct)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;

  document.querySelector("#distribution").innerHTML = `
    <div class="split-bars">
      ${renderBars("Inicial", initial)}
      ${renderBars("1º bimestre", final)}
    </div>
  `;
}

function renderVelocity(records) {
  const total = Math.max(1, records.length);
  const counts = Object.fromEntries(Object.keys(STATUS_COLORS).map((status) => [status, 0]));
  records.forEach((record) => {
    counts[record.status] += 1;
  });

  document.querySelector("#velocity").innerHTML = Object.entries(counts).map(([status, count]) => {
    const pct = count / total;
    return `
      <div class="bar-row velocity-row">
        <strong>${status.replace(" evolução", "")}</strong>
        <div class="bar-track"><div class="bar" style="width:${pct * 100}%; background:${STATUS_COLORS[status]}"></div></div>
        <span>${formatPct(pct)}</span>
      </div>
    `;
  }).join("");
}

function consolidadoLevelStats(records, field) {
  const counts = Object.fromEntries(getLevels().map((level) => [level, 0]));
  counts.sem = 0;
  records.forEach((r) => {
    const v = r[field];
    if (getLevelScore()[v]) counts[v]++;
    else counts.sem++;
  });
  const total = records.length || 1;
  const pct = {};
  [...getLevels(), "sem"].forEach((l) => { pct[l] = counts[l] / total; });
  return { counts, pct, total: records.length };
}

function missingStats(records) {
  const total = records.length || 1;
  const missingInitial = records.filter((record) => record.missingInitial).length;
  const missingFinal = records.filter((record) => record.missingFinal).length;
  const missingPair = records.filter((record) => !record.hasPair).length;
  const paired = records.filter((record) => record.hasPair).length;
  return {
    total: records.length,
    paired,
    missingInitial,
    missingFinal,
    missingPair,
    pairedPct: paired / total,
    missingInitialPct: missingInitial / total,
    missingFinalPct: missingFinal / total,
    missingPairPct: missingPair / total,
  };
}

function getScopeTitle() {
  const school = getSchoolLabel();
  const year = `${state.selectedAno}º ano`;
  const question = isReadingEvaluation() && state.selectedQuestion !== "__all__" ? ` · ${state.selectedQuestion}` : "";
  return state.selectedSchool === "__all__" ? `${school} · ${year}${question}` : `${school} · ${year}${question}`;
}

function renderConsolidadoKpis(records) {
  const initial = consolidadoLevelStats(records, "initial");
  const fin = consolidadoLevelStats(records, "final");
  const missing = missingStats(records);
  const target = getTargetLevel();
  const targetLabel = getTargetLabel();
  const noun = getRecordNoun();
  const nounTitle = getRecordNounTitle();
  const items = [
    [`Total de ${noun}`, formatNumber(records.length), "no recorte selecionado", `Total de ${noun} registrados no recorte, incluindo aqueles sem par válido.`],
    ["Com par válido", formatPct(missing.pairedPct), `${formatNumber(missing.paired)} ${noun}`, `${nounTitle} com resultado válido na avaliação inicial e no 1º bimestre.`],
    [`${targetLabel} – Inicial`, formatPct(initial.pct[target]), `${formatNumber(initial.counts[target])} ${noun}`, `Percentual de ${getEvaluationConfig().targetTooltip} na avaliação inicial, sobre o total de ${noun} do recorte.`],
    [`${targetLabel} – 1ºBI`, formatPct(fin.pct[target]), `${formatNumber(fin.counts[target])} ${noun}`, `Percentual de ${getEvaluationConfig().targetTooltip} no 1º bimestre, sobre o total de ${noun} do recorte.`],
    ["Sem registro – Inicial", formatPct(missing.missingInitialPct), `${formatNumber(missing.missingInitial)} ${noun}`, `${nounTitle} sem resultado registrado ou válido na avaliação inicial.`],
    ["Sem registro – 1ºBI", formatPct(fin.pct.sem), `${formatNumber(fin.counts.sem)} ${noun}`, `${nounTitle} sem resultado registrado ou válido no 1º bimestre.`],
  ];
  document.querySelector("#consolidado-kpis").innerHTML = items.map(([label, value, note, tooltip]) => `
    <article class="kpi">
      <span>${label}<span class="info-tip kpi-tip" tabindex="0" aria-label="Ajuda: ${tooltip}" data-tooltip="${tooltip}">?</span></span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `).join("") + `
    <article class="kpi kpi-action">
      <span>Exportação</span>
      <strong>XLSX</strong>
      <small>Resumo, distribuição, escolas, turmas, alunos e sem dado.</small>
      <button id="exportConsolidadoWorkbook" class="text-action" type="button">Baixar consolidado XLSX</button>
    </article>
  `;
}

function renderConsolidadoHeatmap(records) {
  const initial = consolidadoLevelStats(records, "initial");
  const fin = consolidadoLevelStats(records, "final");
  const chartLevels = [...getVisualLevels(), "sem"];

  const renderPeriod = (title, stats) => `
    <div class="heatmap-period">
      <p class="mini-title">${title}</p>
      <table>
        <thead>
          <tr><th>${getCategoryLabel()}</th><th>Alunos</th><th>%</th></tr>
        </thead>
        <tbody>
          ${chartLevels.map((level) => {
            const count = stats.counts[level] ?? 0;
            const pct = stats.pct[level] ?? 0;
            const color = LEVEL_COLORS[level] || "#8a94a6";
            const label = level === "sem" ? "Sem dado" : level;
            return `
              <tr>
                <th>
                  <span class="level-swatch" style="background:${color}"></span>
                  ${label}
                </th>
                <td>
                  <div class="heat-cell" style="background:${color}; opacity:${0.22 + pct * 0.68}">
                    ${formatNumber(count)}
                  </div>
                </td>
                <td><strong>${formatPct(pct)}</strong></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelector("#consolidado-heatmap").innerHTML = `
    ${renderPeriod("Inicial", initial)}
    ${renderPeriod("1º bimestre", fin)}
  `;
}

function renderConsolidadoDreChart(records) {
  const panel = document.querySelector("#consolidado-dre-panel");
  panel.hidden = state.selectedDre !== "__all__" || state.selectedSchool !== "__all__";
  if (panel.hidden) return;

  const field = state.consolidadoDrePeriod === "initial" ? "initial" : "final";
  const grouped = new Map();
  records.forEach((r) => {
    if (!r.dre) return;
    if (!grouped.has(r.dre)) grouped.set(r.dre, []);
    grouped.get(r.dre).push(r);
  });

  const chartLevels = [...getLevels(), "sem"];
  const dreData = Array.from(grouped.entries())
    .map(([dre, recs]) => ({ dre, stats: consolidadoLevelStats(recs, field) }))
    .sort((a, b) => (b.stats.pct[getTargetLevel()] ?? 0) - (a.stats.pct[getTargetLevel()] ?? 0));

  if (!dreData.length) {
    document.querySelector("#consolidado-dre-chart").innerHTML = `<p class="empty-state">Nenhum dado disponível.</p>`;
    return;
  }

  const rows = dreData.map(({ dre, stats }) => {
    const bars = chartLevels.map((level) => {
      const pct = stats.pct[level] ?? 0;
      const color = LEVEL_COLORS[level] || "#8a94a6";
      const label = level === "sem" ? "Sem dado" : level;
      const inner = pct >= 0.03 ? `<span class="dre-seg-label">${formatPct(pct)}</span>` : "";
      return `<div class="dre-bar-seg" style="width:${pct * 100}%; background:${color}" title="${label}: ${formatPct(pct)} (${formatNumber(stats.counts[level])})">${inner}</div>`;
    }).join("");
    return `
      <div class="dre-bar-row">
        <span class="dre-bar-label">${escapeHtml(dre)}</span>
        <div class="dre-bar-track">${bars}</div>
      </div>
    `;
  }).join("");

  const legend = chartLevels.map((level) => {
    const color = LEVEL_COLORS[level] || "#8a94a6";
    const label = level === "sem" ? "Sem dado" : level;
    return `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${label}</span>`;
  }).join("");

  document.querySelector("#consolidado-dre-chart").innerHTML = `
    <div class="dre-chart-legend">${legend}</div>
    <div class="dre-chart-rows">${rows}</div>
  `;
}

function renderConsolidadoSchoolTable(records) {
  const field = state.consolidadoSchoolPeriod === "initial" ? "initial" : "final";
  const sortBy = state.consolidadoSchoolSortBy;
  const dir = state.consolidadoSchoolSortDir === "asc" ? 1 : -1;
  const levels = getLevels();

  const grouped = new Map();
  records.forEach((r) => {
    if (!r.schoolCode) return;
    if (!grouped.has(r.schoolCode)) {
      grouped.set(r.schoolCode, { schoolCode: r.schoolCode, school: r.school, recs: [] });
    }
    grouped.get(r.schoolCode).recs.push(r);
  });

  const schools = Array.from(grouped.values())
    .map((g) => ({ ...g, stats: consolidadoLevelStats(g.recs, field) }))
    .sort((a, b) => {
      if (sortBy === "school") return dir * a.school.localeCompare(b.school, "pt-BR");
      if (sortBy === "total") return dir * (a.stats.total - b.stats.total);
      const aVal = sortBy === "sem" ? a.stats.pct.sem : (a.stats.pct[sortBy] ?? 0);
      const bVal = sortBy === "sem" ? b.stats.pct.sem : (b.stats.pct[sortBy] ?? 0);
      return dir * (aVal - bVal);
    });

  const chartLevels = [...levels, "sem"];
  document.querySelector("#consolidado-school-table thead").innerHTML = `
    <tr>
      <th>Escola</th>
      <th>Total</th>
      ${levels.map((level) => `<th>${escapeHtml(level)}</th>`).join("")}
      <th>Sem dado</th>
    </tr>
  `;
  const rows = schools.map((s) => {
    const selected = state.selectedSchool === s.schoolCode;
    const cells = chartLevels.map((level) => {
      const count = s.stats.counts[level] ?? 0;
      const pct = s.stats.pct[level] ?? 0;
      return `<td>${formatPct(pct)} <small>${formatNumber(count)}</small></td>`;
    }).join("");
    return `<tr class="clickable-row ${selected ? "selected-row" : ""}" data-school-code="${escapeHtml(s.schoolCode)}" title="Filtrar ${escapeHtml(s.school)}">
      <td class="school-name">${escapeHtml(s.school)}</td>
      <td>${formatNumber(s.stats.total)}</td>
      ${cells}
    </tr>`;
  }).join("");

  document.querySelector("#consolidado-school-table tbody").innerHTML = rows || `
    <tr><td colspan="${levels.length + 3}" class="empty-table">Nenhuma escola encontrada para o recorte atual.</td></tr>
  `;
}

function renderConsolidadoDesempenho(records) {
  const field = state.consolidadoChartPeriod === "initial" ? "initial" : "final";
  const stats = consolidadoLevelStats(records, field);
  const chartLevels = [...getVisualLevels(), "sem"];

  const maxRaw = Math.max(0.05, ...chartLevels.map((l) => stats.pct[l] ?? 0));
  const maxPct = Math.ceil(maxRaw * 10) / 10;
  const tickStep = maxPct <= 0.3 ? 0.05 : 0.1;
  const ticks = [];
  for (let t = 0; t <= maxPct + 0.001; t += tickStep) ticks.push(Math.round(t * 1000) / 1000);

  const labelW = 88;
  const rightPad = 58;
  const barAreaW = 360;
  const barH = 24;
  const barGap = 11;
  const topPad = 14;
  const bottomPad = 30;
  const n = chartLevels.length;
  const chartInnerH = n * barH + (n - 1) * barGap;
  const SVG_W = labelW + barAreaW + rightPad;
  const SVG_H = topPad + chartInnerH + bottomPad;

  const gridLines = ticks.map((tick) => {
    const x = labelW + (tick / maxPct) * barAreaW;
    return `
      <line class="grid-line" x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + chartInnerH}"></line>
      <text class="tick-label" x="${x}" y="${SVG_H - 6}" text-anchor="middle">${formatPct(tick)}</text>
    `;
  }).join("");

  const bars = chartLevels.map((level, i) => {
    const pct = stats.pct[level] ?? 0;
    const w = Math.max(0, (pct / maxPct) * barAreaW);
    const y = topPad + i * (barH + barGap);
    const color = LEVEL_COLORS[level] || "#8a94a6";
    const label = level === "sem" ? "Sem dado" : level;
    return `
      <text class="tick-label" x="${labelW - 8}" y="${y + barH * 0.67}" text-anchor="end">${label}</text>
      <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" fill="${color}" rx="3" opacity="0.88"></rect>
      <text class="tick-label" x="${labelW + w + 6}" y="${y + barH * 0.67}" font-weight="750">${formatPct(pct)}</text>
    `;
  }).join("");

  document.querySelector("#consolidado-desempenho").innerHTML = `
    <svg viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto">
      ${gridLines}${bars}
    </svg>
  `;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angle = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function donutArcPath(cx, cy, outerR, innerR, startAngle, endAngle) {
  const fullCircle = endAngle - startAngle >= 359.99;
  if (fullCircle) {
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
      `M ${cx} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx - 0.01} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      "Z",
    ].join(" ");
  }
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, startAngle);
  const endInner = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

function renderConsolidadoDonut(records) {
  const field = state.consolidadoDonutPeriod === "initial" ? "initial" : "final";
  const stats = consolidadoLevelStats(records, field);
  const chartLevels = [...getVisualLevels(), "sem"];
  const total = Math.max(1, records.length);
  let angle = 0;
  const slices = chartLevels.map((level) => {
    const count = stats.counts[level] ?? 0;
    const pct = count / total;
    const start = angle;
    const end = angle + pct * 360;
    angle = end;
    return { level, count, pct, start, end };
  }).filter((slice) => slice.count > 0);

  const cx = 150;
  const cy = 142;
  const outerR = 104;
  const innerR = 58;
  const periodLabel = state.consolidadoDonutPeriod === "initial" ? "Inicial" : "1º bimestre";
  const label = getScopeTitle();
  const paths = slices.map((slice) => {
    const color = LEVEL_COLORS[slice.level] || "#8a94a6";
    const name = slice.level === "sem" ? "Sem dado" : slice.level;
    return `
      <path d="${donutArcPath(cx, cy, outerR, innerR, slice.start, slice.end)}" fill="${color}" opacity="0.92">
        <title>${name}: ${formatNumber(slice.count)} alunos (${formatPct(slice.pct)})</title>
      </path>
    `;
  }).join("");
  const legend = chartLevels.map((level) => {
    const color = LEVEL_COLORS[level] || "#8a94a6";
    const name = level === "sem" ? "Sem dado" : level;
    const count = stats.counts[level] ?? 0;
    const pct = stats.pct[level] ?? 0;
    return `
      <div class="donut-legend-item">
        <span class="legend-swatch" style="background:${color}"></span>
        <strong>${name}</strong>
        <span>${formatPct(pct)}</span>
        <small>${formatNumber(count)}</small>
      </div>
    `;
  }).join("");

  document.querySelector("#consolidado-donut").innerHTML = `
    <div class="donut-layout">
      <svg viewBox="0 0 300 284" role="img" aria-label="Distribuição geral ${periodLabel}">
        ${paths || `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#dce3ee"></circle>`}
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff"></circle>
        <text class="donut-center-value" x="${cx}" y="${cy - 4}" text-anchor="middle">${formatNumber(records.length)}</text>
        <text class="donut-center-label" x="${cx}" y="${cy + 18}" text-anchor="middle">alunos</text>
      </svg>
      <div>
        <p class="table-note">${escapeHtml(label)} · ${periodLabel}</p>
        <div class="donut-legend">${legend}</div>
      </div>
    </div>
  `;
}

function renderConsolidadoParticipacao(records) {
  const field = state.consolidadoChartPeriod === "initial" ? "initial" : "final";
  const stats = consolidadoLevelStats(records, field);
  const semPct = stats.pct.sem;
  const preenchidoPct = 1 - semPct;

  const leftPad = 70;
  const rightPad = 60;
  const barW = 80;
  const spacing = 220;
  const chartH = 200;
  const topPad = 28;
  const bottomPad = 36;
  const SVG_W = leftPad + barW * 2 + spacing + rightPad;
  const SVG_H = topPad + chartH + bottomPad;

  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const gridLines = yTicks.map((tick) => {
    const y = topPad + (1 - tick) * chartH;
    return `
      <line class="grid-line" x1="${leftPad}" y1="${y}" x2="${SVG_W - rightPad}" y2="${y}"></line>
      <text class="tick-label" x="${leftPad - 6}" y="${y + 4}" text-anchor="end">${formatPct(tick)}</text>
    `;
  }).join("");

  const renderBar = (x, pct, label, opacity) => {
    const h = Math.max(pct * chartH, 2);
    const barY = topPad + chartH - h;
    return `
      <rect x="${x}" y="${barY}" width="${barW}" height="${h}" fill="#1f6feb" opacity="${opacity}" rx="4"></rect>
      <text class="tick-label" x="${x + barW / 2}" y="${Math.min(barY - 7, topPad + chartH - h - 4)}" text-anchor="middle" font-weight="800">${formatPct(pct)}</text>
      <text class="tick-label" x="${x + barW / 2}" y="${topPad + chartH + 18}" text-anchor="middle">${label}</text>
    `;
  };

  document.querySelector("#consolidado-participacao").innerHTML = `
    <svg viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto">
      ${gridLines}
      <line class="axis-line" x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + chartH}"></line>
      ${renderBar(leftPad, preenchidoPct, "Preenchido", 1)}
      ${renderBar(leftPad + barW + spacing, semPct, "Sem dado", 0.3)}
    </svg>
  `;
}

function renderConsolidado() {
  const records = filterRecords(state.records, { includeMissing: true });
  const compRecords = filterRecords(state.records, { includeMissing: true, includeSchool: false });
  renderFilterSummary(records);
  renderConsolidadoKpis(records);
  renderConsolidadoDesempenho(records);
  renderConsolidadoDonut(records);
  renderConsolidadoParticipacao(records);
  renderConsolidadoHeatmap(records);
  renderConsolidadoDreChart(compRecords);
  renderConsolidadoSchoolTable(compRecords);
}

function renderScatter(records) {
  const stats = schoolStats(records);
  const width = 1000;
  const height = 450;
  const plot = { left: 82, right: 34, top: 42, bottom: 78 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (value) => plot.left + value * plotWidth;
  const y = (value) => plot.top + (1 - value) * plotHeight;
  const xLevel = state.scatterXLevel;
  const yLevel = state.scatterYLevel;
  const xAxisTitle = `% em ${xLevel} na inicial`;
  const yAxisTitle = `% em ${yLevel} no 1º bimestre`;
  const points = stats.map((school) => {
    const selected = state.selectedSchool === school.code;
    const xPct = school.records.filter((record) => record.initial === xLevel).length / school.total;
    const yPct = school.records.filter((record) => record.final === yLevel).length / school.total;
    const px = x(xPct);
    const py = y(yPct);
    const labelX = Math.min(px + 14, width - 156);
    const labelY = Math.max(py - 16, plot.top + 18);
    const labelText = school.school.length > 20 ? `${school.school.slice(0, 19)}...` : school.school;
    return `
      <g>
        <circle cx="${px}" cy="${py}" r="${selected ? 8 : 5}"
          fill="${selected ? "#c43d3d" : "#1f6feb"}" opacity="${selected ? 0.95 : 0.64}">
          <title>${escapeHtml(school.school)}: ${xLevel} inicial ${formatPct(xPct)}, ${yLevel} no 1º bimestre ${formatPct(yPct)}</title>
        </circle>
        ${selected ? `
          <g>
            <rect class="point-label-bg" x="${labelX - 8}" y="${labelY - 16}" width="142" height="24" rx="5"></rect>
            <text class="point-label" x="${labelX}" y="${labelY}">${escapeHtml(labelText)}</text>
          </g>
        ` : ""}
      </g>
    `;
  }).join("");

  document.querySelector("#scatter").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${[0, 0.25, 0.5, 0.75, 1].map((tick) => `
        <line class="grid-line" x1="${x(tick)}" y1="${plot.top}" x2="${x(tick)}" y2="${height - plot.bottom}"></line>
        <line class="grid-line" x1="${plot.left}" y1="${y(tick)}" x2="${width - plot.right}" y2="${y(tick)}"></line>
        <text class="tick-label" x="${x(tick)}" y="${height - plot.bottom + 24}" text-anchor="middle">${formatPct(tick)}</text>
        <text class="tick-label" x="${plot.left - 14}" y="${y(tick) + 4}" text-anchor="end">${formatPct(tick)}</text>
      `).join("")}
      <line class="axis-line" x1="${plot.left}" y1="${height - plot.bottom}" x2="${width - plot.right}" y2="${height - plot.bottom}"></line>
      <line class="axis-line" x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${height - plot.bottom}"></line>
      ${points}
      <g class="axis-title">
        <rect x="${width / 2 - 104}" y="${height - 39}" width="208" height="28" rx="6"></rect>
        <text x="${width / 2}" y="${height - 20}" text-anchor="middle">${xAxisTitle}</text>
      </g>
      <g class="axis-title" transform="translate(17 ${plot.top + plotHeight / 2}) rotate(-90)">
        <rect x="-116" y="-14" width="232" height="28" rx="6"></rect>
        <text x="0" y="5" text-anchor="middle">${yAxisTitle}</text>
      </g>
    </svg>
  `;
  document.querySelector("#scatter").setAttribute(
    "aria-label",
    `Dispersão de escolas por ${xLevel} na avaliação inicial e ${yLevel} no 1º bimestre`
  );
}

function statusClass(status) {
  if (status === "Alta evolução") return "good";
  if (status === "Evolução média") return "mid";
  if (status === "Estável") return "stable";
  return "bad";
}

function classroomButton(record, label = "Abrir guia da turma") {
  return `
    <button class="classroom-open-btn" type="button"
      data-classroom-open
      data-school-code="${escapeHtml(record.schoolCode)}"
      data-class-name="${escapeHtml(record.className)}"
      aria-label="${escapeHtml(label)} ${escapeHtml(record.className)}"
      title="${escapeHtml(label)} ${escapeHtml(record.className)}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    </button>
  `;
}

function classStats(records) {
  const grouped = new Map();
  records.forEach((record) => {
    const key = `${record.schoolCode}::${record.className}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        schoolCode: record.schoolCode,
        school: record.school,
        className: record.className,
        records: [],
      });
    }
    grouped.get(key).records.push(record);
  });

  return Array.from(grouped.values()).map((group) => {
    const paired = group.records.filter((record) => record.hasPair);
    const total = group.records.length;
    const pairedTotal = paired.length || 1;
    const missingInitial = group.records.filter((record) => record.missingInitial).length;
    const missingFinal = group.records.filter((record) => record.missingFinal).length;
    const target = getTargetLevel();
    const finalAlphaCount = paired.filter((record) => record.final === target).length;
    const initialAlphaCount = paired.filter((record) => record.initial === target).length;
    const improved = paired.filter((record) => record.gain > 0).length;
    const stable = paired.filter((record) => record.gain === 0).length;
    const regressed = paired.filter((record) => record.gain < 0).length;
    const avgGain = paired.reduce((sum, record) => sum + record.gain, 0) / pairedTotal;
    return {
      ...group,
      total,
      pairedCount: paired.length,
      missingInitial,
      missingFinal,
      missingPair: total - paired.length,
      finalAlphaCount,
      alphaDeltaCount: finalAlphaCount - initialAlphaCount,
      finalAlphaPct: finalAlphaCount / pairedTotal,
      improvedPct: improved / pairedTotal,
      stablePct: stable / pairedTotal,
      regressedPct: regressed / pairedTotal,
      avgGain,
    };
  });
}

function sortClassStats(stats, sortBy, sortDir) {
  return [...stats].sort((a, b) => {
    const direction = sortDir === "asc" ? 1 : -1;
    const aValue = sortBy === "school" ? a.school : sortBy === "className" ? a.className : a[sortBy];
    const bValue = sortBy === "school" ? b.school : sortBy === "className" ? b.className : b[sortBy];
    if (typeof aValue === "string" || typeof bValue === "string") {
      return direction * String(aValue).localeCompare(String(bValue), "pt-BR", { numeric: true });
    }
    return direction * ((aValue || 0) - (bValue || 0));
  });
}

function renderClassesTable(records) {
  const rows = sortClassStats(classStats(records), state.classesSortBy, state.classesSortDir).map((group) => {
    const recordRef = {
      schoolCode: group.schoolCode,
      className: group.className,
    };
    return `
      <tr>
        <td>${classroomButton(recordRef, "Abrir guia da turma")}</td>
        <td class="school-name">${escapeHtml(group.school)}</td>
        <td><strong>${escapeHtml(group.className)}</strong></td>
        <td>${formatNumber(group.total)}</td>
        <td>${formatNumber(group.pairedCount)} <small>${formatPct(group.pairedCount / Math.max(1, group.total))}</small></td>
        <td>${formatNumber(group.missingInitial)} <small>${formatPct(group.missingInitial / Math.max(1, group.total))}</small></td>
        <td>${formatNumber(group.missingFinal)} <small>${formatPct(group.missingFinal / Math.max(1, group.total))}</small></td>
        <td>${formatNumber(group.missingPair)}</td>
        <td>${formatPct(group.finalAlphaPct)} <small>${formatNumber(group.finalAlphaCount)}</small></td>
        <td>${formatPct(group.improvedPct)}</td>
        <td>${formatPct(group.stablePct)}</td>
        <td>${formatPct(group.regressedPct)}</td>
        <td><strong>${formatDecimal(group.avgGain)}</strong></td>
      </tr>
    `;
  }).join("");

  document.querySelector("#classesTable tbody").innerHTML = rows || `
    <tr><td colspan="13" class="empty-table">Nenhuma turma encontrada para o recorte atual.</td></tr>
  `;
}

function renderStudents(records) {
  const focusRecords = records
    .filter((record) => record.gain <= 0 || record.gain >= 2)
    .sort(sortStudents);
  const limit = 220;
  const focus = focusRecords.slice(0, limit);
  const note = document.querySelector("#studentsLimitNote");
  if (note) {
    note.textContent = focusRecords.length > limit
      ? `Exibindo os ${formatNumber(limit)} primeiros de ${formatNumber(focusRecords.length)} alunos priorizados pela ordenação atual.`
      : `Exibindo ${formatNumber(focusRecords.length)} alunos priorizados pela ordenação atual.`;
  }

  document.querySelector("#studentsTable tbody").innerHTML = focus.map((record) => `
    <tr>
      <td><strong>${escapeHtml(getStudentDisplayName(record))}</strong></td>
      <td>${escapeHtml(record.school)}</td>
      <td>
        <button class="class-link" type="button"
          data-classroom-open
          data-school-code="${escapeHtml(record.schoolCode)}"
          data-class-name="${escapeHtml(record.className)}"
          title="Abrir guia da turma ${escapeHtml(record.className)}">
          ${escapeHtml(record.className)}
        </button>
      </td>
      <td>${record.initial}</td>
      <td>${record.final}</td>
      <td>${record.gain > 0 ? "+" : ""}${record.gain}</td>
      <td><span class="status-pill ${statusClass(record.status)}">${record.status}</span></td>
    </tr>
  `).join("") || `
    <tr><td colspan="7" class="empty-table">Nenhum aluno encontrado para o recorte atual.</td></tr>
  `;
}

function sortStudents(a, b) {
  const direction = state.studentSortDir === "asc" ? 1 : -1;
  const key = state.studentSortBy;
  const score = getLevelScore();
  const scoreValue = (record, field) => score[record[field]] || 0;
  const value = (record) => {
    if (key === "initial" || key === "final") return scoreValue(record, key);
    if (key === "name") return getStudentDisplayName(record);
    return record[key];
  };
  const aValue = value(a);
  const bValue = value(b);
  let result;
  if (typeof aValue === "string" || typeof bValue === "string") {
    result = String(aValue ?? "").localeCompare(String(bValue ?? ""), "pt-BR", { numeric: true });
  } else {
    result = (aValue ?? 0) - (bValue ?? 0);
  }
  return direction * result ||
    a.school.localeCompare(b.school, "pt-BR") ||
    a.className.localeCompare(b.className, "pt-BR", { numeric: true }) ||
    String(a.question || "").localeCompare(String(b.question || ""), "pt-BR") ||
    getStudentDisplayName(a).localeCompare(getStudentDisplayName(b), "pt-BR");
}

function getClassroomTabId(schoolCode, className) {
  return `${schoolCode}::${className}`;
}

function getClassroomRecords(tab) {
  if (!tab?.schoolCode || !tab?.className) return [];
  return filterRecords(state.records, { includeMissing: true }).filter((record) =>
    record.schoolCode === tab.schoolCode && record.className === tab.className
  );
}

function getStudentInitial(name) {
  return String(name || "").trim().slice(0, 1).toUpperCase() || "A";
}

function getStudentDisplayName(record) {
  return `${getStudentInitial(record.name)}${record.id}`;
}

function evolutionMarker(record, period) {
  if (period !== "final") return "";
  const marker = !record.hasPair
    ? { symbol: "*", label: "Sem comparação", className: "unknown" }
    : record.gain > 0
    ? { symbol: "↑", label: "Evoluiu", className: "up" }
    : record.gain < 0
      ? { symbol: "↓", label: "Baixou", className: "down" }
      : { symbol: "–", label: "Manteve", className: "same" };
  return `
    <span class="student-evolution ${marker.className}" title="${marker.label}: ${record.initial} para ${record.final}" aria-label="${marker.label}">
      ${marker.symbol}
    </span>
  `;
}

function renderClassroomView(tab) {
  const records = getClassroomRecords(tab);
  const period = tab.period;
  const field = period === "initial" ? "initial" : "final";
  const schoolName = records[0]?.school || getSchoolLabel();
  const total = Math.max(1, records.length);
  const missing = records.filter((record) => !record[field]);
  const groups = getLevels().map((level) => ({
    level,
    color: LEVEL_COLORS[level],
    records: records.filter((record) => record[field] === level),
  })).concat([{
    level: "Sem dado",
    color: "#8a94a6",
    records: missing,
  }]);

  return `
    <div class="classroom-view-head">
      <div>
        <p class="eyebrow">Visualização da turma</p>
        <h2>Turma ${escapeHtml(tab.className)}</h2>
        <p class="classroom-subtitle">${escapeHtml(schoolName)} · ${formatNumber(records.length)} ${getRecordNoun()} no recorte</p>
      </div>
      <div class="classroom-toolbar" aria-label="Selecionar período">
        <button type="button" data-classroom-period="initial" class="${period === "initial" ? "active" : ""}">Inicial</button>
        <button type="button" data-classroom-period="final" class="${period === "final" ? "active" : ""}">1º bimestre</button>
      </div>
    </div>
    ${period === "final" ? `
      <div class="classroom-legend" aria-label="Legenda da evolução">
        <span><b class="student-evolution up">↑</b> Evoluiu</span>
        <span><b class="student-evolution same">–</b> Manteve</span>
        <span><b class="student-evolution down">↓</b> Baixou</span>
        <span><b class="student-evolution unknown">*</b> Sem comparação</span>
      </div>
    ` : ""}
    ${records.length ? `
      <div class="classroom-stage">
      ${groups.map((group) => {
        const count = group.records.length;
        const pct = count / total;
        return `
          <section class="classroom-group">
            <div class="classroom-group-head">
              <span class="level-swatch" style="background:${group.color}"></span>
              <strong>${group.level}</strong>
              <small>${formatNumber(count)} · ${formatPct(pct)}</small>
            </div>
            <div class="student-cloud" aria-label="${group.level}: ${formatNumber(count)} ${getRecordNoun()}">
              ${group.records.map((record) => `
                <span class="student-marker" style="--student-color:${group.color}" title="${escapeHtml(getStudentDisplayName(record))}${record.question ? ` · ${escapeHtml(record.question)}` : ""} · ${group.level}">
                  ${evolutionMarker(record, period)}
                  <span class="student-head"></span>
                  <span class="student-body"></span>
                  <span class="student-name">${escapeHtml(getStudentDisplayName(record))}</span>
                </span>
              `).join("")}
            </div>
          </section>
        `;
      }).join("")}
      </div>
    ` : `
      <div class="empty-state">Nenhum aluno encontrado para esta turma no recorte atual.</div>
    `}
  `;
}

function openClassroomTab(schoolCode, className) {
  const id = getClassroomTabId(schoolCode, className);
  if (!state.classroomTabs.some((tab) => tab.id === id)) {
    state.classroomTabs.push({ id, schoolCode, className, period: "final" });
  }
  state.activeClassroomTabId = id;
  renderClassroomTabs();
  document.querySelector("#classroomTabsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderClassroomTabs() {
  const panel = document.querySelector("#classroomTabsPanel");
  const tabList = document.querySelector("#classroomTabList");
  const content = document.querySelector("#classroomTabContent");
  panel.hidden = state.classroomTabs.length === 0;
  if (!state.classroomTabs.length) {
    tabList.innerHTML = "";
    content.innerHTML = "";
    return;
  }

  if (!state.activeClassroomTabId || !state.classroomTabs.some((tab) => tab.id === state.activeClassroomTabId)) {
    state.activeClassroomTabId = state.classroomTabs[0].id;
  }

  tabList.innerHTML = state.classroomTabs.map((tab) => {
    const active = tab.id === state.activeClassroomTabId;
    return `
      <button class="class-tab ${active ? "active" : ""}" type="button" role="tab"
        aria-selected="${active}" data-class-tab="${escapeHtml(tab.id)}">
        <span>Turma ${escapeHtml(tab.className)}</span>
        <small>${escapeHtml(tab.schoolCode)}</small>
        <span class="class-tab-close" data-close-class-tab="${escapeHtml(tab.id)}" aria-label="Fechar turma">&times;</span>
      </button>
    `;
  }).join("");

  const activeTab = state.classroomTabs.find((tab) => tab.id === state.activeClassroomTabId);
  content.innerHTML = activeTab ? renderClassroomView(activeTab) : "";
}

function syncDreForSchool(schoolCode) {
  if (schoolCode === "__all__") return;
  const record = state.records.find((r) => r.schoolCode === schoolCode);
  if (record && state.selectedDre !== record.dre) {
    state.selectedDre = record.dre;
    document.querySelector("#dreFilter").value = state.selectedDre;
    populateSchoolFilter();
  }
}

function getSchoolLabel() {
  if (state.selectedSchool === "__all__") return "Todas as escolas";
  return state.schools.find(([code]) => code === state.selectedSchool)?.[1] || "Escola selecionada";
}

function renderFilterSummary(records) {
  const filters = [
    ["Avaliação", getEvaluationConfig().label],
    ...(isReadingEvaluation() ? [["Questão", state.selectedQuestion === "__all__" ? "Todas as questões" : state.selectedQuestion]] : []),
    ["DRE", state.selectedDre === "__all__" ? "Todas as DREs" : state.selectedDre],
    ["Escola", getSchoolLabel()],
    ["Ano", `${state.selectedAno}º ano`],
    [`${getRecordNounTitle()} no recorte`, formatNumber(records.length)],
  ];

  document.querySelector("#filterSummary").innerHTML = `
    <div>
      <p class="eyebrow">Filtros aplicados</p>
      <strong>Recorte atual</strong>
    </div>
    <div class="filter-summary-items">
      ${filters.map(([label, value]) => `
        <span class="filter-badge">
          <small>${label}</small>
          <b>${escapeHtml(value)}</b>
        </span>
      `).join("")}
    </div>
  `;
}

function populateFilters() {
  const dres = Array.from(new Set(state.records.map((r) => r.dre).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const anos = [state.selectedAno];
  state.dres = dres;
  state.anos = anos;
  document.querySelector("#dreFilter").innerHTML =
    `<option value="__all__">Todas as DREs</option>` +
    dres.map((dre) => `<option value="${escapeHtml(dre)}">${escapeHtml(dre)}</option>`).join("");
  populateSchoolFilter();
}

function populateEvaluationFilter() {
  const select = document.querySelector("#evaluationFilter");
  if (!select) return;
  select.innerHTML = Object.values(EVALUATIONS).map((evaluation) =>
    `<option value="${evaluation.id}">${escapeHtml(evaluation.label)}</option>`
  ).join("");
  select.value = state.selectedEvaluation;
}

function populateQuestionFilter() {
  const wrap = document.querySelector("#questionFilterWrap");
  const select = document.querySelector("#questionFilter");
  if (!wrap || !select) return;
  const config = getEvaluationConfig();
  const questions = getQuestions();
  const show = config.domain === "Leitura" && questions.length > 1;
  wrap.hidden = !show;
  if (!show) {
    state.selectedQuestion = "__all__";
    select.innerHTML = `<option value="__all__">Todas as questões</option>`;
    select.value = "__all__";
    return;
  }
  select.innerHTML = questions.map((question) =>
    `<option value="${escapeHtml(question)}">${escapeHtml(question)}</option>`
  ).join("");
  if (!questions.includes(state.selectedQuestion)) {
    state.selectedQuestion = questions[0];
  }
  select.value = state.selectedQuestion;
}

function updateEvaluationContext() {
  const config = getEvaluationConfig();
  state.selectedAno = config.year;
  const yearLabel = document.querySelector("#evaluationYearLabel");
  if (yearLabel) yearLabel.textContent = `${config.year}º ano`;
  const topbarTitle = document.querySelector("#topbarTitle");
  if (topbarTitle) topbarTitle.textContent = config.title || config.label;
}

function updateLevelControls() {
  const levels = getLevels();
  const optionHtml = (periodLabel) => levels.map((level) =>
    `<option value="${escapeHtml(level)}">${escapeHtml(level)} ${periodLabel}</option>`
  ).join("");
  const scatterX = document.querySelector("#scatterXLevel");
  const scatterY = document.querySelector("#scatterYLevel");
  if (scatterX) {
    scatterX.innerHTML = optionHtml("inicial");
    if (!levels.includes(state.scatterXLevel)) state.scatterXLevel = levels[0];
    scatterX.value = state.scatterXLevel;
  }
  if (scatterY) {
    scatterY.innerHTML = optionHtml("1ºBI");
    if (!levels.includes(state.scatterYLevel)) state.scatterYLevel = getTargetLevel();
    scatterY.value = state.scatterYLevel;
  }
  const target = getTargetLevel();
  const targetLabel = getTargetLabel();
  const nounTitle = getRecordNounTitle();
  [
    ["#rankingSortBy", "finalAlphaPct", `${targetLabel} (1ºBI)`],
    ["#rankingSortBy", "alphaDeltaPct", `${targetLabel} (diferença)`],
    ["#rankingSortBy", "total", nounTitle],
    ["#dreRankingSortBy", "finalAlphaPct", `${targetLabel} (1ºBI)`],
    ["#dreRankingSortBy", "alphaDeltaPct", `${targetLabel} (diferença)`],
    ["#dreRankingSortBy", "total", nounTitle],
    ["#classesSortBy", "finalAlphaPct", `${targetLabel} (1ºBI)`],
    ["#classesSortBy", "total", nounTitle],
  ].forEach(([selector, value, label]) => {
    const option = document.querySelector(`${selector} option[value="${value}"]`);
    if (option) option.textContent = label;
  });
  const consolidatedSort = document.querySelector("#consolidadoSchoolSortBy");
  if (consolidatedSort) {
    consolidatedSort.innerHTML = levels.map((level) =>
      `<option value="${escapeHtml(level)}">${escapeHtml(level)}</option>`
    ).join("") + `<option value="sem">Sem dado</option><option value="total">Total</option><option value="school">Escola</option>`;
    if (!levels.includes(state.consolidadoSchoolSortBy) && !["sem", "total", "school"].includes(state.consolidadoSchoolSortBy)) {
      state.consolidadoSchoolSortBy = target;
    }
    consolidatedSort.value = state.consolidadoSchoolSortBy;
  }
}

function updateTableLabels() {
  const targetLabel = getTargetLabel();
  const nounTitle = getRecordNounTitle();
  const setText = (selector, text) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  };
  setText("#dreRankingTable thead th:nth-child(2)", nounTitle);
  setText("#dreRankingTable thead th:nth-child(3)", `${targetLabel} (1ºBI)`);
  setText("#dreRankingTable thead th:nth-child(4)", `${targetLabel} (diferença)`);
  setText("#rankingTable thead th:nth-child(2)", nounTitle);
  setText("#rankingTable thead th:nth-child(3)", `${targetLabel} (1ºBI)`);
  setText("#rankingTable thead th:nth-child(4)", `${targetLabel} (diferença)`);
  setText("#classesTable thead th:nth-child(4)", nounTitle);
  setText("#classesTable thead th:nth-child(9)", `${targetLabel} (1ºBI)`);
}

function rebuildRecordsForEvaluation() {
  updateEvaluationContext();
  populateQuestionFilter();
  state.records = buildStudentRecords(state.rawRows);
  state.scatterXLevel = getLevels()[0];
  state.scatterYLevel = getTargetLevel();
  state.consolidadoSchoolSortBy = getTargetLevel();
  state.selectedSchool = "__all__";
  state.classroomTabs = [];
  state.activeClassroomTabId = null;
  populateFilters();
  updateLevelControls();
  updateTableLabels();
}

function populateSchoolFilter() {
  const scopedRecords = filterRecords(state.records, { includeMissing: true, includeSchool: false });
  const schools = Array.from(new Map(scopedRecords.map((r) => [r.schoolCode, r.school])).entries())
    .sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"));
  state.schools = schools;
  const hasSelectedSchool = state.selectedSchool === "__all__" || schools.some(([code]) => code === state.selectedSchool);
  if (!hasSelectedSchool) state.selectedSchool = "__all__";
  document.querySelector("#schoolFilter").innerHTML =
    `<option value="__all__">Todas as escolas</option>` +
    schools.map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join("");
  document.querySelector("#schoolFilter").value = state.selectedSchool;
}

function render() {
  document.querySelector("#view-evolucao").hidden = state.viewMode !== "evolucao";
  document.querySelector("#view-consolidado").hidden = state.viewMode !== "consolidado";

  if (state.viewMode === "consolidado") {
    renderConsolidado();
    return;
  }

  const records = filterRecords(state.records);
  const recordsInScope = filterRecords(state.records, { includeMissing: true });
  const comparisonRecords = filterRecords(state.records, { includeSchool: false });
  renderFilterSummary(recordsInScope);
  renderKpis(records);
  renderSankey(records);
  renderHeatmap(records);
  renderDistribution(records);
  renderVelocity(records);
  renderDreRanking(comparisonRecords);
  renderRanking(comparisonRecords);
  renderScatter(comparisonRecords);
  renderClassesTable(recordsInScope);
  renderStudents(records);
  renderClassroomTabs();
}

let _progressTimer = null;

function startPageProgress() {
  const bar = document.getElementById("page-progress");
  if (!bar) return;
  if (_progressTimer) { clearTimeout(_progressTimer); _progressTimer = null; }
  bar.style.transition = "none";
  bar.style.opacity = "1";
  bar.style.width = "5%";
  bar.offsetWidth; // reflow
  bar.style.transition = "width 700ms cubic-bezier(0.1, 0.5, 0.8, 1)";
  bar.style.width = "65%";
  const main = document.querySelector("main");
  if (main) main.classList.add("is-rendering");
}

function finishPageProgress() {
  const bar = document.getElementById("page-progress");
  if (!bar) return;
  const main = document.querySelector("main");
  if (main) main.classList.remove("is-rendering");
  bar.style.transition = "width 150ms ease";
  bar.style.width = "100%";
  _progressTimer = setTimeout(() => {
    bar.style.transition = "opacity 260ms ease";
    bar.style.opacity = "0";
    _progressTimer = setTimeout(() => {
      bar.style.transition = "none";
      bar.style.width = "0%";
      _progressTimer = null;
    }, 270);
  }, 160);
}

function renderAsync(fn) {
  startPageProgress();
  return new Promise(resolve => {
    setTimeout(() => {
      fn();
      finishPageProgress();
      resolve();
    }, 30);
  });
}

function setLoadProgress(frac, status) {
  const fill = document.getElementById("loader-fill");
  const bar = document.getElementById("loader-bar");
  const statusEl = document.getElementById("loader-status");
  const pct = Math.round(frac * 100);
  if (fill) fill.style.width = `${pct}%`;
  if (bar) bar.setAttribute("aria-valuenow", pct);
  if (statusEl && status !== undefined) statusEl.textContent = status;
}

function hideLoader() {
  const el = document.getElementById("app-loader");
  if (!el) return;
  el.classList.add("is-done");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
}

async function init() {
  setLoadProgress(0.04, "Baixando dados…");

  const response = await fetch(DATA_PATH);
  if (!response.ok) throw new Error(`Falha ao carregar ${DATA_PATH}`);

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let text;
  if (total && response.body) {
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      setLoadProgress(0.04 + (received / total) * 0.56, "Baixando dados…");
    }
    const all = new Uint8Array(received);
    let pos = 0;
    for (const chunk of chunks) { all.set(chunk, pos); pos += chunk.length; }
    text = new TextDecoder().decode(all);
  } else {
    text = await response.text();
    setLoadProgress(0.60, "Baixando dados…");
  }

  setLoadProgress(0.65, "Processando dados…");
  const rows = parseJsonRows(text);
  state.rawRows = rows;
  populateEvaluationFilter();

  setLoadProgress(0.78, "Processando dados…");
  rebuildRecordsForEvaluation();

  document.querySelector("#evaluationFilter").addEventListener("change", (event) => {
    state.selectedEvaluation = event.target.value;
    state.selectedQuestion = "__all__";
    renderAsync(() => { rebuildRecordsForEvaluation(); render(); });
  });
  document.querySelector("#questionFilter").addEventListener("change", (event) => {
    state.selectedQuestion = event.target.value;
    renderAsync(() => { rebuildRecordsForEvaluation(); render(); });
  });
  document.querySelector("#dreFilter").addEventListener("change", (event) => {
    state.selectedDre = event.target.value;
    populateSchoolFilter();
    renderAsync(() => render());
  });
  document.querySelector("#schoolFilter").addEventListener("change", (event) => {
    state.selectedSchool = event.target.value;
    syncDreForSchool(state.selectedSchool);
    renderAsync(() => render());
  });
  document.querySelector("#scatterXLevel").addEventListener("change", (event) => {
    state.scatterXLevel = event.target.value;
    renderScatter(filterRecords(state.records, { includeSchool: false }));
  });
  document.querySelector("#scatterYLevel").addEventListener("change", (event) => {
    state.scatterYLevel = event.target.value;
    renderScatter(filterRecords(state.records, { includeSchool: false }));
  });
  document.querySelector("#rankingSortBy").addEventListener("change", (event) => {
    state.rankingSortBy = event.target.value;
    renderRanking(filterRecords(state.records, { includeSchool: false }));
  });
  document.querySelector("#rankingSortDir").addEventListener("change", (event) => {
    state.rankingSortDir = event.target.value;
    renderRanking(filterRecords(state.records, { includeSchool: false }));
  });
  document.querySelector("#dreRankingSortBy").addEventListener("change", (event) => {
    state.dreRankingSortBy = event.target.value;
    renderDreRanking(filterRecords(state.records, { includeSchool: false }));
  });
  document.querySelector("#dreRankingSortDir").addEventListener("change", (event) => {
    state.dreRankingSortDir = event.target.value;
    renderDreRanking(filterRecords(state.records, { includeSchool: false }));
  });
  document.querySelector("#dreRankingTable tbody").addEventListener("click", (event) => {
    const row = event.target.closest("[data-dre]");
    if (!row) return;
    state.selectedDre = row.dataset.dre;
    document.querySelector("#dreFilter").value = state.selectedDre;
    populateSchoolFilter();
    renderAsync(() => render());
  });
  document.querySelector("#rankingTable tbody").addEventListener("click", (event) => {
    const row = event.target.closest("[data-school-code]");
    if (!row) return;
    state.selectedSchool = row.dataset.schoolCode;
    syncDreForSchool(state.selectedSchool);
    document.querySelector("#schoolFilter").value = state.selectedSchool;
    renderAsync(() => render());
  });
  document.querySelector("#studentSortBy").addEventListener("change", (event) => {
    state.studentSortBy = event.target.value;
    renderStudents(filterRecords(state.records));
  });
  document.querySelector("#studentSortDir").addEventListener("change", (event) => {
    state.studentSortDir = event.target.value;
    renderStudents(filterRecords(state.records));
  });
  document.querySelector("#studentsTable tbody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-classroom-open]");
    if (!button) return;
    openClassroomTab(button.dataset.schoolCode, button.dataset.className);
  });
  document.querySelector("#classesSortBy").addEventListener("change", (event) => {
    state.classesSortBy = event.target.value;
    renderClassesTable(filterRecords(state.records, { includeMissing: true }));
  });
  document.querySelector("#classesSortDir").addEventListener("change", (event) => {
    state.classesSortDir = event.target.value;
    renderClassesTable(filterRecords(state.records, { includeMissing: true }));
  });
  document.querySelector("#classesTable tbody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-classroom-open]");
    if (!button) return;
    openClassroomTab(button.dataset.schoolCode, button.dataset.className);
  });
  document.querySelector("#classroomTabsPanel").addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-class-tab]");
    if (closeButton) {
      const id = closeButton.dataset.closeClassTab;
      const index = state.classroomTabs.findIndex((tab) => tab.id === id);
      state.classroomTabs = state.classroomTabs.filter((tab) => tab.id !== id);
      if (state.activeClassroomTabId === id) {
        state.activeClassroomTabId = state.classroomTabs[Math.max(0, index - 1)]?.id || state.classroomTabs[0]?.id || null;
      }
      renderClassroomTabs();
      return;
    }
    const tabButton = event.target.closest("[data-class-tab]");
    if (tabButton) {
      state.activeClassroomTabId = tabButton.dataset.classTab;
      renderClassroomTabs();
      return;
    }
    const periodButton = event.target.closest("[data-classroom-period]");
    if (periodButton) {
      const activeTab = state.classroomTabs.find((tab) => tab.id === state.activeClassroomTabId);
      if (activeTab) activeTab.period = periodButton.dataset.classroomPeriod;
      renderClassroomTabs();
    }
  });
  document.querySelector("#closeAllClassTabs").addEventListener("click", () => {
    state.classroomTabs = [];
    state.activeClassroomTabId = null;
    renderClassroomTabs();
  });

  document.querySelector("#switchEvolucao").addEventListener("click", () => {
    if (state.viewMode === "evolucao") return;
    state.viewMode = "evolucao";
    document.querySelector("#switchEvolucao").classList.add("active");
    document.querySelector("#switchConsolidado").classList.remove("active");
    renderAsync(() => render());
  });
  document.querySelector("#switchConsolidado").addEventListener("click", () => {
    if (state.viewMode === "consolidado") return;
    state.viewMode = "consolidado";
    document.querySelector("#switchConsolidado").classList.add("active");
    document.querySelector("#switchEvolucao").classList.remove("active");
    renderAsync(() => render());
  });
  document.querySelector("#consolidadoChartPeriod").addEventListener("change", (e) => {
    state.consolidadoChartPeriod = e.target.value;
    if (state.viewMode === "consolidado") {
      const records = filterRecords(state.records, { includeMissing: true });
      renderConsolidadoDesempenho(records);
      renderConsolidadoParticipacao(records);
    }
  });
  document.querySelector("#consolidadoDonutPeriod").addEventListener("change", (e) => {
    state.consolidadoDonutPeriod = e.target.value;
    if (state.viewMode === "consolidado") {
      renderConsolidadoDonut(filterRecords(state.records, { includeMissing: true }));
    }
  });
  document.querySelector("#consolidadoDrePeriod").addEventListener("change", (e) => {
    state.consolidadoDrePeriod = e.target.value;
    if (state.viewMode === "consolidado") {
      renderConsolidadoDreChart(filterRecords(state.records, { includeMissing: true, includeSchool: false }));
    }
  });
  document.querySelector("#consolidadoSchoolSortBy").addEventListener("change", (e) => {
    state.consolidadoSchoolSortBy = e.target.value;
    if (state.viewMode === "consolidado") {
      renderConsolidadoSchoolTable(filterRecords(state.records, { includeMissing: true, includeSchool: false }));
    }
  });
  document.querySelector("#consolidadoSchoolSortDir").addEventListener("change", (e) => {
    state.consolidadoSchoolSortDir = e.target.value;
    if (state.viewMode === "consolidado") {
      renderConsolidadoSchoolTable(filterRecords(state.records, { includeMissing: true, includeSchool: false }));
    }
  });
  document.querySelector("#consolidadoSchoolPeriod").addEventListener("change", (e) => {
    state.consolidadoSchoolPeriod = e.target.value;
    if (state.viewMode === "consolidado") {
      renderConsolidadoSchoolTable(filterRecords(state.records, { includeMissing: true, includeSchool: false }));
    }
  });
  document.querySelector("#consolidado-school-table tbody").addEventListener("click", (e) => {
    const row = e.target.closest("[data-school-code]");
    if (!row) return;
    state.selectedSchool = row.dataset.schoolCode;
    syncDreForSchool(state.selectedSchool);
    document.querySelector("#schoolFilter").value = state.selectedSchool;
    renderAsync(() => render());
  });

  const appLayout = document.querySelector(".app-layout");
  const sidebarToggle = document.querySelector("#sidebarToggle");
  sidebarToggle.addEventListener("click", () => {
    const hidden = appLayout.classList.toggle("sidebar--hidden");
    sidebarToggle.innerHTML = hidden ? "&#8250;" : "&#8249;";
    sidebarToggle.setAttribute("aria-expanded", String(!hidden));
  });

  const resizer = document.querySelector(".sidebar-resizer");
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = document.querySelector(".sidebar").offsetWidth;
    resizer.classList.add("resizing");
    const onMove = (e) => {
      const w = Math.max(160, Math.min(480, startW + e.clientX - startX));
      document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    };
    const onUp = () => {
      resizer.classList.remove("resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  document.querySelectorAll(".table-dl-btn").forEach((btn) => {
    btn.addEventListener("click", () => exportTableXlsx(btn.dataset.table, btn.dataset.filename, btn.dataset.skipCol));
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("#exportConsolidadoWorkbook")) exportConsolidadoWorkbook();
  });

  const copyIcon = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="9" height="9" rx="1.5"/><path d="M5 3.5A1.5 1.5 0 0 1 6.5 2H13a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 13 11.5"/></svg>`;
  const copiedIcon = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7-7"/></svg>`;
  const expandIcon = `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2H2v4"/><path d="M2 2l5 5"/><path d="M10 14h4v-4"/><path d="M14 14l-5-5"/></svg>`;
  document.querySelectorAll("article.panel").forEach((panel) => {
    if (panel.querySelector(".table-wrap")) return;
    const head = panel.querySelector(".panel-head");
    if (!head) return;
    let actions = head.querySelector(".panel-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "panel-actions";
      head.appendChild(actions);
    }
    const fullBtn = document.createElement("button");
    fullBtn.className = "card-fullscreen-btn";
    fullBtn.type = "button";
    fullBtn.title = "Ver em tela cheia";
    fullBtn.setAttribute("aria-label", "Ver gráfico em tela cheia");
    fullBtn.innerHTML = expandIcon;
    fullBtn.addEventListener("click", () => openFullscreenPanel(panel));
    actions.appendChild(fullBtn);

    const btn = document.createElement("button");
    btn.className = "card-copy-btn";
    btn.type = "button";
    btn.title = "Copiar como imagem";
    btn.innerHTML = copyIcon;
    btn.addEventListener("click", async () => {
      if (typeof html2canvas === "undefined") { alert("Biblioteca de captura não disponível."); return; }
      btn.classList.add("copying");
      btn.disabled = true;
      try {
        const canvas = await html2canvas(panel, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          } catch {
            const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "grafico.png" });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }
          btn.innerHTML = copiedIcon;
          btn.classList.add("copied");
          setTimeout(() => { btn.innerHTML = copyIcon; btn.classList.remove("copied"); }, 2000);
        }, "image/png");
      } catch (err) {
        console.error("Erro ao capturar gráfico:", err);
      } finally {
        btn.classList.remove("copying");
        btn.disabled = false;
      }
    });
    actions.appendChild(btn);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFullscreenPanel();
  });

  setLoadProgress(0.92, "Renderizando painel…");
  render();
  setLoadProgress(1.0, "Pronto!");
  setTimeout(hideLoader, 120);
}

function closeFullscreenPanel() {
  const overlay = document.querySelector(".fullscreen-overlay");
  if (!overlay) return;
  overlay.remove();
  document.body.classList.remove("fullscreen-open");
}

function openFullscreenPanel(panel) {
  closeFullscreenPanel();
  const clone = panel.cloneNode(true);
  clone.querySelectorAll(".panel-actions, .card-copy-btn, .card-fullscreen-btn").forEach((node) => node.remove());
  clone.classList.add("fullscreen-panel");

  const overlay = document.createElement("div");
  overlay.className = "fullscreen-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Gráfico em tela cheia");
  overlay.innerHTML = `
    <div class="fullscreen-shell">
      <button class="fullscreen-close" type="button" aria-label="Fechar tela cheia" title="Fechar">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>
    </div>
  `;
  overlay.querySelector(".fullscreen-shell").appendChild(clone);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeFullscreenPanel();
  });
  overlay.querySelector(".fullscreen-close").addEventListener("click", closeFullscreenPanel);
  document.body.appendChild(overlay);
  document.body.classList.add("fullscreen-open");
  overlay.querySelector(".fullscreen-close").focus();
}

function parseExportValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const pctMatch = text.match(/^([+-]?\d+(?:,\d+)?)%$/);
  if (pctMatch) return Number(pctMatch[1].replace(",", ".")) / 100;
  const numberMatch = text.match(/^[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^[+-]?\d+(?:,\d+)?$/);
  if (numberMatch) return Number(text.replace(/\./g, "").replace(",", "."));
  return text;
}

function makeSheet(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const widths = [];
  rows.forEach((row) => {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] || 8, Math.min(42, String(cell ?? "").length + 2));
    });
  });
  ws["!cols"] = widths.map((wch) => ({ wch }));
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellRef];
      if (cell?.t === "n" && Math.abs(cell.v) <= 1 && String(rows[0]?.[col] || "").includes("%")) {
        cell.z = "0%";
      }
    }
  }
  return ws;
}

function getPeriodLabel(period) {
  return period === "initial" ? "Inicial" : "1º bimestre";
}

function distributionRows(records) {
  const rows = [["Período", getCategoryLabel(), getRecordNounTitle(), "%"]];
  [
    ["initial", consolidadoLevelStats(records, "initial")],
    ["final", consolidadoLevelStats(records, "final")],
  ].forEach(([period, stats]) => {
    [...getLevels(), "sem"].forEach((level) => {
      rows.push([
        getPeriodLabel(period),
        level === "sem" ? "Sem dado" : level,
        stats.counts[level] ?? 0,
        stats.pct[level] ?? 0,
      ]);
    });
  });
  return rows;
}

function schoolDistributionRows(records, period) {
  const field = period === "initial" ? "initial" : "final";
  const rows = [["Escola", "Código EOL Escola", "Total", ...getLevels().flatMap((level) => [level, `% ${level}`]), "Sem dado", "% Sem dado"]];
  const grouped = new Map();
  records.forEach((record) => {
    if (!record.schoolCode) return;
    if (!grouped.has(record.schoolCode)) grouped.set(record.schoolCode, { schoolCode: record.schoolCode, school: record.school, records: [] });
    grouped.get(record.schoolCode).records.push(record);
  });
  Array.from(grouped.values())
    .sort((a, b) => a.school.localeCompare(b.school, "pt-BR"))
    .forEach((group) => {
      const stats = consolidadoLevelStats(group.records, field);
      rows.push([
        group.school,
        group.schoolCode,
        stats.total,
        ...getLevels().flatMap((level) => [stats.counts[level], stats.pct[level]]),
        stats.counts.sem,
        stats.pct.sem,
      ]);
    });
  return rows;
}

function classExportRows(records) {
  const targetLabel = getTargetLabel();
  const rows = [["DRE", "Escola", "Código EOL Escola", "Turma", "Total", "Par válido", "% Par válido", "Sem dado Inicial", "% Sem dado Inicial", "Sem dado 1ºBI", "% Sem dado 1ºBI", "Sem par", "% Sem par", `${targetLabel} 1ºBI`, `% ${targetLabel} 1ºBI`, "Índice de Evolução"]];
  sortClassStats(classStats(records), "school", "asc").forEach((group) => {
    const dre = group.records[0]?.dre || "";
    const total = Math.max(1, group.total);
    rows.push([
      dre,
      group.school,
      group.schoolCode,
      group.className,
      group.total,
      group.pairedCount,
      group.pairedCount / total,
      group.missingInitial,
      group.missingInitial / total,
      group.missingFinal,
      group.missingFinal / total,
      group.missingPair,
      group.missingPair / total,
      group.finalAlphaCount,
      group.finalAlphaPct,
      group.avgGain,
    ]);
  });
  return rows;
}

function studentExportRows(records) {
  const rows = [["DRE", "Escola", "Código EOL Escola", "Ano", "Turma", "Questão", "Aluno", "Código EOL Estudante", "Inicial", "1º bimestre", "Ganho", "Situação", "Sem dado Inicial", "Sem dado 1ºBI"]];
  records
    .slice()
    .sort((a, b) => a.school.localeCompare(b.school, "pt-BR") || a.className.localeCompare(b.className, "pt-BR", { numeric: true }) || getStudentDisplayName(a).localeCompare(getStudentDisplayName(b), "pt-BR"))
    .forEach((record) => {
      rows.push([
        record.dre,
        record.school,
        record.schoolCode,
        record.ano,
        record.className,
        record.question || "",
        getStudentDisplayName(record),
        record.id,
        record.initial || "Sem dado",
        record.final || "Sem dado",
        record.gain ?? "",
        record.status,
        record.missingInitial ? "Sim" : "Não",
        record.missingFinal ? "Sim" : "Não",
      ]);
    });
  return rows;
}

function missingExportRows(records) {
  return studentExportRows(records.filter((record) => !record.hasPair));
}

function exportConsolidadoWorkbook() {
  if (typeof XLSX === "undefined") {
    alert("Biblioteca de exportação não disponível.");
    return;
  }
  const records = filterRecords(state.records, { includeMissing: true });
  const comparisonRecords = filterRecords(state.records, { includeMissing: true, includeSchool: false });
  const missing = missingStats(records);
  const initial = consolidadoLevelStats(records, "initial");
  const fin = consolidadoLevelStats(records, "final");
  const target = getTargetLevel();
  const targetLabel = getTargetLabel();
  const wb = XLSX.utils.book_new();
  const summaryRows = [
    ["Campo", "Valor"],
    ["Tipo de avaliação", getEvaluationConfig().label],
    ["Questão", isReadingEvaluation() ? (state.selectedQuestion === "__all__" ? "Todas as questões" : state.selectedQuestion) : getQuestions()[0]],
    ["DRE", state.selectedDre === "__all__" ? "Todas as DREs" : state.selectedDre],
    ["Escola", getSchoolLabel()],
    ["Ano", `${state.selectedAno}º ano`],
    [`Total de ${getRecordNoun()}`, records.length],
    ["Com par válido", missing.paired],
    ["% com par válido", missing.pairedPct],
    ["Sem dado Inicial", missing.missingInitial],
    ["% sem dado Inicial", missing.missingInitialPct],
    ["Sem dado 1ºBI", missing.missingFinal],
    ["% sem dado 1ºBI", missing.missingFinalPct],
    ["Sem par", missing.missingPair],
    ["% sem par", missing.missingPairPct],
    [`${targetLabel} Inicial`, initial.counts[target]],
    [`% ${targetLabel} Inicial`, initial.pct[target]],
    [`${targetLabel} 1ºBI`, fin.counts[target]],
    [`% ${targetLabel} 1ºBI`, fin.pct[target]],
  ];
  [
    ["Resumo", summaryRows],
    ["Distribuicao", distributionRows(records)],
    ["Escolas Final", schoolDistributionRows(comparisonRecords, "final")],
    ["Escolas Inicial", schoolDistributionRows(comparisonRecords, "initial")],
    ["Turmas", classExportRows(records)],
    ["Alunos", studentExportRows(records)],
    ["Sem dado", missingExportRows(records)],
  ].forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(wb, makeSheet(rows), name);
  });
  const scope = [
    state.selectedDre === "__all__" ? "todas-dres" : unformatLabel(state.selectedDre),
    state.selectedSchool === "__all__" ? "todas-escolas" : unformatLabel(getSchoolLabel()),
    unformatLabel(getEvaluationConfig().label),
    `${state.selectedAno}-ano`,
  ].join("_");
  XLSX.writeFile(wb, `consolidado-sondagem_${scope}.xlsx`);
}

function exportTableXlsx(tableId, filename, skipColStr) {
  if (typeof XLSX === "undefined") {
    alert("Biblioteca de exportação não disponível.");
    return;
  }
  const table = document.getElementById(tableId);
  if (!table) return;
  const skipCol = skipColStr !== undefined ? parseInt(skipColStr, 10) : -1;
  const rows = [];
  table.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("th, td")]
      .filter((_, i) => i !== skipCol)
      .map((cell) => parseExportValue(cell.innerText.trim().replace(/\s+/g, " ")));
    if (cells.length) rows.push(cells);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(rows), "Dados");
  XLSX.writeFile(wb, filename + ".xlsx");
}

init().catch((error) => {
  document.body.innerHTML = `<main><section class="panel"><h1>Não foi possível carregar o painel</h1><p>${error.message}</p></section></main>`;
});
