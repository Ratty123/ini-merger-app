(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IniStructureTools = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const CATEGORY_DEFINITIONS = [
    { id: 'lumen', title: 'Lumen & Global Illumination', patterns: ['r.lumen.', 'r.lumenscene.'] },
    { id: 'shadows', title: 'Shadows & Virtual Shadow Maps', patterns: ['r.shadow.', 'r.capsule', 'r.dfshadow', 'r.dffullresolution', 'r.dfdistancescale', 'r.dfshadowquality', 'r.supportpointlightwholesceneshadows', 'r.allowpointlightcubemapshadows'] },
    { id: 'atmosphere', title: 'Atmosphere, Fog & Clouds', patterns: ['r.skyatmosphere.', 'r.volumetricfog.', 'r.volumetriccloud.', 'r.volumetricrendertarget.'] },
    { id: 'post', title: 'Post Processing, Reflections & Anti-Aliasing', patterns: ['r.tsr.', 'r.temporalaa', 'r.ssr.', 'r.ssgi.', 'r.ssgi', 'r.ambientocclusion', 'r.gtao.', 'r.reflections.', 'r.sss.', 'r.bloom.', 'r.motionblur', 'r.scenecolorfringe', 'r.filmgrain', 'r.tonemapper.', 'r.postprocess', 'r.diffuseindirect.denoiser'] },
    { id: 'upscaling', title: 'Upscaling & Frame Generation', patterns: ['r.ngx.', 'r.xess.', 'r.streamline.', 't.streamline.', 'r.fidelityfx.', 'r.nis.'] },
    { id: 'nanite', title: 'Nanite, Geometry & Mesh Processing', patterns: ['r.nanite.', 'r.geometrycollection.', 'r.gpuskin.', 'r.meshdrawcommands.', 'r.meshstreaming', 'r.skeletalmesh', 'r.staticmesh', 'skeletalmesh.', 'landscape.rendernanite'] },
    { id: 'streaming', title: 'Streaming, Virtual Textures & HLOD', patterns: ['r.streaming.', 'r.texturestreaming', 'r.virtualtextures', 'r.vt.', 's.', 'pakcache.', 'wp.', 'r.hlod.', 'r.lod', 'r.mipmap', 'r.meshstreaming', 'r.texturestreaming.'] },
    { id: 'foliage', title: 'Landscape, Foliage & Grass', patterns: ['grass.', 'foliage.', 'r.landscape', 'landscape.'] },
    { id: 'd3d12', title: 'D3D12, RHI & Render Graph', patterns: ['d3d12.', 'r.d3d12.', 'r.d3d.', 'r.rhi', 'r.rhicmd', 'r.rdg.', 'r.renderthread', 'r.gtsynctype', 'r.graphicsthread', 'r.rendertarget', 'rhi.'] },
    { id: 'threading', title: 'Threading, Task Graph & Async Work', patterns: ['taskgraph.', 'async.', 'tick.', 'useallcores', 'workerthreadpriority', 'r.parallel', 'a.parallel', 'ai.allowparallel', 'p.async', 'fx.allowasync', 'benablemulticorerendering', 'ballowmultithreaded'] },
    { id: 'shaders', title: 'Shaders, PSO & Compilation', patterns: ['r.shader', 'r.pso', 'shadercompiler', 'ballowshader', 'basyncshader', 'numunusedshadercompilingthreads', 'maxshaderjobs', 'maxshaderjobbatchsize', 'niagara.createshadersonload'] },
    { id: 'audiofx', title: 'Audio, Niagara & Effects', patterns: ['au.', 'audiothread.', 'fx.', 'fx.', 'platformformat', 'platformstreamingformat'] },
    { id: 'logging', title: 'Logging, Debug & Telemetry', patterns: ['log', 'csv.', 'pixwinplugin', 'renderdocplugin', 'r.gpucrash', 'r.dumpgpu', 'r.shaderdrawdebug', 'memory.', 'timermanager.', 'benabletelemetry', 'fathydracrashhandler', 'logcrash'] },
    { id: 'input', title: 'Input, UI & Interaction', patterns: ['brawmouseinput', 'rawmouseinputenabled', 'bdisablemouseacceleration', 'benablemousesmoothing', 'bviewaccelerationenabled'] },
    { id: 'misc', title: 'Engine & Miscellaneous', patterns: [] }
  ];

  function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function isSectionLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('[') && trimmed.endsWith(']');
  }

  function isCommentLine(line) {
    return /^\s*[;#]/.test(line);
  }

  function parseSettingLine(line) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([+\-\.!]?)([^=]+?)(?:\s*=\s*(.*))?$/);

    if (!match) {
      return null;
    }

    const key = match[2].trim();

    if (!key) {
      return null;
    }

    return {
      operator: match[1] || '',
      key,
      normalizedKey: normalizeText(key),
      value: typeof match[3] === 'string' ? match[3] : ''
    };
  }

  function getConsoleVariableCategory(key) {
    const normalizedKey = normalizeText(key);
    const category = CATEGORY_DEFINITIONS.find((item) => item.patterns.some((pattern) => normalizedKey.startsWith(pattern)));
    return category || CATEGORY_DEFINITIONS[CATEGORY_DEFINITIONS.length - 1];
  }

  function pushUniqueBlankLine(lines) {
    if (lines.length === 0 || lines[lines.length - 1] === '') {
      return;
    }

    lines.push('');
  }

  function organizeConsoleVariablesText(text) {
    const sourceLines = String(text || '').split(/\r?\n/);
    const output = [];
    const categorySummary = [];
    let index = 0;

    while (index < sourceLines.length) {
      const line = sourceLines[index];

      if (line.trim() !== '[ConsoleVariables]') {
        output.push(line);
        index += 1;
        continue;
      }

      output.push(line);
      index += 1;

      const buckets = new Map();
      const looseLines = [];

      while (index < sourceLines.length && !isSectionLine(sourceLines[index])) {
        const currentLine = sourceLines[index];
        const trimmed = currentLine.trim();

        if (trimmed === '') {
          index += 1;
          continue;
        }

        if (isCommentLine(currentLine)) {
          looseLines.push(currentLine);
          index += 1;
          continue;
        }

        const parsed = parseSettingLine(currentLine);

        if (!parsed) {
          looseLines.push(currentLine);
          index += 1;
          continue;
        }

        const category = getConsoleVariableCategory(parsed.key);

        if (!buckets.has(category.id)) {
          buckets.set(category.id, {
            title: category.title,
            entries: []
          });
        }

        buckets.get(category.id).entries.push(currentLine.trim());
        index += 1;
      }

      const orderedBuckets = CATEGORY_DEFINITIONS
        .map((category) => ({
          id: category.id,
          title: category.title,
          entries: buckets.get(category.id)?.entries || []
        }))
        .filter((bucket) => bucket.entries.length > 0);

      if (orderedBuckets.length > 0) {
        pushUniqueBlankLine(output);
      }

      orderedBuckets.forEach((bucket, bucketIndex) => {
        output.push(`; ${bucket.title}`);
        bucket.entries.forEach((entry) => output.push(entry));
        categorySummary.push({
          id: bucket.id,
          title: bucket.title,
          count: bucket.entries.length
        });

        if (bucketIndex < orderedBuckets.length - 1 || looseLines.length > 0) {
          pushUniqueBlankLine(output);
        }
      });

      if (looseLines.length > 0) {
        output.push('; Notes & Unclassified');
        looseLines.forEach((entry) => output.push(entry));
      }
    }

    return {
      text: output.join('\r\n'),
      categorySummary
    };
  }

  return {
    getConsoleVariableCategory,
    organizeConsoleVariablesText
  };
});
