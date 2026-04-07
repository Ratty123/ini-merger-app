(function () {
  const api = window.iniMergerAPI;
  const mergeCore = window.IniMergeCore;

  const PREVIEW_PLACEHOLDER = [
    '; Merged output preview',
    '; Add files and click Build Merge'
  ].join('\n');

  const state = {
    files: [],
    mergeModel: null,
    mergedContent: '',
    activeConflictId: null,
    activeDuplicateId: null,
    isConflictModalOpen: false,
    isDuplicateModalOpen: false
  };

  const elements = {
    addFilesBtn: document.getElementById('addFilesBtn'),
    mergeBtn: document.getElementById('mergeBtn'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    reviewConflictBtn: document.getElementById('reviewConflictBtn'),
    reviewDuplicatesBtn: document.getElementById('reviewDuplicatesBtn'),
    statusBadge: document.getElementById('statusBadge'),
    statusMessage: document.getElementById('statusMessage'),
    summaryBar: document.getElementById('summaryBar'),
    fileList: document.getElementById('fileList'),
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
    keepCurrentConflictBtn: document.getElementById('keepCurrentConflictBtn'),
    duplicateModal: document.getElementById('duplicateModal'),
    duplicateModalBackdrop: document.getElementById('duplicateModalBackdrop'),
    duplicateModalTitle: document.getElementById('duplicateModalTitle'),
    duplicateModalMeta: document.getElementById('duplicateModalMeta'),
    duplicateModalOptions: document.getElementById('duplicateModalOptions'),
    closeDuplicateModalBtn: document.getElementById('closeDuplicateModalBtn'),
    removeDuplicateBtn: document.getElementById('removeDuplicateBtn'),
    keepDuplicateBtn: document.getElementById('keepDuplicateBtn')
  };

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

  function getLineCount(text) {
    if (!text) {
      return 0;
    }

    return text.split(/\r?\n/).length;
  }

  function mergeFilesByPath(existingFiles, nextFiles) {
    const merged = new Map(existingFiles.map((file) => [file.path, file]));

    nextFiles.forEach((file) => {
      merged.set(file.path, file);
    });

    return Array.from(merged.values());
  }

  function getManualOverrideCount() {
    if (!state.mergeModel) {
      return 0;
    }

    return state.mergeModel.conflicts.reduce((count, conflict) => {
      const defaultOption = conflict.options[0];
      return count + (defaultOption && conflict.selectedOptionId !== defaultOption.id ? 1 : 0);
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
        `${state.files.length} file${state.files.length === 1 ? '' : 's'} loaded. Arrange the order and build the merge.`
      );
      return;
    }

    const conflictCount = state.mergeModel.summary.conflictCount;
    const duplicateCount = state.mergeModel.summary.duplicateCount;

    if (conflictCount > 0 || duplicateCount > 0) {
      const issueParts = [];
      const actionParts = [];

      if (conflictCount > 0) {
        issueParts.push(`${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`);
        actionParts.push('review conflicts');
      }

      if (duplicateCount > 0) {
        issueParts.push(`${duplicateCount} duplicate group${duplicateCount === 1 ? '' : 's'}`);
        actionParts.push('review duplicates');
      }

      setStatus(
        conflictCount > 0 ? 'Review Needed' : 'Duplicates Found',
        'warning',
        `${issueParts.join(' and ')} found. ${actionParts[0].charAt(0).toUpperCase()}${actionParts[0].slice(1)}${actionParts.length > 1 ? ` and ${actionParts[1]}` : ''} before saving.`
      );
      return;
    }

    setStatus('Ready To Save', 'success', 'Merge built successfully. No conflicts found.');
  }

  function renderSummaryBar() {
    clearNode(elements.summaryBar);

    const items = [
      { value: String(state.files.length), label: 'Files' },
      { value: state.mergeModel ? String(state.mergeModel.summary.sectionCount) : '--', label: 'Sections' },
      { value: state.mergeModel ? String(state.mergeModel.summary.conflictCount) : '--', label: 'Conflicts' },
      { value: state.mergeModel ? String(state.mergeModel.summary.duplicateCount) : '--', label: 'Duplicates' },
      { value: state.mergeModel ? String(getManualOverrideCount()) : '--', label: 'Overrides' }
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

  function getPriorityLabel(index) {
    if (index === 0) {
      return 'Lowest priority';
    }

    if (index === state.files.length - 1) {
      return 'Highest priority';
    }

    return `Priority ${index + 1}`;
  }

  function invalidateMerge() {
    state.mergeModel = null;
    state.mergedContent = '';
    state.activeConflictId = null;
    state.activeDuplicateId = null;
    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
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

  function renderPreview() {
    if (!state.mergeModel) {
      elements.previewMeta.textContent = 'No merged output yet.';
      elements.previewOutput.textContent = PREVIEW_PLACEHOLDER;
      elements.previewOutput.classList.add('is-empty');
      return;
    }

    elements.previewMeta.textContent = `${getLineCount(state.mergedContent)} lines`;
    elements.previewOutput.textContent = state.mergedContent;
    elements.previewOutput.classList.remove('is-empty');
  }

  function selectActiveConflict(conflictId) {
    state.activeConflictId = conflictId;
    refresh();
  }

  function openConflictModal() {
    if (!state.mergeModel || state.mergeModel.conflicts.length === 0) {
      return;
    }

    if (!state.activeConflictId) {
      state.activeConflictId = state.mergeModel.conflicts[0].id;
    }

    state.isDuplicateModalOpen = false;
    state.isConflictModalOpen = true;
    refresh();
  }

  function closeConflictModal() {
    state.isConflictModalOpen = false;
    refresh();
  }

  function openDuplicateModal() {
    if (!state.mergeModel || state.mergeModel.duplicates.length === 0) {
      return;
    }

    if (!state.activeDuplicateId) {
      state.activeDuplicateId = state.mergeModel.duplicates[0].id;
    }

    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = true;
    refresh();
  }

  function closeDuplicateModal() {
    state.isDuplicateModalOpen = false;
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

    elements.conflictMeta.textContent = `${state.mergeModel.conflicts.length} conflict${state.mergeModel.conflicts.length === 1 ? '' : 's'}`;

    state.mergeModel.conflicts.forEach((conflict) => {
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
          `Current: ${selectedOption ? selectedOption.sourceNames[0] : 'unknown'} | Sources: ${uniqueSources.join(', ')}`
        )
      );

      const badge = createElement(
        'span',
        'conflict-badge',
        conflict.selectedOptionId === conflict.options[0].id ? 'Default' : 'Override'
      );

      top.append(copy, badge);
      card.append(top);

      elements.conflictList.appendChild(card);
    });
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
    elements.conflictModalMeta.textContent = `Conflict ${conflictIndex + 1} of ${state.mergeModel.conflicts.length} | Current selection: ${selectedOption ? selectedOption.sourceNames[0] : 'unknown'} | ${conflict.options.length} option${conflict.options.length === 1 ? '' : 's'}`;

    clearNode(elements.conflictModalOptions);

    conflict.options.forEach((option, index) => {
      const optionCard = createElement(
        'section',
        `option-card${option.id === conflict.selectedOptionId ? ' is-selected' : ''}`
      );

      const optionTop = createElement('div', 'option-card__top');
      const tags = createElement('div', 'option-tags');

      if (index === 0) {
        tags.appendChild(createElement('span', 'option-tag is-default', 'Highest priority'));
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

  function syncModalBodyState() {
    document.body.classList.toggle('modal-open', state.isConflictModalOpen || state.isDuplicateModalOpen);
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

  function refreshActions() {
    elements.mergeBtn.disabled = state.files.length === 0;
    elements.mergeBtn.textContent = state.mergeModel ? 'Rebuild Merge' : 'Build Merge';
    elements.saveBtn.disabled = !state.mergeModel || !state.mergedContent;
    elements.reviewConflictBtn.disabled = !state.mergeModel || !state.activeConflictId;
    elements.reviewDuplicatesBtn.disabled = !state.mergeModel || !state.activeDuplicateId;
  }

  function refresh() {
    refreshStatus();
    renderSummaryBar();
    renderFileList();
    renderPreview();
    renderConflictList();
    renderConflictModal();
    renderDuplicateModal();
    syncModalBodyState();
    refreshActions();
  }

  function removeFile(index) {
    state.files.splice(index, 1);
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
    invalidateMerge();
    refresh();
  }

  function buildMerge() {
    if (state.files.length === 0) {
      setStatus('No Files', 'warning', 'Load at least one INI file before building the merge.');
      return;
    }

    state.mergeModel = mergeCore.createMergeModel(state.files);
    state.mergedContent = mergeCore.renderMergedContent(state.mergeModel);
    state.activeConflictId = state.mergeModel.conflicts[0] ? state.mergeModel.conflicts[0].id : null;
    state.activeDuplicateId = state.mergeModel.duplicates[0] ? state.mergeModel.duplicates[0].id : null;
    state.isConflictModalOpen = false;
    state.isDuplicateModalOpen = false;
    refresh();
  }

  function applyConflictSelection(conflictId, optionId) {
    mergeCore.selectConflictOption(state.mergeModel, conflictId, optionId);
    state.mergedContent = mergeCore.renderMergedContent(state.mergeModel);
    state.activeConflictId = conflictId;
    advanceConflictReview();
  }

  function applyDuplicatePreference(duplicateId, keepDuplicates) {
    mergeCore.setDuplicatePreference(state.mergeModel, duplicateId, keepDuplicates);
    state.mergedContent = mergeCore.renderMergedContent(state.mergeModel);
    state.activeDuplicateId = duplicateId;
    advanceDuplicateReview();
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
    invalidateMerge();
    refresh();
  }

  elements.addFilesBtn.addEventListener('click', addFiles);
  elements.mergeBtn.addEventListener('click', buildMerge);
  elements.saveBtn.addEventListener('click', saveMergedFile);
  elements.resetBtn.addEventListener('click', resetApp);
  elements.reviewConflictBtn.addEventListener('click', openConflictModal);
  elements.reviewDuplicatesBtn.addEventListener('click', openDuplicateModal);
  elements.closeConflictModalBtn.addEventListener('click', closeConflictModal);
  elements.keepCurrentConflictBtn.addEventListener('click', advanceConflictReview);
  elements.conflictModalBackdrop.addEventListener('click', closeConflictModal);
  elements.closeDuplicateModalBtn.addEventListener('click', closeDuplicateModal);
  elements.duplicateModalBackdrop.addEventListener('click', closeDuplicateModal);
  elements.removeDuplicateBtn.addEventListener('click', () => applyDuplicatePreference(state.activeDuplicateId, false));
  elements.keepDuplicateBtn.addEventListener('click', () => applyDuplicatePreference(state.activeDuplicateId, true));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
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

  refresh();
})();
