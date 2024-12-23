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

let pithHistory = new Uint8Array(256);
let pithPointer = 0;

let playing = false;

main();
update();

async function main() {
  graphics.width = graphics.clientWidth;
  graphics.height = graphics.clientHeight;

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  listAudioDevices();

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: 0 ? { exact: 0 } : undefined }
  });
}

function connect() {
  audioContext = new AudioContext();
  console.log(audioContext.sampleRate);

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
  analyser.smoothingTimeConstant = 0.7;
  
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

addEventListener('resize', () => {
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
  analyser.getByteFrequencyData(dataArray);

  // Data
  const pitch = detectPitch(dataArray, audioContext.sampleRate);
  const formants = detectFormants(dataArray, audioContext.sampleRate);
  const resonances = detectResonance(dataArray, audioContext.sampleRate);

  pithHistory[pithPointer] = pitch;
  pithPointer++;
  if (pithPointer > pithHistory.length) pithPointer -= pithHistory.length;

  drawGraph(pitch, formants, resonances);
}

function drawGraph(f0, formants, resonances) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

  const xScale = canvas.width / 2048;
  const yScale = canvas.height / 300;

  // Graph metrics

  canvasCtx.fillStyle = 'pink';
  canvasCtx.fillRect(
    0,
    canvas.height - 255 * yScale,
    canvas.width,
    (canvas.height - 180 * yScale) - (canvas.height - 255 * yScale)
  );

  canvasCtx.fillStyle = 'lightblue';
  canvasCtx.fillRect(
    0,
    canvas.height - 165 * yScale,
    canvas.width,
    (canvas.height - 85 * yScale) - (canvas.height - 165 * yScale)
  );

  canvasCtx.fillStyle = 'whitesmoke';
  canvasCtx.fillRect(
    0,
    canvas.height - 180 * yScale,
    canvas.width,
    (canvas.height - 165 * yScale) - (canvas.height - 180 * yScale)
  );

  canvasCtx.font = "12px serif";
  canvasCtx.lineWidth = 1;
  canvasCtx.fillStyle = 'gray';
  canvasCtx.strokeStyle = 'gray';

  for (var y = 0; y < 300; y += 10) {
    let py = canvas.height - ((y+1) * yScale);
    canvasCtx.fillText(y + "Hz", 5, py);
    canvasCtx.beginPath();
    canvasCtx.moveTo(50, py);
    canvasCtx.lineTo(canvas.width, py);
    canvasCtx.stroke();
  }

  // Ressonance
  canvasCtx.fillStyle = 'blue';
  resonances.forEach(({ frequency, amplitude }) => {
    const x = frequency * xScale;
    const y = canvas.height - amplitude * yScale;
    canvasCtx.fillRect(x - 4, y - 4, 8, 8);
  });

  // Formants
  canvasCtx.fillStyle = 'red';
  formants.forEach(frequency => {
    const x = frequency * xScale;
    const y = canvas.height / 2;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 6, 0, Math.PI * 2);
    canvasCtx.fill();
  });

  // Pitch
  canvasCtx.strokeStyle = 'green';
  canvasCtx.beginPath();

  let x = 0;
  let xstep = canvas.width / pithHistory.length;

  let i = pithPointer+1;
  if (i > pithHistory.length) i -= pithHistory.length;

  let lastWas0 = true;

  while (true) {
    const y = canvas.height - pithHistory[i] * yScale;

    if (pithHistory[i] == 0)
      lastWas0 = true;

    else if (lastWas0 && pithHistory[i] != 0)
    {
      lastWas0 = false;
      canvasCtx.moveTo(x, y);
    }
    else
      canvasCtx.lineTo(x, y);

    i++;
    x += xstep;
    if (i > pithHistory.length) i -= pithHistory.length;
    if (i == pithPointer) break;
  }
  canvasCtx.lineWidth = 4;
  canvasCtx.stroke();

  let g;

  if (f0 < 85 || f0 > 300)
    g = "-";
  else if (f0 < 165)
    g = "Male";
  else
    g = "Female";

    if (g == "-") {
      if (formants[0] < 500 && formants[1] > 1500) g = "Neutral Male";
      if (formants[0] > 500 && formants[1] < 1500) g = "Neutral Female";
    }

  canvasCtx.font = "24px serif";
  canvasCtx.fillStyle = 'black';
  canvasCtx.fillText("gender: " + g, 500, 20);
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
