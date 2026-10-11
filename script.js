let isTesting = false;
let isAutoRunning = false;
let autoInterval = null;

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
        // 1. วัดค่า Ping และ Jitter โดยใช้ไฟล์ภาพขนาดเล็ก (รองรับ CORS เต็มรูปแบบ)
        statusBadge.innerText = "กำลังวัดค่า Ping และ Jitter...";
        let pings = [];
        for (let i = 0; i < 4; i++) {
            let start = performance.now();
            await fetch('https://upload.wikimedia.org/wikipedia/commons/3/3f/Placeholder_view_vector.svg?' + Math.random(), { cache: 'no-store' });
            let end = performance.now();
            pings.push(end - start);
            await new Promise(r => setTimeout(r, 60));
        }

        let avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
        let jitterSum = 0;
        for (let i = 0; i < pings.length - 1; i++) {
            jitterSum += Math.abs(pings[i + 1] - pings[i]);
        }
        let jitter = Math.round(jitterSum / (pings.length - 1));

        resPing.innerText = avgPing + " ms";
        resJitter.innerText = jitter + " ms";

        // 2. วัดความเร็วดาวน์โหลด (Download Speed) แบบเรียลไทม์
        statusBadge.innerText = "กำลังทดสอบความเร็วดาวน์โหลด...";
        mainUnit.innerText = "Mbps Download";

        // ใช้ไฟล์จาก jsDelivr CDN ขนาดกำลังพอดีเพื่อทดสอบความเร็วจริง
        let downloadUrl = 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js?' + Math.random();
        let startTime = performance.now();
        
        const response = await fetch(downloadUrl, { cache: 'no-store' });
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

        // 3. วัดความเร็วอัปโหลด (Upload Speed) 
        statusBadge.innerText = "กำลังทดสอบความเร็วอัปโหลด...";
        mainUnit.innerText = "Mbps Upload";

        let uploadDataSize = 256 * 1024; // 256 KB ข้อมูลจำลองสำหรับอัปโหลดผ่าน HTTP PUT/POST ไปยัง Echo Server สาธารณะ
        let dummyData = new Uint8Array(uploadDataSize);
        for (let i = 0; i < dummyData.length; i++) {
            dummyData[i] = Math.floor(Math.random() * 256);
        }

        let uploadStart = performance.now();
        // ใช้ HttpBin POST ทดสอบรับส่งข้อมูลอัปโหลดจริง
        await fetch('https://httpbin.org/post', {
            method: 'POST',
            body: dummyData,
            cache: 'no-store'
        });
        let uploadEnd = performance.now();

        let uploadDurationSec = (uploadEnd - uploadStart) / 1000;
        if (uploadDurationSec <= 0) uploadDurationSec = 0.05;
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

        // 4. สรุปผลการทดสอบ
        statusBadge.innerText = "ทดสอบเสร็จสิ้นสมบูรณ์";
        summaryContent.innerHTML = `
            • ความเร็วดาวน์โหลด: <b>${finalDownloadMbps} Mbps</b><br>
            • ความเร็วอัปโหลด: <b>${finalUploadMbps} Mbps</b><br>
            • ค่า Ping: <b>${avgPing} ms</b> | Jitter: <b>${jitter} ms</b>
        `;
        summaryBox.classList.remove('hidden');

    } catch (error) {
        statusBadge.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อ";
        errorBox.innerText = "⚠️ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ทดสอบได้: " + error.message;
        errorBox.classList.remove('hidden');
        console.error("SpeedTest Error:", error);
    } finally {
        isTesting = false;
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}
