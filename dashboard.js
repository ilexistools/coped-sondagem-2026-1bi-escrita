const DATA_PATH = "data/lp_sistema_de_escrita.json";
const LEVELS = ["PS", "SSVC", "SCVC", "SA", "A"];
const SANKEY_LEVELS = [...LEVELS].reverse();
const LEVEL_SCORE = { PS: 1, SSVC: 2, SCVC: 3, SA: 4, A: 5 };
const LEVEL_COLORS = {
  PS: "#c43d3d",
  SSVC: "#d9851f",
  SCVC: "#d4ad26",
  SA: "#1f9a7a",
  A: "#1f6feb",
};
const STATUS_COLORS = {
  "Alta evolução": "#1a8f5a",
  "Evolução média": "#1f6feb",
  "Estável": "#b36b00",
  "Baixa": "#c43d3d",
};

const state = {
  records: [],
  schools: [],
  dres: [],
  anos: [],
  selectedDre: "__all__",
  selectedSchool: "__all__",
  selectedAno: "__all__",
  scatterXLevel: "PS",
  scatterYLevel: "A",
  rankingSortBy: "avgGain",
  rankingSortDir: "desc",
  search: "",
  classroomTabs: [],
  activeClassroomTabId: null,
};

const formatPct = (value) => `${Math.round(value * 100)}%`;
const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(value);
const formatDecimal = (value) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char]));

function parseJsonRows(text) {
  return JSON.parse(text.replace(/:\s*NaN(?=\s*[,}])/g, ": null"));
}

