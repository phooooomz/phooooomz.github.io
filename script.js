let isTesting = false;
let isAutoRunning = false;
let autoInterval = null;

// ใช้เซิร์ฟเวอร์หลักที่เสถียรและรองรับ CORS / No-CORS สมบูรณ์
const testServerUrl = 'https://www.cloudflare.com/cdn-cgi/trace';

function toggleAutoTest() {
    isAutoRunning = !isAutoRunning;
    const autoBtn = document.getElementById('auto-btn');
    if (isAutoRunning) {
        autoBtn.innerText = "⏹ ปิดทดสอบซ้ำอัตโนมัติ";
        autoBtn.classList.add('bg-blue-900/40', 'border-blue-500/50');
        if (!isTesting) startSpeedTest();
        autoInterval = setInterval(() => {
            if (!isTesting) startSpeedTest();
        }, 15000);
    } else {
        autoBtn.innerText = "🔄 ทดสอบซ้ำอัตโนมัติ (ปิด)";
        autoBtn.classList.remove('bg-blue-900/40', 'border-blue-500/50');
        clearInterval(autoInterval);
    }
}

async function startSpeedTest() {
    if (isTesting) return;
    isTesting = true;

    const startBtn = document.getElementById('start-btn');
    const statusBadge = document.getElementById('status-badge');
    const mainSpeed = document.getElementById('main-speed');
    const mainUnit = document.getElementById('main-unit');
    const resPing = document.getElementById('res-ping');
    const resJitter = document.getElementById('res-jitter');
    const resDownload = document.getElementById('res-download');
    const resUpload = document.getElementById('res-upload');
    const summaryBox = document.getElementById('summary-box');
    const summaryContent = document.getElementById('summary-content');
    const errorBox = document.getElementById('error-box');

    startBtn.disabled = true;
    startBtn.classList.add('opacity-50', 'cursor-not-allowed');
    summaryBox.classList.add('hidden');
    errorBox.classList.add('hidden');

    resPing.innerText = "- ms";
    resJitter.innerText = "- ms";
    resDownload.innerText = "- Mbps";
    resUpload.innerText = "- Mbps";
    mainSpeed.innerText = "0.00";
    mainUnit.innerText = "Mbps Download";

    try {
        // 1. วัดค่า Ping และ Jitter
        statusBadge.innerText = "กำลังวัดค่า Ping และ Jitter...";
        let pings = [];
        for (let i = 0; i < 5; i++) {
            let start = performance.now();
            await fetch(testServerUrl + "?" + Math.random(), { cache: 'no-store', mode: 'no-cors' });
            let end = performance.now();
            pings.push(end - start);
            await new Promise(r => setTimeout(r, 80));
        }

        let avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
        
        let jitterSum = 0;
        for (let i = 0; i < pings.length - 1; i++) {
            jitterSum += Math.abs(pings[i + 1] - pings[i]);
        }
        let jitter = Math.round(jitterSum / (pings.length - 1));

        resPing.innerText = avgPing + " ms";
        resJitter.innerText = jitter + " ms";

        // 2. วัดความเร็วดาวน์โหลดแบบเรียลไทม์ (Download Speed)
        statusBadge.innerText = "กำลังทดสอบความเร็วดาวน์โหลด...";
        mainUnit.innerText = "Mbps Download";

        let targetUrl = "https://upload.wikimedia.org/wikipedia/commons/3/3f/Placeholder_view_vector.svg?" + Math.random();
        let startTime = performance.now();
        
        const response = await fetch(targetUrl, { cache: 'no-store' });
        const reader = response.body.getReader();
        let receivedLength = 0;

        while(true) {
            let {done, value} = await reader.read();
            if (done) break;
            receivedLength += value.length;
            
            let currentTime = performance.now();
            let durationSoFar = (currentTime - startTime) / 1000;
            if (durationSoFar > 0) {
                let currentBps = (receivedLength * 8) / durationSoFar;
                let currentMbps = currentBps / (1024 * 1024);
                mainSpeed.innerText = currentMbps.toFixed(2);
            }
        }

        let endTime = performance.now();
        let totalDurationSec = (endTime - startTime) / 1000;
        let finalBits = receivedLength * 8;
        let finalBps = finalBits / totalDurationSec;
        let finalDownloadMbps = parseFloat((finalBps / (1024 * 1024)).toFixed(2));

        mainSpeed.innerText = finalDownloadMbps;
        resDownload.innerText = finalDownloadMbps + " Mbps";

        // 3. วัดความเร็วอัปโหลด (Upload Speed) - แก้ไขปัญหาเรื่องข้อจำกัดขนาดของ Crypto โดยใช้ Math.random เติมข้อมูลแทน
        statusBadge.innerText = "กำลังทดสอบความเร็วอัปโหลด...";
        mainUnit.innerText = "Mbps Upload";

        let uploadDataSize = 512 * 1024; // ปรับขนาดให้เหมาะสมและไม่เกินข้อจำกัดของเบราว์เซอร์
        let dummyData = new Uint8Array(uploadDataSize);
        for (let i = 0; i < dummyData.length; i++) {
            dummyData[i] = Math.floor(Math.random() * 256);
        }

        let uploadStart = performance.now();
        await fetch(testServerUrl, {
            method: 'POST',
            body: dummyData,
            mode: 'no-cors',
            cache: 'no-store'
        });
        let uploadEnd = performance.now();

        let uploadDurationSec = (uploadEnd - uploadStart) / 1000;
        if (uploadDurationSec <= 0) uploadDurationSec = 0.05; // ป้องกันหารด้วยศูนย์
        let uploadBits = uploadDataSize * 8;
        let uploadBps = uploadBits / uploadDurationSec;
        let finalUploadMbps = parseFloat((uploadBps / (1024 * 1024)).toFixed(2));

        for (let i = 1; i <= 10; i++) {
            mainSpeed.innerText = (finalUploadMbps * (i / 10)).toFixed(2);
            await new Promise(r => setTimeout(r, 30));
        }
        mainSpeed.innerText = finalUploadMbps;
        resUpload.innerText = finalUploadMbps + " Mbps";
        mainUnit.innerText = "Mbps Download";

        // 4. สรุปผลการทดสอบเมื่อเสร็จสิ้น
        statusBadge.innerText = "ทดสอบเสร็จสิ้นสมบูรณ์";
        summaryContent.innerHTML = `
            • ความเร็วดาวน์โหลด: <b>${finalDownloadMbps} Mbps</b><br>
            • ความเร็วอัปโหลด: <b>${finalUploadMbps} Mbps</b><br>
            • ค่า Ping: <b>${avgPing} ms</b> | Jitter: <b>${jitter} ms</b>
        `;
        summaryBox.classList.remove('hidden');

    } catch (error) {
        statusBadge.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อ";
        errorBox.innerText = "⚠️ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ทดสอบได้ กรุณาตรวจสอบอินเทอร์เน็ตของคุณ: " + error.message;
        errorBox.classList.remove('hidden');
        console.error("SpeedTest Error:", error);
    } finally {
        isTesting = false;
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}
