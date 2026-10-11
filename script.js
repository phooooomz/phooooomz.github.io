'use strict';

// Cloudflare Speed Test public endpoints. Measurements depend on network and service availability.
const TEST_BASE = 'https://speed.cloudflare.com';
const $ = (id) => document.getElementById(id);
const startButton = $('start-button');
const speedNumber = $('speed-number');
const speedUnit = $('speed-unit');
const phaseLabel = $('phase-label');
const statusMessage = $('status-message');
const progressBar = $('progress-bar');
const downloadResult = $('download-result');
const uploadResult = $('upload-result');
const pingResult = $('ping-result');
const jitterResult = $('jitter-result');
let running = false;

function setStatus(phase, message, progress) {
  if (phaseLabel) phaseLabel.textContent = phase;
  statusMessage.textContent = message;
  progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}

function showSpeed(mbps) {
  if (!Number.isFinite(mbps) || mbps < 0) {
    speedNumber.textContent = '—';
    speedUnit.textContent = 'Mbps';
    return;
  }
  // Display sub-1 Mbps readings as Kbps, then switch to Mbps at the measured threshold.
  if (mbps < 1) {
    const kbps = mbps * 1000;
    speedNumber.textContent = kbps >= 100 ? kbps.toFixed(0) : kbps.toFixed(1);
    speedUnit.textContent = 'Kbps';
  } else {
    speedNumber.textContent = mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1);
    speedUnit.textContent = 'Mbps';
  }
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
    const response = await fetch(`${TEST_BASE}/__down?bytes=0&${cacheBuster()}`, {
      method: 'HEAD', cache: 'no-store', mode: 'cors'
    });
    if (!response.ok) throw new Error(`Ping test failed (${response.status})`);
    times.push(performance.now() - started);
  }
  const mean = times.reduce((sum, n) => sum + n, 0) / times.length;
  const differences = times.slice(1).map((n, i) => Math.abs(n - times[i]));
  const jitter = differences.length ? differences.reduce((sum, n) => sum + n, 0) / differences.length : 0;
  return { ping: mean, jitter };
}

