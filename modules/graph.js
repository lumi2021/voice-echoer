var max_time = 5;

var max_frequency = 400;
var min_frequency = 50;

var canvas;
var ctx;

let graphData = [];

var time = 0;

const graphScale = {
    get x() { return canvas.width / (max_time); },
    get y() { return canvas.height / (max_frequency - min_frequency); }
}

function _init(canvasRef) {

    canvas = canvasRef;
    ctx = canvas.getContext("2d");

    window.addEventListener('resize', _updateCanvas);
    _updateCanvas();

    console.log("Graph view initialised");

}

function _update(timestamp) {
    time = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    _drawBase();
    _drawData();
}

function _incrementData(data) {
    graphData.push(data);
    _clearHistory();
}

function _drawBase() {

    // Gender ranges
    ctx.fillStyle = 'pink';
    ctx.fillRect(0, f2p(255), canvas.width, f2p(180) - f2p(255));

    ctx.fillStyle = 'lightblue';
    ctx.fillRect(0, f2p(165), canvas.width, f2p(85) - f2p(165));

    ctx.fillStyle = 'whitesmoke';
    ctx.fillRect(0, f2p(180), canvas.width, f2p(165) - f2p(180));

    // Graph metrics
    ctx.font = "12px serif";
    ctx.lineWidth = 1;
    ctx.fillStyle = 'gray';
    ctx.strokeStyle = 'gray';
    ctx.beginPath();

    var step = Math.max(1, Math.round((max_frequency - min_frequency) / (canvas.height / 30)));
    for (var y = min_frequency; y < max_frequency; y += step) {

        let py = f2p(y);
        ctx.fillText(y + "Hz", 5, py);
        ctx.beginPath();
        ctx.moveTo(50, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
    }
    
}

function _drawData() {
    
    ctx.lineWidth = 5;
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'green';

    let isInLine = false;

    ctx.beginPath();
    let averageRange = 1;
    for (var x = graphData.length-averageRange-1; x > 0 ; x -= averageRange)
    {
        let data = graphData.slice(x, x+averageRange);

        if (!data[0] || data[0].timestamp < time - max_time) break;

        let average = 0;
        for (var i of data) average += (i ? i.pitch : 0);
        average /= averageRange;
        
        let px = t2p(data[Math.ceil(averageRange/2)-1].timestamp);
        let py = f2p(average);

        if (average > min_frequency && average < max_frequency) {

            if (isInLine) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);

            isInLine = true;

        } else isInLine = false;
    }

    ctx.stroke();

}

function _updateCanvas() {

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

}

function _clearHistory() {
    while(graphData[0].timestamp < time - max_time) graphData.shift();
}


// frequency to pixels
function f2p(frequency) { return canvas.height - ((frequency - min_frequency) * graphScale.y); }
// pixels to frequency
function p2f(pixels) { return ((canvas.height - pixels) / graphScale.y) + min_frequency; }

// time to pixels
function t2p(t) { return canvas.width - ((time - t) * graphScale.x) }

export const graph = {
    init: _init,
    update: _update,
    incrementData: _incrementData
};
