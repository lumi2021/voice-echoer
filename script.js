const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const audioInputSelect = document.getElementById('audioInput');
const audioDelayInput = document.getElementById('audioDelay');
const canvas = document.getElementById('graphics');
const canvasCtx = graphics.getContext('2d');

let audioContext;
let mediaStream;
let source;
let destination;
let delaynode;

let analyser;
let bufferLength;
let dataArray;

let pithHistory = new Uint8Array(128);
let pithPointer = 0;

let playing = false;

main();
update();

async function main() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  listAudioDevices();

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: 0 ? { exact: 0 } : undefined }
  });
}

function connect() {
  audioContext = new AudioContext();

  source = audioContext.createMediaStreamSource(mediaStream);
  destination = audioContext.destination;
  delaynode = audioContext.createDelay();

  initAnalizer();
  
  delaynode.delayTime.minValue = 0;
  delaynode.delayTime.maxValue = 5;
  delaynode.delayTime.value = parseFloat(audioDelayInput.value) / 10;

  delaynode.connect(destination);
  source.connect(delaynode);
  delaynode.connect(analyser);
}
function disconnect() {
  //if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  if (analyser) analyser.disconnect();
  if (source) source.disconnect();
  if (delaynode) delaynode.disconnect();
  if (audioContext) audioContext.close();
}

function initAnalizer() {
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
}

startButton.addEventListener('click', async () => {
    connect();

    startButton.disabled = true;
    stopButton.disabled = false;
    playing = true;
});

stopButton.addEventListener('click', () => {
    disconnect();

    startButton.disabled = false;
    stopButton.disabled = true;
    playing = false;
});

audioInputSelect.addEventListener('change', async () => {
  if (mediaStream) {
    if (playing) disconnect();
    
    const selectedDeviceId = audioInputSelect.value;
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined }
    });

    if (playing) connect();
  }
});

audioDelayInput.addEventListener('input', () => {
  //delayNode.delayTime.value = parseFloat(audioDelayInput.value) / 5;
  disconnect();
  connect();
});

graphics.addEventListener('resize', () => {
  graphics.width = graphics.clientWidth;
  graphics.height = graphics.clientHeight;
});

async function listAudioDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    while (audioInputSelect.childElementCount > 0)
        audioInputSelect.removeChild(0);

    audioInputs.forEach(device => {

        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microfone ${audioInputSelect.length + 1}`;
        audioInputSelect.appendChild(option);

    });
}

function update() {
  requestAnimationFrame(update);

  if (!playing) return;

  // Data
  const pitch = detectPitch(dataArray, audioContext.sampleRate);
  const formants = detectFormants(dataArray, audioContext.sampleRate);
  const resonances = detectResonance(dataArray, audioContext.sampleRate);

  pithHistory[pithPointer] = pitch;
  pithPointer++;
  if (pithPointer > pithHistory.length) pithPointer -= pithHistory.length;

  drawGraph(formants, resonances);
}

function drawGraph(formants, resonances) {
  analyser.getByteFrequencyData(dataArray);

  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

  const xScale = canvas.width / 2048;
  const yScale = canvas.height / 256;

  console.log(audioContext.sampleRate);

  // Ressonance
  canvasCtx.fillStyle = 'blue';
  resonances.forEach(({ frequency, amplitude }) => {
    const x = frequency * xScale;
    const y = canvas.height - amplitude * yScale;
    canvasCtx.fillRect(x - 2, y - 2, 4, 4);
  });

  // Formants
  canvasCtx.fillStyle = 'red';
  formants.forEach(frequency => {
    const x = frequency * xScale;
    const y = canvas.height / 2;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 3, 0, Math.PI * 2);
    canvasCtx.fill();
  });

  // Pitch
    
  canvasCtx.strokeStyle = 'green';
  canvasCtx.beginPath();

  let x = 0;
  let xstep = canvas.width / pithHistory.length;

  let i = pithPointer+1;
  if (i > pithHistory.length) i -= pithHistory.length;

  canvasCtx.moveTo(0, canvas.height - pithHistory[i] * xScale);
  while (true) {

    const y = canvas.height - pithHistory[i] * yScale;

    canvasCtx.lineTo(x, y);

    i++;
    x += xstep;
    if (i > pithHistory.length) i -= pithHistory.length;
    if (i == pithPointer) break;
  }

  canvasCtx.stroke();
}

function detectPitch(frequencyData, sampleRate) {
  const threshold = 128;
  for (let i = 1; i < frequencyData.length - 1; i++) {
    if (
      frequencyData[i] > threshold &&
      frequencyData[i] > frequencyData[i - 1] &&
      frequencyData[i] > frequencyData[i + 1]
    ) {
      return (i * sampleRate) / analyser.fftSize;
    }
  }
  return 0;
}
function detectFormants(frequencyData, sampleRate) {
  const threshold = 128;
  const formants = [];
  for (let i = 1; i < frequencyData.length - 1; i++) {
    if (
      frequencyData[i] > threshold &&
      frequencyData[i] > frequencyData[i - 1] &&
      frequencyData[i] > frequencyData[i + 1]
    ) {
      const frequency = (i * sampleRate) / analyser.fftSize;
      formants.push(frequency);
    }
  }
  return formants.slice(0, 3);
}
function detectResonance(frequencyData, sampleRate) {
  const threshold = 128;
  const peaks = [];

  for (let i = 1; i < frequencyData.length - 1; i++) {
    if (
      frequencyData[i] > threshold &&
      frequencyData[i] > frequencyData[i - 1] &&
      frequencyData[i] > frequencyData[i + 1]
    ) {
      const frequency = (i * sampleRate) / analyser.fftSize;
      peaks.push({ frequency, amplitude: frequencyData[i] });
    }
  }

  return peaks;
}
