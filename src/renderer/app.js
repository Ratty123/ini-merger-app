(function () {
  const api = window.iniMergerAPI;
  const mergeCore = window.IniMergeCore;
  const structureTools = window.IniStructureTools;

  const LEGACY_PROFILE_STORAGE_KEY = 'ini-merger-app.profiles.v2';
  const APP_CONFIG_VERSION = 1;
  const DEFAULT_PREVIEW_FONT_SIZE = 12;
  const DEFAULT_PREVIEW_LINE_HEIGHT = 1.35;
  const RULE_PRESETS = [
    {
      id: 'balanced',
      label: 'Balanced',
      description: 'Highest priority wins. Duplicates are removed by default.',
      defaultConflictStrategy: 'highest',
      defaultDuplicateStrategy: 'remove'
    },
    {
      id: 'base-first',
      label: 'Base First',
      description: 'Lowest priority wins. Duplicates are removed by default.',
      defaultConflictStrategy: 'lowest',
      defaultDuplicateStrategy: 'remove'
    },
    {
      id: 'preserve-all',
      label: 'Preserve All Copies',
      description: 'Highest priority wins. Duplicate groups keep every copy.',
      defaultConflictStrategy: 'highest',
      defaultDuplicateStrategy: 'keep'
    }
  ];

  const PREVIEW_PLACEHOLDER = [
    '; Merged output preview',
    '; Add files and click Build Merge'
  ].join('\n');

  const DIFF_PLACEHOLDER = [
    '--- Default merge',
    '+++ Current merge',
    '',
    'Build a merge to compare changes against the preset defaults.'
  ].join('\n');

  const WELL_KNOWN_UNREAL_SECTIONS = new Map([
    ['core.system', 'Core system paths and startup lists'],
    ['systemsettings', 'Console variables and system settings'],
    ['systemsettingseditor', 'Editor-only console variables and system settings'],
    ['consolevariables', 'Console variable startup overrides'],
    ['startup', 'Console variable startup overrides'],
    ['texturestreaming', 'Legacy texture streaming settings']
  ]);

  const CVAR_PREFIX_RECOMMENDATIONS = [
    { prefix: 'd3d12.', sectionName: '/Script/D3D12RHI.D3D12Options', hint: 'D3D12 RHI option' },
    { prefix: 'r.d3d12.', sectionName: '/Script/D3D12RHI.D3D12Options', hint: 'D3D12 renderer option' },
    { prefix: 'rhi.', sectionName: '/Script/Engine.RendererSettings', hint: 'RHI or renderer subsystem setting' },
    { prefix: 'r.rhicmd', sectionName: '/Script/Engine.RendererSettings', hint: 'RHI command submission setting' },
    { prefix: 'r.rdg.', sectionName: '/Script/Engine.RendererSettings', hint: 'Render graph setting' },
    { prefix: 'r.lumen.', sectionName: '/Script/Engine.RendererSettings', hint: 'Lumen renderer setting' },
    { prefix: 'r.lumenscene.', sectionName: '/Script/Engine.RendererSettings', hint: 'Lumen scene renderer setting' },
    { prefix: 'r.shadow.', sectionName: '/Script/Engine.RendererSettings', hint: 'Shadow renderer setting' },
    { prefix: 'r.nanite.', sectionName: '/Script/Engine.RendererSettings', hint: 'Nanite renderer setting' },
    { prefix: 'r.tsr.', sectionName: '/Script/Engine.RendererSettings', hint: 'Temporal Super Resolution setting' },
    { prefix: 'r.temporalaa', sectionName: '/Script/Engine.RendererSettings', hint: 'Temporal anti-aliasing setting' },
    { prefix: 'r.ssr.', sectionName: '/Script/Engine.RendererSettings', hint: 'Screen-space reflection setting' },
    { prefix: 'r.ambientocclusion', sectionName: '/Script/Engine.RendererSettings', hint: 'Ambient occlusion renderer setting' },
    { prefix: 'r.volumetricfog.', sectionName: '/Script/Engine.RendererSettings', hint: 'Volumetric fog setting' },
    { prefix: 'r.volumetriccloud.', sectionName: '/Script/Engine.RendererSettings', hint: 'Volumetric cloud setting' },
    { prefix: 'r.skyatmosphere.', sectionName: '/Script/Engine.RendererSettings', hint: 'Sky atmosphere setting' },
    { prefix: 'r.ngx.', sectionName: '/Script/Engine.RendererSettings', hint: 'DLSS / NGX setting' },
    { prefix: 'r.xess.', sectionName: '/Script/Engine.RendererSettings', hint: 'XeSS setting' },
    { prefix: 'r.streamline.', sectionName: '/Script/Engine.RendererSettings', hint: 'Streamline upscaling or frame generation setting' },
    { prefix: 'r.fidelityfx.', sectionName: '/Script/Engine.RendererSettings', hint: 'FidelityFX / FSR setting' },
    { prefix: 'r.nis.', sectionName: '/Script/Engine.RendererSettings', hint: 'NIS upscaling setting' },
    { prefix: 'r.streaming.', sectionName: '/Script/Engine.StreamingSettings', hint: 'Texture or asset streaming setting' },
    { prefix: 'r.texturestreaming', sectionName: '/Script/Engine.StreamingSettings', hint: 'Texture streaming setting' },
    { prefix: 's.', sectionName: '/Script/Engine.StreamingSettings', hint: 'Streaming subsystem setting' },
    { prefix: 'fx.niagara', sectionName: '/Script/Niagara.NiagaraSettings', hint: 'Niagara setting' },
    { prefix: 'fx.', sectionName: '/Script/Niagara.NiagaraSettings', hint: 'FX or Niagara setting' },
    { prefix: 'au.', sectionName: '/Script/Engine.AudioSettings', hint: 'Audio setting' },
    { prefix: 'gc.', sectionName: '/Script/Engine.GarbageCollectionSettings', hint: 'Garbage collection setting' },
    { prefix: 'log', sectionName: 'Core.Log', hint: 'Logging category override' },
    { prefix: 'sg.', sectionName: 'SystemSettings', hint: 'Scalability console variable' },
    { prefix: 'foliage.', sectionName: 'SystemSettings', hint: 'Foliage console variable' },
    { prefix: 'grass.', sectionName: 'SystemSettings', hint: 'Grass console variable' },
    { prefix: 'r.', sectionName: 'SystemSettings', hint: 'Renderer console variable' }
  ];

  const state = {
    files: [],
    availableSections: [],
    excludedSections: [],
    sectionSelectionDraft: [],
    sectionSearchQuery: '',
    mergeModel: null,
    mergedContent: '',
    defaultMergedContent: '',
    activeConflictId: null,
    activeDuplicateId: null,
    isConflictModalOpen: false,
    isDuplicateModalOpen: false,
    isSectionsModalOpen: false,
    isProfilesModalOpen: false,
    isStructureModalOpen: false,
    previewMode: 'merged',
    rulePresetId: 'balanced',
    cleanupMode: 'preserve',
    structureMode: 'off',
    consoleVariableLayout: 'flat',
    searchQuery: '',
    profiles: loadLegacyProfiles(),
    profileDraftName: '',
    previewFontSize: DEFAULT_PREVIEW_FONT_SIZE,
    previewLineHeight: DEFAULT_PREVIEW_LINE_HEIGHT,
    previewShowLineNumbers: true,
    structuralReport: null,
    consoleVariableCategorySummary: []
  };

  let autosaveTimer = null;
  let autosaveReady = false;
  let lastSavedConfigJson = '';

  const elements = {
    addFilesBtn: document.getElementById('addFilesBtn'),
    mergeBtn: document.getElementById('mergeBtn'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    reviewConflictBtn: document.getElementById('reviewConflictBtn'),
    reviewStructureBtn: document.getElementById('reviewStructureBtn'),
    reviewDuplicatesBtn: document.getElementById('reviewDuplicatesBtn'),
    statusBadge: document.getElementById('statusBadge'),
    statusMessage: document.getElementById('statusMessage'),
    summaryBar: document.getElementById('summaryBar'),
    autosaveMeta: document.getElementById('autosaveMeta'),
    searchInput: document.getElementById('searchInput'),
    rulePresetSelect: document.getElementById('rulePresetSelect'),
    cleanupModeSelect: document.getElementById('cleanupModeSelect'),
    structureModeSelect: document.getElementById('structureModeSelect'),
    sectionFilterBtn: document.getElementById('sectionFilterBtn'),
    profilesBtn: document.getElementById('profilesBtn'),
    previewMergedBtn: document.getElementById('previewMergedBtn'),
    previewDiffBtn: document.getElementById('previewDiffBtn'),
    previewFontSizeSelect: document.getElementById('previewFontSizeSelect'),
    previewLineHeightSelect: document.getElementById('previewLineHeightSelect'),
    toggleLineNumbersBtn: document.getElementById('toggleLineNumbersBtn'),
    fileList: document.getElementById('fileList'),
    useDefaultsBtn: document.getElementById('useDefaultsBtn'),
    resetReviewBtn: document.getElementById('resetReviewBtn'),
    applySectionSourceBtn: document.getElementById('applySectionSourceBtn'),
    previewNote: document.getElementById('previewNote'),
    previewMeta: document.getElementById('previewMeta'),
    previewOutput: document.getElementById('previewOutput'),
    conflictMeta: document.getElementById('conflictMeta'),
    conflictList: document.getElementById('conflictList'),
    conflictModal: document.getElementById('conflictModal'),
    conflictModalBackdrop: document.getElementById('conflictModalBackdrop'),
    conflictModalTitle: document.getElementById('conflictModalTitle'),
    conflictModalMeta: document.getElementById('conflictModalMeta'),
    conflictModalOptions: document.getElementById('conflictModalOptions'),
    closeConflictModalBtn: document.getElementById('closeConflictModalBtn'),
    applyConflictToSectionBtn: document.getElementById('applyConflictToSectionBtn'),
    keepCurrentConflictBtn: document.getElementById('keepCurrentConflictBtn'),
    duplicateModal: document.getElementById('duplicateModal'),
    duplicateModalBackdrop: document.getElementById('duplicateModalBackdrop'),
    duplicateModalTitle: document.getElementById('duplicateModalTitle'),
    duplicateModalMeta: document.getElementById('duplicateModalMeta'),
    duplicateModalOptions: document.getElementById('duplicateModalOptions'),
    closeDuplicateModalBtn: document.getElementById('closeDuplicateModalBtn'),
    removeAllDuplicatesBtn: document.getElementById('removeAllDuplicatesBtn'),
    keepAllDuplicatesBtn: document.getElementById('keepAllDuplicatesBtn'),
    removeDuplicateBtn: document.getElementById('removeDuplicateBtn'),
    keepDuplicateBtn: document.getElementById('keepDuplicateBtn'),
    sectionsModal: document.getElementById('sectionsModal'),
    sectionsModalBackdrop: document.getElementById('sectionsModalBackdrop'),
    sectionsModalMeta: document.getElementById('sectionsModalMeta'),
    closeSectionsModalBtn: document.getElementById('closeSectionsModalBtn'),
    sectionSearchInput: document.getElementById('sectionSearchInput'),
    selectAllSectionsBtn: document.getElementById('selectAllSectionsBtn'),
    clearSectionsBtn: document.getElementById('clearSectionsBtn'),
    sectionList: document.getElementById('sectionList'),
    applySectionsBtn: document.getElementById('applySectionsBtn'),
    profilesModal: document.getElementById('profilesModal'),
    profilesModalBackdrop: document.getElementById('profilesModalBackdrop'),
    profilesModalMeta: document.getElementById('profilesModalMeta'),
    closeProfilesModalBtn: document.getElementById('closeProfilesModalBtn'),
    profileNameInput: document.getElementById('profileNameInput'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    profileList: document.getElementById('profileList'),
    structureModal: document.getElementById('structureModal'),
    structureModalBackdrop: document.getElementById('structureModalBackdrop'),
    structureModalMeta: document.getElementById('structureModalMeta'),
    closeStructureModalBtn: document.getElementById('closeStructureModalBtn'),
    structureList: document.getElementById('structureList'),
    autoCleanStructureBtn: document.getElementById('autoCleanStructureBtn'),
    categorizeConsoleVariablesBtn: document.getElementById('categorizeConsoleVariablesBtn'),
    resetStructureToolsBtn: document.getElementById('resetStructureToolsBtn')
  };

  function loadLegacyProfiles() {
    try {
      const raw = window.localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function persistProfiles() {
    scheduleAutosave();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function createElement(tagName, className, text) {
    const node = document.createElement(tagName);

    if (className) {
      node.className = className;
    }

    if (typeof text === 'string') {
      node.textContent = text;
    }

    return node;
  }

  function createButton(label, className, onClick, disabled) {
    const button = createElement('button', className, label);
    button.type = 'button';
    button.disabled = Boolean(disabled);
    button.addEventListener('click', onClick);
    return button;
  }

  function createEmptyState(message) {
    return createElement('div', 'empty-state', message);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightText(text, query) {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
      return escapeHtml(text);
    }

    const source = String(text);
    const lower = source.toLowerCase();
    let cursor = 0;
    let html = '';

    while (cursor < source.length) {
      const matchIndex = lower.indexOf(normalizedQuery, cursor);

      if (matchIndex === -1) {
        html += escapeHtml(source.slice(cursor));
        break;
      }

      html += escapeHtml(source.slice(cursor, matchIndex));
      html += `<mark>${escapeHtml(source.slice(matchIndex, matchIndex + normalizedQuery.length))}</mark>`;
      cursor = matchIndex + normalizedQuery.length;
    }

    return html;
  }

  function isPreviewCommentLine(line) {
    return /^\s*[;#]/.test(line);
  }

  function isPreviewSectionLine(line) {
    return /^\s*\[[^\]]+\]\s*$/.test(line);
  }

  function splitInlineComment(line) {
    const match = line.match(/^(.*?)(\s+[;#].*)$/);

    if (!match) {
      return {
        body: line,
        comment: ''
      };
    }

    return {
      body: match[1],
      comment: match[2]
    };
  }

  function createPreviewLineContent(line, query, mode) {
    if (mode === 'diff') {
      return `<span class="syntax-text">${highlightText(line || ' ', query)}</span>`;
    }

    if (line === '') {
      return '<span class="syntax-text">&nbsp;</span>';
    }

    if (isPreviewCommentLine(line)) {
      return `<span class="syntax-comment">${highlightText(line, query)}</span>`;
    }

    if (isPreviewSectionLine(line)) {
      return `<span class="syntax-section">${highlightText(line, query)}</span>`;
    }

    const match = line.match(/^(\s*)([+\-\.!]?)([^=]+?)(\s*=\s*)(.*)$/);

    if (!match) {
      return `<span class="syntax-text">${highlightText(line, query)}</span>`;
    }

    const leading = match[1];
    const operator = match[2];
    const key = match[3];
    const separator = match[4];
    const remainder = splitInlineComment(match[5]);
    let html = '';

    if (leading) {
      html += `<span class="syntax-text">${escapeHtml(leading)}</span>`;
    }

    html += `<span class="syntax-key">${highlightText(`${operator}${key}`, query)}</span>`;
    html += `<span class="syntax-operator">${escapeHtml(separator)}</span>`;

    if (remainder.body) {
      html += `<span class="syntax-value">${highlightText(remainder.body, query)}</span>`;
    }

    if (remainder.comment) {
      html += `<span class="syntax-comment">${highlightText(remainder.comment, query)}</span>`;
    }

    return html || '<span class="syntax-text">&nbsp;</span>';
  }

  function createPreviewMarkup(text, query, mode) {
    return String(text)
      .split(/\r?\n/)
      .map((line, index) => {
        let lineClass = 'preview-line';

        if (mode === 'diff') {
          if (line.startsWith('+ ')) {
            lineClass += ' preview-line--added';
          } else if (line.startsWith('- ')) {
            lineClass += ' preview-line--removed';
          } else if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass += ' preview-line--header';
          }
        } else if (isPreviewSectionLine(line)) {
          lineClass += ' preview-line--section';
        } else if (isPreviewCommentLine(line)) {
          lineClass += ' preview-line--comment';
        }

        const gutter = state.previewShowLineNumbers
          ? `<span class="preview-gutter">${index + 1}</span>`
          : '';

        return `<div class="${lineClass}">${gutter}<span class="preview-code">${createPreviewLineContent(line, query, mode)}</span></div>`;
      })
      .join('');
  }

  function countQueryMatches(text, query) {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
      return 0;
    }

    const source = String(text).toLowerCase();
    let matchCount = 0;
    let cursor = 0;

    while (cursor < source.length) {
      const index = source.indexOf(normalizedQuery, cursor);

      if (index === -1) {
        break;
      }

      matchCount += 1;
      cursor = index + normalizedQuery.length;
    }

    return matchCount;
  }

  function getCleanupLabel(cleanupMode) {
    switch (cleanupMode) {
      case 'smart':
        return 'Smart cleanup';
      case 'minimal':
        return 'Minimal output';
      default:
        return 'Comments preserved';
    }
  }

  function getStructureModeLabel(structureMode) {
    switch (structureMode) {
      case 'warn':
        return 'Structural warnings enabled';
      case 'clean':
        return 'Loose structural lines cleaned';
      default:
        return 'Structural cleanup off';
    }
  }

  function getConsoleVariableLayoutLabel(layout) {
    return layout === 'categorized'
      ? 'Console variables grouped by category'
      : 'Console variables kept flat';
  }

  function isSectionHeaderLine(line) {
    return /^\s*\[[^\]]+\]\s*$/.test(line);
  }

  function parsePreviewSectionName(line) {
    const match = String(line).trim().match(/^\[(.+)\]$/);
    return match ? match[1].trim() : '';
  }

  function parsePreviewAssignmentLine(line) {
    const match = String(line).trim().match(/^([+\-\.!]?)([^=]+?)\s*=\s*(.*)$/);

    if (!match) {
      return null;
    }

    return {
      operator: match[1] || '',
      key: match[2].trim(),
      normalizedKey: normalizeText(match[2]),
      value: match[3]
    };
  }

  function classifyUnrealSection(sectionName) {
    const normalizedName = normalizeText(sectionName);

    if (WELL_KNOWN_UNREAL_SECTIONS.has(normalizedName)) {
      return {
        family: 'known',
        confidence: 'high',
        description: WELL_KNOWN_UNREAL_SECTIONS.get(normalizedName)
      };
    }

    if (/^\/script\/[a-z0-9_]+\.[a-z0-9_]+$/i.test(sectionName)) {
      return {
        family: 'script-class',
        confidence: 'high',
        description: 'Class-backed Unreal config section'
      };
    }

    if (/^\/.+\.[a-z0-9_]+$/i.test(sectionName)) {
      return {
        family: 'asset',
        confidence: 'medium',
        description: 'Asset-backed Unreal config section'
      };
    }

    return {
      family: 'custom',
      confidence: 'low',
      description: 'Custom or unverified section name'
    };
  }

  function getRecommendedSectionForKey(key) {
    const normalizedKey = normalizeText(key);

    if (!normalizedKey) {
      return null;
    }

    if (normalizedKey === 'paths' || normalizedKey.endsWith('paths')) {
      return {
        sectionName: 'Core.System',
        hint: 'Path list setting'
      };
    }

    if (['platformformat', 'platformstreamingformat'].includes(normalizedKey)) {
      return {
        sectionName: '/Script/Engine.AudioSettings',
        hint: 'Audio platform format setting'
      };
    }

    if (['bdisablemouseacceleration', 'benablemousesmoothing', 'brawmouseinput', 'rawmouseinputenabled', 'bviewaccelerationenabled'].includes(normalizedKey)) {
      return {
        sectionName: 'Engine.InputSettings',
        hint: 'Input setting'
      };
    }

    if (normalizedKey.startsWith('ballowshader') || normalizedKey.startsWith('basyncshader') || normalizedKey.startsWith('maxshader') || normalizedKey.startsWith('numunusedshader')) {
      return {
        sectionName: 'ShaderCompiler',
        hint: 'Shader compiler setting'
      };
    }

    return CVAR_PREFIX_RECOMMENDATIONS.find((item) => normalizedKey.startsWith(item.prefix)) || null;
  }

  function analyzeStructure(text) {
    const lines = String(text || '').split(/\r?\n/);
    const issues = [];
    const seenUnverifiedSections = new Set();
    let currentSection = null;

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();

      if (!trimmed || isPreviewCommentLine(line)) {
        return;
      }

      if (isSectionHeaderLine(line)) {
        currentSection = parsePreviewSectionName(line);
        const sectionInfo = classifyUnrealSection(currentSection);

        if (sectionInfo.family === 'custom' && !seenUnverifiedSections.has(normalizeText(currentSection))) {
          seenUnverifiedSections.add(normalizeText(currentSection));
          issues.push({
            id: `section:${normalizeText(currentSection)}`,
            type: 'unverified-section',
            severity: 'info',
            lineNumber,
            sectionName: currentSection,
            line,
            message: `"${currentSection}" is not in the built-in generic Unreal section list.`,
            recommendation: 'Kept as-is. Review manually if this is supposed to be a standard engine section.'
          });
        }

        return;
      }

      const assignment = parsePreviewAssignmentLine(line);

      if (!currentSection) {
        issues.push({
          id: `line:${lineNumber}`,
          type: 'loose-line',
          severity: 'warning',
          lineNumber,
          sectionName: null,
          line,
          message: 'Loose text exists outside any INI section.',
          recommendation: 'Safe to remove. Real Unreal settings should live under a section header.'
        });
        return;
      }

      if (!assignment) {
        issues.push({
          id: `line:${lineNumber}`,
          type: 'loose-line',
          severity: 'warning',
          lineNumber,
          sectionName: currentSection,
          line,
          message: `Loose text inside [${currentSection}] is not a real INI assignment.`,
          recommendation: 'Safe to remove. Decorative dividers, headings, credits, and prose should not be merged into the final INI.'
        });
        return;
      }

      const sectionInfo = classifyUnrealSection(currentSection);
      const recommendation = getRecommendedSectionForKey(assignment.key);

      if (sectionInfo.family === 'custom' && recommendation) {
        issues.push({
          id: `hint:${lineNumber}`,
          type: 'suggested-section',
          severity: 'info',
          lineNumber,
          sectionName: currentSection,
          line,
          message: `${recommendation.hint} appears inside an unverified section.`,
          recommendation: `Review whether "${assignment.key}" belongs under [${recommendation.sectionName}] instead of [${currentSection}].`
        });
      }
    });

    return {
      issues,
      summary: {
        issueCount: issues.length,
        looseLineCount: issues.filter((issue) => issue.type === 'loose-line').length,
        unverifiedSectionCount: issues.filter((issue) => issue.type === 'unverified-section').length,
        suggestedMoveCount: issues.filter((issue) => issue.type === 'suggested-section').length,
        reviewIssueCount: issues.filter((issue) => issue.type !== 'loose-line').length
      }
    };
  }

  function removeStructuralLooseLines(text, report) {
    if (!report || report.summary.looseLineCount === 0) {
      return String(text || '');
    }

    const looseLineNumbers = new Set(
      report.issues
        .filter((issue) => issue.type === 'loose-line')
        .map((issue) => issue.lineNumber)
    );

    return String(text || '')
      .split(/\r?\n/)
      .filter((line, index) => !looseLineNumbers.has(index + 1))
      .join('\r\n')
      .replace(/(\r\n){3,}/g, '\r\n\r\n')
      .replace(/^\s+|\s+$/g, '');
  }

  function buildRenderedOutput(text) {
    const baseText = String(text || '');
    const structuralReport = analyzeStructure(baseText);
    let processedText = state.structureMode === 'clean'
      ? removeStructuralLooseLines(baseText, structuralReport)
      : baseText;
    let categorySummary = [];

    if (state.consoleVariableLayout === 'categorized' && structureTools?.organizeConsoleVariablesText) {
      const organized = structureTools.organizeConsoleVariablesText(processedText);
      processedText = organized.text;
      categorySummary = Array.isArray(organized.categorySummary) ? organized.categorySummary : [];
    }

    return {
      text: processedText,
      structuralReport: state.structureMode === 'off'
        ? {
            issues: [],
          summary: {
            issueCount: 0,
            looseLineCount: 0,
            unverifiedSectionCount: 0,
            suggestedMoveCount: 0,
            reviewIssueCount: 0
          }
        }
        : structuralReport,
      consoleVariableCategorySummary: categorySummary
    };
  }

  function getRenderOptions() {
    return {
      cleanupMode: state.cleanupMode
    };
  }

  function clampPreviewFontSize(value) {
    const numeric = Number(value);

    if (Number.isNaN(numeric)) {
      return DEFAULT_PREVIEW_FONT_SIZE;
    }

    return Math.max(11, Math.min(16, numeric));
  }

  function clampPreviewLineHeight(value) {
    const numeric = Number(value);

    if (Number.isNaN(numeric)) {
      return DEFAULT_PREVIEW_LINE_HEIGHT;
    }

    return Math.max(1.2, Math.min(1.7, numeric));
  }

  function setAutosaveMeta(text, tone) {
    elements.autosaveMeta.textContent = text;
    elements.autosaveMeta.dataset.tone = tone;
  }

  function buildConfigPayload() {
    const serializedProfiles = state.profiles.map((profile) => {
      const filePaths = Array.isArray(profile.session?.filePaths)
        ? profile.session.filePaths
        : Array.isArray(profile.session?.files)
          ? profile.session.files.map((file) => file.path).filter(Boolean)
          : [];

      return {
        ...clone(profile),
        session: {
          ...clone(profile.session || {}),
          filePaths
        }
      };
    }).map((profile) => {
      if (profile.session && Object.prototype.hasOwnProperty.call(profile.session, 'files')) {
        delete profile.session.files;
      }

      return profile;
    });

    return {
      version: APP_CONFIG_VERSION,
      workspace: {
        filePaths: state.files.map((file) => file.path),
        rulePresetId: state.rulePresetId,
        cleanupMode: state.cleanupMode,
        structureMode: state.structureMode,
        consoleVariableLayout: state.consoleVariableLayout,
        previewMode: state.previewMode,
        previewFontSize: state.previewFontSize,
        previewLineHeight: state.previewLineHeight,
        previewShowLineNumbers: state.previewShowLineNumbers,
        excludedSections: clone(state.excludedSections),
        searchQuery: state.searchQuery,
        profileDraftName: state.profileDraftName,
        selectionSnapshot: createSelectionSnapshot()
      },
      profiles: serializedProfiles
    };
  }

  async function saveConfigNow() {
    if (!autosaveReady) {
      return;
    }

    const payload = buildConfigPayload();
    const nextJson = JSON.stringify(payload);

    if (nextJson === lastSavedConfigJson) {
      return;
    }

    const result = await api.saveConfig(payload);

    if (result?.success) {
      lastSavedConfigJson = nextJson;
      setAutosaveMeta(`Autosave: ${result.path}`, 'success');
      return;
    }

    setAutosaveMeta(`Autosave failed: ${result?.error || 'unknown error'}`, 'error');
  }

  function scheduleAutosave() {
    if (!autosaveReady) {
      return;
    }

    clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      saveConfigNow().catch((error) => {
        setAutosaveMeta(`Autosave failed: ${error.message}`, 'error');
      });
    }, 250);
  }

  async function restoreFilesFromConfig(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      state.files = [];
      return { loaded: 0, missing: [] };
    }

    const result = await api.loadFilesByPath(filePaths);

    if (!result || result.error) {
      throw new Error(result?.error || 'Unable to restore saved files.');
    }

    state.files = Array.isArray(result.files) ? result.files : [];
    return {
      loaded: state.files.length,
      missing: Array.isArray(result.missingPaths) ? result.missingPaths : []
    };
  }

  async function loadInitialConfig() {
    setAutosaveMeta('Autosave: loading session', 'idle');

    try {
      const result = await api.loadConfig();

      if (!result?.success) {
        autosaveReady = true;
        setAutosaveMeta(`Autosave: ${result?.error || 'config unavailable'}`, 'error');
        refresh();
        return;
      }

      const config = result.config || {};
      const workspace = config.workspace || {};

      if (Array.isArray(config.profiles)) {
        state.profiles = config.profiles;
      }

      state.rulePresetId = RULE_PRESETS.some((preset) => preset.id === workspace.rulePresetId)
        ? workspace.rulePresetId
        : state.rulePresetId;
      state.cleanupMode = ['preserve', 'smart', 'minimal'].includes(workspace.cleanupMode)
        ? workspace.cleanupMode
        : state.cleanupMode;
      state.structureMode = ['off', 'warn', 'clean'].includes(workspace.structureMode)
        ? workspace.structureMode
        : state.structureMode;
      state.consoleVariableLayout = workspace.consoleVariableLayout === 'categorized'
        ? 'categorized'
        : 'flat';
      state.previewMode = workspace.previewMode === 'diff' ? 'diff' : 'merged';
      state.previewFontSize = clampPreviewFontSize(workspace.previewFontSize);
      state.previewLineHeight = clampPreviewLineHeight(workspace.previewLineHeight);
      state.previewShowLineNumbers = workspace.previewShowLineNumbers !== false;
      state.excludedSections = Array.isArray(workspace.excludedSections) ? clone(workspace.excludedSections) : [];
      state.searchQuery = typeof workspace.searchQuery === 'string' ? workspace.searchQuery : '';
      state.profileDraftName = typeof workspace.profileDraftName === 'string' ? workspace.profileDraftName : '';

      const restoreInfo = await restoreFilesFromConfig(workspace.filePaths);
      refreshAvailableSections();

      if (state.files.length > 0) {
        rebuildMerge(workspace.selectionSnapshot || null);
      } else {
        invalidateMerge();
        refresh();
      }

      autosaveReady = true;
      lastSavedConfigJson = JSON.stringify(buildConfigPayload());
      setAutosaveMeta(`Autosave: ${result.path}`, 'success');

      if (restoreInfo.loaded > 0 && restoreInfo.missing.length === 0) {
        setStatus('Session Restored', 'success', `Restored ${restoreInfo.loaded} saved file${restoreInfo.loaded === 1 ? '' : 's'} from the last session.`);
      } else if (restoreInfo.loaded > 0) {
        setStatus(
          'Session Partially Restored',
          'warning',
          `Restored ${restoreInfo.loaded} file${restoreInfo.loaded === 1 ? '' : 's'}. ${restoreInfo.missing.length} saved path${restoreInfo.missing.length === 1 ? '' : 's'} could not be reopened.`
        );
      }
    } catch (error) {
      autosaveReady = true;
      setAutosaveMeta(`Autosave: ${error.message}`, 'error');
      refresh();
    }
  }

  function getLineCount(text) {
    if (!text) {
      return 0;
    }

    return String(text).split(/\r?\n/).length;
  }

  function getRulePreset() {
    return RULE_PRESETS.find((preset) => preset.id === state.rulePresetId) || RULE_PRESETS[0];
  }

  function populateRulePresets() {
    clearNode(elements.rulePresetSelect);

    RULE_PRESETS.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      option.title = preset.description;
      elements.rulePresetSelect.appendChild(option);
    });
  }

  function applyPreviewPreferences() {
    elements.previewOutput.style.setProperty('--preview-font-size', `${state.previewFontSize}px`);
    elements.previewOutput.style.setProperty('--preview-line-height', String(state.previewLineHeight));
    elements.previewOutput.classList.toggle('preview-output--line-numbers', state.previewShowLineNumbers);
  }

  function mergeFilesByPath(existingFiles, nextFiles) {
    const merged = new Map(existingFiles.map((file) => [file.path, file]));

    nextFiles.forEach((file) => {
      merged.set(file.path, file);
    });

    return Array.from(merged.values());
  }

  function getPriorityLabel(index) {
    if (index === 0) {
      return 'Lowest priority';
    }

    if (index === state.files.length - 1) {
      return 'Highest priority';
    }

    return `Priority ${index + 1}`;
  }

  function getManualOverrideCount() {
    if (!state.mergeModel) {
      return 0;
    }

    return state.mergeModel.conflicts.reduce((count, conflict) => {
      return count + (conflict.selectedOptionId !== conflict.defaultOptionId ? 1 : 0);
    }, 0);
  }

  function getManualDuplicateCount() {
    if (!state.mergeModel) {
      return 0;
    }

    return state.mergeModel.duplicates.reduce((count, duplicate) => {
      return count + (duplicate.keepDuplicates !== duplicate.defaultKeepDuplicates ? 1 : 0);
    }, 0);
  }

  function getSelectedOption(conflict) {
    return conflict.options.find((option) => option.id === conflict.selectedOptionId) || conflict.options[0] || null;
  }

  function getConflictById(conflictId) {
    if (!state.mergeModel) {
      return null;
    }

    return state.mergeModel.conflicts.find((conflict) => conflict.id === conflictId) || null;
  }

  function getConflictIndex(conflictId) {
    if (!state.mergeModel) {
      return -1;
    }

    return state.mergeModel.conflicts.findIndex((conflict) => conflict.id === conflictId);
  }

  function getDuplicateById(duplicateId) {
    if (!state.mergeModel) {
      return null;
    }

    return state.mergeModel.duplicates.find((duplicate) => duplicate.id === duplicateId) || null;
  }

  function getDuplicateIndex(duplicateId) {
    if (!state.mergeModel) {
      return -1;
    }

    return state.mergeModel.duplicates.findIndex((duplicate) => duplicate.id === duplicateId);
  }

  function getPrimaryOccurrence(option) {
    if (!option || !Array.isArray(option.occurrences) || option.occurrences.length === 0) {
      return null;
    }

    return option.occurrences.reduce((best, occurrence) => {
      if (!best) {
        return occurrence;
      }

      if (occurrence.precedence !== best.precedence) {
        return occurrence.precedence > best.precedence ? occurrence : best;
      }

      return occurrence.encounterIndex > best.encounterIndex ? occurrence : best;
    }, null);
  }

  function getPrimarySourceName(option) {
    const occurrence = getPrimaryOccurrence(option);
    return occurrence ? occurrence.sourceName : 'unknown';
  }

  function getPrimarySourceId(option) {
    const occurrence = getPrimaryOccurrence(option);
    return occurrence ? occurrence.sourceId : null;
  }

  function createSelectionSnapshot() {
    if (!state.mergeModel) {
      return null;
    }

    return {
      activeConflictId: state.activeConflictId,
      activeDuplicateId: state.activeDuplicateId,
      conflicts: state.mergeModel.conflicts
        .filter((conflict) => conflict.selectedOptionId !== conflict.defaultOptionId)
        .map((conflict) => ({
          id: conflict.id,
          optionId: conflict.selectedOptionId
        })),
      duplicates: state.mergeModel.duplicates
        .filter((duplicate) => duplicate.keepDuplicates !== duplicate.defaultKeepDuplicates)
        .map((duplicate) => ({
          id: duplicate.id,
          keepDuplicates: duplicate.keepDuplicates
        }))
    };
  }

  function applySelectionSnapshot(snapshot) {
    if (!snapshot || !state.mergeModel) {
      return;
    }

    snapshot.conflicts?.forEach((selection) => {
      const conflict = getConflictById(selection.id);

      if (!conflict || !conflict.options.some((option) => option.id === selection.optionId)) {
        return;
      }

      mergeCore.selectConflictOption(state.mergeModel, selection.id, selection.optionId);
    });

    snapshot.duplicates?.forEach((selection) => {
      const duplicate = getDuplicateById(selection.id);

      if (!duplicate) {
        return;
      }

      mergeCore.setDuplicatePreference(state.mergeModel, selection.id, selection.keepDuplicates);
    });

    state.activeConflictId = getConflictById(snapshot.activeConflictId) ? snapshot.activeConflictId : null;
    state.activeDuplicateId = getDuplicateById(snapshot.activeDuplicateId) ? snapshot.activeDuplicateId : null;
  }

  function refreshAvailableSections() {
    const sectionsByName = new Map();

    state.files.forEach((file) => {
      const parsed = mergeCore.parseIni(file.content, file);

      parsed.sections.forEach((section) => {
        const normalizedName = normalizeText(section.name);
        let item = sectionsByName.get(normalizedName);

        if (!item) {
          item = {
            name: section.name,
            normalizedName,
            fileNames: new Set()
          };
          sectionsByName.set(normalizedName, item);
        }

        item.fileNames.add(file.name);
      });
    });

    state.availableSections = Array.from(sectionsByName.values())
      .map((section) => ({
        ...section,
        fileNames: Array.from(section.fileNames).sort((left, right) => left.localeCompare(right))
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const validSections = new Set(state.availableSections.map((section) => section.normalizedName));
    state.excludedSections = state.excludedSections.filter((sectionName) => validSections.has(normalizeText(sectionName)));
    state.sectionSelectionDraft = getIncludedSectionNames();
  }

  function getIncludedSectionNames() {
    const excluded = new Set(state.excludedSections.map((sectionName) => normalizeText(sectionName)));
    return state.availableSections
      .filter((section) => !excluded.has(section.normalizedName))
      .map((section) => section.name);
  }

  function getSectionButtonLabel() {
    if (state.availableSections.length === 0) {
      return 'All Sections';
    }

    const includedCount = getIncludedSectionNames().length;

    if (includedCount === state.availableSections.length) {
      return 'All Sections';
    }

    return `${includedCount}/${state.availableSections.length} Sections`;
  }

  function getMergeBuildOptions() {
    const preset = getRulePreset();
    return {
      excludedSections: state.excludedSections,
      defaultConflictStrategy: preset.defaultConflictStrategy,
      defaultDuplicateStrategy: preset.defaultDuplicateStrategy
    };
  }

  function invalidateMerge() {
    state.mergeModel = null;
    state.mergedContent = '';
    state.defaultMergedContent = '';
    state.activeConflictId = null;
    state.activeDuplicateId = null;
    state.structuralReport = null;
    state.consoleVariableCategorySummary = [];
    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
    state.isStructureModalOpen = false;
  }

  function setMergedContentFromModel() {
    if (!state.mergeModel) {
      state.mergedContent = '';
      state.structuralReport = null;
      state.consoleVariableCategorySummary = [];
      return;
    }

    const rendered = buildRenderedOutput(mergeCore.renderMergedContent(state.mergeModel, getRenderOptions()));
    state.mergedContent = rendered.text;
    state.structuralReport = rendered.structuralReport;
    state.consoleVariableCategorySummary = rendered.consoleVariableCategorySummary;
  }

  function rebuildMerge(snapshot) {
    if (state.files.length === 0) {
      invalidateMerge();
      refresh();
      return;
    }

    state.mergeModel = mergeCore.createMergeModel(state.files, getMergeBuildOptions());
    state.defaultMergedContent = buildRenderedOutput(mergeCore.renderMergedContent(state.mergeModel, getRenderOptions())).text;
    applySelectionSnapshot(snapshot);
    setMergedContentFromModel();
    state.activeConflictId = state.activeConflictId || (state.mergeModel.conflicts[0] ? state.mergeModel.conflicts[0].id : null);
    state.activeDuplicateId = state.activeDuplicateId || (state.mergeModel.duplicates[0] ? state.mergeModel.duplicates[0].id : null);
    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
    state.isStructureModalOpen = false;
    refresh();
  }

  function setStatus(label, tone, message) {
    elements.statusBadge.textContent = label;
    elements.statusBadge.dataset.tone = tone;
    elements.statusMessage.textContent = message;
  }

  function refreshStatus() {
    if (state.files.length === 0) {
      setStatus('No Files', 'idle', 'Add INI files to begin. The last file in the list has the highest priority.');
      return;
    }

    if (!state.mergeModel) {
      setStatus(
        'Ready',
        'info',
        `${state.files.length} file${state.files.length === 1 ? '' : 's'} loaded. Arrange the order, choose rules if needed, and build the merge.`
      );
      return;
    }

    const issueParts = [];

    if (state.mergeModel.summary.conflictCount > 0) {
      issueParts.push(`${state.mergeModel.summary.conflictCount} conflict${state.mergeModel.summary.conflictCount === 1 ? '' : 's'}`);
    }

    if (state.mergeModel.summary.duplicateCount > 0) {
      issueParts.push(`${state.mergeModel.summary.duplicateCount} duplicate group${state.mergeModel.summary.duplicateCount === 1 ? '' : 's'}`);
    }

    const structuralReviewCount = state.structureMode === 'clean'
      ? (state.structuralReport?.summary.reviewIssueCount || 0)
      : (state.structuralReport?.summary.issueCount || 0);

    if (state.structureMode !== 'off' && structuralReviewCount > 0) {
      issueParts.push(`${structuralReviewCount} structural warning${structuralReviewCount === 1 ? '' : 's'}`);
    }

    if (issueParts.length > 0) {
      setStatus('Review Needed', 'warning', `${issueParts.join(' and ')} found. Review them before saving.`);
      return;
    }

    if (state.excludedSections.length > 0) {
      const includedCount = getIncludedSectionNames().length;
      setStatus('Filtered', 'info', `Merge built with ${includedCount} included section${includedCount === 1 ? '' : 's'}.`);
      return;
    }

    setStatus('Ready To Save', 'success', 'Merge built successfully. No conflicts or duplicate review items remain.');
  }

  function renderSummaryBar() {
    clearNode(elements.summaryBar);

    const items = [
      { value: String(state.files.length), label: 'Files' },
      { value: state.mergeModel ? String(state.mergeModel.summary.sectionCount) : '--', label: 'Sections' },
      { value: state.mergeModel ? String(state.mergeModel.summary.conflictCount) : '--', label: 'Conflicts' },
      { value: state.mergeModel ? String(state.mergeModel.summary.duplicateCount) : '--', label: 'Duplicates' },
      { value: state.mergeModel && state.structureMode !== 'off' ? String(state.structuralReport?.summary.issueCount || 0) : '--', label: 'Structure' },
      { value: state.mergeModel ? String(getManualOverrideCount() + getManualDuplicateCount()) : '--', label: 'Changes' }
    ];

    items.forEach((item) => {
      const pill = createElement('div', 'summary-pill');
      pill.append(
        createElement('strong', '', item.value),
        createElement('span', '', item.label)
      );
      elements.summaryBar.appendChild(pill);
    });
  }

  function reorderFiles(fromIndex, toIndex) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.files.length ||
      toIndex >= state.files.length
    ) {
      return;
    }

    const moved = state.files.splice(fromIndex, 1)[0];
    state.files.splice(toIndex, 0, moved);
    invalidateMerge();
    refreshAvailableSections();
    refresh();
  }

  function attachDragHandlers(card, index) {
    card.draggable = true;

    card.addEventListener('dragstart', (event) => {
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });

    card.addEventListener('dragenter', (event) => {
      event.preventDefault();
      card.classList.add('is-drop-target');
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drop-target');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const fromIndex = Number(event.dataTransfer.getData('text/plain'));

      if (!Number.isNaN(fromIndex)) {
        reorderFiles(fromIndex, index);
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      document.querySelectorAll('.file-card.is-drop-target').forEach((node) => {
        node.classList.remove('is-drop-target');
      });
    });
  }

  function renderFileList() {
    clearNode(elements.fileList);

    if (state.files.length === 0) {
      elements.fileList.appendChild(createEmptyState('No files added yet.'));
      return;
    }

    state.files.forEach((file, index) => {
      const card = createElement('article', 'file-card');
      attachDragHandlers(card, index);

      const top = createElement('div', 'file-card__top');
      const titleBlock = createElement('div', '');
      titleBlock.append(
        createElement('h3', 'file-card__title', file.name),
        createElement('p', 'file-card__subline', `${getLineCount(file.content)} lines`)
      );

      const chip = createElement(
        'span',
        `file-chip${index === 0 ? ' is-top' : ''}${index === state.files.length - 1 ? ' is-bottom' : ''}`,
        getPriorityLabel(index)
      );

      top.append(titleBlock, chip);

      const path = createElement('p', 'file-card__path', file.path);
      const actions = createElement('div', 'file-actions');
      actions.append(
        createButton('Up', 'mini-button', () => reorderFiles(index, index - 1), index === 0),
        createButton('Down', 'mini-button', () => reorderFiles(index, index + 1), index === state.files.length - 1),
        createButton('Remove', 'mini-button', () => removeFile(index), false)
      );

      card.append(top, path, actions);
      elements.fileList.appendChild(card);
    });
  }

  function createDiffView(beforeText, afterText) {
    const before = String(beforeText).split(/\r?\n/);
    const after = String(afterText).split(/\r?\n/);
    const lines = ['--- Default merge', '+++ Current merge'];
    const lookahead = 8;
    let beforeIndex = 0;
    let afterIndex = 0;
    let changeCount = 0;

    while (beforeIndex < before.length || afterIndex < after.length) {
      if (beforeIndex < before.length && afterIndex < after.length && before[beforeIndex] === after[afterIndex]) {
        lines.push(`  ${before[beforeIndex]}`);
        beforeIndex += 1;
        afterIndex += 1;
        continue;
      }

      if (beforeIndex >= before.length) {
        lines.push(`+ ${after[afterIndex]}`);
        afterIndex += 1;
        changeCount += 1;
        continue;
      }

      if (afterIndex >= after.length) {
        lines.push(`- ${before[beforeIndex]}`);
        beforeIndex += 1;
        changeCount += 1;
        continue;
      }

      let matchInAfter = -1;
      let matchInBefore = -1;

      for (let offset = 1; offset <= lookahead && afterIndex + offset < after.length; offset += 1) {
        if (after[afterIndex + offset] === before[beforeIndex]) {
          matchInAfter = afterIndex + offset;
          break;
        }
      }

      for (let offset = 1; offset <= lookahead && beforeIndex + offset < before.length; offset += 1) {
        if (before[beforeIndex + offset] === after[afterIndex]) {
          matchInBefore = beforeIndex + offset;
          break;
        }
      }

      if (matchInAfter !== -1 && (matchInBefore === -1 || matchInAfter - afterIndex <= matchInBefore - beforeIndex)) {
        while (afterIndex < matchInAfter) {
          lines.push(`+ ${after[afterIndex]}`);
          afterIndex += 1;
          changeCount += 1;
        }
        continue;
      }

      if (matchInBefore !== -1) {
        while (beforeIndex < matchInBefore) {
          lines.push(`- ${before[beforeIndex]}`);
          beforeIndex += 1;
          changeCount += 1;
        }
        continue;
      }

      lines.push(`- ${before[beforeIndex]}`);
      lines.push(`+ ${after[afterIndex]}`);
      beforeIndex += 1;
      afterIndex += 1;
      changeCount += 2;
    }

    if (changeCount === 0) {
      return {
        text: 'No changes from the preset default merge.',
        changeCount: 0
      };
    }

    return {
      text: lines.join('\n'),
      changeCount
    };
  }

  function renderPreview() {
    let previewText = PREVIEW_PLACEHOLDER;
    let previewMode = state.previewMode;
    let meta = 'No merged output yet.';
    let note = `Current merged output based on the active selections. ${getCleanupLabel(state.cleanupMode)}.`;
    let isEmpty = false;

    if (!state.mergeModel) {
      previewText = state.previewMode === 'diff' ? DIFF_PLACEHOLDER : PREVIEW_PLACEHOLDER;
      isEmpty = true;
    } else if (state.previewMode === 'diff') {
      const diffView = createDiffView(state.defaultMergedContent, state.mergedContent);
      previewText = diffView.text;
      meta = diffView.changeCount === 0
        ? 'No changes from preset defaults'
        : `${diffView.changeCount} changed line${diffView.changeCount === 1 ? '' : 's'}`;
      note = `Diff against the current rule preset and section filter defaults. ${getCleanupLabel(state.cleanupMode)}. ${getStructureModeLabel(state.structureMode)}. ${getConsoleVariableLayoutLabel(state.consoleVariableLayout)}.`;
    } else {
      previewText = state.mergedContent;
      meta = `${getLineCount(state.mergedContent)} lines`;
      note = `Current merged output based on the active selections. ${getCleanupLabel(state.cleanupMode)}. ${getStructureModeLabel(state.structureMode)}. ${getConsoleVariableLayoutLabel(state.consoleVariableLayout)}.`;
    }

    const matchCount = countQueryMatches(previewText, state.searchQuery);

    if (matchCount > 0) {
      meta += ` | ${matchCount} match${matchCount === 1 ? '' : 'es'}`;
    }

    if (state.structureMode !== 'off' && state.structuralReport?.summary.issueCount > 0) {
      if (state.structureMode === 'clean' && state.structuralReport.summary.looseLineCount > 0) {
        meta += ` | ${state.structuralReport.summary.looseLineCount} loose line${state.structuralReport.summary.looseLineCount === 1 ? '' : 's'} cleaned`;
      }

      if (state.structuralReport.summary.reviewIssueCount > 0 || state.structureMode !== 'clean') {
        const structuralCount = state.structureMode === 'clean'
          ? state.structuralReport.summary.reviewIssueCount
          : state.structuralReport.summary.issueCount;
        meta += ` | ${structuralCount} structural issue${structuralCount === 1 ? '' : 's'}`;
      }
    }

    if (state.consoleVariableLayout === 'categorized' && state.consoleVariableCategorySummary.length > 0) {
      meta += ` | ${state.consoleVariableCategorySummary.length} cvar categor${state.consoleVariableCategorySummary.length === 1 ? 'y' : 'ies'}`;
    }

    elements.previewNote.textContent = note;
    elements.previewMeta.textContent = meta;
    elements.previewOutput.innerHTML = createPreviewMarkup(previewText, state.searchQuery, previewMode);
    elements.previewOutput.classList.toggle('is-empty', isEmpty);
    applyPreviewPreferences();
  }

  function conflictMatchesSearch(conflict) {
    const query = normalizeText(state.searchQuery);

    if (!query) {
      return true;
    }

    const haystack = [
      conflict.sectionName,
      conflict.label,
      ...conflict.options.map((option) => option.raw),
      ...conflict.options.flatMap((option) => option.sourceNames)
    ].join('\n').toLowerCase();

    return haystack.includes(query);
  }

  function getVisibleConflicts() {
    if (!state.mergeModel) {
      return [];
    }

    return state.mergeModel.conflicts.filter((conflict) => conflictMatchesSearch(conflict));
  }

  function syncActiveConflictSelection() {
    if (!state.mergeModel || state.mergeModel.conflicts.length === 0) {
      state.activeConflictId = null;
      return;
    }

    const visibleConflicts = getVisibleConflicts();

    if (visibleConflicts.length === 0) {
      return;
    }

    if (!visibleConflicts.some((conflict) => conflict.id === state.activeConflictId)) {
      state.activeConflictId = visibleConflicts[0].id;
    }
  }

  function selectActiveConflict(conflictId) {
    state.activeConflictId = conflictId;
    refresh();
  }

  function renderConflictList() {
    clearNode(elements.conflictList);

    if (!state.mergeModel) {
      elements.conflictMeta.textContent = 'No merge built.';
      elements.conflictList.appendChild(createEmptyState('Build the merge to review conflicts.'));
      return;
    }

    if (state.mergeModel.conflicts.length === 0) {
      elements.conflictMeta.textContent = 'No conflicts.';
      elements.conflictList.appendChild(createEmptyState('No conflicts found.'));
      return;
    }

    syncActiveConflictSelection();
    const visibleConflicts = getVisibleConflicts();
    elements.conflictMeta.textContent = state.searchQuery
      ? `${visibleConflicts.length} of ${state.mergeModel.conflicts.length} conflicts`
      : `${state.mergeModel.conflicts.length} conflict${state.mergeModel.conflicts.length === 1 ? '' : 's'}`;

    if (visibleConflicts.length === 0) {
      elements.conflictList.appendChild(createEmptyState('No conflicts match the current search.'));
      return;
    }

    visibleConflicts.forEach((conflict) => {
      const isActive = state.activeConflictId === conflict.id;
      const selectedOption = getSelectedOption(conflict);
      const uniqueSources = Array.from(new Set(conflict.options.flatMap((option) => option.sourceNames)));

      const card = createElement('article', `conflict-card${isActive ? ' is-active' : ''}`);
      card.tabIndex = 0;
      card.addEventListener('click', () => selectActiveConflict(conflict.id));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectActiveConflict(conflict.id);
        }
      });

      const top = createElement('div', 'conflict-card__top');
      const copy = createElement('div', 'conflict-card__copy');
      copy.append(
        createElement('h3', 'conflict-card__title', `${conflict.sectionName} -> ${conflict.label}`),
        createElement(
          'p',
          'conflict-card__subline',
          `Current: ${getPrimarySourceName(selectedOption)} | Sources: ${uniqueSources.join(', ')}`
        )
      );

      const badge = createElement(
        'span',
        'conflict-badge',
        conflict.selectedOptionId === conflict.defaultOptionId ? 'Default' : 'Override'
      );

      top.append(copy, badge);
      card.append(top);
      elements.conflictList.appendChild(card);
    });
  }

  function openConflictModal() {
    if (!state.mergeModel || state.mergeModel.conflicts.length === 0) {
      return;
    }

    syncActiveConflictSelection();

    if (!state.activeConflictId) {
      state.activeConflictId = state.mergeModel.conflicts[0].id;
    }

    state.isDuplicateModalOpen = false;
    state.isSectionsModalOpen = false;
    state.isProfilesModalOpen = false;
    state.isStructureModalOpen = false;
    state.isConflictModalOpen = true;
    refresh();
  }

  function closeConflictModal() {
    state.isConflictModalOpen = false;
    refresh();
  }

  function renderConflictModal() {
    const conflict = state.isConflictModalOpen ? getConflictById(state.activeConflictId) : null;

    if (!conflict) {
      elements.conflictModal.classList.remove('is-open');
      elements.conflictModal.setAttribute('aria-hidden', 'true');
      clearNode(elements.conflictModalOptions);
      return;
    }

    const selectedOption = getSelectedOption(conflict);
    const conflictIndex = getConflictIndex(conflict.id);
    elements.conflictModalTitle.textContent = `${conflict.sectionName} -> ${conflict.label}`;
    elements.conflictModalMeta.textContent = `Conflict ${conflictIndex + 1} of ${state.mergeModel.conflicts.length} | Current selection: ${getPrimarySourceName(selectedOption)} | ${conflict.options.length} option${conflict.options.length === 1 ? '' : 's'}`;

    clearNode(elements.conflictModalOptions);

    conflict.options.forEach((option) => {
      const optionCard = createElement(
        'section',
        `option-card${option.id === conflict.selectedOptionId ? ' is-selected' : ''}`
      );

      const optionTop = createElement('div', 'option-card__top');
      const tags = createElement('div', 'option-tags');

      if (option.id === conflict.defaultOptionId) {
        tags.appendChild(createElement('span', 'option-tag is-default', 'Preset default'));
      }

      if (option.id === conflict.selectedOptionId) {
        tags.appendChild(createElement('span', 'option-tag is-selected', 'Selected'));
      }

      const meta = createElement('p', 'option-meta', `From ${option.sourceNames.join(' | ')}`);
      optionTop.append(tags, meta);

      const code = createElement('pre', 'option-code', option.raw);
      const action = createButton(
        option.id === conflict.selectedOptionId ? 'Selected' : 'Keep This Value',
        'button button-ghost option-action',
        () => applyConflictSelection(conflict.id, option.id),
        option.id === conflict.selectedOptionId
      );

      optionCard.append(optionTop, code, action);
      elements.conflictModalOptions.appendChild(optionCard);
    });

    elements.conflictModal.classList.add('is-open');
    elements.conflictModal.setAttribute('aria-hidden', 'false');
  }

  function advanceConflictReview() {
    if (!state.mergeModel || !state.activeConflictId) {
      closeConflictModal();
      return;
    }

    const currentIndex = getConflictIndex(state.activeConflictId);
    const nextConflict = state.mergeModel.conflicts[currentIndex + 1];

    if (nextConflict) {
      state.activeConflictId = nextConflict.id;
      state.isConflictModalOpen = true;
    } else {
      state.isConflictModalOpen = false;
    }

    refresh();
  }

  function applyConflictSelection(conflictId, optionId) {
    mergeCore.selectConflictOption(state.mergeModel, conflictId, optionId);
    setMergedContentFromModel();
    state.activeConflictId = conflictId;
    advanceConflictReview();
  }

  function applySelectedSourceToSection(conflictId = state.activeConflictId) {
    const conflict = getConflictById(conflictId);

    if (!conflict) {
      return;
    }

    const selectedOption = getSelectedOption(conflict);
    const targetSourceId = getPrimarySourceId(selectedOption);

    if (!targetSourceId) {
      setStatus('No Source', 'warning', 'The current conflict selection does not have a usable source file.');
      return;
    }

    let appliedCount = 0;

    state.mergeModel.conflicts.forEach((candidate) => {
      if (candidate.sectionName !== conflict.sectionName) {
        return;
      }

      const matchingOption = candidate.options.find((option) => {
        return option.occurrences.some((occurrence) => occurrence.sourceId === targetSourceId);
      });

      if (matchingOption && candidate.selectedOptionId !== matchingOption.id) {
        mergeCore.selectConflictOption(state.mergeModel, candidate.id, matchingOption.id);
        appliedCount += 1;
      }
    });

    setMergedContentFromModel();
    refresh();
    setStatus(
      'Section Updated',
      'info',
      appliedCount > 0
        ? `Applied the selected file to ${appliedCount} conflict${appliedCount === 1 ? '' : 's'} in ${conflict.sectionName}.`
        : `The selected file was already applied everywhere possible in ${conflict.sectionName}.`
    );
  }

  function openDuplicateModal() {
    if (!state.mergeModel || state.mergeModel.duplicates.length === 0) {
      return;
    }

    if (!state.activeDuplicateId) {
      state.activeDuplicateId = state.mergeModel.duplicates[0].id;
    }

    state.isConflictModalOpen = false;
    state.isSectionsModalOpen = false;
    state.isProfilesModalOpen = false;
    state.isStructureModalOpen = false;
    state.isDuplicateModalOpen = true;
    refresh();
  }

  function closeDuplicateModal() {
    state.isDuplicateModalOpen = false;
    refresh();
  }

  function renderDuplicateModal() {
    const duplicate = state.isDuplicateModalOpen ? getDuplicateById(state.activeDuplicateId) : null;

    if (!duplicate) {
      elements.duplicateModal.classList.remove('is-open');
      elements.duplicateModal.setAttribute('aria-hidden', 'true');
      clearNode(elements.duplicateModalOptions);
      return;
    }

    const duplicateIndex = getDuplicateIndex(duplicate.id);
    elements.duplicateModalTitle.textContent = `${duplicate.sectionName} -> ${duplicate.label}`;
    elements.duplicateModalMeta.textContent =
      `Duplicate ${duplicateIndex + 1} of ${state.mergeModel.duplicates.length} | ${duplicate.occurrences.length} copies found | Current setting: ${duplicate.keepDuplicates ? 'Keep all copies' : 'Remove duplicates'}`;

    clearNode(elements.duplicateModalOptions);

    const detailCard = createElement('section', 'option-card duplicate-detail');
    detailCard.append(
      createElement('p', 'option-meta', 'Matching entry'),
      createElement('pre', 'option-code', duplicate.raw)
    );

    const sources = createElement('div', 'duplicate-source-list');
    duplicate.occurrences.forEach((occurrence) => {
      sources.appendChild(
        createElement(
          'div',
          'duplicate-source-item',
          `${occurrence.sourceName} - line ${occurrence.lineNumber} - ${occurrence.sourcePath}`
        )
      );
    });

    detailCard.appendChild(sources);
    elements.duplicateModalOptions.appendChild(detailCard);

    elements.duplicateModal.classList.add('is-open');
    elements.duplicateModal.setAttribute('aria-hidden', 'false');
  }

  function advanceDuplicateReview() {
    if (!state.mergeModel || !state.activeDuplicateId) {
      closeDuplicateModal();
      return;
    }

    const currentIndex = getDuplicateIndex(state.activeDuplicateId);
    const nextDuplicate = state.mergeModel.duplicates[currentIndex + 1];

    if (nextDuplicate) {
      state.activeDuplicateId = nextDuplicate.id;
      state.isDuplicateModalOpen = true;
    } else {
      state.isDuplicateModalOpen = false;
    }

    refresh();
  }

  function applyDuplicatePreference(duplicateId, keepDuplicates) {
    mergeCore.setDuplicatePreference(state.mergeModel, duplicateId, keepDuplicates);
    setMergedContentFromModel();
    state.activeDuplicateId = duplicateId;
    advanceDuplicateReview();
  }

  function applyAllDuplicatePreferences(keepDuplicates) {
    if (!state.mergeModel || state.mergeModel.duplicates.length === 0) {
      return;
    }

    state.mergeModel.duplicates.forEach((duplicate) => {
      mergeCore.setDuplicatePreference(state.mergeModel, duplicate.id, keepDuplicates);
    });

    setMergedContentFromModel();
    state.isDuplicateModalOpen = false;
    refresh();
    setStatus(
      keepDuplicates ? 'Duplicates Preserved' : 'Duplicates Removed',
      'info',
      keepDuplicates
        ? `Kept all ${state.mergeModel.duplicates.length} duplicate group${state.mergeModel.duplicates.length === 1 ? '' : 's'}.`
        : `Removed duplicates across all ${state.mergeModel.duplicates.length} duplicate group${state.mergeModel.duplicates.length === 1 ? '' : 's'}.`
    );
  }

  function openSectionsModal() {
    state.sectionSelectionDraft = getIncludedSectionNames();
    state.sectionSearchQuery = '';
    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
    state.isProfilesModalOpen = false;
    state.isStructureModalOpen = false;
    state.isSectionsModalOpen = true;
    refresh();
  }

  function closeSectionsModal() {
    state.isSectionsModalOpen = false;
    refresh();
  }

  function toggleSectionDraft(sectionName, checked) {
    const next = new Set(state.sectionSelectionDraft);

    if (checked) {
      next.add(sectionName);
    } else {
      next.delete(sectionName);
    }

    state.sectionSelectionDraft = Array.from(next).sort((left, right) => left.localeCompare(right));
    refresh();
  }

  function renderSectionsModal() {
    if (!state.isSectionsModalOpen) {
      elements.sectionsModal.classList.remove('is-open');
      elements.sectionsModal.setAttribute('aria-hidden', 'true');
      clearNode(elements.sectionList);
      return;
    }

    elements.sectionsModal.classList.add('is-open');
    elements.sectionsModal.setAttribute('aria-hidden', 'false');
    elements.sectionsModalMeta.textContent = `${state.sectionSelectionDraft.length} of ${state.availableSections.length} section${state.availableSections.length === 1 ? '' : 's'} included`;
    elements.sectionSearchInput.value = state.sectionSearchQuery;

    clearNode(elements.sectionList);
    const query = normalizeText(state.sectionSearchQuery);
    const visibleSections = state.availableSections.filter((section) => {
      if (!query) {
        return true;
      }

      const haystack = `${section.name}\n${section.fileNames.join('\n')}`.toLowerCase();
      return haystack.includes(query);
    });

    if (visibleSections.length === 0) {
      elements.sectionList.appendChild(createEmptyState('No sections match the current search.'));
      return;
    }

    visibleSections.forEach((section) => {
      const row = createElement('label', 'section-row');
      row.tabIndex = 0;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'section-checkbox';
      checkbox.checked = state.sectionSelectionDraft.includes(section.name);
      checkbox.addEventListener('change', (event) => toggleSectionDraft(section.name, event.target.checked));

      const copy = createElement('div', 'section-row__copy');
      copy.append(
        createElement('h3', 'file-card__title', section.name),
        createElement('p', 'section-summary', `${section.fileNames.length} file${section.fileNames.length === 1 ? '' : 's'}: ${section.fileNames.join(', ')}`)
      );

      row.append(checkbox, copy);
      elements.sectionList.appendChild(row);
    });
  }

  function applySectionFilter() {
    const included = new Set(state.sectionSelectionDraft.map((sectionName) => normalizeText(sectionName)));
    state.excludedSections = state.availableSections
      .filter((section) => !included.has(section.normalizedName))
      .map((section) => section.name);
    state.isSectionsModalOpen = false;

    if (state.files.length === 0) {
      refresh();
      return;
    }

    const snapshot = createSelectionSnapshot();
    rebuildMerge(snapshot);
  }

  function openProfilesModal() {
    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
    state.isSectionsModalOpen = false;
    state.isStructureModalOpen = false;
    state.isProfilesModalOpen = true;
    refresh();
  }

  function closeProfilesModal() {
    state.isProfilesModalOpen = false;
    refresh();
  }

  function createProfileSession() {
    return {
      filePaths: state.files.map((file) => file.path),
      rulePresetId: state.rulePresetId,
      cleanupMode: state.cleanupMode,
      structureMode: state.structureMode,
      consoleVariableLayout: state.consoleVariableLayout,
      previewMode: state.previewMode,
      previewFontSize: state.previewFontSize,
      previewLineHeight: state.previewLineHeight,
      previewShowLineNumbers: state.previewShowLineNumbers,
      excludedSections: clone(state.excludedSections),
      searchQuery: state.searchQuery,
      selectionSnapshot: createSelectionSnapshot()
    };
  }

  function saveCurrentProfile() {
    const profileName = elements.profileNameInput.value.trim();

    if (!profileName) {
      setStatus('Name Required', 'warning', 'Enter a profile name before saving the current session.');
      return;
    }

    if (state.files.length === 0) {
      setStatus('No Session', 'warning', 'Load files before saving a profile.');
      return;
    }

    const existing = state.profiles.find((profile) => normalizeText(profile.name) === normalizeText(profileName));
    const profile = {
      id: existing ? existing.id : `profile:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
      name: profileName,
      savedAt: new Date().toISOString(),
      session: createProfileSession()
    };

    try {
      if (existing) {
        state.profiles = state.profiles.map((item) => item.id === existing.id ? profile : item);
      } else {
        state.profiles = [profile].concat(state.profiles);
      }

      persistProfiles();
      state.profileDraftName = profileName;
      refresh();
      setStatus('Profile Saved', 'success', `Saved session profile "${profileName}".`);
    } catch (error) {
      setStatus('Save Failed', 'error', `Unable to save profile: ${error.message}`);
    }
  }

  async function loadProfile(profileId) {
    const profile = state.profiles.find((item) => item.id === profileId);

    if (!profile) {
      return;
    }

    const legacyFiles = Array.isArray(profile.session.files) ? clone(profile.session.files) : null;
    const filePaths = Array.isArray(profile.session.filePaths)
      ? profile.session.filePaths
      : Array.isArray(profile.session.files)
        ? profile.session.files.map((file) => file.path).filter(Boolean)
        : [];

    state.files = [];
    state.rulePresetId = profile.session.rulePresetId || 'balanced';
    state.cleanupMode = profile.session.cleanupMode || 'preserve';
    state.structureMode = profile.session.structureMode || 'off';
    state.consoleVariableLayout = profile.session.consoleVariableLayout === 'categorized' ? 'categorized' : 'flat';
    state.previewMode = profile.session.previewMode || 'merged';
    state.previewFontSize = clampPreviewFontSize(profile.session.previewFontSize);
    state.previewLineHeight = clampPreviewLineHeight(profile.session.previewLineHeight);
    state.previewShowLineNumbers = profile.session.previewShowLineNumbers !== false;
    state.excludedSections = clone(profile.session.excludedSections || []);
    state.searchQuery = profile.session.searchQuery || '';
    state.profileDraftName = profile.name;
    state.isProfilesModalOpen = false;

    if (legacyFiles && legacyFiles.length > 0 && legacyFiles.every((file) => typeof file.content === 'string')) {
      state.files = legacyFiles;
    } else {
      const restoreInfo = await restoreFilesFromConfig(filePaths);

      if (restoreInfo.missing.length > 0) {
        setStatus(
          'Profile Partially Loaded',
          'warning',
          `Loaded profile "${profile.name}" with ${restoreInfo.missing.length} missing source path${restoreInfo.missing.length === 1 ? '' : 's'}.`
        );
      }
    }

    refreshAvailableSections();
    rebuildMerge(profile.session.selectionSnapshot || null);

    if (!(Array.isArray(filePaths) && filePaths.length > 0 && state.files.length < filePaths.length)) {
      setStatus('Profile Loaded', 'success', `Loaded session profile "${profile.name}".`);
    }
  }

  function deleteProfile(profileId) {
    const profile = state.profiles.find((item) => item.id === profileId);

    if (!profile) {
      return;
    }

    state.profiles = state.profiles.filter((item) => item.id !== profileId);
    persistProfiles();
    refresh();
    setStatus('Profile Removed', 'info', `Removed session profile "${profile.name}".`);
  }

  function renderProfilesModal() {
    if (!state.isProfilesModalOpen) {
      elements.profilesModal.classList.remove('is-open');
      elements.profilesModal.setAttribute('aria-hidden', 'true');
      clearNode(elements.profileList);
      return;
    }

    elements.profilesModal.classList.add('is-open');
    elements.profilesModal.setAttribute('aria-hidden', 'false');
    elements.profilesModalMeta.textContent = `${state.profiles.length} saved profile${state.profiles.length === 1 ? '' : 's'}`;
    elements.profileNameInput.value = state.profileDraftName;
    clearNode(elements.profileList);

    if (state.profiles.length === 0) {
      elements.profileList.appendChild(createEmptyState('No saved profiles yet.'));
      return;
    }

    state.profiles.forEach((profile) => {
      const card = createElement('article', 'profile-card');
      const top = createElement('div', 'profile-card__top');
      const copy = createElement('div', 'profile-card__copy');
      const fileCount = Array.isArray(profile.session.filePaths)
        ? profile.session.filePaths.length
        : Array.isArray(profile.session.files)
          ? profile.session.files.length
          : 0;
      copy.append(
        createElement('h3', 'profile-card__title', profile.name),
        createElement(
          'p',
          'profile-card__meta',
          `${fileCount} file${fileCount === 1 ? '' : 's'} | ${new Date(profile.savedAt).toLocaleString()}`
        )
      );

      const actions = createElement('div', 'profile-card__actions');
      actions.append(
        createButton('Load', 'mini-button', () => {
          loadProfile(profile.id).catch((error) => {
            setStatus('Profile Error', 'error', `Unable to load profile: ${error.message}`);
          });
        }, false),
        createButton('Delete', 'mini-button', () => deleteProfile(profile.id), false)
      );

      top.append(copy, actions);
      card.append(top);
      elements.profileList.appendChild(card);
    });
  }

  function openStructureModal() {
    if (!state.mergeModel) {
      return;
    }

    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
    state.isSectionsModalOpen = false;
    state.isProfilesModalOpen = false;
    state.isStructureModalOpen = true;
    refresh();
  }

  function closeStructureModal() {
    state.isStructureModalOpen = false;
    refresh();
  }

  function autoCleanStructureIssues() {
    if (!state.mergeModel) {
      return;
    }

    state.structureMode = 'clean';
    state.isStructureModalOpen = false;
    rebuildMerge(createSelectionSnapshot());
    setStatus('Structure Cleaned', 'info', 'Applied safe structural cleanup to loose non-INI lines.');
  }

  function toggleCategorizedConsoleVariables() {
    if (!state.mergeModel) {
      return;
    }

    state.consoleVariableLayout = state.consoleVariableLayout === 'categorized' ? 'flat' : 'categorized';
    state.isStructureModalOpen = false;
    rebuildMerge(createSelectionSnapshot());

    if (state.consoleVariableLayout === 'categorized' && state.consoleVariableCategorySummary.length === 0) {
      setStatus('No ConsoleVariables', 'info', 'No [ConsoleVariables] entries were found to categorize.');
      return;
    }

    setStatus(
      state.consoleVariableLayout === 'categorized' ? 'Cvars Categorized' : 'Cvars Flattened',
      'info',
      state.consoleVariableLayout === 'categorized'
        ? 'Grouped ConsoleVariables by category to make the merged output easier to scan.'
        : 'Returned ConsoleVariables to a flat layout.'
    );
  }

  function resetStructureTools() {
    if (!state.mergeModel) {
      return;
    }

    state.structureMode = 'off';
    state.consoleVariableLayout = 'flat';
    state.isStructureModalOpen = false;
    rebuildMerge(createSelectionSnapshot());
    setStatus('Structure Reset', 'info', 'Turned off structural cleanup and console-variable categorization.');
  }

  function renderStructureModal() {
    if (!state.isStructureModalOpen) {
      elements.structureModal.classList.remove('is-open');
      elements.structureModal.setAttribute('aria-hidden', 'true');
      clearNode(elements.structureList);
      return;
    }

    const report = state.structuralReport;

    if (!report) {
      elements.structureModal.classList.remove('is-open');
      elements.structureModal.setAttribute('aria-hidden', 'true');
      clearNode(elements.structureList);
      return;
    }

    elements.structureModal.classList.add('is-open');
    elements.structureModal.setAttribute('aria-hidden', 'false');
    elements.autoCleanStructureBtn.textContent = state.structureMode === 'clean' ? 'Safe Cleanup Enabled' : 'Auto Clean Safe Issues';
    elements.categorizeConsoleVariablesBtn.textContent = state.consoleVariableLayout === 'categorized'
      ? 'Use Flat ConsoleVariables'
      : 'Categorize ConsoleVariables';
    const metaParts = [
      `${report.summary.issueCount} issue${report.summary.issueCount === 1 ? '' : 's'}`,
      getStructureModeLabel(state.structureMode),
      getConsoleVariableLayoutLabel(state.consoleVariableLayout)
    ];

    if (state.structureMode === 'clean' && report.summary.looseLineCount > 0) {
      metaParts.push(`${report.summary.looseLineCount} loose line${report.summary.looseLineCount === 1 ? '' : 's'} already cleaned`);
    }

    elements.structureModalMeta.textContent = metaParts.join(' | ');
    clearNode(elements.structureList);

    if (report.issues.length === 0) {
      elements.structureList.appendChild(createEmptyState('No structural issues found.'));
    } else {
      report.issues.forEach((issue) => {
        const card = createElement('article', 'structure-card');
        const top = createElement('div', 'structure-card__top');
        const copy = createElement('div', 'structure-card__copy');
        const badgeClass = issue.severity === 'warning' ? 'structure-badge is-warning' : 'structure-badge';
        const title = issue.sectionName
          ? `Line ${issue.lineNumber} in [${issue.sectionName}]`
          : `Line ${issue.lineNumber}`;

        copy.append(
          createElement('h3', 'structure-card__title', title),
          createElement('p', 'structure-card__meta', issue.message),
          createElement('p', 'structure-card__recommendation', issue.recommendation)
        );

        top.append(
          copy,
          createElement('span', badgeClass, issue.type === 'loose-line' ? 'Safe to clean' : 'Review')
        );

        const code = createElement('pre', 'option-code', issue.line);
        card.append(top, code);
        elements.structureList.appendChild(card);
      });
    }

    if (state.consoleVariableCategorySummary.length > 0) {
      const summaryCard = createElement('article', 'structure-card');
      const title = createElement('h3', 'structure-card__title', 'Console Variable Categories');
      const meta = createElement(
        'p',
        'structure-card__meta',
        state.consoleVariableLayout === 'categorized'
          ? 'The merged [ConsoleVariables] section is currently grouped by category.'
          : 'You can auto-group [ConsoleVariables] into categories without moving them out of the section.'
      );
      const list = createElement('div', 'summary-bar');

      state.consoleVariableCategorySummary.forEach((item) => {
        const pill = createElement('div', 'summary-pill');
        pill.append(
          createElement('strong', '', String(item.count)),
          createElement('span', '', item.title)
        );
        list.appendChild(pill);
      });

      summaryCard.append(title, meta, list);
      elements.structureList.appendChild(summaryCard);
    }
  }

  function syncModalBodyState() {
    const anyModalOpen =
      state.isConflictModalOpen ||
      state.isDuplicateModalOpen ||
      state.isSectionsModalOpen ||
      state.isProfilesModalOpen ||
      state.isStructureModalOpen;

    document.body.classList.toggle('modal-open', anyModalOpen);
  }

  function renderToolState() {
    if (elements.searchInput.value !== state.searchQuery) {
      elements.searchInput.value = state.searchQuery;
    }

    elements.rulePresetSelect.value = state.rulePresetId;
    elements.cleanupModeSelect.value = state.cleanupMode;
    elements.structureModeSelect.value = state.structureMode;
    elements.sectionFilterBtn.textContent = getSectionButtonLabel();
    elements.profilesBtn.textContent = `Profiles (${state.profiles.length})`;
    elements.reviewStructureBtn.textContent = state.structuralReport?.summary.issueCount
      ? `Review Structure (${state.structuralReport.summary.issueCount})`
      : 'Review Structure';
    elements.previewMergedBtn.classList.toggle('is-active', state.previewMode === 'merged');
    elements.previewDiffBtn.classList.toggle('is-active', state.previewMode === 'diff');
    elements.previewFontSizeSelect.value = String(state.previewFontSize);
    elements.previewLineHeightSelect.value = String(state.previewLineHeight);
    elements.toggleLineNumbersBtn.classList.toggle('is-active', state.previewShowLineNumbers);
  }

  function usePresetDefaults() {
    if (!state.mergeModel) {
      return;
    }

    state.mergeModel.conflicts.forEach((conflict) => {
      mergeCore.selectConflictOption(state.mergeModel, conflict.id, conflict.defaultOptionId);
    });

    state.mergeModel.duplicates.forEach((duplicate) => {
      mergeCore.setDuplicatePreference(state.mergeModel, duplicate.id, duplicate.defaultKeepDuplicates);
    });

    setMergedContentFromModel();
    refresh();
    setStatus('Defaults Applied', 'info', 'Applied the active preset defaults to all conflicts and duplicate groups.');
  }

  function resetReviewChoices() {
    usePresetDefaults();
  }

  function refreshActions() {
    const hasMerge = Boolean(state.mergeModel);
    const hasConflicts = hasMerge && state.mergeModel.conflicts.length > 0;
    const hasDuplicates = hasMerge && state.mergeModel.duplicates.length > 0;
    const hasSearchVisibleConflict = hasConflicts && getVisibleConflicts().length > 0;

    elements.mergeBtn.disabled = state.files.length === 0;
    elements.mergeBtn.textContent = state.mergeModel ? 'Rebuild Merge' : 'Build Merge';
    elements.saveBtn.disabled = !state.mergeModel || !state.mergedContent;
    elements.reviewConflictBtn.disabled = !hasSearchVisibleConflict || !state.activeConflictId;
    elements.reviewStructureBtn.disabled = !hasMerge;
    elements.reviewDuplicatesBtn.disabled = !hasDuplicates || !state.activeDuplicateId;
    elements.removeAllDuplicatesBtn.disabled = !hasDuplicates;
    elements.keepAllDuplicatesBtn.disabled = !hasDuplicates;
    elements.useDefaultsBtn.disabled = !hasMerge || (state.mergeModel.conflicts.length === 0 && state.mergeModel.duplicates.length === 0);
    elements.resetReviewBtn.disabled = !hasMerge || (getManualOverrideCount() + getManualDuplicateCount() === 0);
    elements.applySectionSourceBtn.disabled = !hasConflicts || !state.activeConflictId;
    elements.applyConflictToSectionBtn.disabled = !hasConflicts || !state.activeConflictId;
    elements.autoCleanStructureBtn.disabled = !hasMerge;
    elements.categorizeConsoleVariablesBtn.disabled = !hasMerge;
    elements.resetStructureToolsBtn.disabled = !hasMerge;
    elements.sectionFilterBtn.disabled = state.files.length === 0;
    elements.applySectionsBtn.disabled = state.availableSections.length === 0;
  }

  function refresh() {
    refreshStatus();
    renderSummaryBar();
    renderToolState();
    renderFileList();
    renderConflictList();
    renderPreview();
    renderConflictModal();
    renderDuplicateModal();
    renderSectionsModal();
    renderProfilesModal();
    renderStructureModal();
    syncModalBodyState();
    refreshActions();
    scheduleAutosave();
  }

  function removeFile(index) {
    state.files.splice(index, 1);
    refreshAvailableSections();
    invalidateMerge();
    refresh();
  }

  async function addFiles() {
    const result = await api.openFiles();

    if (!result || result.error) {
      setStatus('Error', 'error', `Unable to open files: ${result?.error || 'unknown error'}`);
      return;
    }

    if (result.length === 0) {
      return;
    }

    state.files = mergeFilesByPath(state.files, result);
    refreshAvailableSections();
    invalidateMerge();
    refresh();
  }

  function buildMerge() {
    if (state.files.length === 0) {
      setStatus('No Files', 'warning', 'Load at least one INI file before building the merge.');
      return;
    }

    const snapshot = state.mergeModel ? createSelectionSnapshot() : null;
    rebuildMerge(snapshot);
  }

  async function saveMergedFile() {
    if (!state.mergedContent) {
      setStatus('No Output', 'warning', 'Build the merge before saving.');
      return;
    }

    const result = await api.saveFile(state.mergedContent);

    if (result.success) {
      setStatus('Saved', 'success', `Output saved to ${result.path}`);
      return;
    }

    if (result.canceled) {
      setStatus('Canceled', 'info', 'Save canceled.');
      return;
    }

    setStatus('Error', 'error', `Unable to save file: ${result.error || 'unknown error'}`);
  }

  function resetApp() {
    state.files = [];
    state.availableSections = [];
    state.excludedSections = [];
    state.sectionSelectionDraft = [];
    state.sectionSearchQuery = '';
    state.searchQuery = '';
    state.profileDraftName = '';
    invalidateMerge();
    refresh();
  }

  elements.addFilesBtn.addEventListener('click', addFiles);
  elements.mergeBtn.addEventListener('click', buildMerge);
  elements.saveBtn.addEventListener('click', saveMergedFile);
  elements.resetBtn.addEventListener('click', resetApp);
  elements.reviewConflictBtn.addEventListener('click', openConflictModal);
  elements.reviewStructureBtn.addEventListener('click', openStructureModal);
  elements.reviewDuplicatesBtn.addEventListener('click', openDuplicateModal);
  elements.useDefaultsBtn.addEventListener('click', usePresetDefaults);
  elements.resetReviewBtn.addEventListener('click', resetReviewChoices);
  elements.applySectionSourceBtn.addEventListener('click', () => applySelectedSourceToSection());
  elements.sectionFilterBtn.addEventListener('click', openSectionsModal);
  elements.profilesBtn.addEventListener('click', openProfilesModal);
  elements.previewMergedBtn.addEventListener('click', () => {
    state.previewMode = 'merged';
    refresh();
  });
  elements.previewDiffBtn.addEventListener('click', () => {
    state.previewMode = 'diff';
    refresh();
  });

  elements.searchInput.addEventListener('input', (event) => {
    state.searchQuery = event.target.value;
    refresh();
  });

  elements.rulePresetSelect.addEventListener('change', (event) => {
    state.rulePresetId = event.target.value;

    if (state.files.length === 0) {
      refresh();
      return;
    }

    const snapshot = state.mergeModel ? createSelectionSnapshot() : null;
    rebuildMerge(snapshot);
  });

  elements.cleanupModeSelect.addEventListener('change', (event) => {
    state.cleanupMode = event.target.value;

    if (state.files.length === 0 || !state.mergeModel) {
      refresh();
      return;
    }

    const snapshot = createSelectionSnapshot();
    rebuildMerge(snapshot);
  });

  elements.structureModeSelect.addEventListener('change', (event) => {
    state.structureMode = event.target.value;

    if (state.files.length === 0 || !state.mergeModel) {
      refresh();
      return;
    }

    const snapshot = createSelectionSnapshot();
    rebuildMerge(snapshot);
  });

  elements.previewFontSizeSelect.addEventListener('change', (event) => {
    state.previewFontSize = clampPreviewFontSize(event.target.value);
    refresh();
  });

  elements.previewLineHeightSelect.addEventListener('change', (event) => {
    state.previewLineHeight = clampPreviewLineHeight(event.target.value);
    refresh();
  });

  elements.toggleLineNumbersBtn.addEventListener('click', () => {
    state.previewShowLineNumbers = !state.previewShowLineNumbers;
    refresh();
  });

  elements.closeConflictModalBtn.addEventListener('click', closeConflictModal);
  elements.keepCurrentConflictBtn.addEventListener('click', advanceConflictReview);
  elements.applyConflictToSectionBtn.addEventListener('click', () => applySelectedSourceToSection(state.activeConflictId));
  elements.conflictModalBackdrop.addEventListener('click', closeConflictModal);

  elements.closeDuplicateModalBtn.addEventListener('click', closeDuplicateModal);
  elements.duplicateModalBackdrop.addEventListener('click', closeDuplicateModal);
  elements.removeAllDuplicatesBtn.addEventListener('click', () => applyAllDuplicatePreferences(false));
  elements.keepAllDuplicatesBtn.addEventListener('click', () => applyAllDuplicatePreferences(true));
  elements.removeDuplicateBtn.addEventListener('click', () => applyDuplicatePreference(state.activeDuplicateId, false));
  elements.keepDuplicateBtn.addEventListener('click', () => applyDuplicatePreference(state.activeDuplicateId, true));

  elements.closeSectionsModalBtn.addEventListener('click', closeSectionsModal);
  elements.sectionsModalBackdrop.addEventListener('click', closeSectionsModal);
  elements.sectionSearchInput.addEventListener('input', (event) => {
    state.sectionSearchQuery = event.target.value;
    refresh();
  });
  elements.selectAllSectionsBtn.addEventListener('click', () => {
    state.sectionSelectionDraft = state.availableSections.map((section) => section.name);
    refresh();
  });
  elements.clearSectionsBtn.addEventListener('click', () => {
    state.sectionSelectionDraft = [];
    refresh();
  });
  elements.applySectionsBtn.addEventListener('click', applySectionFilter);

  elements.closeProfilesModalBtn.addEventListener('click', closeProfilesModal);
  elements.profilesModalBackdrop.addEventListener('click', closeProfilesModal);
  elements.profileNameInput.addEventListener('input', (event) => {
    state.profileDraftName = event.target.value;
  });
  elements.saveProfileBtn.addEventListener('click', saveCurrentProfile);

  elements.closeStructureModalBtn.addEventListener('click', closeStructureModal);
  elements.structureModalBackdrop.addEventListener('click', closeStructureModal);
  elements.autoCleanStructureBtn.addEventListener('click', autoCleanStructureIssues);
  elements.categorizeConsoleVariablesBtn.addEventListener('click', toggleCategorizedConsoleVariables);
  elements.resetStructureToolsBtn.addEventListener('click', resetStructureTools);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (state.isStructureModalOpen) {
      closeStructureModal();
      return;
    }

    if (state.isProfilesModalOpen) {
      closeProfilesModal();
      return;
    }

    if (state.isSectionsModalOpen) {
      closeSectionsModal();
      return;
    }

    if (state.isDuplicateModalOpen) {
      closeDuplicateModal();
      return;
    }

    if (state.isConflictModalOpen) {
      closeConflictModal();
    }
  });

  window.addEventListener('beforeunload', () => {
    clearTimeout(autosaveTimer);

    if (autosaveReady) {
      void saveConfigNow();
    }
  });

  async function initialize() {
    populateRulePresets();
    refreshAvailableSections();
    refresh();
    await loadInitialConfig();
  }

  initialize().catch((error) => {
    setAutosaveMeta(`Autosave: ${error.message}`, 'error');
    refresh();
  });
})();
