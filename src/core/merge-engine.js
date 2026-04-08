(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IniMergeCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const REPEATABLE_KEYS = new Set(['paths']);
  const COMMENT_PREFIXES = [';', '#'];

  function normalizeLineEndings(content) {
    return String(content ?? '').replace(/\r\n?/g, '\n');
  }

  function createId(prefix, value) {
    return `${prefix}:${value}`;
  }

  function isCommentLine(line) {
    const trimmed = line.trim();
    return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  }

  function isSectionLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('[') && trimmed.endsWith(']');
  }

  function normalizeKey(key) {
    return key.trim().toLowerCase();
  }

  function normalizeSectionName(sectionName) {
    return String(sectionName ?? '').trim().toLowerCase();
  }

  function normalizeCreateMergeOptions(options) {
    const excludedSections = new Set(
      Array.from(options?.excludedSections || []).map((sectionName) => normalizeSectionName(sectionName))
    );

    return {
      excludedSections,
      defaultConflictStrategy: options?.defaultConflictStrategy === 'lowest' ? 'lowest' : 'highest',
      defaultDuplicateStrategy: options?.defaultDuplicateStrategy === 'keep' ? 'keep' : 'remove'
    };
  }

  function normalizeRenderOptions(options) {
    const cleanupMode = ['smart', 'minimal'].includes(options?.cleanupMode) ? options.cleanupMode : 'preserve';
    return {
      cleanupMode
    };
  }

  function classifySetting(operator, normalizedKey) {
    if (operator === '.') {
      return { kind: 'repeatable', dedupeMode: 'keep' };
    }

    if (operator === '+' || operator === '-' || operator === '!') {
      return { kind: 'repeatable', dedupeMode: 'dedupe' };
    }

    if (REPEATABLE_KEYS.has(normalizedKey)) {
      return { kind: 'repeatable', dedupeMode: 'dedupe' };
    }

    return { kind: 'scalar', dedupeMode: 'dedupe' };
  }

  function parseSettingLine(line) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([+\-\.!]?)([^=]+?)(?:\s*=\s*(.*))?$/);

    if (!match) {
      return null;
    }

    const operator = match[1] || '';
    const key = match[2].trim();

    if (!key) {
      return null;
    }

    const value = typeof match[3] === 'string' ? match[3] : '';
    const normalizedKey = normalizeKey(key);
    const classification = classifySetting(operator, normalizedKey);

    return {
      raw: trimmed,
      operator,
      key,
      normalizedKey,
      value,
      kind: classification.kind,
      dedupeMode: classification.dedupeMode
    };
  }

  function parseIni(content, sourceMeta) {
    const lines = normalizeLineEndings(content).split('\n');
    const document = {
      sourceId: sourceMeta.id,
      sourceName: sourceMeta.name,
      sourcePath: sourceMeta.path,
      preamble: [],
      sections: []
    };

    let currentSection = null;
    let pendingLines = [];

    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index];

      if (isSectionLine(rawLine)) {
        if (currentSection) {
          currentSection.trailingLines.push(...pendingLines);
        } else {
          document.preamble.push(...pendingLines);
        }

        pendingLines = [];
        currentSection = {
          name: rawLine.trim().slice(1, -1).trim(),
          entries: [],
          trailingLines: []
        };
        document.sections.push(currentSection);
        continue;
      }

      if (rawLine.trim() === '' || isCommentLine(rawLine)) {
        pendingLines.push(rawLine);
        continue;
      }

      const parsedSetting = parseSettingLine(rawLine);

      if (!currentSection || !parsedSetting) {
        document.preamble.push(...pendingLines, rawLine);
        pendingLines = [];
        continue;
      }

      currentSection.entries.push({
        ...parsedSetting,
        leadingLines: pendingLines,
        lineNumber: index + 1,
        sourceId: sourceMeta.id,
        sourceName: sourceMeta.name,
        sourcePath: sourceMeta.path
      });
      pendingLines = [];
    }

    if (currentSection) {
      currentSection.trailingLines.push(...pendingLines);
    } else {
      document.preamble.push(...pendingLines);
    }

    return document;
  }

  function getEffectiveEntries(section) {
    const scalarBuckets = new Map();
    const records = [];

    section.entries.forEach((entry, index) => {
      if (entry.kind === 'scalar') {
        const semanticKey = createId('scalar', entry.normalizedKey);
        scalarBuckets.set(semanticKey, {
          type: 'scalar',
          semanticKey,
          order: index,
          entry
        });
        return;
      }

      records.push({
        type: 'repeatable',
        semanticKey: entry.dedupeMode === 'dedupe'
          ? createId('repeatable', entry.raw)
          : createId('repeatable-instance', `${entry.sourceId}:${entry.lineNumber}`),
        order: index,
        entry
      });
    });

    const scalarRecords = Array.from(scalarBuckets.values());
    return scalarRecords.concat(records).sort((left, right) => left.order - right.order);
  }

  function uniqueLooseLines(groups) {
    const merged = [];
    const seen = new Set();

    groups.forEach((lines) => {
      lines.forEach((line) => {
        const fingerprint = line === '' ? '__BLANK__' : line;

        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          merged.push(line);
        }
      });
    });

    return merged;
  }

  function createOccurrence(entry, fileIndex, encounterIndex) {
    return {
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      sourcePath: entry.sourcePath,
      lineNumber: entry.lineNumber,
      raw: entry.raw,
      leadingLines: entry.leadingLines.slice(),
      precedence: fileIndex,
      encounterIndex
    };
  }

  function createOption(entry, fileIndex, encounterIndex) {
    const occurrence = createOccurrence(entry, fileIndex, encounterIndex);

    return {
      id: createId('option', `${entry.sourceId}:${entry.lineNumber}:${encounterIndex}`),
      raw: entry.raw,
      leadingLines: entry.leadingLines.slice(),
      sourceNames: [entry.sourceName],
      sourceIds: [entry.sourceId],
      precedence: fileIndex,
      encounterIndex,
      occurrences: [occurrence]
    };
  }

  function addSourceToOption(option, entry, fileIndex, encounterIndex) {
    if (!option.sourceIds.includes(entry.sourceId)) {
      option.sourceIds.push(entry.sourceId);
      option.sourceNames.push(entry.sourceName);
    }

    option.precedence = Math.max(option.precedence, fileIndex);
    option.encounterIndex = Math.max(option.encounterIndex, encounterIndex);
    option.occurrences.push(createOccurrence(entry, fileIndex, encounterIndex));
  }

  function sortConflictOptions(options) {
    return options.slice().sort((left, right) => {
      if (right.precedence !== left.precedence) {
        return right.precedence - left.precedence;
      }

      return right.encounterIndex - left.encounterIndex;
    });
  }

  function getDefaultConflictOptionId(options, strategy) {
    if (options.length === 0) {
      return null;
    }

    return strategy === 'lowest' ? options[options.length - 1].id : options[0].id;
  }

  function createMergeModel(files, options = {}) {
    const buildOptions = normalizeCreateMergeOptions(options);
    const parsedDocuments = files.map((file) => parseIni(file.content, file));
    const sectionsByName = new Map();
    const conflicts = [];
    const duplicates = [];
    let encounterIndex = 0;

    const model = {
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        path: file.path
      })),
      preamble: uniqueLooseLines(parsedDocuments.map((document) => document.preamble)),
      sections: [],
      conflicts,
      duplicates,
      summary: {
        fileCount: files.length,
        sectionCount: 0,
        scalarCount: 0,
        repeatableCount: 0,
        conflictCount: 0,
        duplicateCount: 0
      }
    };

    parsedDocuments.forEach((document, fileIndex) => {
      document.sections.forEach((section) => {
        if (buildOptions.excludedSections.has(normalizeSectionName(section.name))) {
          return;
        }

        let aggregate = sectionsByName.get(section.name);

        if (!aggregate) {
          aggregate = {
            name: section.name,
            items: [],
            itemIndex: new Map(),
            trailingGroups: [section.trailingLines.slice()]
          };
          sectionsByName.set(section.name, aggregate);
          model.sections.push(aggregate);
        } else {
          aggregate.trailingGroups.push(section.trailingLines.slice());
        }

        const effectiveEntries = getEffectiveEntries(section);

        effectiveEntries.forEach((record) => {
          encounterIndex += 1;

          if (record.type === 'repeatable') {
            if (record.entry.dedupeMode === 'dedupe' && aggregate.itemIndex.has(record.semanticKey)) {
              const existingItem = aggregate.items[aggregate.itemIndex.get(record.semanticKey)];
              addSourceToOption(existingItem.entry, record.entry, fileIndex, encounterIndex);
              return;
            }

            const repeatableEntry = createOption(record.entry, fileIndex, encounterIndex);
            const item = {
              type: 'repeatable',
              semanticKey: record.semanticKey,
              label: `${record.entry.operator}${record.entry.key}`,
              entry: repeatableEntry
            };

            aggregate.itemIndex.set(record.semanticKey, aggregate.items.length);
            aggregate.items.push(item);
            return;
          }

          let scalarItem;

          if (aggregate.itemIndex.has(record.semanticKey)) {
            scalarItem = aggregate.items[aggregate.itemIndex.get(record.semanticKey)];
          } else {
            scalarItem = {
              type: 'scalar',
              semanticKey: record.semanticKey,
              label: record.entry.key,
              optionsMap: new Map(),
              options: [],
              selectedOptionId: null,
              conflictId: null
            };
            aggregate.itemIndex.set(record.semanticKey, aggregate.items.length);
            aggregate.items.push(scalarItem);
          }

          if (scalarItem.optionsMap.has(record.entry.raw)) {
            addSourceToOption(scalarItem.optionsMap.get(record.entry.raw), record.entry, fileIndex, encounterIndex);
          } else {
            const option = createOption(record.entry, fileIndex, encounterIndex);
            scalarItem.optionsMap.set(record.entry.raw, option);
            scalarItem.options.push(option);
          }
        });
      });
    });

    model.sections = model.sections.map((section) => {
      const finalizedItems = section.items.map((item) => {
        if (item.type === 'repeatable') {
          model.summary.repeatableCount += 1;

          if (item.entry.occurrences.length > 1) {
            duplicates.push({
              id: createId('duplicate', `${section.name}:${item.label}:${item.entry.id}`),
              type: 'repeatable',
              sectionName: section.name,
              label: item.label,
              raw: item.entry.raw,
              optionId: item.entry.id,
              defaultKeepDuplicates: buildOptions.defaultDuplicateStrategy === 'keep',
              keepDuplicates: buildOptions.defaultDuplicateStrategy === 'keep',
              occurrences: item.entry.occurrences.slice()
            });
          }

          return item;
        }

        const sortedOptions = sortConflictOptions(item.options);
        const selectedOptionId = getDefaultConflictOptionId(sortedOptions, buildOptions.defaultConflictStrategy);
        model.summary.scalarCount += 1;

        sortedOptions.forEach((option) => {
          if (option.occurrences.length > 1) {
            duplicates.push({
              id: createId('duplicate', `${section.name}:${item.label}:${option.id}`),
              type: 'scalar',
              sectionName: section.name,
              label: item.label,
              raw: option.raw,
              optionId: option.id,
              defaultKeepDuplicates: buildOptions.defaultDuplicateStrategy === 'keep',
              keepDuplicates: buildOptions.defaultDuplicateStrategy === 'keep',
              occurrences: option.occurrences.slice()
            });
          }
        });

        if (sortedOptions.length > 1) {
          const conflictId = createId('conflict', `${section.name}:${item.label}`);
          conflicts.push({
            id: conflictId,
            sectionName: section.name,
            label: item.label,
            options: sortedOptions,
            defaultOptionId: selectedOptionId,
            selectedOptionId
          });
          item.conflictId = conflictId;
        }

        return {
          type: 'scalar',
          semanticKey: item.semanticKey,
          label: item.label,
          options: sortedOptions,
          selectedOptionId,
          conflictId: item.conflictId
        };
      });

      return {
        name: section.name,
        items: finalizedItems,
        trailingLines: uniqueLooseLines(section.trailingGroups)
      };
    });

    model.summary.sectionCount = model.sections.length;
    model.summary.conflictCount = conflicts.length;
    model.summary.duplicateCount = duplicates.length;
    return model;
  }

  function findConflict(model, conflictId) {
    return model.conflicts.find((conflict) => conflict.id === conflictId) || null;
  }

  function selectConflictOption(model, conflictId, optionId) {
    const conflict = findConflict(model, conflictId);

    if (!conflict) {
      throw new Error(`Unknown conflict: ${conflictId}`);
    }

    if (!conflict.options.some((option) => option.id === optionId)) {
      throw new Error(`Unknown option ${optionId} for conflict ${conflictId}`);
    }

    conflict.selectedOptionId = optionId;

    for (const section of model.sections) {
      for (const item of section.items) {
        if (item.type === 'scalar' && item.conflictId === conflictId) {
          item.selectedOptionId = optionId;
          return;
        }
      }
    }
  }

  function findDuplicate(model, duplicateId) {
    return model.duplicates.find((duplicate) => duplicate.id === duplicateId) || null;
  }

  function setDuplicatePreference(model, duplicateId, keepDuplicates) {
    const duplicate = findDuplicate(model, duplicateId);

    if (!duplicate) {
      throw new Error(`Unknown duplicate: ${duplicateId}`);
    }

    duplicate.keepDuplicates = Boolean(keepDuplicates);
  }

  function getSelectedScalarOption(item, conflictsById) {
    if (!item.conflictId) {
      return item.options[0] || null;
    }

    const conflict = conflictsById.get(item.conflictId);

    if (!conflict) {
      return item.options[0] || null;
    }

    return conflict.options.find((option) => option.id === conflict.selectedOptionId) || conflict.options[0] || null;
  }

  function pushLines(target, lines) {
    lines.forEach((line) => {
      target.push(line);
    });
  }

  function trimEdgeBlankLines(lines) {
    let start = 0;
    let end = lines.length;

    while (start < end && lines[start] === '') {
      start += 1;
    }

    while (end > start && lines[end - 1] === '') {
      end -= 1;
    }

    return lines.slice(start, end);
  }

  function stripInlineComment(line) {
    const parsed = parseSettingLine(line);

    if (!parsed) {
      return line;
    }

    const match = line.match(/^(\s*[+\-\.!]?[^=]+=\s*.*?)(\s+[;#].*)$/);
    return match ? match[1].trimEnd() : line;
  }

  function hasExplicitAssignment(line) {
    return /^\s*[+\-\.!]?[^=]+?=\s*.*$/.test(line);
  }

  function getNextMeaningfulLine(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index += 1) {
      if (lines[index].trim() !== '') {
        return lines[index];
      }
    }

    return '';
  }

  function cleanupRenderedLines(lines, cleanupMode) {
    if (cleanupMode === 'preserve') {
      return trimEdgeBlankLines(lines);
    }

    const stripStandaloneComments = cleanupMode === 'smart' || cleanupMode === 'minimal';
    const stripInlineComments = cleanupMode === 'minimal';
    const cleaned = [];

    lines.forEach((line, index) => {
      if (stripStandaloneComments && isCommentLine(line)) {
        return;
      }

      if (cleanupMode === 'minimal' && line.trim() !== '' && !isSectionLine(line) && !hasExplicitAssignment(line)) {
        return;
      }

      const nextLine = stripInlineComments ? stripInlineComment(line) : line;
      const trimmed = nextLine.trim();

      if (trimmed === '') {
        const previousLine = cleaned.length > 0 ? cleaned[cleaned.length - 1] : '';
        const upcomingLine = getNextMeaningfulLine(lines, index + 1);

        if (previousLine === '' || isSectionLine(previousLine) || isSectionLine(upcomingLine)) {
          return;
        }
      }

      cleaned.push(nextLine);
    });

    return trimEdgeBlankLines(cleaned);
  }

  function renderMergedContent(model, options = {}) {
    const renderOptions = normalizeRenderOptions(options);
    const lines = [];
    const conflictsById = new Map(model.conflicts.map((conflict) => [conflict.id, conflict]));
    const duplicatesByOptionId = new Map(model.duplicates.map((duplicate) => [duplicate.optionId, duplicate]));

    pushLines(lines, model.preamble);

    model.sections.forEach((section, sectionIndex) => {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }

      lines.push(`[${section.name}]`);

      section.items.forEach((item) => {
        if (item.type === 'repeatable') {
          const duplicate = duplicatesByOptionId.get(item.entry.id);

          if (duplicate && duplicate.keepDuplicates) {
            item.entry.occurrences.forEach((occurrence) => {
              pushLines(lines, occurrence.leadingLines);
              lines.push(occurrence.raw);
            });
            return;
          }

          pushLines(lines, item.entry.leadingLines);
          lines.push(item.entry.raw);
          return;
        }

        const selectedOption = getSelectedScalarOption(item, conflictsById);

        if (!selectedOption) {
          return;
        }

        const duplicate = duplicatesByOptionId.get(selectedOption.id);

        if (duplicate && duplicate.keepDuplicates) {
          selectedOption.occurrences.forEach((occurrence) => {
            pushLines(lines, occurrence.leadingLines);
            lines.push(occurrence.raw);
          });
          return;
        }

        pushLines(lines, selectedOption.leadingLines);
        lines.push(selectedOption.raw);
      });

      pushLines(lines, section.trailingLines);

      if (sectionIndex < model.sections.length - 1 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
    });

    return cleanupRenderedLines(lines, renderOptions.cleanupMode).join('\r\n');
  }

  return {
    parseIni,
    createMergeModel,
    renderMergedContent,
    selectConflictOption,
    setDuplicatePreference
  };
});
