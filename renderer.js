// Import electron components
const { ipcRenderer } = require('electron');

// Main state variables
const state = {
  files: {},
  iniContents: [],
  mergedContent: '',
  conflicts: [],
  currentConflictIndex: 0,
  mergeComplete: false,
  mergeInProgress: false
};

// References to DOM elements
const elements = {
  fileList: document.getElementById('fileList'),
  addFilesBtn: document.getElementById('addFilesBtn'),
  status: document.getElementById('status'),
  startMergeBtn: document.getElementById('startMergeBtn'),
  conflictResolver: document.getElementById('conflictResolver'),
  conflictTitle: document.getElementById('conflictTitle'),
  conflictSection: document.getElementById('conflictSection'),
  conflictSetting: document.getElementById('conflictSetting'),
  conflictOptions: document.getElementById('conflictOptions'),
  mergeResult: document.getElementById('mergeResult'),
  resultPreview: document.getElementById('resultPreview'),
  downloadBtn: document.getElementById('downloadBtn'),
  resetBtn: document.getElementById('resetBtn')
};

// Parse INI content into structured format
const parseINI = (content) => {
  const lines = content.split('\n');
  const result = {};
  let currentSection = null;

  for (let line of lines) {
    line = line.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith(';')) continue;

    // Section headers
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1);
      if (!result[currentSection]) {
        result[currentSection] = [];
      }
      continue;
    }

    // Must have a current section
    if (currentSection === null) continue;

    // Add line to current section
    result[currentSection].push(line);
  }

  return result;
};

// Convert structured INI back to text
const generateINI = (iniStructure) => {
  let output = '';

  for (const section in iniStructure) {
    output += `[${section}]\n`;
    for (const line of iniStructure[section]) {
      output += `${line}\n`;
    }
    output += `\n`; // Add single newline after each section
  }

  return output.trim(); // Remove trailing blank line at the end
};


// Extract setting name from an INI line
const getSettingName = (line) => {
  const equalPos = line.indexOf('=');
  return equalPos > 0 ? line.substring(0, equalPos).trim() : line.trim();
};

// Detect conflicts between INI files
const detectConflicts = (parsedInis) => {
  const conflicts = [];
  const settingMap = new Map();
  
  // Special handling for known repeatable settings
  const repeatableSettings = ['Paths', '+Suppress']; // Add other repeatable settings here
  
  parsedInis.forEach((ini, iniIndex) => {
    for (const section in ini) {
      const lines = ini[section];
      
      lines.forEach(line => {
        // Skip comment lines
        if (line.trim().startsWith(';')) return;
        
        const settingName = getSettingName(line);
        // Use the full line as the key for exact matching
        const key = `${section}|${line}`;
        const nameKey = `${section}|${settingName}`;
        
        // Skip conflict detection for repeatable settings
        if (repeatableSettings.includes(settingName)) {
          return;
        }
        
        // First check if we already have this exact line
        if (!settingMap.has(key)) {
          // If not, check if we have the same setting name with a different value
          const existingSettingKeys = Array.from(settingMap.keys())
            .filter(k => k.startsWith(`${section}|`) && getSettingName(k.split('|')[1]) === settingName);
          
          if (existingSettingKeys.length > 0) {
            // We have the same setting with a different value
            const existingKey = existingSettingKeys[0];
            const existing = settingMap.get(existingKey);
            
            // Create a conflict
            conflicts.push({
              key: nameKey,
              section,
              settingName,
              values: [
                { value: existingKey.split('|')[1], source: existing.sources[0] },
                { value: line, source: iniIndex }
              ]
            });
          } else {
            // First time seeing this setting
            settingMap.set(key, { 
              value: line, 
              sources: [iniIndex],
              section
            });
          }
        } else {
          // Exact same line exists, just add to sources
          const existing = settingMap.get(key);
          existing.sources.push(iniIndex);
        }
      });
    }
  });
  
  return conflicts;
};