function parseTSV(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines.shift().split("\t");
  return lines.map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function normalizeLevel(value) {
  const raw = (value || "").trim().toUpperCase().replace(/_+$/, "");
  if (raw === "SSCV") return "SSVC";
  if (LEVEL_SCORE[raw]) return raw;
  return null;
}

function classifyGain(gain) {
  if (gain >= 2) return "Alta evolução";
  if (gain === 1) return "Evolução média";
  if (gain === 0) return "Estável";
  return "Baixa";
}

function buildStudentRecords(rows) {
  const byStudent = new Map();
  const invalid = { initial: 0, final: 0 };

  rows.forEach((row) => {
    if (row["Questão"] !== "Sistema de escrita") return;
    const studentId = row["Código EOL Estudante"];
    if (!studentId) return;
    const level = normalizeLevel(row["Resposta"]);
    const period = row["Bimestre"] === "Inicial" ? "initial" : row["Bimestre"] === "1° bimestre" ? "final" : null;
    if (!period) return;

    if (!byStudent.has(studentId)) {
      byStudent.set(studentId, {
        id: studentId,
        name: row["Nome Estudante"],
        schoolCode: row["Código EOL Escola"],
        school: row["Nome Escola"],
        dre: row["Nome DRE"],
        ano: row["Ano"],
        className: row["Nome Turma"],
        initial: null,
        final: null,
      });
    }

    const record = byStudent.get(studentId);
    if (level) {
      record[period] = level;
      record.school = row["Nome Escola"] || record.school;
      record.schoolCode = row["Código EOL Escola"] || record.schoolCode;
      record.className = row["Nome Turma"] || record.className;
    } else {
      invalid[period] += 1;
    }
  });

  const records = Array.from(byStudent.values()).map((record) => {
    const hasPair = Boolean(record.initial && record.final);
    const gain = hasPair ? LEVEL_SCORE[record.final] - LEVEL_SCORE[record.initial] : null;
    return {
      ...record,
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
  const initialAlpha = paired.filter((record) => record.initial === "A").length / total;
  const finalAlpha = paired.filter((record) => record.final === "A").length / total;
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
    const finalAlphaCount = summary.paired.filter((record) => record.final === "A").length;
    const initialAlphaCount = summary.paired.filter((record) => record.initial === "A").length;
    return {
      ...school,
      total: summary.total,
      improvedPct: summary.improved / summary.total,
      stablePct: summary.stable / summary.total,
      regressedPct: summary.regressed / summary.total,
      avgGain: summary.avgGain,
      initialPsPct: summary.paired.filter((record) => record.initial === "PS").length / summary.total,
      finalAlphaCount,
      initialAlphaCount,
      finalAlphaPct: summary.finalAlpha,
      alphaDeltaCount: finalAlphaCount - initialAlphaCount,
      alphaDeltaPct: summary.finalAlpha - summary.initialAlpha,
    };
  }).sort((a, b) => b.avgGain - a.avgGain || b.improvedPct - a.improvedPct);
}

function countByLevel(records, field) {
  const counts = Object.fromEntries(LEVELS.map((level) => [level, 0]));
  records.forEach((record) => {
    if (record[field]) counts[record[field]] += 1;
  });
  return counts;
}

function renderKpis(records) {
  const summary = summarize(records);
  const missingPair = filterRecords(state.records, { includeMissing: true }).filter((record) => !record.hasPair).length;
  const totalStudentsInScope = summary.paired.length + missingPair || 1;
  const finalAlphaCount = summary.paired.filter((record) => record.final === "A").length;
  const initialAlphaCount = summary.paired.filter((record) => record.initial === "A").length;
  const alphaCountDelta = finalAlphaCount - initialAlphaCount;
  const alphaDelta = summary.finalAlpha - summary.initialAlpha;

  const items = [
    ["Alfabéticos (1ºBI)", formatPct(summary.finalAlpha), `${formatNumber(finalAlphaCount)} alunos`, "Percentual e quantidade de alunos na hipótese A no 1º bimestre, entre alunos com par válido."],
    ["Alfabéticos (diferença)", `${alphaDelta >= 0 ? "+" : ""}${formatPct(alphaDelta)}`, `${alphaCountDelta >= 0 ? "+" : ""}${formatNumber(alphaCountDelta)} alunos`, "Diferença entre alunos na hipótese A no 1º bimestre e na avaliação inicial, em percentual e quantidade."],
    ["Alunos com par válido", formatPct(summary.paired.length / totalStudentsInScope), `${formatNumber(summary.paired.length)} alunos`, "Alunos com hipótese válida na avaliação inicial e no 1º bimestre; são os únicos usados nos cálculos de evolução."],
    ["Sem par válido", formatPct(missingPair / totalStudentsInScope), `${formatNumber(missingPair)} alunos`, "Alunos sem hipótese válida em um dos dois períodos; ficam fora dos cálculos de evolução."],
    ["Melhoraram", formatPct(summary.improved / summary.total), `${formatNumber(summary.improved)} alunos`, "Alunos cujo nível numérico aumentou entre a inicial e o 1º bimestre."],
    ["Mantiveram", formatPct(summary.stable / summary.total), `${formatNumber(summary.stable)} alunos`, "Alunos que permaneceram na mesma hipótese entre a inicial e o 1º bimestre."],
    ["Baixaram", formatPct(summary.regressed / summary.total), `${formatNumber(summary.regressed)} alunos`, "Alunos cujo nível numérico diminuiu entre a inicial e o 1º bimestre."],
    ["Índice de Evolução", formatDecimal(summary.avgGain), "Ganho médio de níveis", "Média dos ganhos de nível: PS=1, SSVC=2, SCVC=3, SA=4 e A=5."],
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
  const maxStroke = 34;
  const leftCounts = countByLevel(records, "initial");
  const rightCounts = countByLevel(records, "final");
  const matrix = LEVELS.flatMap((initial) =>
    LEVELS.map((final) => ({
      initial,
      final,
      count: records.filter((record) => record.initial === initial && record.final === final).length,
    })).filter((flow) => flow.count > 0)
  );
  const maxFlow = Math.max(1, ...matrix.map((flow) => flow.count));
  const height = 350;
  const rowGap = 58;
  const top = 68;
  const y = Object.fromEntries(SANKEY_LEVELS.map((level, index) => [level, top + index * rowGap]));

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
  const nodeBlock = (level, x, count) => `
    <rect x="${x}" y="${y[level] - 28}" width="116" height="56" rx="7" fill="${LEVEL_COLORS[level]}" opacity="0.96"></rect>
    <text x="${x + 58}" y="${y[level] - 5}" text-anchor="middle" fill="#fff" font-size="16" font-weight="850">${level}</text>
    <text class="node-meta" x="${x + 58}" y="${y[level] + 15}" text-anchor="middle">${formatNumber(count)} · ${formatPct(count / total)}</text>
  `;
  const nodes = SANKEY_LEVELS.map((level) => `
    <g>
      ${nodeBlock(level, 18, leftCounts[level])}
      ${nodeBlock(level, 646, rightCounts[level])}
    </g>
  `).join("");

  document.querySelector("#pairCount").textContent = `${formatNumber(records.length)} pares`;
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

  const renderPeriod = (title, counts) => `
    <div class="heatmap-period">
      <p class="mini-title">${title}</p>
      <table>
        <thead>
          <tr>
            <th>Hipótese</th>
            <th>Alunos</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          ${SANKEY_LEVELS.map((level) => {
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
  const stats = [...schoolStats(records)].sort((a, b) => {
    const direction = state.rankingSortDir === "asc" ? 1 : -1;
    const key = state.rankingSortBy;
    const aValue = a[key];
    const bValue = b[key];
    if (typeof aValue === "string" || typeof bValue === "string") {
      return direction * String(aValue).localeCompare(String(bValue), "pt-BR");
    }
    return direction * ((aValue || 0) - (bValue || 0));
  });
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

function renderDistribution(records) {
  const initial = countByLevel(records, "initial");
  const final = countByLevel(records, "final");
  const total = Math.max(1, records.length);

  const renderBars = (title, counts) => `
    <div>
      <p class="mini-title">${title}</p>
      ${SANKEY_LEVELS.map((level) => {
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
    const finalAlphaCount = paired.filter((record) => record.final === "A").length;
    const initialAlphaCount = paired.filter((record) => record.initial === "A").length;
    const improved = paired.filter((record) => record.gain > 0).length;
    const stable = paired.filter((record) => record.gain === 0).length;
    const regressed = paired.filter((record) => record.gain < 0).length;
    const avgGain = paired.reduce((sum, record) => sum + record.gain, 0) / pairedTotal;
    return {
      ...group,
      total,
      pairedCount: paired.length,
      missingPair: total - paired.length,
      finalAlphaCount,
      alphaDeltaCount: finalAlphaCount - initialAlphaCount,
      finalAlphaPct: finalAlphaCount / pairedTotal,
      improvedPct: improved / pairedTotal,
      stablePct: stable / pairedTotal,
      regressedPct: regressed / pairedTotal,
      avgGain,
    };
  }).sort((a, b) =>
    a.school.localeCompare(b.school, "pt-BR") ||
    a.className.localeCompare(b.className, "pt-BR", { numeric: true })
  );
}

function renderClassesTable(records) {
  const rows = classStats(records).map((group) => {
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
    <tr><td colspan="11" class="empty-table">Nenhuma turma encontrada para o recorte atual.</td></tr>
  `;
}

function renderStudents(records) {
  const term = state.search.trim().toLocaleLowerCase("pt-BR");
  const focus = records
    .filter((record) => record.gain <= 0 || record.gain >= 2)
    .filter((record) => !term || `${record.name} ${record.school}`.toLocaleLowerCase("pt-BR").includes(term))
    .sort((a, b) => a.gain - b.gain || a.school.localeCompare(b.school, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 220);

  document.querySelector("#studentsTable tbody").innerHTML = focus.map((record) => `
    <tr>
      <td><strong>${escapeHtml(record.name)}</strong></td>
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
  `).join("");
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

function getFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "Aluno";
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
  const groups = LEVELS.map((level) => ({
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
        <p class="classroom-subtitle">${escapeHtml(schoolName)} · ${formatNumber(records.length)} alunos no recorte</p>
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
            <div class="student-cloud" aria-label="${group.level}: ${formatNumber(count)} alunos">
              ${group.records.map((record) => `
                <span class="student-marker" style="--student-color:${group.color}" title="${escapeHtml(record.name)} · ${group.level}">
                  ${evolutionMarker(record, period)}
                  <span class="student-head"></span>
                  <span class="student-body"></span>
                  <span class="student-name">${escapeHtml(getFirstName(record.name))}</span>
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

function getSchoolLabel() {
  if (state.selectedSchool === "__all__") return "Todas as escolas";
  return state.schools.find(([code]) => code === state.selectedSchool)?.[1] || "Escola selecionada";
}

function renderFilterSummary(records) {
  const filters = [
    ["DRE", state.selectedDre === "__all__" ? "Todas as DREs" : state.selectedDre],
    ["Escola", getSchoolLabel()],
    ["Ano", state.selectedAno === "__all__" ? "Todos os anos" : `${state.selectedAno}º ano`],
    ["Alunos no recorte", formatNumber(records.length)],
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
  const anos = Array.from(new Set(state.records.map((r) => r.ano).filter(Boolean)))
    .sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b), "pt-BR"));
  state.dres = dres;
  state.anos = anos;
  document.querySelector("#dreFilter").innerHTML =
    `<option value="__all__">Todas as DREs</option>` +
    dres.map((dre) => `<option value="${escapeHtml(dre)}">${escapeHtml(dre)}</option>`).join("");
  document.querySelector("#anoFilter").innerHTML =
    `<option value="__all__">Todos os anos</option>` +
    anos.map((ano) => `<option value="${escapeHtml(ano)}">${escapeHtml(ano)}º ano</option>`).join("");
  populateSchoolFilter();
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
  const records = filterRecords(state.records);
  const recordsInScope = filterRecords(state.records, { includeMissing: true });
  const comparisonRecords = filterRecords(state.records, { includeSchool: false });
  renderFilterSummary(recordsInScope);
  renderKpis(records);
  renderSankey(records);
  renderHeatmap(records);
  renderDistribution(records);
  renderVelocity(records);
  renderRanking(comparisonRecords);
  renderScatter(comparisonRecords);
  renderClassesTable(recordsInScope);
  renderStudents(records);
  renderClassroomTabs();
}

async function init() {
  const response = await fetch(DATA_PATH);
  if (!response.ok) throw new Error(`Falha ao carregar ${DATA_PATH}`);
  const rows = parseJsonRows(await response.text());
  state.records = buildStudentRecords(rows);
  populateFilters();

  document.querySelector("#dreFilter").addEventListener("change", (event) => {
    state.selectedDre = event.target.value;
    populateSchoolFilter();
    render();
  });
  document.querySelector("#anoFilter").addEventListener("change", (event) => {
    state.selectedAno = event.target.value;
    populateSchoolFilter();
    render();
  });
  document.querySelector("#schoolFilter").addEventListener("change", (event) => {
    state.selectedSchool = event.target.value;
    render();
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
  document.querySelector("#rankingTable tbody").addEventListener("click", (event) => {
    const row = event.target.closest("[data-school-code]");
    if (!row) return;
    state.selectedSchool = row.dataset.schoolCode;
    document.querySelector("#schoolFilter").value = state.selectedSchool;
    render();
  });
  document.querySelector("#studentSearch").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderStudents(filterRecords(state.records));
  });
  document.querySelector("#studentsTable tbody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-classroom-open]");
    if (!button) return;
    openClassroomTab(button.dataset.schoolCode, button.dataset.className);
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

  render();
}

init().catch((error) => {
  document.body.innerHTML = `<main><section class="panel"><h1>Não foi possível carregar o painel</h1><p>${error.message}</p></section></main>`;
});
