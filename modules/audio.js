let mediaStream;

// nodes
let audioContext;
let source;
let destination;
let delay;
let biquad;
let gain;
let compressor;
let analyser;
let leave;

// data
let bufferLength;
let dataBuffer;
let lastAnalyzedData;

// variables
let audioDevices;
let deviceId;
let liveOutputDelay = 0;

async function _init(updateAudioDevicesCallback) {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await listAudioDevices();
    updateAudioDevicesCallback(audioDevices);

    await requestMedia();

    _reset();
}

function _reset() {
    disconnect();
    connect();
}

function connect() {
    if (!mediaStream) return;

    audioContext = new AudioContext();
    console.log("audio sample rate: " + audioContext.sampleRate);

    source = audioContext.createMediaStreamSource(mediaStream);
    destination = audioContext.destination;
    delay = audioContext.createDelay(5);
    biquad = audioContext.createBiquadFilter();
    gain = audioContext.createGain();
    compressor = audioContext.createDynamicsCompressor();
    initAnalizer();
    
    // setting up dalay node...
    delay.delayTime.value = liveOutputDelay;

    // setting up biquad filter...
    biquad.type = "bandpass";
    biquad.frequency.value = 175;
    biquad.gain.value = 2;

    // setting up gain filter...
    gain.gain.value = 8;

    // setting up compressor...
    compressor.threshold.value = 40;
    compressor.knee.value = 0;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    setSource();

    connectCompressorNode();
    connectBiquadNode();

    connectDelayNode();

    connectAnalyzer();

    connectGainNode();
    connectOutput();
}

function disconnect() {
    if (!mediaStream) return;

    if (analyser) analyser.disconnect();
    if (source) source.disconnect();
    if (delay) delay.disconnect();
    if (biquad) biquad.disconnect();
    if (audioContext) audioContext.close();
}

function setSource() { leave = source; console.log("Source setted"); }
function connectBiquadNode() { leave.connect(biquad); leave = biquad; console.log("Biquad connected"); }
function connectGainNode() { leave.connect(gain); leave = gain; console.log("Gain connected"); }
function connectCompressorNode() { leave.connect(compressor); leave = compressor; console.log("Compressor connected"); }
function connectDelayNode() { leave.connect(delay); leave = delay; console.log("Delay connected"); }
function connectAnalyzer() { leave.connect(analyser); console.log("Analyser connected"); }
function connectOutput() { leave.connect(destination); console.log("Output connected"); }

function initAnalizer() {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;

    bufferLength = analyser.frequencyBinCount;
    dataBuffer = new Uint8Array(bufferLength);
}

function _selectAudioDevice(id) {
    if (!mediaStream) return;

    deviceId = id;
    _reset();
}

function _update() {
    
    analyser.getByteFrequencyData(dataBuffer);

    let formants = detectFormants();
    let pitch = detectPitch();

    lastAnalyzedData = {
        timestamp: audioContext.currentTime,
        formants: formants,
        pitch: pitch
    };
    
}

function detectFormants(threshold = 50) {
    const formants = [];

    for (let i = 1; i < dataBuffer.length - 1; i++) {
        if (
            dataBuffer[i] > threshold &&
            dataBuffer[i] > dataBuffer[i - 1] &&
            dataBuffer[i] > dataBuffer[i + 1]
        ) {
            const frequency = (i * analyser.context.sampleRate) / analyser.fftSize;
            formants.push(frequency);
        }
    }

    return formants;

}
function detectPitch() {
    const threshold = 128;

    for (let i = 1; i < dataBuffer.length - 1; i++) {
      if (
        dataBuffer[i] > threshold &&
        dataBuffer[i] > dataBuffer[i - 1] &&
        dataBuffer[i] > dataBuffer[i + 1]
      ) {
        return (i * audioContext.sampleRate) / analyser.fftSize;
      }
    }
    return 0;
}


async function requestMedia() {
    console.log(deviceId);
    mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            sampleRate: 88200,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    }).catch((e) => console.error("Error:\n", e));
}

async function listAudioDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    audioDevices = [];

    audioInputs.forEach(device => {

        const option = {
            id: device.deviceId,
            name: device.label || `Microfone ${audioDevices.length + 1}`
        }
        audioDevices.push(option);

    });

    deviceId = audioDevices[0].id;
}

export const audio = {
    init: _init,
    selectAudioDevice: _selectAudioDevice,
    reset: _reset,
    update: _update,

    get analysedData() { return lastAnalyzedData }
};