// Merge INI files
const mergeINIs = () => {
  state.mergeInProgress = true;
  updateStatus('Processing files...');
  
  try {
    // Get file contents as array
    const fileContentArray = Object.values(state.files).map(file => file.content);
    
    // Parse all INI files
    const parsedInis = fileContentArray.map(content => parseINI(content));
    
    // Special handling for known repeatable settings
    const repeatableSettings = ['Paths', '+Suppress']; // Add other repeatable settings here
    
    // Find conflicts
    const detectedConflicts = detectConflicts(parsedInis);
    state.conflicts = detectedConflicts;
    
    // Track source files for each line (for reporting, not for adding comments)
    const lineSourceMap = new Map();
    const mergeSummary = {
      totalSettings: 0,
      uniqueSettings: 0,
      repeatedSettings: 0,
      settingsPerSource: {},
      sectionSummary: {}
    };
    
    // Initialize counters for each source file
    Object.keys(state.files).forEach((filePath, idx) => {
      mergeSummary.settingsPerSource[idx] = {
        name: state.files[filePath].name,
        count: 0
      };
    });
    
    // Start with the first file as base
    let mergedIni = JSON.parse(JSON.stringify(parsedInis[0])); // Deep clone
    
    // Count settings in first file
    for (const section in mergedIni) {
      mergeSummary.settingsPerSource[0].count += mergedIni[section].filter(line => 
        !line.trim().startsWith(';') && line.trim() !== ''
      ).length;
      
      // Initialize section summary
      if (!mergeSummary.sectionSummary[section]) {
        mergeSummary.sectionSummary[section] = {
          totalSettings: 0,
          sources: [0]
        };
      }
      
      // Count non-comment lines in this section
      mergeSummary.sectionSummary[section].totalSettings += mergedIni[section].filter(line => 
        !line.trim().startsWith(';') && line.trim() !== ''
      ).length;
    }
    
    // Add source tracking for base file
    for (const section in mergedIni) {
      mergedIni[section].forEach(line => {
        // Skip comment lines
        if (!line.trim().startsWith(';') && line.trim() !== '') {
          // Store source in the map
          lineSourceMap.set(line, [0]); // Source index 0 (first file)
        }
      });
    }
    
    // Add non-conflicting settings from other files
    for (let i = 1; i < parsedInis.length; i++) {
      const ini = parsedInis[i];
      
      for (const section in ini) {
        // Initialize section if not exists in merged result
        if (!mergedIni[section]) {
          mergedIni[section] = [];
          
          // Initialize section in summary
          if (!mergeSummary.sectionSummary[section]) {
            mergeSummary.sectionSummary[section] = {
              totalSettings: 0,
              sources: [i]
            };
          } else {
            mergeSummary.sectionSummary[section].sources.push(i);
          }
        } else if (!mergeSummary.sectionSummary[section].sources.includes(i)) {
          mergeSummary.sectionSummary[section].sources.push(i);
        }
        
        // Add lines that don't exist in merged result yet
        for (const line of ini[section]) {
          // Skip comment lines when calculating stats
          if (line.trim().startsWith(';') || line.trim() === '') continue;
          
          mergeSummary.settingsPerSource[i].count++; // Count original settings
          
          const settingName = getSettingName(line);
          
          // Check if this is a repeatable setting
          if (repeatableSettings.includes(settingName)) {
            // For repeatable settings, add all instances
            const lineAlreadyExists = mergedIni[section].some(existingLine => existingLine === line);
            if (!lineAlreadyExists) {
              mergedIni[section].push(line);
              lineSourceMap.set(line, [i]);
              mergeSummary.sectionSummary[section].totalSettings++;
              mergeSummary.repeatedSettings++;
            } else {
              // If line already exists, add this source to its sources
              const sources = lineSourceMap.get(line) || [];
              if (!sources.includes(i)) {
                sources.push(i);
                lineSourceMap.set(line, sources);
              }
            }
            continue;
          }
          
          // For non-repeatable settings, check for conflicts
          const existingLines = mergedIni[section].filter(existingLine => 
            getSettingName(existingLine) === settingName && 
            !existingLine.trim().startsWith(';')
          );
          
          if (existingLines.length === 0) {
            // Setting doesn't exist yet, add it
            mergedIni[section].push(line);
            lineSourceMap.set(line, [i]);
            mergeSummary.sectionSummary[section].totalSettings++;
            mergeSummary.uniqueSettings++;
          } else if (!existingLines.some(existingLine => existingLine === line)) {
            // Same setting with different value - this is a conflict
            // Will be handled by conflict resolution, don't add it now
          } else {
            // Exact same line already exists, just add source
            const sources = lineSourceMap.get(line) || [];
            if (!sources.includes(i)) {
              sources.push(i);
              lineSourceMap.set(line, sources);
            }
          }
        }
      }
    }
    
    // Preserve original comments from all files
    const allComments = new Map();
    
    // Collect comments from all files
    parsedInis.forEach((ini, iniIndex) => {
      for (const section in ini) {
        let previousLine = null;
        
        ini[section].forEach(line => {
          if (line.trim().startsWith(';')) {
            // This is a comment line
            if (previousLine && !previousLine.trim().startsWith(';')) {
              // Comment follows a setting - associate with that setting
              const commentKey = `${section}|${previousLine}`;
              if (!allComments.has(commentKey)) {
                allComments.set(commentKey, line);
              }
            } else {
              // Standalone comment or comment block - associate with section
              const commentKey = `${section}|SECTION_COMMENT|${line}`;
              allComments.set(commentKey, line);
            }
          }
          previousLine = line;
        });
      }
    });
    
    // Add comments to merged content
    const mergedWithComments = {};
    
    for (const section in mergedIni) {
      mergedWithComments[section] = [];
      
      // Add section-level comments first
      Array.from(allComments.keys())
        .filter(key => key.startsWith(`${section}|SECTION_COMMENT|`))
        .forEach(key => {
          mergedWithComments[section].push(allComments.get(key));
        });
      
      // Add settings with their associated comments
      for (const line of mergedIni[section]) {
        const commentKey = `${section}|${line}`;
        
        mergedWithComments[section].push(line);
        
        if (allComments.has(commentKey)) {
          mergedWithComments[section].push(allComments.get(commentKey));
        }
      }
    }
    
    // Calculate total settings
    mergeSummary.totalSettings = Object.values(mergeSummary.sectionSummary)
      .reduce((sum, section) => sum + section.totalSettings, 0);
    
    // Generate merged content
    state.mergedContent = generateINI(mergedWithComments);
    
    // Update status with summary
    const summaryText = `Merge Summary: Combined ${mergeSummary.totalSettings} settings from ${Object.keys(state.files).length} files.`;
    
    if (detectedConflicts.length > 0) {
      state.currentConflictIndex = 0;
      updateStatus(`${summaryText} Found ${detectedConflicts.length} conflicts. Please resolve them one by one.`);
      showConflictUI();
    } else {
      state.mergeComplete = true;
      updateStatus(`${summaryText} No conflicts found!`);
      state.mergeInProgress = false;
      showResultUI();
    }
  } catch (error) {
    updateStatus(`Error merging files: ${error.message}`);
    state.mergeInProgress = false;
  }
};