async function measureDownload(durationMs = 7000) {
  const start = performance.now();
  const stopAt = start + durationMs;
  let bytesSinceSample = 0;
  let totalBytes = 0;
  let sampleStart = performance.now();
  let smoothedMbps = 0;
  let firstSample = true;
  let workersDone = 0;
  let workerError = null;
  const controller = new AbortController();
  const concurrency = 3;
  const chunkBytes = 2_000_000;

  async function worker() {
    try {
      while (performance.now() < stopAt && !controller.signal.aborted) {
        const response = await fetch(`${TEST_BASE}/__down?bytes=${chunkBytes}&${cacheBuster()}`, {
          cache: 'no-store', mode: 'cors', signal: controller.signal
        });
        if (!response.ok) throw new Error(`Download test failed (${response.status})`);
        if (!response.body) {
          const data = await response.arrayBuffer();
          bytesSinceSample += data.byteLength;
          totalBytes += data.byteLength;
          continue;
        }
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesSinceSample += value.byteLength;
          totalBytes += value.byteLength;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && !workerError) workerError = error;
    } finally {
      workersDone++;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  // Sample throughput in short windows instead of averaging from the first byte.
  // This avoids a misleading initial spike dominating the displayed speed.
  while (performance.now() < stopAt && !workerError) {
    await new Promise(resolve => setTimeout(resolve, 350));
    const now = performance.now();
    const elapsed = (now - sampleStart) / 1000;
    if (elapsed >= 0.25) {
      const instantMbps = (bytesSinceSample * 8) / elapsed / 1_000_000;
      // Smooth the real rolling measurements slightly to reduce flicker, without adding fake values.
      smoothedMbps = firstSample ? instantMbps : (smoothedMbps * 0.35 + instantMbps * 0.65);
      firstSample = false;
      showSpeed(smoothedMbps);
      setStatus('กำลังวัด Download', `รับข้อมูลแล้ว ${(totalBytes / 1_000_000).toFixed(1)} MB`, 20 + Math.min(50, ((now - start) / durationMs) * 50));
      bytesSinceSample = 0;
      sampleStart = now;
    }
  }

  controller.abort();
  await Promise.all(workers);
  if (workerError) throw workerError;
  const elapsed = (performance.now() - start) / 1000;
  if (!totalBytes || elapsed <= 0) throw new Error('เซิร์ฟเวอร์ไม่ส่งข้อมูลทดสอบกลับมา');
  return { speed: (totalBytes * 8) / elapsed / 1_000_000, elapsed, bytes: totalBytes };
}

async function measureUpload(durationMs = 4500) {
  const started = performance.now();
  let bytes = 0;
  const payload = new Uint8Array(1_000_000);
  while (performance.now() - started < durationMs) {
    const response = await fetch(`${TEST_BASE}/__up?${cacheBuster()}`, {
      method: 'POST', body: payload,
      headers: { 'Content-Type': 'application/octet-stream' },
      cache: 'no-store', mode: 'cors'
    });
    if (!response.ok) throw new Error(`Upload test failed (${response.status})`);
    await response.arrayBuffer();
    bytes += payload.byteLength;
    const elapsed = (performance.now() - started) / 1000;
    setStatus('กำลังวัด Upload', `ส่งข้อมูลแล้ว ${(bytes / 1_000_000).toFixed(1)} MB`, 70 + Math.min(25, (elapsed / (durationMs / 1000)) * 25));
  }
  const elapsed = (performance.now() - started) / 1000;
  return { speed: (bytes * 8) / elapsed / 1_000_000, elapsed, bytes };
}

async function runTest() {
  if (running) return;
  running = true;
  startButton.disabled = true;
  startButton.textContent = 'กำลังทดสอบ…';
  showSpeed(0);
  downloadResult.textContent = '—';
  uploadResult.textContent = '—';
  pingResult.textContent = '—';
  jitterResult.textContent = '—';
  progressBar.style.width = '0%';

  try {
    setStatus('กำลังวัด Download', 'กำลังรับข้อมูลเพื่อวัดความเร็วอินเทอร์เน็ต', 5);
    const down = await measureDownload();
    downloadResult.textContent = formatMetric(down.speed);
    showSpeed(down.speed);
    setStatus('รับข้อมูลเสร็จแล้ว', `ใช้เวลา ${down.elapsed.toFixed(2)} วินาที · รับข้อมูล ${(down.bytes / 1_000_000).toFixed(1)} MB`, 55);

    setStatus('กำลังวัด Upload', 'กำลังส่งข้อมูลไปยังเซิร์ฟเวอร์ทดสอบ', 60);
    const up = await measureUpload();
    uploadResult.textContent = formatMetric(up.speed);
    setStatus('ส่งข้อมูลเสร็จแล้ว', `ใช้เวลา ${up.elapsed.toFixed(2)} วินาที · ส่งข้อมูล ${(up.bytes / 1_000_000).toFixed(1)} MB`, 80);

    setStatus('กำลังวัด Ping และ Jitter', 'กำลังวัดเวลาในการตอบสนองหลายครั้ง', 85);
    const latency = await measurePing();
    pingResult.textContent = formatMetric(latency.ping);
    jitterResult.textContent = formatMetric(latency.jitter);

    showSpeed(down.speed);
    setStatus('ทดสอบเสร็จแล้ว', 'วัด Download, Upload, Ping และ Jitter เสร็จเรียบร้อย', 100);
    statusMessage.textContent = 'ทดสอบเสร็จแล้ว · กดปุ่มด้านล่างเพื่อทดสอบอีกครั้ง';
  } catch (error) {
    console.error('Speed test error:', error);
    const detail = error && error.message ? error.message : String(error);
    setStatus('ทดสอบไม่สำเร็จ', `เชื่อมต่อเซิร์ฟเวอร์ทดสอบไม่ได้ (${detail}) ลองปิด VPN/ตัวบล็อกโฆษณา หรือเปลี่ยนเครือข่ายแล้วทดสอบใหม่`, 0);
    if (speedNumber.textContent === '—') showSpeed(NaN);
  } finally {
    running = false;
    startButton.disabled = false;
    startButton.textContent = 'ทดสอบอีกครั้ง';
  }
}

startButton.addEventListener('click', runTest);
