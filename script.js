import { graph } from "./modules/graph.js";
import { audio } from "./modules/audio.js";

const ecchoButton = document.getElementById('toggleEccho');
const audioInputSelect = document.getElementById('audioInput');
const audioDelayInput = document.getElementById('audioDelay');

let history = [];

main();

async function main() {

    graph.init(document.getElementById('graphics'));
    await audio.init(listAudioDevices);

    window.requestAnimationFrame(update);
}

function update(timestamp) {

    audio.update();

    var data = audio.analysedData;
    history.push(data);

    graph.incrementData(data);

    graph.update(audio.analysedData.timestamp);

    window.requestAnimationFrame(update);
}

function listAudioDevices(audioDevices) {
    while(audioInputSelect.childElementCount > 0)
        audioInputSelect.removeChild(audioInputSelect.firstChild);

    for (let i of audioDevices)
    {
        const option = document.createElement('option');
        option.value = i.id;
        option.textContent = i.name;
        audioInputSelect.appendChild(option);
    }
}