// Process a user selection for a conflict
const resolveConflict = (selectedIndex) => {
  const conflict = state.conflicts[state.currentConflictIndex];
  const selectedValue = conflict.values[selectedIndex].value;
  
  // Update the merged content with the selected value
  const lines = state.mergedContent.split('\n');
  let inSection = false;
  let updated = false;
  
  const updatedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track when we're in the relevant section
    if (line.trim() === `[${conflict.section}]`) {
      inSection = true;
      updatedLines.push(line);
      continue;
    }
    
    // If we reach a new section, we're no longer in the target section
    if (line.trim().startsWith('[') && line.trim().endsWith(']') && inSection) {
      inSection = false;
    }
    
    // If we're in the right section, check for the setting to replace
    if (inSection && getSettingName(line.trim()) === conflict.settingName) {
      // Skip any existing comment line associated with this setting
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith(';')) {
        i++; // Skip the next line (comment)
      }
      
      if (!updated) {
        updatedLines.push(selectedValue);
        updated = true;
      }
      continue; // Skip the conflicting line
    }
    
    updatedLines.push(line);
  }
  
  // If we didn't find the setting, it might not exist in the output yet
  if (!updated) {
    // Find the right section and add the setting
    inSection = false;
    let sectionFound = false;
    
    for (let i = 0; i < updatedLines.length; i++) {
      const line = updatedLines[i].trim();
      
      if (line === `[${conflict.section}]`) {
        sectionFound = true;
        break;
      }
    }
    
    if (sectionFound) {
      const newLines = [];
      inSection = false;
      
      for (let i = 0; i < updatedLines.length; i++) {
        const line = updatedLines[i].trim();
        newLines.push(updatedLines[i]);
        
        if (line === `[${conflict.section}]`) {
          inSection = true;
          continue;
        }
        
        if (inSection && (line.startsWith('[') || i === updatedLines.length - 1)) {
          // We're at the end of the section, insert the new value
          newLines.splice(newLines.length - 1, 0, selectedValue);
          break;
        }
      }
      
      updatedLines.length = 0;
      updatedLines.push(...newLines);
    } else {
      // Add new section at the end
      updatedLines.push(`[${conflict.section}]`);
      updatedLines.push(selectedValue);
      updatedLines.push('');
    }
  }
  
  state.mergedContent = updatedLines.join('\n');
  
  // Move to next conflict or complete
  if (state.currentConflictIndex < state.conflicts.length - 1) {
    state.currentConflictIndex++;
    showConflictUI();
  } else {
    state.mergeComplete = true;
    updateStatus('All conflicts resolved! Merge complete.');
    state.mergeInProgress = false;
    hideConflictUI();
    showResultUI();
  }
};

