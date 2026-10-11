'use strict';

// Cloudflare Speed Test public endpoints. Results depend on connection and service availability.
const TEST_BASE = 'https://speed.cloudflare.com';
const $ = (id) => document.getElementById(id);
const startButton = $('start-button');
const speedNumber = $('speed-number');
const phaseLabel = $('phase-label');
const statusMessage = $('status-message');
const progressBar = $('progress-bar');
const downloadResult = $('download-result');
const uploadResult = $('upload-result');
const pingResult = $('ping-result');
const jitterResult = $('jitter-result');
let running = false;

function setStatus(phase, message, progress) {
  phaseLabel.textContent = phase;
  statusMessage.textContent = message;
  progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function showSpeed(value) {
  speedNumber.textContent = Number.isFinite(value) ? (value >= 100 ? value.toFixed(0) : value.toFixed(1)) : '—';
}

function formatMetric(value) {
  return Number.isFinite(value) ? (value >= 100 ? value.toFixed(0) : value.toFixed(1)) : '—';
}

function cacheBuster() {
  return `t=${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function measurePing(samples = 8) {
  const times = [];
  for (let i = 0; i < samples; i++) {
    const started = performance.now();
    const response = await fetch(`${TEST_BASE}/__ping?${cacheBuster()}`, {
      cache: 'no-store',
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`Ping test failed (${response.status})`);
    await response.arrayBuffer();
    times.push(performance.now() - started);
  }
  const mean = times.reduce((sum, n) => sum + n, 0) / times.length;
  const differences = times.slice(1).map((n, i) => Math.abs(n - times[i]));
  const jitter = differences.length ? differences.reduce((sum, n) => sum + n, 0) / differences.length : 0;
  return { ping: mean, jitter };
}

async function measureDownload(durationMs = 8000) {
  const started = performance.now();
  let bytes = 0;
  let latestMbps = 0;
  let requestSize = 1_000_000;
  while (performance.now() - started < durationMs) {
    const response = await fetch(`${TEST_BASE}/__down?bytes=${requestSize}&${cacheBuster()}`, {
      cache: 'no-store',
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`Download test failed (${response.status})`);
    const data = await response.arrayBuffer();
    bytes += data.byteLength;
    const elapsed = (performance.now() - started) / 1000;
    latestMbps = (bytes * 8) / elapsed / 1_000_000;
    showSpeed(latestMbps);
    setStatus('กำลังวัด Download', `รับข้อมูลแล้ว ${(bytes / 1_000_000).toFixed(1)} MB`, 25 + Math.min(45, (elapsed / (durationMs / 1000)) * 45));
    if (performance.now() - started > 1800) requestSize = 5_000_000;
  }
  const elapsed = (performance.now() - started) / 1000;
  return (bytes * 8) / elapsed / 1_000_000;
}

async function measureUpload(durationMs = 5000) {
  const started = performance.now();
  let bytes = 0;
  let latestMbps = 0;
  const payload = new Uint8Array(1_000_000);
  while (performance.now() - started < durationMs) {
    const response = await fetch(`${TEST_BASE}/__up?${cacheBuster()}`, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/octet-stream' },
      cache: 'no-store',
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`Upload test failed (${response.status})`);
    await response.arrayBuffer();
    bytes += payload.byteLength;
    const elapsed = (performance.now() - started) / 1000;
    latestMbps = (bytes * 8) / elapsed / 1_000_000;
    setStatus('กำลังวัด Upload', `ส่งข้อมูลแล้ว ${(bytes / 1_000_000).toFixed(1)} MB`, 70 + Math.min(25, (elapsed / (durationMs / 1000)) * 25));
  }
  const elapsed = (performance.now() - started) / 1000;
  return (bytes * 8) / elapsed / 1_000_000;
}

async function runTest() {
  if (running) return;
  running = true;
  startButton.disabled = true;
  startButton.textContent = 'กำลังทดสอบ…';
  speedNumber.textContent = '—';
  downloadResult.textContent = '—';
  uploadResult.textContent = '—';
  pingResult.textContent = '—';
  jitterResult.textContent = '—';
  progressBar.style.width = '0%';

  try {
    setStatus('กำลังตรวจสอบ Ping', 'กำลังส่งคำขอทดสอบไปยังเซิร์ฟเวอร์', 5);
    const latency = await measurePing();
    pingResult.textContent = formatMetric(latency.ping);
    jitterResult.textContent = formatMetric(latency.jitter);
    setStatus('กำลังเตรียมทดสอบ', 'เชื่อมต่อเซิร์ฟเวอร์สำเร็จ', 20);

    const down = await measureDownload();
    downloadResult.textContent = formatMetric(down);
    showSpeed(down);

    const up = await measureUpload();
    uploadResult.textContent = formatMetric(up);
    showSpeed(down);
    setStatus('ทดสอบเสร็จแล้ว', 'วัดความเร็วเสร็จเรียบร้อยแล้ว', 100);
    statusMessage.textContent = 'ทดสอบเสร็จแล้ว · กดปุ่มด้านล่างเพื่อทดสอบอีกครั้ง';
  } catch (error) {
    console.error('Speed test error:', error);
    setStatus('ทดสอบไม่สำเร็จ', 'เชื่อมต่อเซิร์ฟเวอร์ทดสอบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่', 0);
    if (speedNumber.textContent === '—') showSpeed(NaN);
  } finally {
    running = false;
    startButton.disabled = false;
    startButton.textContent = 'ทดสอบอีกครั้ง';
  }
}

startButton.addEventListener('click', runTest);
