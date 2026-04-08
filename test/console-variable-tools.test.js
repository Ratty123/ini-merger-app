const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getConsoleVariableCategory,
  organizeConsoleVariablesText
} = require('../src/core/console-variable-tools');

test('getConsoleVariableCategory classifies common Unreal console variable prefixes', () => {
  assert.equal(getConsoleVariableCategory('r.Lumen.ScreenProbeGather.DownsampleFactor').id, 'lumen');
  assert.equal(getConsoleVariableCategory('r.Shadow.Virtual.SMRT.SamplesPerRayDirectional').id, 'shadows');
  assert.equal(getConsoleVariableCategory('D3D12.MaximumFrameLatency').id, 'd3d12');
  assert.equal(getConsoleVariableCategory('s.AsyncLoadingTimeLimit').id, 'streaming');
  assert.equal(getConsoleVariableCategory('LogRenderer').id, 'logging');
});

test('organizeConsoleVariablesText groups ConsoleVariables with category headers and preserves other sections', () => {
  const input = [
    '[ConsoleVariables]',
    'r.Lumen.ScreenProbeGather.DownsampleFactor=36',
    'r.Shadow.Virtual.SMRT.SamplesPerRayDirectional=4',
    'D3D12.MaximumFrameLatency=1',
    'r.Streaming.PoolSize=6144',
    '',
    '[/Script/Engine.Engine]',
    'bSmoothFrameRate=0'
  ].join('\r\n');

  const result = organizeConsoleVariablesText(input);

  assert.match(result.text, /\[ConsoleVariables\]/);
  assert.match(result.text, /; Lumen & Global Illumination/);
  assert.match(result.text, /; Shadows & Virtual Shadow Maps/);
  assert.match(result.text, /; D3D12, RHI & Render Graph/);
  assert.match(result.text, /; Streaming, Virtual Textures & HLOD/);
  assert.match(result.text, /\[\/Script\/Engine\.Engine\]/);
  assert.match(result.text, /bSmoothFrameRate=0/);
  assert.equal(result.categorySummary.length >= 4, true);
});