// UI Update Functions
const updateFileList = () => {
  const fileArray = Object.values(state.files);
  
  if (fileArray.length === 0) {
    elements.fileList.innerHTML = '<li>No files loaded</li>';
    elements.startMergeBtn.style.display = 'none';
  } else {
    elements.fileList.innerHTML = fileArray.map((file) => 
      `<li>${file.name}</li>`
    ).join('');
    elements.startMergeBtn.style.display = 'inline-block';
  }
};

const updateStatus = (message) => {
  elements.status.textContent = message;
  elements.status.style.display = message ? 'block' : 'none';
};

const showConflictUI = () => {
  const conflict = state.conflicts[state.currentConflictIndex];
  const fileArray = Object.values(state.files);
  
  elements.conflictTitle.textContent = `Conflict ${state.currentConflictIndex + 1} of ${state.conflicts.length}`;
  elements.conflictSection.textContent = `[${conflict.section}]`;
  elements.conflictSetting.textContent = conflict.settingName;
  
  elements.conflictOptions.innerHTML = conflict.values.map((option, index) => `
    <div class="conflict-option">
      <div class="option-header">Option ${index + 1} (from file ${fileArray[option.source]?.name || 'unknown'})</div>
      <pre>${option.value}</pre>
      <button class="button choose-option" data-index="${index}">Choose This Value</button>
    </div>
  `).join('');
  
  // Add event listeners to the dynamically created buttons
  document.querySelectorAll('.choose-option').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      resolveConflict(index);
    });
  });
  
  elements.conflictResolver.style.display = 'block';
};

const hideConflictUI = () => {
  elements.conflictResolver.style.display = 'none';
};

const showResultUI = () => {
  elements.resultPreview.textContent = state.mergedContent;
  elements.mergeResult.style.display = 'block';
};

const hideResultUI = () => {
  elements.mergeResult.style.display = 'none';
};

// Event Handlers
elements.addFilesBtn.addEventListener('click', async () => {
  const fileContents = await ipcRenderer.invoke('open-files');
  
  if (Object.keys(fileContents).length > 0) {
    // Add the new files to the state
    state.files = { ...state.files, ...fileContents };
    updateFileList();
  }
});

elements.startMergeBtn.addEventListener('click', () => {
  hideResultUI();
  mergeINIs();
});

elements.downloadBtn.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('save-file', state.mergedContent);
  
  if (result.success) {
    updateStatus(`File saved successfully to: ${result.path}`);
  } else {
    updateStatus(`Error saving file: ${result.error || 'Unknown error'}`);
  }
});

elements.resetBtn.addEventListener('click', () => {
  state.files = {};
  state.iniContents = [];
  state.mergedContent = '';
  state.conflicts = [];
  state.currentConflictIndex = 0;
  state.mergeComplete = false;
  state.mergeInProgress = false;
  
  updateFileList();
  updateStatus('');
  hideConflictUI();
  hideResultUI();
});

// Initialize the UI
updateFileList();
